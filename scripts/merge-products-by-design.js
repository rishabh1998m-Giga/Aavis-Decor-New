#!/usr/bin/env node
/**
 * Merge products with same design_name + category into one product with multiple variants.
 * Moves variants and images to the primary product, sets variant_id on images, stores slug_aliases.
 *
 * Usage:
 *   node scripts/merge-products-by-design.js --dry-run
 *   node scripts/merge-products-by-design.js --apply
 *
 * Optional env:
 *   EXCEL_PATH=/path/to/Product.xlsx
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
const dryRun = args.has("--dry-run") || !shouldApply;

const excelPath = process.env.EXCEL_PATH || path.join(ROOT, "Product.xlsx");

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
    isFeatured: false,
    isActive: true,
    color: (row.color || "").toString().trim() || null,
    size: (row.size || "").toString().trim() || null,
    variantPrice: parseNum(row["Variant Price"], parseNum(row.base_price, 0)),
    stockQuantity: parseNum(row.stock, 0),
    imageUrls,
    rowIdx: rowIdx + 2,
  };
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
  snap.docs.forEach((d) => {
    const c = d.data();
    const keyName = normalizeCategory(c.name);
    const keySlug = normalizeCategory(c.slug);
    if (keyName) byNormKey.set(keyName, d.id);
    if (keySlug) byNormKey.set(keySlug, d.id);
  });
  return { byNormKey };
}

async function loadDbState(db) {
  const [productsSnap, variantsSnap, imagesSnap] = await Promise.all([
    db.collection("products").get(),
    db.collection("product_variants").get(),
    db.collection("product_images").get(),
  ]);

  const productById = new Map();
  productsSnap.docs.forEach((d) => productById.set(d.id, { id: d.id, ...d.data() }));

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

async function main() {
  if (!fs.existsSync(excelPath)) throw new Error(`Excel file not found: ${excelPath}`);

  const wb = XLSX.readFile(excelPath);
  const sheet = wb.SheetNames.find((n) => /product/i.test(n)) || wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: "" });

  const db = await getDb();
  const { byNormKey: categoryByNormKey } = await buildCategoryMaps(db);
  const { productById, variantBySku, variantsByProductId, imagesByProductId } = await loadDbState(db);

  const expectedRows = rows
    .map((row, i) => buildExpected(row, i, categoryByNormKey))
    .filter((e) => e.sku);

  const groupKey = (e) => `${e.designName ?? ""}::${e.categoryNorm ?? ""}`;
  const groups = new Map();
  for (const e of expectedRows) {
    const key = groupKey(e);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }

  const toMerge = [...groups.values()].filter((g) => g.length > 1);

  console.log(`Found ${toMerge.length} groups to merge (design_name + category).`);
  if (toMerge.length === 0) {
    console.log("Nothing to merge.");
    return;
  }

  const report = { dryRun, groups: [], merged: 0, errors: [] };

  for (const group of toMerge) {
    const primaryRow = group[0];
    const primaryVariant = variantBySku.get(primaryRow.sku);
    if (!primaryVariant) {
      report.errors.push({ group: groupKey(primaryRow), msg: `Primary SKU ${primaryRow.sku} not found in DB` });
      continue;
    }

    const primaryProductId = primaryVariant.product_id;
    const primaryProduct = productById.get(primaryProductId);
    if (!primaryProduct) {
      report.errors.push({ group: groupKey(primaryRow), msg: `Primary product ${primaryProductId} not found` });
      continue;
    }

    const productIdsInGroup = new Set();
    const skuToVariantId = new Map();
    const productIdToSlug = new Map();

    for (const row of group) {
      const v = variantBySku.get(row.sku);
      if (!v) continue;
      productIdsInGroup.add(v.product_id);
      skuToVariantId.set(row.sku, v.id);
      const p = productById.get(v.product_id);
      if (p?.slug) productIdToSlug.set(v.product_id, p.slug);
    }

    if (!productIdsInGroup.has(primaryProductId)) {
      report.errors.push({ group: groupKey(primaryRow), msg: "Primary product not in group" });
      continue;
    }

    const toDeleteProductIds = [...productIdsInGroup].filter((id) => id !== primaryProductId);
    const slugAliases = toDeleteProductIds
      .map((id) => productIdToSlug.get(id))
      .filter(Boolean)
      .filter((s) => s !== primaryProduct.slug);

    report.groups.push({
      designName: primaryRow.designName,
      category: primaryRow.categoryNorm,
      primaryProductId,
      primarySlug: primaryProduct.slug,
      rowCount: group.length,
      toDeleteProductIds,
      slugAliases,
    });

    if (dryRun) {
      console.log(`[DRY-RUN] Would merge ${group.length} rows into ${primaryProduct.slug}`);
      report.merged += 1;
      continue;
    }

    const batch = db.batch();

    for (const row of group) {
      const variantId = skuToVariantId.get(row.sku);
      if (!variantId) continue;

      const v = variantBySku.get(row.sku);
      if (v.product_id !== primaryProductId) {
        batch.update(db.collection("product_variants").doc(variantId), {
          product_id: primaryProductId,
          updated_at: new Date().toISOString(),
        });
      }

      const productId = v.product_id;
      if (productId === primaryProductId) continue;

      const images = (imagesByProductId.get(productId) || []).sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
      );

      for (const img of images) {
        batch.update(db.collection("product_images").doc(img.id), {
          product_id: primaryProductId,
          variant_id: variantId,
          alt_text: `${primaryRow.name} - ${row.color || ""} ${row.size || ""} - image`.trim(),
        });
      }
    }

    if (slugAliases.length > 0) {
      const existingAliases = primaryProduct.slug_aliases || [];
      const merged = [...new Set([...existingAliases, ...slugAliases])];
      batch.update(db.collection("products").doc(primaryProductId), {
        slug_aliases: merged,
        base_price: Math.min(...group.map((r) => r.basePrice)),
        updated_at: new Date().toISOString(),
      });
    }

    for (const pid of toDeleteProductIds) {
      batch.delete(db.collection("products").doc(pid));
    }

    try {
      await batch.commit();
      report.merged += 1;
      console.log(`Merged ${group.length} into ${primaryProduct.slug}`);
    } catch (err) {
      report.errors.push({ group: groupKey(primaryRow), msg: String(err) });
      console.error(`Error merging ${primaryRow.designName}:`, err);
    }
  }

  console.log("\nReport:", JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
