#!/usr/bin/env node
/**
 * Assign products to Home Textiles category (for categories that have no products).
 * Run: node scripts/assign-home-textiles.js
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

  const catSnap = await db.collection("categories").where("slug", "==", "home-textiles").limit(1).get();
  if (catSnap.empty) {
    console.log("Home Textiles category not found.");
    return;
  }
  const homeTextilesId = catSnap.docs[0].id;

  const productsInHome = await db
    .collection("products")
    .where("category_id", "==", homeTextilesId)
    .where("is_active", "==", true)
    .limit(1)
    .get();

  if (!productsInHome.empty) {
    console.log("Home Textiles already has products. Skipping.");
    return;
  }

  const tableLinensSnap = await db.collection("categories").where("slug", "==", "table-linens").limit(1).get();
  const tableLinensId = tableLinensSnap.empty ? null : tableLinensSnap.docs[0].id;
  if (!tableLinensId) {
    console.log("Table Linens category not found. Nothing to assign.");
    return;
  }

  const productsSnap = await db
    .collection("products")
    .where("is_active", "==", true)
    .where("category_id", "==", tableLinensId)
    .orderBy("created_at", "desc")
    .limit(10)
    .get();

  if (productsSnap.empty) {
    console.log("No products in Table Linens to assign.");
    return;
  }

  console.log("Assigning products from Table Linens to Home Textiles...");

  const now = new Date().toISOString();
  let count = 0;
  for (const d of productsSnap.docs) {
    if (DRY_RUN) {
      console.log("Would assign:", d.data().name);
      count++;
      continue;
    }
    await db.collection("products").doc(d.id).update({
      category_id: homeTextilesId,
      updated_at: now,
    });
    console.log("Assigned:", d.data().name);
    count++;
  }
  console.log(DRY_RUN ? "Would assign" : "Assigned", count, "products to Home Textiles.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
