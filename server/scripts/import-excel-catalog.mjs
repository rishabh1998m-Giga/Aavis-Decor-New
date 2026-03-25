#!/usr/bin/env node
/**
 * Import catalog rows from the repo Excel template into PostgreSQL.
 *
 * Behavior:
 * - Groups multiple Excel rows into one product (by slug, fallback name)
 * - Creates/updates variants per product by SKU (fallback color+size key)
 * - Replaces product images from sheet URLs (stored as product-level gallery)
 *
 * Prerequisite: DATABASE_URL, schema migrated (npm run db:migrate).
 * Default file (repo root): product_upload_template (1) (1) (2).xlsx
 *
 *   cd server && node scripts/import-excel-catalog.mjs
 *   EXCEL_PATH=/path/to/file.xlsx node scripts/import-excel-catalog.mjs
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import postgres from "postgres";
import { nanoid } from "nanoid";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(__dirname, "..", "..");

dotenv.config({ path: path.join(REPO_ROOT, ".env") });
dotenv.config({ path: path.join(SERVER_ROOT, ".env") });

const excelPath =
  process.env.EXCEL_PATH ||
  path.join(REPO_ROOT, "product_upload_template (1) (1) (2).xlsx");

if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL (e.g. in repo .env or server/.env)");
  process.exit(1);
}

if (!fs.existsSync(excelPath)) {
  console.error("Excel not found:", excelPath);
  process.exit(1);
}

function slugify(text) {
  return (text || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 200);
}

function parseNum(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function parseBool(v) {
  if (v === undefined || v === null || v === "") return true;
  const s = String(v).toLowerCase();
  return s === "yes" || s === "true" || s === "1" || s === "y";
}

function toDirectImageUrl(url) {
  const u = String(url).trim();
  const driveMatch = u.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch)
    return `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
  return u;
}

function norm(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

async function ensureDefaultCategories(sql, now) {
  const rows = await sql`SELECT id, name, slug FROM categories`;
  if (rows.length > 0) return rows;
  const defaults = [
    { name: "Pillow Covers", slug: "pillow-covers", sort_order: 0 },
    { name: "Curtains", slug: "curtains", sort_order: 1 },
    { name: "Table Linens", slug: "table-linens", sort_order: 2 },
    { name: "Home Textiles", slug: "home-textiles", sort_order: 3 },
  ];
  for (const c of defaults) {
    const id = nanoid();
    await sql`
      INSERT INTO categories (id, name, slug, description, image_url, is_active, sort_order, created_at, updated_at)
      VALUES (${id}, ${c.name}, ${c.slug}, ${null}, ${null}, ${true}, ${c.sort_order}, ${now}, ${now})
    `;
  }
  return await sql`SELECT id, name, slug FROM categories`;
}

function categoryMapFromRows(catRows) {
  const m = new Map();
  for (const r of catRows) {
    m.set(norm(r.name), r.id);
    m.set(norm(r.slug), r.id);
  }
  m.set("curtain", m.get("curtains") || null);
  m.set("tablecloth", m.get("table linens") || m.get("table-linens") || null);
  return m;
}

function getImageUrlsFromRow(r) {
  const urls = [];
  for (let j = 1; j <= 8; j++) {
    const url = (r[`image_${j}`] || r[`image ${j}`] || "").toString().trim();
    if (url && url.startsWith("http")) urls.push(toDirectImageUrl(url));
  }
  return urls;
}

function groupRows(rawRows) {
  const groups = new Map();
  let skipped = 0;

  for (const r of rawRows) {
    const name = (r.name || r.Name || "").toString().trim();
    if (!name) {
      skipped++;
      continue;
    }

    const slugRaw = (r.slug || r.Slug || "").toString().trim();
    const slug = slugRaw || slugify(name);
    const key = slug || slugify(name);

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        slug,
        name,
        categoryName: (r.category || r.Category || "").toString().trim(),
        designName: (r.design_name || "").toString().trim() || null,
        description: (r.description || "").toString().trim() || null,
        shortDescription: (r.short_description || "").toString().trim() || null,
        fabric: (r.fabric || "").toString().trim() || null,
        dimensions: (r.dimensions || "").toString().trim() || null,
        careInstructions: (r.care_instructions || "").toString().trim() || null,
        gstRate: parseNum(r.gst_rate ?? r.GST),
        isActive: parseBool(r.active),
        isFeatured: parseBool(r.featured),
        tags: new Set(),
        variants: [],
        imageUrls: [],
      });
    }

    const g = groups.get(key);
    g.name = g.name || name;
    g.slug = g.slug || slug;
    g.categoryName = g.categoryName || (r.category || r.Category || "").toString().trim();
    g.designName = g.designName || (r.design_name || "").toString().trim() || null;
    g.description = g.description || (r.description || "").toString().trim() || null;
    g.shortDescription =
      g.shortDescription || (r.short_description || "").toString().trim() || null;
    g.fabric = g.fabric || (r.fabric || "").toString().trim() || null;
    g.dimensions = g.dimensions || (r.dimensions || "").toString().trim() || null;
    g.careInstructions =
      g.careInstructions || (r.care_instructions || "").toString().trim() || null;

    if (parseBool(r.active)) g.isActive = true;
    if (parseBool(r.featured)) g.isFeatured = true;
    if (g.gstRate == null) g.gstRate = parseNum(r.gst_rate ?? r.GST);

    const tagsRaw = r.tags
      ? String(r.tags)
          .split(/[,;]/)
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
    for (const tag of tagsRaw) g.tags.add(tag);

    const basePrice = parseNum(r.base_price) ?? 0;
    const compareAtPrice = parseNum(r.compare_price ?? r.compare_at_price) ?? null;
    const variantPrice =
      parseNum(r["Variant Price"] ?? r.variant_price) ?? basePrice;
    const stock = parseNum(r.stock) ?? 0;
    const color = (r.color || "").toString().trim() || null;
    const size = (r.size || "").toString().trim() || null;
    const rawSku = (r.sku || r.SKU || "").toString().trim();
    const sku = rawSku || `IMPORT-${g.slug || slugify(g.name)}-${g.variants.length + 1}`;

    g.variants.push({
      sku,
      color,
      size,
      price: variantPrice,
      compareAtPrice,
      stock,
      basePrice,
    });

    const rowImageUrls = getImageUrlsFromRow(r);
    for (const url of rowImageUrls) {
      if (!g.imageUrls.includes(url)) g.imageUrls.push(url);
    }
  }

  return { groups: [...groups.values()], skipped };
}

async function upsertProduct(sql, group, categoryByKey, now, productIndex) {
  const categoryId = group.categoryName
    ? categoryByKey.get(norm(group.categoryName)) || null
    : null;
  const tags = [...group.tags];
  const tagsSql = tags.length ? sql.array(tags) : null;
  const groupMinPrice = group.variants.length
    ? Math.min(...group.variants.map((v) => Number(v.price)))
    : 0;
  const groupMaxPrice = group.variants.length
    ? Math.max(...group.variants.map((v) => Number(v.price)))
    : groupMinPrice;
  const compareCandidates = group.variants
    .map((v) => v.compareAtPrice)
    .filter((v) => v != null)
    .map(Number);
  const compareAtPrice = compareCandidates.length
    ? Math.max(...compareCandidates)
    : null;

  const explicitFeatured = !!group.isFeatured;
  const featuredFallback = productIndex < 8;
  const isFeatured = explicitFeatured || featuredFallback;

  const rows = await sql`
    SELECT id FROM products WHERE slug = ${group.slug} LIMIT 1
  `;

  if (rows.length) {
    const productId = rows[0].id;
    await sql`
      UPDATE products SET
        category_id = ${categoryId},
        name = ${group.name},
        description = ${group.description},
        short_description = ${group.shortDescription},
        design_name = ${group.designName},
        base_price = ${String(groupMinPrice)},
        max_variant_price = ${String(groupMaxPrice)},
        compare_at_price = ${compareAtPrice != null ? String(compareAtPrice) : null},
        gst_rate = ${group.gstRate != null ? String(group.gstRate) : null},
        fabric = ${group.fabric},
        dimensions = ${group.dimensions},
        care_instructions = ${group.careInstructions},
        tags = ${tagsSql},
        is_featured = ${isFeatured},
        is_active = ${!!group.isActive},
        updated_at = ${now}
      WHERE id = ${productId}
    `;
    return { productId, created: 0, updated: 1 };
  }

  const productId = nanoid();
  await sql`
    INSERT INTO products (
      id, category_id, name, slug, description, short_description, design_name,
      base_price, max_variant_price, compare_at_price, gst_rate, fabric, dimensions, care_instructions,
      tags, is_featured, is_active, created_at, updated_at
    ) VALUES (
      ${productId},
      ${categoryId},
      ${group.name},
      ${group.slug},
      ${group.description},
      ${group.shortDescription},
      ${group.designName},
      ${String(groupMinPrice)},
      ${String(groupMaxPrice)},
      ${compareAtPrice != null ? String(compareAtPrice) : null},
      ${group.gstRate != null ? String(group.gstRate) : null},
      ${group.fabric},
      ${group.dimensions},
      ${group.careInstructions},
      ${tagsSql},
      ${isFeatured},
      ${!!group.isActive},
      ${now},
      ${now}
    )
  `;
  return { productId, created: 1, updated: 0 };
}

async function upsertVariants(sql, productId, variants, now) {
  const existing = await sql`
    SELECT id, sku, color, size
    FROM product_variants
    WHERE product_id = ${productId}
  `;

  const bySku = new Map();
  const byFallback = new Map();
  for (const row of existing) {
    const skuKey = norm(row.sku);
    if (skuKey) bySku.set(skuKey, row.id);
    const fb = `${norm(row.color)}|${norm(row.size)}`;
    byFallback.set(fb, row.id);
  }

  const keep = [];

  for (const v of variants) {
    const skuKey = norm(v.sku);
    const fbKey = `${norm(v.color)}|${norm(v.size)}`;
    const existingId = bySku.get(skuKey) || byFallback.get(fbKey) || null;
    if (existingId) {
      keep.push(existingId);
      await sql`
        UPDATE product_variants SET
          sku = ${v.sku},
          color = ${v.color},
          size = ${v.size},
          price = ${String(v.price)},
          compare_at_price = ${v.compareAtPrice != null ? String(v.compareAtPrice) : null},
          stock_quantity = ${Number(v.stock) || 0},
          is_active = ${true},
          updated_at = ${now}
        WHERE id = ${existingId}
      `;
    } else {
      const id = nanoid();
      keep.push(id);
      await sql`
        INSERT INTO product_variants (
          id, product_id, sku, color, size, price, compare_at_price, stock_quantity, is_active, created_at, updated_at
        ) VALUES (
          ${id},
          ${productId},
          ${v.sku},
          ${v.color},
          ${v.size},
          ${String(v.price)},
          ${v.compareAtPrice != null ? String(v.compareAtPrice) : null},
          ${Number(v.stock) || 0},
          ${true},
          ${now},
          ${now}
        )
      `;
    }
  }

  await sql`
    UPDATE product_variants
    SET is_active = false, updated_at = ${now}
    WHERE product_id = ${productId}
      AND NOT (id = ANY(${sql.array(keep)}))
  `;
}

async function replaceProductImages(sql, productId, productName, imageUrls, now) {
  await sql`DELETE FROM product_images WHERE product_id = ${productId}`;
  for (let idx = 0; idx < imageUrls.length; idx++) {
    const imgId = nanoid();
    await sql`
      INSERT INTO product_images (id, product_id, variant_id, url, alt_text, sort_order, is_primary, created_at)
      VALUES (
        ${imgId},
        ${productId},
        ${null},
        ${imageUrls[idx]},
        ${`${productName} - image ${idx + 1}`},
        ${idx},
        ${idx === 0},
        ${now}
      )
    `;
  }
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  const now = new Date().toISOString();

  try {
    const wb = XLSX.readFile(excelPath);
    const sheetName = wb.SheetNames.find((n) => /product/i.test(n)) || wb.SheetNames[0];
    const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
    if (!rawRows.length) {
      console.log("No rows in sheet:", sheetName);
      return;
    }

    const { groups, skipped } = groupRows(rawRows);
    if (!groups.length) {
      console.log("No valid product rows in sheet:", sheetName);
      return;
    }

    const catRows = await ensureDefaultCategories(sql, now);
    const categoryByKey = categoryMapFromRows(catRows);

    let created = 0;
    let updated = 0;
    let importedVariants = 0;

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const upsert = await upsertProduct(sql, group, categoryByKey, now, i);
      created += upsert.created;
      updated += upsert.updated;

      await upsertVariants(sql, upsert.productId, group.variants, now);
      importedVariants += group.variants.length;
      await replaceProductImages(sql, upsert.productId, group.name, group.imageUrls, now);
    }

    console.log(
      "Postgres catalog import done.",
      "Products created:",
      created,
      "Products updated:",
      updated,
      "Variants processed:",
      importedVariants,
      "Skipped rows:",
      skipped,
      "— sheet:",
      sheetName
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
