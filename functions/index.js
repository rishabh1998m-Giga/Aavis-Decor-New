import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();
setGlobalOptions({ region: "asia-south1" });
const db = getFirestore();

const MAX_CUSTOM_CURTAIN_SIZE = 200;

function sanitizeCustomCurtainSize(raw) {
  if (raw == null || typeof raw !== "string") return "";
  const t = raw.trim().slice(0, MAX_CUSTOM_CURTAIN_SIZE);
  return t
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveGstRate(product, categorySlugById) {
  const raw = product?.gst_rate;
  const n = raw != null && raw !== "" ? Number(raw) : NaN;
  if (Number.isFinite(n)) return n;
  const slug = product?.category_id ? categorySlugById.get(String(product.category_id)) : null;
  if (slug === "pillow-covers" || slug === "table-linens") return 5;
  return 18;
}

function isAdmin(token) {
  return token && (token.role === "admin" || token.admin === true);
}

/** Validate discount code. No auth required. */
export const validateDiscount = onCall({ cors: true }, async (request) => {
  const { code, cartTotal } = request.data || {};
  if (!code) {
    throw new HttpsError("invalid-argument", "No code provided");
  }
  const snapshot = await db
    .collection("discounts")
    .where("code", "==", String(code).toUpperCase())
    .where("is_active", "==", true)
    .limit(1)
    .get();
  if (snapshot.empty) {
    return { valid: false, error: "Invalid coupon code" };
  }
  const doc = snapshot.docs[0];
  const discount = { id: doc.id, ...doc.data() };
  const now = new Date();
  if (discount.expires_at && new Date(discount.expires_at) < now) {
    return { valid: false, error: "Coupon has expired" };
  }
  if (discount.max_uses != null && (discount.usage_count || 0) >= discount.max_uses) {
    return { valid: false, error: "Coupon usage limit reached" };
  }
  const cart = Number(cartTotal) || 0;
  if (discount.min_cart_value != null && cart < Number(discount.min_cart_value)) {
    return {
      valid: false,
      error: `Minimum cart value ₹${discount.min_cart_value} required`,
    };
  }
  let discountAmount = 0;
  if (discount.type === "percentage") {
    discountAmount = Math.round((cart * Number(discount.value)) / 100);
  } else {
    discountAmount = Math.min(Number(discount.value), cart);
  }
  return {
    valid: true,
    discountAmount,
    type: discount.type,
    value: Number(discount.value),
    code: discount.code,
  };
});

/** Create order: verify prices, decrement stock in transaction, create order + items. */
export const createOrder = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to place an order");
  }
  const userId = request.auth.uid;
  const { items, shippingAddress, paymentMethod, discountCode } = request.data || {};
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new HttpsError("invalid-argument", "Cart is empty");
  }

  const variantIds = items.map((i) => i.variantId);
  const variantsSnap = await db.collection("product_variants").get();
  const variantMap = new Map();
  const productIds = new Set();
  variantsSnap.docs.forEach((d) => {
    const v = { id: d.id, ...d.data() };
    if (variantIds.includes(d.id)) {
      variantMap.set(d.id, v);
      productIds.add(v.product_id);
    }
  });

  for (const item of items) {
    if (!variantMap.has(item.variantId)) {
      throw new HttpsError("invalid-argument", `Variant ${item.variantId} not found`);
    }
  }

  const productsSnap = await db.collection("products").get();
  const productMap = new Map();
  productsSnap.docs.forEach((d) => {
    if (productIds.has(d.id)) productMap.set(d.id, { id: d.id, ...d.data() });
  });

  const categoryIds = [
    ...new Set(
      [...productMap.values()]
        .map((p) => p.category_id)
        .filter((id) => id != null && String(id).length > 0)
        .map((id) => String(id))
    ),
  ];
  const categorySlugById = new Map();
  for (let i = 0; i < categoryIds.length; i += 10) {
    const batch = categoryIds.slice(i, i + 10);
    const refs = batch.map((id) => db.collection("categories").doc(id));
    const snaps = await db.getAll(...refs);
    snaps.forEach((snap) => {
      if (snap.exists) {
        const slug = snap.data().slug;
        if (slug) categorySlugById.set(snap.id, String(slug));
      }
    });
  }

  const decrementBatch = async () => {
    return db.runTransaction(async (tx) => {
      for (const item of items) {
        const v = variantMap.get(item.variantId);
        const ref = db.collection("product_variants").doc(item.variantId);
        const snap = await tx.get(ref);
        if (!snap.exists) throw new HttpsError("failed-precondition", "Variant not found");
        const current = snap.data();
        const stock = Number(current.stock_quantity) ?? 0;
        const qty = Number(item.quantity) || 1;
        if (stock < qty) {
          throw new HttpsError(
            "failed-precondition",
            `Insufficient stock for SKU ${v.sku}. Available: ${stock}`
          );
        }
        tx.update(ref, { stock_quantity: stock - qty });
      }
    });
  };

  await decrementBatch();

  let subtotal = 0;
  const orderItems = [];
  for (const item of items) {
    const variant = variantMap.get(item.variantId);
    const product = productMap.get(variant.product_id);
    const lineTotal = Number(variant.price) * (Number(item.quantity) || 1);
    const gstRate = resolveGstRate(product, categorySlugById);
    const gstAmount = Math.round((lineTotal * gstRate) / (100 + gstRate));
    subtotal += lineTotal;
    const custom = sanitizeCustomCurtainSize(item.customCurtainSize);
    const baseVariantInfo = [variant.color, variant.size].filter(Boolean).join(" / ") || "Default";
    const variantInfo = custom ? `${baseVariantInfo} / Custom: ${custom}` : baseVariantInfo;
    orderItems.push({
      product_id: variant.product_id,
      variant_id: item.variantId,
      product_name: product?.name || "Unknown",
      variant_info: variantInfo,
      sku: variant.sku,
      quantity: Number(item.quantity) || 1,
      unit_price: Number(variant.price),
      total_price: lineTotal,
      gst_rate: gstRate,
      gst_amount: gstAmount,
    });
  }

  let discountAmount = 0;
  let appliedDiscountCode = null;
  if (discountCode) {
    const discSnap = await db
      .collection("discounts")
      .where("code", "==", String(discountCode).toUpperCase())
      .where("is_active", "==", true)
      .limit(1)
      .get();
    if (!discSnap.empty) {
      const disc = discSnap.docs[0].data();
      const docRef = discSnap.docs[0].ref;
      const now = new Date();
      const notExpired = !disc.expires_at || new Date(disc.expires_at) > now;
      const underUsage = disc.max_uses == null || (disc.usage_count || 0) < disc.max_uses;
      const meetsMin = disc.min_cart_value == null || subtotal >= Number(disc.min_cart_value);
      if (notExpired && underUsage && meetsMin) {
        if (disc.type === "percentage") {
          discountAmount = Math.round((subtotal * Number(disc.value)) / 100);
        } else {
          discountAmount = Math.min(Number(disc.value), subtotal);
        }
        appliedDiscountCode = disc.code;
        await docRef.update({ usage_count: (disc.usage_count || 0) + 1 });
      }
    }
  }

  const shippingSnap = await db
    .collection("shipping_rules")
    .where("is_active", "==", true)
    .limit(1)
    .get();
  const shippingRules = shippingSnap.empty ? {} : shippingSnap.docs[0].data();
  const freeThreshold = Number(shippingRules.free_shipping_threshold ?? 999);
  const flatRate = Number(shippingRules.flat_rate ?? 99);
  const codFeeRate = Number(shippingRules.cod_fee ?? 49);
  const shippingAmount = subtotal >= freeThreshold ? 0 : flatRate;
  const codFee = paymentMethod === "cod" ? codFeeRate : 0;
  const gstTotal = Math.round((subtotal * 18) / 118);
  const totalAmount = subtotal - discountAmount + shippingAmount + codFee;

  const orderNumber = `LNC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const now = new Date().toISOString();
  const orderRef = db.collection("orders").doc();
  const orderPayload = {
    order_number: orderNumber,
    user_id: userId,
    status: "pending",
    subtotal,
    gst_amount: gstTotal,
    shipping_amount: shippingAmount,
    cod_fee: codFee,
    total_amount: totalAmount,
    payment_method: paymentMethod || "cod",
    payment_status: paymentMethod === "cod" ? "pending" : "pending",
    shipping_address: shippingAddress || {},
    billing_address: shippingAddress || {},
    fulfillment_status: "unfulfilled",
    discount_code: appliedDiscountCode,
    discount_amount: discountAmount,
    created_at: now,
    updated_at: now,
  };
  await orderRef.set(orderPayload);

  const batch = db.batch();
  for (const oi of orderItems) {
    const itemRef = db.collection("order_items").doc();
    batch.set(itemRef, { ...oi, order_id: orderRef.id });
  }
  await batch.commit();

  return {
    orderId: orderRef.id,
    orderNumber,
    totalAmount,
    discountAmount,
  };
});

/** Admin-only bulk operations */
export const bulkOperations = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Unauthorized");
  }
  const token = request.auth.token;
  if (!isAdmin(token)) {
    throw new HttpsError("permission-denied", "Forbidden");
  }
  const { operation, data } = request.data || {};
  switch (operation) {
    case "csv-import": {
      const products = data?.products || [];
      let created = 0;
      const errors = [];
      for (const row of products) {
        try {
          if (!row.name || !row.slug) {
            errors.push(`Row missing name or slug: ${JSON.stringify(row)}`);
            continue;
          }
          const slug = String(row.slug).trim();
          const existing = await db.collection("products").where("slug", "==", slug).limit(1).get();
          const payload = {
            name: row.name,
            slug,
            description: row.description || null,
            short_description: row.short_description || null,
            base_price: Number(row.base_price || 0),
            compare_at_price: row.compare_at_price != null ? Number(row.compare_at_price) : null,
            category_id: row.category_id || null,
            fabric: row.fabric || null,
            dimensions: row.dimensions || null,
            care_instructions: row.care_instructions || null,
            tags: row.tags ? String(row.tags).split(",").map((t) => t.trim()) : null,
            is_active: row.is_active !== "false",
            is_featured: row.is_featured === "true",
            updated_at: new Date().toISOString(),
          };
          if (!existing.empty) {
            await existing.docs[0].ref.update(payload);
          } else {
            payload.created_at = payload.updated_at;
            await db.collection("products").add(payload);
          }
          const productSnap = await db.collection("products").where("slug", "==", slug).limit(1).get();
          const productId = productSnap.docs[0]?.id;
          if (row.sku && productId) {
            const variantSnap = await db.collection("product_variants").where("sku", "==", String(row.sku)).limit(1).get();
            const variantPayload = {
              product_id: productId,
              sku: row.sku,
              color: row.color || null,
              size: row.size || null,
              price: Number(row.variant_price || row.base_price || 0),
              compare_at_price: row.variant_compare_price != null ? Number(row.variant_compare_price) : null,
              stock_quantity: Number(row.stock_quantity || 0),
              is_active: true,
              updated_at: new Date().toISOString(),
            };
            if (!variantSnap.empty) {
              await variantSnap.docs[0].ref.update(variantPayload);
            } else {
              variantPayload.created_at = variantPayload.updated_at;
              await db.collection("product_variants").add(variantPayload);
            }
          }
          created++;
        } catch (e) {
          errors.push(`Row error: ${e.message}`);
        }
      }
      return { created, updated: 0, errors, total: products.length };
    }
    case "bulk-price-update": {
      const { variantIds, adjustmentType, adjustmentValue } = data || {};
      let updated = 0;
      for (const id of variantIds || []) {
        const ref = db.collection("product_variants").doc(id);
        const snap = await ref.get();
        if (!snap.exists) continue;
        const variant = snap.data();
        let newPrice = Number(variant.price);
        if (adjustmentType === "percentage") {
          newPrice = Math.round(newPrice * (1 + Number(adjustmentValue) / 100));
        } else if (adjustmentType === "fixed") {
          newPrice = newPrice + Number(adjustmentValue);
        } else if (adjustmentType === "set") {
          newPrice = Number(adjustmentValue);
        }
        if (newPrice > 0) {
          await ref.update({ price: newPrice, updated_at: new Date().toISOString() });
          updated++;
        }
      }
      return { updated };
    }
    case "bulk-inventory-update": {
      const updates = data?.updates || [];
      let updated = 0;
      for (const u of updates) {
        const ref = db.collection("product_variants").doc(u.variantId);
        const snap = await ref.get();
        if (snap.exists) {
          await ref.update({ stock_quantity: Number(u.quantity), updated_at: new Date().toISOString() });
          updated++;
        }
      }
      return { updated };
    }
    case "bulk-tag-update": {
      const { productIds, tagsToAdd, tagsToRemove } = data || {};
      for (const pid of productIds || []) {
        const ref = db.collection("products").doc(pid);
        const snap = await ref.get();
        if (!snap.exists) continue;
        let tags = snap.data().tags || [];
        if (tagsToAdd?.length) tags = [...new Set([...tags, ...tagsToAdd])];
        if (tagsToRemove?.length) tags = tags.filter((t) => !tagsToRemove.includes(t));
        await ref.update({ tags, updated_at: new Date().toISOString() });
      }
      return { updated: (productIds || []).length };
    }
    default:
      throw new HttpsError("invalid-argument", "Unknown operation");
  }
});
