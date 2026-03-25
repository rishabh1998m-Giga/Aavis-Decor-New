/**
 * Migrate data from a live Firebase project (Firestore + optionally Auth) into PostgreSQL.
 *
 * Prerequisites: DATABASE_URL, schema applied (`npm run db:migrate`).
 *
 * Environment:
 *   DATABASE_URL                 — Postgres connection string
 *   FIREBASE_SERVICE_ACCOUNT_PATH — Path to service account JSON (or use GOOGLE_APPLICATION_CREDENTIALS)
 *   MIGRATION_DEFAULT_PASSWORD   — Required with --with-auth (min 8 chars). Applied to every imported Auth user.
 *   MEDIA_URL_PREFIX_OLD         — Optional: substring to replace in image URLs (e.g. old Firebase Storage host)
 *   MEDIA_URL_PREFIX_NEW         — Optional: replacement prefix (e.g. https://yourdomain.com/media)
 *
 * Usage (from server/):
 *   npx tsx scripts/etl-firestore-to-postgres.ts
 *   npx tsx scripts/etl-firestore-to-postgres.ts --with-auth
 *   npx tsx scripts/etl-firestore-to-postgres.ts --dry-run
 *
 * Without --with-auth, stub user rows are created for any user_id referenced by orders/addresses so FKs hold.
 * Those stub accounts cannot sign in until an admin resets passwords or you re-run with --with-auth against a fresh DB.
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import bcrypt from "bcrypt";
import postgres from "postgres";
import admin from "firebase-admin";
import type {
  CollectionReference,
  DocumentSnapshot,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const withAuth = args.has("--with-auth");

function iso(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  if (
    typeof v === "object" &&
    v !== null &&
    "toDate" in v &&
    typeof (v as { toDate: () => Date }).toDate === "function"
  ) {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  return String(v);
}

function numStr(v: unknown): string | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return String(n);
}

function intVal(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function bool(v: unknown): boolean | null {
  if (v == null) return null;
  return Boolean(v);
}

/** Firestore boolean fields are untyped; postgres.js needs real booleans. */
function asBool(v: unknown, defaultValue: boolean): boolean {
  return typeof v === "boolean" ? v : defaultValue;
}

function strArr(v: unknown): string[] | null {
  if (v == null) return null;
  if (!Array.isArray(v)) return null;
  return v.map((x) => String(x));
}

function rewriteUrl(u: string | null | undefined): string | null {
  if (u == null || u === "") return null;
  const oldP = process.env.MEDIA_URL_PREFIX_OLD?.trim();
  const newP = process.env.MEDIA_URL_PREFIX_NEW?.trim();
  if (oldP && newP && u.startsWith(oldP)) return newP + u.slice(oldP.length);
  return u;
}

function uidFromAddress(data: Record<string, unknown>): string | null {
  const id = data.user_id ?? data.userId;
  return id != null ? String(id) : null;
}

