#!/usr/bin/env node
/**
 * Audit and optionally sync Product.xlsx to Firestore.
 *
 * Usage:
 *   node scripts/sync-products-from-xlsx.js --audit
 *   node scripts/sync-products-from-xlsx.js --apply
 *
 * Optional env:
 *   EXCEL_PATH=/absolute/or/relative/path.xlsx
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 */

import dotenv from "dotenv";
import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(ROOT, ".env") });

const args = new Set(process.argv.slice(2));
const shouldApply = args.has("--apply");
const shouldAudit = args.has("--audit") || !shouldApply;

const excelPath = process.env.EXCEL_PATH || path.join(ROOT, "Product.xlsx");
const reportPath = path.join(ROOT, "scripts", "reports", "xlsx-firestore-sync-report.json");

function slugify(text) {
  return (text || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

function parseNum(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseBool(value, fallback = true) {
  if (value === null || value === undefined || value === "") return fallback;
  const s = String(value).trim().toLowerCase();
  if (["true", "yes", "1", "y"].includes(s)) return true;
  if (["false", "no", "0", "n"].includes(s)) return false;
  return fallback;
}

function normalizeCategory(value) {
  const v = (value || "").toString().trim().toLowerCase();
  if (!v) return "";
  if (v === "curtain") return "curtains";
  if (v === "tablecloth") return "table-linens";
  if (v === "cushion cover" || v === "cushion covers") return "pillow-covers";
  return v;
}

function collectImageUrls(row) {
  const urls = [];
  for (let i = 1; i <= 8; i++) {
    const raw = (row[`image_${i}`] || row[`image ${i}`] || "").toString().trim();
    if (raw.startsWith("http")) urls.push(raw);
  }
  return urls;
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function getDb() {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
  if (!projectId) throw new Error("Missing VITE_FIREBASE_PROJECT_ID or GCLOUD_PROJECT");

  const credentialPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(ROOT, "service-account.json");

  if (credentialPath && fs.existsSync(credentialPath)) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialPath;
  }

  const { initializeApp, cert, getApps } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");

  if (!getApps().length) {
    if (fs.existsSync(credentialPath)) {
      const sa = JSON.parse(fs.readFileSync(credentialPath, "utf8"));
      initializeApp({ credential: cert(sa), projectId });
    } else {
      initializeApp({ projectId });
    }
  }

  return getFirestore();
}

async function buildCategoryMaps(db) {
  const snap = await db.collection("categories").get();
  const byNormKey = new Map();
  const byId = new Map();

  snap.docs.forEach((d) => {
    const c = d.data();
    const keyName = normalizeCategory(c.name);
    const keySlug = normalizeCategory(c.slug);
    if (keyName) byNormKey.set(keyName, d.id);
    if (keySlug) byNormKey.set(keySlug, d.id);
    byId.set(d.id, c);
  });

  return { byNormKey, byId };
}

async function loadDbState(db) {
  const [productsSnap, variantsSnap, imagesSnap] = await Promise.all([
    db.collection("products").get(),
    db.collection("product_variants").get(),
    db.collection("product_images").get(),
  ]);

  const productById = new Map();
  productsSnap.docs.forEach((d) => productById.set(d.id, d.data()));

  const variantBySku = new Map();
  const variantsByProductId = new Map();
  variantsSnap.docs.forEach((d) => {
    const v = d.data();
    const sku = (v.sku || "").toString().trim();
    if (sku) variantBySku.set(sku, { id: d.id, ...v });
    const arr = variantsByProductId.get(v.product_id) || [];
    arr.push({ id: d.id, ...v });
    variantsByProductId.set(v.product_id, arr);
  });

  const imagesByProductId = new Map();
  imagesSnap.docs.forEach((d) => {
    const i = d.data();
    const arr = imagesByProductId.get(i.product_id) || [];
    arr.push({ id: d.id, ...i });
    imagesByProductId.set(i.product_id, arr);
  });

  return { productById, variantBySku, variantsByProductId, imagesByProductId };
}

function buildExpected(row, rowIdx, categoryByNormKey) {
  const name = (row.name || "").toString().trim();
  const sku = (row.sku || row.SKU || "").toString().trim();
  const baseSlug = ((row.slug || "").toString().trim() || slugify(name)).slice(0, 140);
  const stableSlug = baseSlug || `product-${rowIdx + 1}`;
  const categoryNorm = normalizeCategory(row.category);

  const categoryId = categoryNorm ? categoryByNormKey.get(categoryNorm) || null : null;
  const imageUrls = collectImageUrls(row);

  return {
    name,
    sku,
    slug: stableSlug,
    categoryNorm,
    categoryId,
    designName: (row.design_name || "").toString().trim() || null,
    basePrice: parseNum(row.base_price, 0),
    compareAtPrice: row.compare_price === "" ? null : parseNum(row.compare_price, 0),
    description: (row.description || "").toString().trim() || null,
    shortDescription: (row.short_description || "").toString().trim() || null,
    fabric: (row.fabric || "").toString().trim() || null,
    dimensions: (row.dimensions || "").toString().trim() || null,
    careInstructions: (row.care_instructions || "").toString().trim() || null,
    tags: row.tags
      ? String(row.tags)
          .split(/[,;]/)
          .map((t) => t.trim())
          .filter(Boolean)
      : null,
    isFeatured: parseBool(row.featured, false),
    isActive: parseBool(row.active, true),
    color: (row.color || "").toString().trim() || null,
    size: (row.size || "").toString().trim() || null,
    variantPrice: parseNum(row["Variant Price"], parseNum(row.base_price, 0)),
    stockQuantity: parseNum(row.stock, 0),
    imageUrls,
  };
}

function sameString(a, b) {
  return (a || "").toString().trim() === (b || "").toString().trim();
}

async function main() {
  if (!fs.existsSync(excelPath)) throw new Error(`Excel file not found: ${excelPath}`);

  const wb = XLSX.readFile(excelPath);
  const sheet = wb.SheetNames.find((n) => /product/i.test(n)) || wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: "" });

  const db = await getDb();
  const { byNormKey: categoryByNormKey } = await buildCategoryMaps(db);
  const { productById, variantBySku, imagesByProductId } = await loadDbState(db);

  const report = {
    mode: shouldApply ? "apply" : "audit",
    excelPath,
    rows: rows.length,
    timestamp: new Date().toISOString(),
    summary: {
      totalRows: rows.length,
      missingSku: 0,
      missingCategoryMapping: 0,
      missingProductForSku: 0,
      mismatchedProductFields: 0,
      mismatchedVariantFields: 0,
      imageMismatches: 0,
      createdProducts: 0,
      updatedProducts: 0,
      updatedVariants: 0,
      rewiredImages: 0,
    },
    issues: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const expected = buildExpected(row, i, categoryByNormKey);
    const issue = { row: i + 2, sku: expected.sku, name: expected.name, problems: [] };

    if (!expected.sku) {
      report.summary.missingSku += 1;
      issue.problems.push("missing-sku-in-excel");
      report.issues.push(issue);
      continue;
    }

    if (expected.categoryNorm && !expected.categoryId) {
      report.summary.missingCategoryMapping += 1;
      issue.problems.push(`unknown-category:${expected.categoryNorm}`);
    }

    const existingVariant = variantBySku.get(expected.sku);
    if (!existingVariant) {
      report.summary.missingProductForSku += 1;
      issue.problems.push("missing-variant-by-sku");

      if (shouldApply) {
        const now = new Date().toISOString();
        const productRef = await db.collection("products").add({
          name: expected.name,
          slug: `${expected.slug}-${slugify(expected.sku).slice(0, 40)}`,
          category_id: expected.categoryId,
          design_name: expected.designName,
          base_price: expected.basePrice,
          compare_at_price: expected.compareAtPrice,
          description: expected.description,
          short_description: expected.shortDescription,
          fabric: expected.fabric,
          dimensions: expected.dimensions,
          care_instructions: expected.careInstructions,
          tags: expected.tags,
          is_featured: expected.isFeatured,
          is_active: expected.isActive,
          gst_rate: 18,
          created_at: now,
          updated_at: now,
        });

        await db.collection("product_variants").add({
          product_id: productRef.id,
          sku: expected.sku,
          color: expected.color,
          size: expected.size,
          price: expected.variantPrice,
          compare_at_price: expected.compareAtPrice,
          stock_quantity: expected.stockQuantity,
          is_active: true,
          created_at: now,
          updated_at: now,
        });

        for (let idx = 0; idx < expected.imageUrls.length; idx++) {
          await db.collection("product_images").add({
            product_id: productRef.id,
            variant_id: null,
            url: expected.imageUrls[idx],
            alt_text: `${expected.name} - image ${idx + 1}`,
            sort_order: idx,
            is_primary: idx === 0,
          });
        }

        report.summary.createdProducts += 1;
      }

      report.issues.push(issue);
      continue;
    }

    const productId = existingVariant.product_id;
    const product = productById.get(productId);
    if (!product) {
      issue.problems.push("variant-points-missing-product");
      report.issues.push(issue);
      continue;
    }

    const productPatch = {};
    if (!sameString(product.name, expected.name)) productPatch.name = expected.name;
    if (expected.categoryId !== product.category_id) productPatch.category_id = expected.categoryId;
    if (parseNum(product.base_price, 0) !== expected.basePrice) productPatch.base_price = expected.basePrice;
    if ((product.compare_at_price ?? null) !== expected.compareAtPrice) productPatch.compare_at_price = expected.compareAtPrice;
    if (!sameString(product.design_name, expected.designName)) productPatch.design_name = expected.designName;
    if (!sameString(product.description, expected.description)) productPatch.description = expected.description;
    if (!sameString(product.short_description, expected.shortDescription)) productPatch.short_description = expected.shortDescription;
    if (!sameString(product.fabric, expected.fabric)) productPatch.fabric = expected.fabric;
    if (!sameString(product.dimensions, expected.dimensions)) productPatch.dimensions = expected.dimensions;
    if (!sameString(product.care_instructions, expected.careInstructions)) productPatch.care_instructions = expected.careInstructions;
    if ((product.is_active ?? true) !== expected.isActive) productPatch.is_active = expected.isActive;

    if (Object.keys(productPatch).length) {
      issue.problems.push("product-field-mismatch");
      report.summary.mismatchedProductFields += 1;
      if (shouldApply) {
        productPatch.updated_at = new Date().toISOString();
        await db.collection("products").doc(productId).update(productPatch);
        report.summary.updatedProducts += 1;
      }
    }

    const variantPatch = {};
    if (!sameString(existingVariant.color, expected.color)) variantPatch.color = expected.color;
    if (!sameString(existingVariant.size, expected.size)) variantPatch.size = expected.size;
    if (parseNum(existingVariant.price, 0) !== expected.variantPrice) variantPatch.price = expected.variantPrice;
    if ((existingVariant.compare_at_price ?? null) !== expected.compareAtPrice) variantPatch.compare_at_price = expected.compareAtPrice;
    if (parseNum(existingVariant.stock_quantity, 0) !== expected.stockQuantity) {
      variantPatch.stock_quantity = expected.stockQuantity;
    }

    if (Object.keys(variantPatch).length) {
      issue.problems.push("variant-field-mismatch");
      report.summary.mismatchedVariantFields += 1;
      if (shouldApply) {
        variantPatch.updated_at = new Date().toISOString();
        await db.collection("product_variants").doc(existingVariant.id).update(variantPatch);
        report.summary.updatedVariants += 1;
      }
    }

    const existingImages = (imagesByProductId.get(productId) || []).sort(
      (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
    );
    const existingUrls = existingImages.map((img) => (img.url || "").toString().trim());
    const expectedUrls = expected.imageUrls.map((u) => u.trim());

    let imageNeedsUpdate = false;
    if (existingUrls.length !== expectedUrls.length) imageNeedsUpdate = true;
    if (!imageNeedsUpdate) {
      for (let idx = 0; idx < expectedUrls.length; idx++) {
        if (existingUrls[idx] !== expectedUrls[idx]) {
          imageNeedsUpdate = true;
          break;
        }
      }
    }

    if (imageNeedsUpdate) {
      issue.problems.push("image-mismatch");
      report.summary.imageMismatches += 1;
      if (shouldApply) {
        const batch = db.batch();
        existingImages.forEach((img) => {
          batch.delete(db.collection("product_images").doc(img.id));
        });
        expectedUrls.forEach((url, idx) => {
          const ref = db.collection("product_images").doc();
          batch.set(ref, {
            product_id: productId,
            variant_id: null,
            url,
            alt_text: `${expected.name} - image ${idx + 1}`,
            sort_order: idx,
            is_primary: idx === 0,
          });
        });
        await batch.commit();
        report.summary.rewiredImages += 1;
      }
    }

    if (issue.problems.length) report.issues.push(issue);
  }

  ensureDir(reportPath);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log("Sync complete.");
  console.log("Mode:", report.mode);
  console.log("Rows:", report.summary.totalRows);
  console.log("Issues:", report.issues.length);
  console.log("Summary:", report.summary);
  console.log("Report:", reportPath);

  if (shouldAudit && !shouldApply) {
    console.log("Audit only. Re-run with --apply to persist fixes.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
