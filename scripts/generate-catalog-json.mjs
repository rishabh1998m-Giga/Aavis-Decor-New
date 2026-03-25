#!/usr/bin/env node
/**
 * Generate a static catalog dataset from `product_upload_template (1) (1) (2).xlsx`.
 *
 * Output: `src/generated/catalog.json`
 *
 * This generator mirrors the grouping/upsert behavior from
 * `server/scripts/import-excel-catalog.mjs`, but writes JSON instead of a DB.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUTPUT_PATH = path.join(ROOT, "src", "generated", "catalog.json");

const excelPath =
  process.env.EXCEL_PATH ||
  path.join(ROOT, "product_upload_template (1) (1) (2).xlsx");

function sha(str) {
  return crypto
    .createHash("sha256")
    .update(String(str))
    .digest("base64url");
}

function makeId(prefix, key) {
  return `${prefix}_${sha(key).slice(0, 18)}`;
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
  // Mirror server importer behavior.
  if (v === undefined || v === null || v === "") return true;
  const s = String(v).toLowerCase();
  return s === "yes" || s === "true" || s === "1" || s === "y";
}

function norm(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function toDirectImageUrl(url) {
  const u = String(url).trim();
  const driveMatch = u.match(
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/
  );
  if (driveMatch)
    return `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
  return u;
}

function normalizeCategorySlug(categoryName) {
  const v = norm(categoryName);
  if (!v) return null;

  // Same intent as `scripts/sync-products-from-xlsx.js` and server importer mapping.
  if (v === "curtain" || v === "curtains") return "curtains";
  if (v === "tablecloth" || v === "table linens" || v === "table-linens") return "table-linens";
  if (v === "cushion cover" || v === "cushion covers" || v === "pillow covers" || v === "pillow-covers")
    return "pillow-covers";
  if (v === "home textiles" || v === "home-textiles" || v === "home textile") return "home-textiles";

  // Fallback: slugify what we received.
  return slugify(v);
}

function categorySortOrder(slug) {
  const defaults = new Map([
    ["pillow-covers", 0],
    ["curtains", 1],
    ["table-linens", 2],
    ["home-textiles", 3],
  ]);
  if (defaults.has(slug)) return defaults.get(slug);
  return 1000;
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

  for (let rowIdx = 0; rowIdx < rawRows.length; rowIdx++) {
    const r = rawRows[rowIdx];
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
        firstRowIndex: rowIdx,
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
        // Optional, if the Excel has alias columns.
        slugAliases: [],
      });
    }

    const g = groups.get(key);
    g.name = g.name || name;
    g.slug = g.slug || slug;
    g.categoryName = g.categoryName || (r.category || r.Category || "").toString().trim();
    g.designName = g.designName || (r.design_name || "").toString().trim() || null;
    g.description = g.description || (r.description || "").toString().trim() || null;
    g.shortDescription = g.shortDescription || (r.short_description || "").toString().trim() || null;
    g.fabric = g.fabric || (r.fabric || "").toString().trim() || null;
    g.dimensions = g.dimensions || (r.dimensions || "").toString().trim() || null;
    g.careInstructions = g.careInstructions || (r.care_instructions || "").toString().trim() || null;

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

    const aliasesRaw =
      r.slug_aliases ??
      r.slugAliases ??
      r["slug aliases"] ??
      r["slug_aliases"];
    if (aliasesRaw) {
      const arr = String(aliasesRaw)
        .split(/[,;]/)
        .map((a) => a.trim())
        .filter(Boolean);
      for (const a of arr) if (!g.slugAliases.includes(a)) g.slugAliases.push(a);
    }

    const basePrice = parseNum(r.base_price) ?? 0;
    const compareAtPrice =
      parseNum(r.compare_price ?? r.compare_at_price) ?? null;

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

async function main() {
  if (!fs.existsSync(excelPath)) {
    throw new Error(`Excel not found: ${excelPath}`);
  }

  const wb = XLSX.readFile(excelPath);
  const sheetName = wb.SheetNames.find((n) => /product/i.test(n)) || wb.SheetNames[0];
  const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });

  if (!rawRows.length) {
    throw new Error(`No rows in sheet: ${sheetName}`);
  }

  const { groups, skipped } = groupRows(rawRows);
  if (!groups.length) {
    throw new Error("No valid product groups found in Excel.");
  }

  const now = new Date().toISOString();

  // Build categories (defaults + discovered).
  const categoriesBySlug = new Map();
  const ensureDefault = (slug, name, sort_order) => {
    if (!categoriesBySlug.has(slug)) {
      categoriesBySlug.set(slug, {
        id: makeId("cat", slug),
        name,
        slug,
        description: null,
        image_url: null,
        is_active: true,
        sort_order,
        firstSeenIndex: 0,
      });
    }
  };

  ensureDefault("pillow-covers", "Pillow Covers", 0);
  ensureDefault("curtains", "Curtains", 1);
  ensureDefault("table-linens", "Table Linens", 2);
  ensureDefault("home-textiles", "Home Textiles", 3);

  let extraSortCursor = 4;

  for (const g of groups) {
    const slug = normalizeCategorySlug(g.categoryName);
    if (!slug) continue;
    if (categoriesBySlug.has(slug)) continue;

    const name = g.categoryName || slug;
    categoriesBySlug.set(slug, {
      id: makeId("cat", slug),
      name,
      slug,
      description: null,
      image_url: null,
      is_active: true,
      sort_order: categorySortOrder(slug) >= 1000 ? extraSortCursor++ : categorySortOrder(slug),
      firstSeenIndex: g.firstRowIndex,
    });
  }

  const categories = [...categoriesBySlug.values()].sort((a, b) => a.sort_order - b.sort_order);
  const categoriesById = new Map(categories.map((c) => [c.id, c]));

  const products = [];

  for (let productIndex = 0; productIndex < groups.length; productIndex++) {
    const g = groups[productIndex];

    const categorySlug = normalizeCategorySlug(g.categoryName);
    const category = categorySlug ? categoriesBySlug.get(categorySlug) || null : null;
    const categoryId = category?.id ?? null;

    const groupMinPrice = g.variants.length
      ? Math.min(...g.variants.map((v) => Number(v.price)))
      : 0;
    const groupMaxPrice = g.variants.length
      ? Math.max(...g.variants.map((v) => Number(v.price)))
      : groupMinPrice;

    const compareCandidates = g.variants
      .map((v) => v.compareAtPrice)
      .filter((v) => v != null)
      .map(Number);
    const compareAtPrice = compareCandidates.length ? Math.max(...compareCandidates) : null;

    const explicitFeatured = !!g.isFeatured;
    const featuredFallback = productIndex < 8;
    const isFeatured = explicitFeatured || featuredFallback;

    const productId = makeId("prod", g.slug);

    const variants = g.variants.map((v) => {
      const variantId = makeId("var", `${g.slug}|${v.sku}`);
      return {
        id: variantId,
        product_id: productId,
        sku: v.sku,
        color: v.color,
        size: v.size,
        price: Number(v.price),
        compare_at_price: v.compareAtPrice != null ? Number(v.compareAtPrice) : null,
        stock_quantity: Number(v.stock) || 0,
        is_active: true,
      };
    });

    const imageUrls = g.imageUrls || [];
    const images = imageUrls.map((url, idx) => ({
      id: makeId("img", `${g.slug}|${url}|${idx}`),
      product_id: productId,
      variant_id: null,
      url,
      alt_text: `${g.name} - image ${idx + 1}`,
      is_primary: idx === 0,
      sort_order: idx,
      created_at: now,
    }));

    const createdAt = new Date(Date.UTC(2020, 0, 1) + g.firstRowIndex).toISOString();

    products.push({
      id: productId,
      category_id: categoryId,
      name: g.name,
      slug: g.slug,
      description: g.description,
      short_description: g.shortDescription,
      design_name: g.designName,
      base_price: groupMinPrice,
      max_variant_price: groupMaxPrice,
      compare_at_price: compareAtPrice != null ? compareAtPrice : null,
      gst_rate: g.gstRate != null ? Number(g.gstRate) : null,
      fabric: g.fabric,
      dimensions: g.dimensions,
      care_instructions: g.careInstructions,
      tags: g.tags.size ? [...g.tags] : null,
      is_featured: isFeatured,
      is_active: !!g.isActive,
      created_at: createdAt,
      updated_at: now,
      slug_aliases: g.slugAliases,
      variants,
      images,
    });
  }

  // Backfill `home-textiles` if the Excel sheet doesn't provide that category.
  // This mirrors `scripts/assign-home-textiles.js` behavior for the DB.
  {
    const home = categoriesBySlug.get("home-textiles") || null;
    const table = categoriesBySlug.get("table-linens") || null;
    if (home && table) {
      const hasHome = products.some((p) => p.category_id === home.id && p.is_active);
      if (!hasHome) {
        const donor = products
          .filter((p) => p.category_id === table.id && p.is_active)
          .sort(
            (a, b) =>
              Date.parse(String(b.created_at ?? 0)) -
              Date.parse(String(a.created_at ?? 0))
          )
          .slice(0, 10);
        for (const p of donor) {
          p.category_id = home.id;
          p.updated_at = now;
        }
        console.log(`Backfilled home-textiles from table-linens: ${donor.length} products`);
      }
    }
  }

  // Fill category representative images (like `/api/categories/representative-images`).
  for (const cat of categories) {
    const catProducts = products
      .filter((p) => p.category_id === cat.id && p.is_active)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    const p = catProducts[0];
    const primary = p?.images?.find((img) => img.is_primary) || p?.images?.sort((a, b) => a.sort_order - b.sort_order)[0];
    cat.image_url = primary?.url ?? null;
  }

  // Write final file.
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      {
        version: 1,
        generated_at: now,
        source: {
          excelPath,
          sheetName: sheetName,
          skipped_rows: skipped,
        },
        categories,
        products,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log("Generated catalog dataset.");
  console.log("Excel:", excelPath);
  console.log("Sheet:", sheetName);
  console.log("Categories:", categories.length);
  console.log("Products:", products.length);
  console.log("Skipped rows:", skipped);
  console.log("Wrote:", OUTPUT_PATH);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

