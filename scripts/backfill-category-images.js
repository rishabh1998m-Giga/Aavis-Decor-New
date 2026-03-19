#!/usr/bin/env node
/**
 * Backfill category image_url from first product's primary image.
 * Run: node scripts/backfill-category-images.js
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(ROOT, ".env") });

async function getDb() {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
  if (!projectId) throw new Error("Missing VITE_FIREBASE_PROJECT_ID");
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(ROOT, "service-account.json");
  if (credPath && (await import("fs")).default.existsSync(credPath)) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
  }
  const { initializeApp, cert, getApps } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const fs = await import("fs");
  if (!getApps().length) {
    if (fs.default.existsSync(credPath)) {
      const sa = JSON.parse(fs.default.readFileSync(credPath, "utf8"));
      initializeApp({ credential: cert(sa), projectId });
    } else {
      initializeApp({ projectId });
    }
  }
  return getFirestore();
}

async function main() {
  const db = await getDb();
  const categoriesSnap = await db.collection("categories").where("is_active", "==", true).get();
  const now = new Date().toISOString();
  let updated = 0;

  for (const catDoc of categoriesSnap.docs) {
    const cat = catDoc.data();
    if (cat.image_url) continue;

    const productsSnap = await db
      .collection("products")
      .where("is_active", "==", true)
      .where("category_id", "==", catDoc.id)
      .orderBy("created_at", "desc")
      .limit(1)
      .get();

    if (productsSnap.empty) continue;

    const imgSnap = await db
      .collection("product_images")
      .where("product_id", "==", productsSnap.docs[0].id)
      .get();

    if (imgSnap.empty) continue;

    const sorted = imgSnap.docs
      .map((d) => ({ ...d.data(), id: d.id }))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const url = sorted[0]?.url;
    if (!url) continue;
    await db.collection("categories").doc(catDoc.id).update({
      image_url: url,
      updated_at: now,
    });
    console.log("Updated", cat.name, "->", url?.slice(0, 50) + "...");
    updated++;
  }

  console.log("Done. Updated", updated, "categories.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
