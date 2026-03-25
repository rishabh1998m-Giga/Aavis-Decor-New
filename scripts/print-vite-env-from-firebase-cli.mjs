#!/usr/bin/env node
/**
 * Uses locally logged-in Firebase CLI to print VITE_FIREBASE_* lines for .env.production / Hostinger.
 * Requires: npx firebase login, and .firebaserc default project set.
 *
 *   node scripts/print-vite-env-from-firebase-cli.mjs [appId]
 *
 * Default appId is read from firebase apps:list if not passed (first WEB app).
 */

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8", cwd: ROOT, stdio: ["pipe", "pipe", "pipe"] });
}

let appId = process.argv[2];

if (!appId) {
  const list = sh("npx firebase apps:list WEB --json");
  const data = JSON.parse(list);
  const apps = data.result ?? data;
  const first =
    Array.isArray(apps) ? apps[0] : Array.isArray(apps?.apps) ? apps.apps[0] : null;
  appId = first?.appId;
  if (!appId) {
    console.error("No WEB app found. Add one in Firebase Console or pass appId as argument.");
    process.exit(1);
  }
}

const raw = sh(`npx firebase apps:sdkconfig WEB ${appId} --json`);
const outer = JSON.parse(raw);
const res = outer.result ?? outer;
const c =
  typeof res?.fileContents === "string" ? JSON.parse(res.fileContents) : res;

console.log("# From: firebase apps:sdkconfig (do not commit secrets to public repos)");
console.log(`VITE_FIREBASE_API_KEY=${c.apiKey ?? ""}`);
console.log(`VITE_FIREBASE_AUTH_DOMAIN=${c.authDomain ?? ""}`);
console.log(`VITE_FIREBASE_PROJECT_ID=${c.projectId ?? ""}`);
console.log(`VITE_FIREBASE_STORAGE_BUCKET=${c.storageBucket ?? ""}`);
console.log(`VITE_FIREBASE_MESSAGING_SENDER_ID=${c.messagingSenderId ?? ""}`);
console.log(`VITE_FIREBASE_APP_ID=${c.appId ?? appId}`);
if (c.measurementId) {
  console.log(`# Optional Analytics: VITE_FIREBASE_MEASUREMENT_ID=${c.measurementId}`);
}
