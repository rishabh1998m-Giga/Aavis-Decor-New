#!/usr/bin/env node
/**
 * Seed the Neon PostgreSQL database from the pre-built catalog.json.
 *
 * This guarantees that product/variant/image IDs in the DB match the IDs
 * embedded in the static catalog.json served to the frontend, so checkout
 * never hits "Variant not found".
 *
 * Usage:
 *   cd server
 *   DATABASE_URL="..." node scripts/import-catalog-json.mjs
 *   DATABASE_URL="..." node scripts/import-catalog-json.mjs --clean
 *
 * --clean  deletes all existing products/variants/images first (fresh import).
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(__dirname, "..", "..");

dotenv.config({ path: path.join(REPO_ROOT, ".env") });
dotenv.config({ path: path.join(SERVER_ROOT, ".env") });

const CATALOG_PATH = path.join(REPO_ROOT, "src", "generated", "catalog.json");

if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL (e.g. in repo .env or server/.env)");
  process.exit(1);
}

if (!fs.existsSync(CATALOG_PATH)) {
  console.error("catalog.json not found at:", CATALOG_PATH);
  process.exit(1);
}

async function main() {
  const clean = process.argv.includes("--clean");
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  const now = new Date().toISOString();

  try {
    const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
    const { categories = [], products = [] } = catalog;

    if (clean) {
      console.log("--clean: deleting all products, variants and images...");
      await sql`DELETE FROM products`;
      await sql`DELETE FROM categories`;
      console.log("Deleted.");
    }

    // --- Categories ---
    let catCreated = 0;
    let catUpdated = 0;
    for (const c of categories) {
      const existing = await sql`SELECT id FROM categories WHERE id = ${c.id} LIMIT 1`;
      if (existing.length) {
        await sql`
          UPDATE categories SET
            name = ${c.name},
            slug = ${c.slug},
            description = ${c.description ?? null},
            image_url = ${c.image_url ?? null},
            is_active = ${c.is_active ?? true},
            sort_order = ${c.sort_order ?? 0},
            updated_at = ${now}
          WHERE id = ${c.id}
        `;
        catUpdated++;
      } else {
        await sql`
          INSERT INTO categories (id, name, slug, description, image_url, is_active, sort_order, created_at, updated_at)
          VALUES (
            ${c.id}, ${c.name}, ${c.slug}, ${c.description ?? null},
            ${c.image_url ?? null}, ${c.is_active ?? true}, ${c.sort_order ?? 0},
            ${now}, ${now}
          )
          ON CONFLICT (id) DO NOTHING
        `;
        catCreated++;
      }
    }
    console.log(`Categories: ${catCreated} created, ${catUpdated} updated.`);

    // --- Products, variants, images ---
    let prodCreated = 0;
    let prodUpdated = 0;
    let variantCount = 0;
    let imageCount = 0;

    for (const p of products) {
      const basePrice = String(p.base_price ?? 0);
      const maxPrice = String(p.max_variant_price ?? p.base_price ?? 0);
      const compareAt = p.compare_at_price != null ? String(p.compare_at_price) : null;
      const gstRate = p.gst_rate != null ? String(p.gst_rate) : null;
      const tags = Array.isArray(p.tags) && p.tags.length ? sql.array(p.tags) : null;

      const existingProd = await sql`SELECT id FROM products WHERE id = ${p.id} LIMIT 1`;
      if (existingProd.length) {
        await sql`
          UPDATE products SET
            category_id = ${p.category_id ?? null},
            name = ${p.name},
            slug = ${p.slug},
            description = ${p.description ?? null},
            short_description = ${p.short_description ?? null},
            design_name = ${p.design_name ?? null},
            base_price = ${basePrice},
            max_variant_price = ${maxPrice},
            compare_at_price = ${compareAt},
            gst_rate = ${gstRate},
            fabric = ${p.fabric ?? null},
            dimensions = ${p.dimensions ?? null},
            care_instructions = ${p.care_instructions ?? null},
            tags = ${tags},
            is_featured = ${p.is_featured ?? false},
            is_active = ${p.is_active ?? true},
            updated_at = ${now}
          WHERE id = ${p.id}
        `;
        prodUpdated++;
      } else {
        await sql`
          INSERT INTO products (
            id, category_id, name, slug, description, short_description, design_name,
            base_price, max_variant_price, compare_at_price, gst_rate, fabric, dimensions,
            care_instructions, tags, is_featured, is_active, created_at, updated_at
          ) VALUES (
            ${p.id}, ${p.category_id ?? null}, ${p.name}, ${p.slug},
            ${p.description ?? null}, ${p.short_description ?? null}, ${p.design_name ?? null},
            ${basePrice}, ${maxPrice}, ${compareAt}, ${gstRate},
            ${p.fabric ?? null}, ${p.dimensions ?? null}, ${p.care_instructions ?? null},
            ${tags}, ${p.is_featured ?? false}, ${p.is_active ?? true},
            ${now}, ${now}
          )
          ON CONFLICT (id) DO NOTHING
        `;
        prodCreated++;
      }

      // Variants
      for (const v of p.variants ?? []) {
        const varPrice = String(v.price ?? 0);
        const varCompare = v.compare_at_price != null ? String(v.compare_at_price) : null;
        const stock = Number(v.stock_quantity ?? v.stock ?? 0);

        await sql`
          INSERT INTO product_variants (
            id, product_id, sku, color, size, price, compare_at_price,
            stock_quantity, is_active, created_at, updated_at
          ) VALUES (
            ${v.id}, ${p.id}, ${v.sku ?? null}, ${v.color ?? null}, ${v.size ?? null},
            ${varPrice}, ${varCompare}, ${stock}, ${v.is_active ?? true},
            ${now}, ${now}
          )
          ON CONFLICT (id) DO UPDATE SET
            sku = EXCLUDED.sku,
            color = EXCLUDED.color,
            size = EXCLUDED.size,
            price = EXCLUDED.price,
            compare_at_price = EXCLUDED.compare_at_price,
            stock_quantity = EXCLUDED.stock_quantity,
            is_active = EXCLUDED.is_active,
            updated_at = EXCLUDED.updated_at
        `;
        variantCount++;
      }

      // Images
      if ((p.images ?? []).length) {
        await sql`DELETE FROM product_images WHERE product_id = ${p.id}`;
        for (const img of p.images) {
          await sql`
            INSERT INTO product_images (
              id, product_id, variant_id, url, alt_text, sort_order, is_primary, created_at
            ) VALUES (
              ${img.id}, ${p.id}, ${img.variant_id ?? null}, ${img.url},
              ${img.alt_text ?? null}, ${img.sort_order ?? 0}, ${img.is_primary ?? false},
              ${now}
            )
            ON CONFLICT (id) DO NOTHING
          `;
          imageCount++;
        }
      }
    }

    console.log(
      `Products: ${prodCreated} created, ${prodUpdated} updated.`,
      `Variants: ${variantCount}.`,
      `Images: ${imageCount}.`
    );
    console.log("Done.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