async function paginateCollection(
  col: CollectionReference,
  pageSize = 400
): Promise<QueryDocumentSnapshot[]> {
  const out: QueryDocumentSnapshot[] = [];
  let last: DocumentSnapshot | undefined;
  for (;;) {
    let q = col.orderBy(admin.firestore.FieldPath.documentId()).limit(pageSize);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    out.push(...snap.docs);
    last = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < pageSize) break;
  }
  return out;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is required");

  const saPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (saPath) {
    const raw = readFileSync(resolve(saPath), "utf8");
    const sa = JSON.parse(raw) as admin.ServiceAccount;
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  } else {
    admin.initializeApp();
  }

  const fsdb = admin.firestore();
  const sql = postgres(dbUrl, { max: 5 });

  function jsonSql(v: unknown) {
    if (v == null) return null;
    return sql.json(JSON.parse(JSON.stringify(v)));
  }

  const stubHash = await bcrypt.hash("__migrated_no_login__", 10);
  const now = new Date().toISOString();

  try {
    if (withAuth) {
      const pw = process.env.MIGRATION_DEFAULT_PASSWORD;
      if (!pw || pw.length < 8) {
        throw new Error(
          "With --with-auth, set MIGRATION_DEFAULT_PASSWORD (min 8 chars) so migrated users can sign in."
        );
      }
      const hash = await bcrypt.hash(pw, 10);
      console.log("Migrating Firebase Auth users + profiles + roles…");
      let nextPageToken: string | undefined;
      let n = 0;
      do {
        const res = await admin.auth().listUsers(1000, nextPageToken);
        for (const u of res.users) {
          const uid = u.uid;
          const email = u.email;
          if (!email) {
            console.warn(`Skip auth user ${uid}: no email`);
            continue;
          }
          const profSnap = await fsdb.collection("profiles").doc(uid).get();
          const p = profSnap.exists ? (profSnap.data() as Record<string, unknown>) : {};
          const roleSnap = await fsdb.collection("user_roles").doc(uid).get();
          const roleRaw = roleSnap.exists ? roleSnap.data()?.role : null;
          const role =
            typeof roleRaw === "string" && roleRaw.length ? roleRaw : "customer";
          const created = u.metadata.creationTime
            ? new Date(u.metadata.creationTime).toISOString()
            : now;

          if (dryRun) {
            n++;
            continue;
          }

          const updatedAt = iso(u.metadata.lastSignInTime) ?? created;
          await sql`
            INSERT INTO users (id, email, password_hash, created_at, updated_at)
            VALUES (${uid}, ${email}, ${hash}, ${created}, ${updatedAt})
            ON CONFLICT (id) DO UPDATE SET
              email = EXCLUDED.email,
              updated_at = EXCLUDED.updated_at
          `;
          await sql`
            INSERT INTO profiles (user_id, full_name, phone, avatar_url, created_at, updated_at)
            VALUES (
              ${uid},
              ${(p.full_name as string) ?? null},
              ${(p.phone as string) ?? null},
              ${rewriteUrl((p.avatar_url as string) ?? null)},
              ${iso(p.created_at) ?? created},
              ${iso(p.updated_at) ?? now}
            )
            ON CONFLICT (user_id) DO UPDATE SET
              full_name = EXCLUDED.full_name,
              phone = EXCLUDED.phone,
              avatar_url = EXCLUDED.avatar_url,
              updated_at = EXCLUDED.updated_at
          `;
          await sql`
            INSERT INTO user_roles (user_id, role)
            VALUES (${uid}, ${role})
            ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role
          `;
          n++;
        }
        nextPageToken = res.pageToken;
      } while (nextPageToken);
      console.log(`Auth migration: ${n} users processed${dryRun ? " (dry-run)" : ""}.`);
    }

    console.log("Migrating categories…");
    for (const doc of await paginateCollection(fsdb.collection("categories"))) {
      const c = doc.data() as Record<string, unknown>;
      if (dryRun) continue;
      await sql`
        INSERT INTO categories (
          id, name, slug, description, image_url, is_active, sort_order, created_at, updated_at
        )
        VALUES (
          ${doc.id},
          ${String(c.name ?? "")},
          ${String(c.slug ?? "")},
          ${(c.description as string) ?? null},
          ${rewriteUrl((c.image_url as string) ?? null)},
          ${asBool(c.is_active, true)},
          ${intVal(c.sort_order) ?? 0},
          ${iso(c.created_at)},
          ${iso(c.updated_at)}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          slug = EXCLUDED.slug,
          description = EXCLUDED.description,
          image_url = EXCLUDED.image_url,
          is_active = EXCLUDED.is_active,
          sort_order = EXCLUDED.sort_order,
          updated_at = EXCLUDED.updated_at
      `;
    }

    console.log("Migrating products…");
    for (const doc of await paginateCollection(fsdb.collection("products"))) {
      const p = doc.data() as Record<string, unknown>;
      const tags = strArr(p.tags);
      const aliases = strArr(p.slug_aliases);
      const tagsSql = tags == null ? null : sql.array(tags);
      const aliasesSql = aliases == null ? null : sql.array(aliases);
      if (dryRun) continue;
      await sql`
        INSERT INTO products (
          id, category_id, name, slug, slug_aliases, description, short_description,
          design_name, meta_title, meta_description, is_active, is_featured,
          base_price, max_variant_price, compare_at_price, gst_rate, tags,
          fabric, dimensions, care_instructions, created_at, updated_at
        )
        VALUES (
          ${doc.id},
          ${(p.category_id as string) ?? null},
          ${String(p.name ?? "")},
          ${String(p.slug ?? "")},
          ${aliasesSql},
          ${(p.description as string) ?? null},
          ${(p.short_description as string) ?? null},
          ${(p.design_name as string) ?? null},
          ${(p.meta_title as string) ?? null},
          ${(p.meta_description as string) ?? null},
          ${asBool(p.is_active, true)},
          ${asBool(p.is_featured, false)},
          ${numStr(p.base_price) ?? "0"},
          ${numStr(p.max_variant_price)},
          ${numStr(p.compare_at_price)},
          ${numStr(p.gst_rate)},
          ${tagsSql},
          ${(p.fabric as string) ?? null},
          ${(p.dimensions as string) ?? null},
          ${(p.care_instructions as string) ?? null},
          ${iso(p.created_at)},
          ${iso(p.updated_at)}
        )
        ON CONFLICT (id) DO UPDATE SET
          category_id = EXCLUDED.category_id,
          name = EXCLUDED.name,
          slug = EXCLUDED.slug,
          slug_aliases = EXCLUDED.slug_aliases,
          description = EXCLUDED.description,
          short_description = EXCLUDED.short_description,
          design_name = EXCLUDED.design_name,
          meta_title = EXCLUDED.meta_title,
          meta_description = EXCLUDED.meta_description,
          is_active = EXCLUDED.is_active,
          is_featured = EXCLUDED.is_featured,
          base_price = EXCLUDED.base_price,
          max_variant_price = EXCLUDED.max_variant_price,
          compare_at_price = EXCLUDED.compare_at_price,
          gst_rate = EXCLUDED.gst_rate,
          tags = EXCLUDED.tags,
          fabric = EXCLUDED.fabric,
          dimensions = EXCLUDED.dimensions,
          care_instructions = EXCLUDED.care_instructions,
          updated_at = EXCLUDED.updated_at
      `;
    }

    console.log("Migrating product_variants…");
    for (const doc of await paginateCollection(fsdb.collection("product_variants"))) {
      const v = doc.data() as Record<string, unknown>;
      if (dryRun) continue;
      await sql`
        INSERT INTO product_variants (
          id, product_id, sku, color, size, price, compare_at_price,
          stock_quantity, low_stock_threshold, is_active, created_at, updated_at
        )
        VALUES (
          ${doc.id},
          ${String(v.product_id)},
          ${String(v.sku ?? "")},
          ${(v.color as string) ?? null},
          ${(v.size as string) ?? null},
          ${numStr(v.price) ?? "0"},
          ${numStr(v.compare_at_price)},
          ${intVal(v.stock_quantity) ?? 0},
          ${intVal(v.low_stock_threshold)},
          ${asBool(v.is_active, true)},
          ${iso(v.created_at)},
          ${iso(v.updated_at)}
        )
        ON CONFLICT (id) DO UPDATE SET
          product_id = EXCLUDED.product_id,
          sku = EXCLUDED.sku,
          color = EXCLUDED.color,
          size = EXCLUDED.size,
          price = EXCLUDED.price,
          compare_at_price = EXCLUDED.compare_at_price,
          stock_quantity = EXCLUDED.stock_quantity,
          low_stock_threshold = EXCLUDED.low_stock_threshold,
          is_active = EXCLUDED.is_active,
          updated_at = EXCLUDED.updated_at
      `;
    }

    console.log("Migrating product_images…");
    for (const doc of await paginateCollection(fsdb.collection("product_images"))) {
      const im = doc.data() as Record<string, unknown>;
      const url = rewriteUrl(String(im.url ?? ""));
      if (!url) continue;
      if (dryRun) continue;
      await sql`
        INSERT INTO product_images (
          id, product_id, variant_id, url, alt_text, sort_order, is_primary, created_at
        )
        VALUES (
          ${doc.id},
          ${String(im.product_id)},
          ${(im.variant_id as string) ?? null},
          ${url},
          ${(im.alt_text as string) ?? null},
          ${intVal(im.sort_order) ?? 0},
          ${asBool(im.is_primary, false)},
          ${iso(im.created_at)}
        )
        ON CONFLICT (id) DO UPDATE SET
          product_id = EXCLUDED.product_id,
          variant_id = EXCLUDED.variant_id,
          url = EXCLUDED.url,
          alt_text = EXCLUDED.alt_text,
          sort_order = EXCLUDED.sort_order,
          is_primary = EXCLUDED.is_primary
      `;
    }

    console.log("Migrating collections…");
    for (const doc of await paginateCollection(fsdb.collection("collections"))) {
      const c = doc.data() as Record<string, unknown>;
      if (dryRun) continue;
      await sql`
        INSERT INTO collections (
          id, title, slug, description, image_url, type, rules, is_active, sort_order, created_at, updated_at
        )
        VALUES (
          ${doc.id},
          ${String(c.title ?? "")},
          ${String(c.slug ?? "")},
          ${(c.description as string) ?? null},
          ${rewriteUrl((c.image_url as string) ?? null)},
          ${String(c.type ?? "manual")},
          ${c.rules != null ? jsonSql(c.rules) : null},
          ${asBool(c.is_active, true)},
          ${intVal(c.sort_order) ?? 0},
          ${iso(c.created_at)},
          ${iso(c.updated_at)}
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          slug = EXCLUDED.slug,
          description = EXCLUDED.description,
          image_url = EXCLUDED.image_url,
          type = EXCLUDED.type,
          rules = EXCLUDED.rules,
          is_active = EXCLUDED.is_active,
          sort_order = EXCLUDED.sort_order,
          updated_at = EXCLUDED.updated_at
      `;
    }

    console.log("Migrating collection_products…");
    for (const doc of await paginateCollection(fsdb.collection("collection_products"))) {
      const cp = doc.data() as Record<string, unknown>;
      const colId = cp.collection_id != null ? String(cp.collection_id) : "";
      const pid = cp.product_id != null ? String(cp.product_id) : "";
      if (!colId || !pid) continue;
      if (dryRun) continue;
      await sql`
        INSERT INTO collection_products (id, collection_id, product_id, sort_order)
        VALUES (
          ${doc.id},
          ${colId},
          ${pid},
          ${intVal(cp.sort_order) ?? 0}
        )
        ON CONFLICT (id) DO UPDATE SET
          collection_id = EXCLUDED.collection_id,
          product_id = EXCLUDED.product_id,
          sort_order = EXCLUDED.sort_order
      `;
    }

    console.log("Migrating discounts…");
    for (const doc of await paginateCollection(fsdb.collection("discounts"))) {
      const d = doc.data() as Record<string, unknown>;
      const code = String(d.code ?? "").toUpperCase();
      if (!code) continue;
      if (dryRun) continue;
      await sql`
        INSERT INTO discounts (
          id, code, type, value, is_active, min_cart_value, max_uses, usage_count,
          expires_at, created_at, updated_at
        )
        VALUES (
          ${doc.id},
          ${code},
          ${String(d.type ?? "fixed")},
          ${numStr(d.value) ?? "0"},
          ${asBool(d.is_active, true)},
          ${numStr(d.min_cart_value)},
          ${intVal(d.max_uses)},
          ${intVal(d.usage_count) ?? 0},
          ${iso(d.expires_at)},
          ${iso(d.created_at)},
          ${iso(d.updated_at)}
        )
        ON CONFLICT (id) DO UPDATE SET
          code = EXCLUDED.code,
          type = EXCLUDED.type,
          value = EXCLUDED.value,
          is_active = EXCLUDED.is_active,
          min_cart_value = EXCLUDED.min_cart_value,
          max_uses = EXCLUDED.max_uses,
          usage_count = EXCLUDED.usage_count,
          expires_at = EXCLUDED.expires_at,
          updated_at = EXCLUDED.updated_at
      `;
    }

    console.log("Migrating shipping_rules…");
    for (const doc of await paginateCollection(fsdb.collection("shipping_rules"))) {
      const s = doc.data() as Record<string, unknown>;
      if (dryRun) continue;
      await sql`
        INSERT INTO shipping_rules (
          id, name, flat_rate, free_shipping_threshold, cod_fee, cod_min_order,
          is_cod_available, is_active, created_at, updated_at
        )
        VALUES (
          ${doc.id},
          ${(s.name as string) ?? null},
          ${numStr(s.flat_rate)},
          ${numStr(s.free_shipping_threshold)},
          ${numStr(s.cod_fee)},
          ${numStr(s.cod_min_order)},
          ${bool(s.is_cod_available)},
          ${bool(s.is_active)},
          ${iso(s.created_at)},
          ${iso(s.updated_at)}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          flat_rate = EXCLUDED.flat_rate,
          free_shipping_threshold = EXCLUDED.free_shipping_threshold,
          cod_fee = EXCLUDED.cod_fee,
          cod_min_order = EXCLUDED.cod_min_order,
          is_cod_available = EXCLUDED.is_cod_available,
          is_active = EXCLUDED.is_active,
          updated_at = EXCLUDED.updated_at
      `;
    }

    console.log("Migrating gst_settings…");
    for (const doc of await paginateCollection(fsdb.collection("gst_settings"))) {
      const g = doc.data() as Record<string, unknown>;
      if (dryRun) continue;
      await sql`
        INSERT INTO gst_settings (
          id, business_name, business_address, business_state, gstin, default_gst_rate,
          is_gst_inclusive, invoice_prefix, next_invoice_number, created_at, updated_at
        )
        VALUES (
          ${doc.id},
          ${(g.business_name as string) ?? null},
          ${(g.business_address as string) ?? null},
          ${(g.business_state as string) ?? null},
          ${(g.gstin as string) ?? null},
          ${numStr(g.default_gst_rate)},
          ${bool(g.is_gst_inclusive)},
          ${(g.invoice_prefix as string) ?? null},
          ${intVal(g.next_invoice_number)},
          ${iso(g.created_at)},
          ${iso(g.updated_at)}
        )
        ON CONFLICT (id) DO UPDATE SET
          business_name = EXCLUDED.business_name,
          business_address = EXCLUDED.business_address,
          business_state = EXCLUDED.business_state,
          gstin = EXCLUDED.gstin,
          default_gst_rate = EXCLUDED.default_gst_rate,
          is_gst_inclusive = EXCLUDED.is_gst_inclusive,
          invoice_prefix = EXCLUDED.invoice_prefix,
          next_invoice_number = EXCLUDED.next_invoice_number,
          updated_at = EXCLUDED.updated_at
      `;
    }

    console.log("Migrating pincode_serviceability…");
    for (const doc of await paginateCollection(fsdb.collection("pincode_serviceability"))) {
      const z = doc.data() as Record<string, unknown>;
      if (dryRun) continue;
      await sql`
        INSERT INTO pincode_serviceability (
          id, pincode, is_serviceable, is_cod_available, city, state, estimated_days, created_at
        )
        VALUES (
          ${doc.id},
          ${String(z.pincode ?? "")},
          ${bool(z.is_serviceable)},
          ${bool(z.is_cod_available)},
          ${(z.city as string) ?? null},
          ${(z.state as string) ?? null},
          ${intVal(z.estimated_days)},
          ${iso(z.created_at)}
        )
        ON CONFLICT (id) DO UPDATE SET
          pincode = EXCLUDED.pincode,
          is_serviceable = EXCLUDED.is_serviceable,
          is_cod_available = EXCLUDED.is_cod_available,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          estimated_days = EXCLUDED.estimated_days
      `;
    }

    if (!withAuth) {
      console.log("Collecting user IDs for stub rows (orders + addresses)…");
      const uidSet = new Set<string>();
      for (const doc of await paginateCollection(fsdb.collection("orders"))) {
        const o = doc.data() as Record<string, unknown>;
        if (o.user_id) uidSet.add(String(o.user_id));
      }
      for (const doc of await paginateCollection(fsdb.collection("addresses"))) {
        const a = doc.data() as Record<string, unknown>;
        const u = uidFromAddress(a);
        if (u) uidSet.add(u);
      }
      if (!dryRun) {
        const existing = await sql<{ id: string }[]>`SELECT id FROM users`;
        const have = new Set(existing.map((r) => r.id));
        for (const uid of uidSet) {
          if (have.has(uid)) continue;
          const email = `${uid}-migrated@invalid.local`;
          await sql`
            INSERT INTO users (id, email, password_hash, created_at, updated_at)
            VALUES (${uid}, ${email}, ${stubHash}, ${now}, ${now})
            ON CONFLICT (id) DO NOTHING
          `;
          await sql`
            INSERT INTO user_roles (user_id, role)
            VALUES (${uid}, ${"customer"})
            ON CONFLICT (user_id) DO NOTHING
          `;
        }
      }
      console.log(`Stub users needed: ${uidSet.size}${dryRun ? " (dry-run)" : ""}`);
    }

    console.log("Migrating addresses…");
    for (const doc of await paginateCollection(fsdb.collection("addresses"))) {
      const a = doc.data() as Record<string, unknown>;
      const userId = uidFromAddress(a);
      if (!userId) continue;
      if (dryRun) continue;
      await sql`
        INSERT INTO addresses (
          id, user_id, full_name, phone, address_line1, address_line2,
          city, state, pincode, is_default, created_at, updated_at
        )
        VALUES (
          ${doc.id},
          ${userId},
          ${String(a.full_name ?? "")},
          ${String(a.phone ?? "")},
          ${String(a.address_line1 ?? "")},
          ${(a.address_line2 as string) ?? null},
          ${String(a.city ?? "")},
          ${String(a.state ?? "")},
          ${String(a.pincode ?? "")},
          ${bool(a.is_default)},
          ${iso(a.created_at)},
          ${iso(a.updated_at)}
        )
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          full_name = EXCLUDED.full_name,
          phone = EXCLUDED.phone,
          address_line1 = EXCLUDED.address_line1,
          address_line2 = EXCLUDED.address_line2,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          pincode = EXCLUDED.pincode,
          is_default = EXCLUDED.is_default,
          updated_at = EXCLUDED.updated_at
      `;
    }

    console.log("Migrating orders…");
    for (const doc of await paginateCollection(fsdb.collection("orders"))) {
      const o = doc.data() as Record<string, unknown>;
      if (dryRun) continue;
      await sql`
        INSERT INTO orders (
          id, order_number, user_id, status, subtotal, gst_amount, shipping_amount, cod_fee,
          total_amount, payment_method, payment_status, shipping_address, billing_address,
          discount_code, discount_amount, fulfillment_status, tracking_number, tracking_url,
          created_at, updated_at
        )
        VALUES (
          ${doc.id},
          ${String(o.order_number ?? doc.id)},
          ${(o.user_id as string) ?? null},
          ${(o.status as string) ?? null},
          ${numStr(o.subtotal) ?? "0"},
          ${numStr(o.gst_amount)},
          ${numStr(o.shipping_amount)},
          ${numStr(o.cod_fee)},
          ${numStr(o.total_amount) ?? "0"},
          ${(o.payment_method as string) ?? null},
          ${(o.payment_status as string) ?? null},
          ${jsonSql(o.shipping_address)},
          ${jsonSql(o.billing_address)},
          ${(o.discount_code as string) ?? null},
          ${numStr(o.discount_amount)},
          ${(o.fulfillment_status as string) ?? null},
          ${(o.tracking_number as string) ?? null},
          ${(o.tracking_url as string) ?? null},
          ${iso(o.created_at)},
          ${iso(o.updated_at)}
        )
        ON CONFLICT (id) DO UPDATE SET
          order_number = EXCLUDED.order_number,
          user_id = EXCLUDED.user_id,
          status = EXCLUDED.status,
          subtotal = EXCLUDED.subtotal,
          gst_amount = EXCLUDED.gst_amount,
          shipping_amount = EXCLUDED.shipping_amount,
          cod_fee = EXCLUDED.cod_fee,
          total_amount = EXCLUDED.total_amount,
          payment_method = EXCLUDED.payment_method,
          payment_status = EXCLUDED.payment_status,
          shipping_address = EXCLUDED.shipping_address,
          billing_address = EXCLUDED.billing_address,
          discount_code = EXCLUDED.discount_code,
          discount_amount = EXCLUDED.discount_amount,
          fulfillment_status = EXCLUDED.fulfillment_status,
          tracking_number = EXCLUDED.tracking_number,
          tracking_url = EXCLUDED.tracking_url,
          updated_at = EXCLUDED.updated_at
      `;
    }

    console.log("Migrating order_items…");
    for (const doc of await paginateCollection(fsdb.collection("order_items"))) {
      const it = doc.data() as Record<string, unknown>;
      const oid = String(it.order_id ?? "");
      if (!oid) continue;
      if (dryRun) continue;
      await sql`
        INSERT INTO order_items (
          id, order_id, product_id, variant_id, product_name, variant_info, sku,
          quantity, unit_price, total_price, gst_rate, gst_amount, created_at
        )
        VALUES (
          ${doc.id},
          ${oid},
          ${(it.product_id as string) ?? null},
          ${(it.variant_id as string) ?? null},
          ${String(it.product_name ?? "Unknown")},
          ${(it.variant_info as string) ?? null},
          ${(it.sku as string) ?? null},
          ${intVal(it.quantity) ?? 1},
          ${numStr(it.unit_price) ?? "0"},
          ${numStr(it.total_price) ?? "0"},
          ${numStr(it.gst_rate)},
          ${numStr(it.gst_amount)},
          ${iso(it.created_at)}
        )
        ON CONFLICT (id) DO UPDATE SET
          order_id = EXCLUDED.order_id,
          product_id = EXCLUDED.product_id,
          variant_id = EXCLUDED.variant_id,
          product_name = EXCLUDED.product_name,
          variant_info = EXCLUDED.variant_info,
          sku = EXCLUDED.sku,
          quantity = EXCLUDED.quantity,
          unit_price = EXCLUDED.unit_price,
          total_price = EXCLUDED.total_price,
          gst_rate = EXCLUDED.gst_rate,
          gst_amount = EXCLUDED.gst_amount
      `;
    }

    console.log(dryRun ? "Dry run complete (no DB writes)." : "Migration complete.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
