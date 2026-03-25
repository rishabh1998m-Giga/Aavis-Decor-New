#!/usr/bin/env node
/**
 * Set gst_rate to 5 for all active products in pillow-covers and table-linens.
 * Run: node scripts/set-gst-rate-5-for-categories.js
 * Optional: DRY_RUN=1 to preview only.
 */

import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(ROOT, ".env") });

const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
const SLUGS = ["pillow-covers", "table-linens"];

async function getDb() {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
  if (!projectId) throw new Error("Missing VITE_FIREBASE_PROJECT_ID");
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(ROOT, "service-account.json");
  if (credPath && fs.existsSync(credPath)) process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
  const { initializeApp, cert, getApps } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  if (!getApps().length) {
    if (fs.existsSync(credPath)) {
      const sa = JSON.parse(fs.readFileSync(credPath, "utf8"));
      initializeApp({ credential: cert(sa), projectId });
    } else {
      initializeApp({ projectId });
    }
  }
  return getFirestore();
}

async function main() {
  const db = await getDb();
  const categoryIds = [];
  for (const slug of SLUGS) {
    const snap = await db.collection("categories").where("slug", "==", slug).limit(1).get();
    if (snap.empty) {
      console.warn(`Category not found: ${slug}`);
      continue;
    }
    categoryIds.push(snap.docs[0].id);
  }
  if (categoryIds.length === 0) {
    console.log("No matching categories.");
    return;
  }

  let updated = 0;
  for (const catId of categoryIds) {
    const productsSnap = await db
      .collection("products")
      .where("category_id", "==", catId)
      .where("is_active", "==", true)
      .get();

    for (const doc of productsSnap.docs) {
      const current = doc.data().gst_rate;
      if (Number(current) === 5) continue;
      console.log(`${DRY_RUN ? "[dry-run] " : ""}Would set gst_rate=5: ${doc.id} ${doc.data().name ?? ""} (was ${current})`);
      if (!DRY_RUN) {
        await doc.ref.update({ gst_rate: 5 });
      }
      updated += 1;
    }
  }

  console.log(DRY_RUN ? `Dry run complete. ${updated} documents would update.` : `Updated ${updated} products.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
