#!/usr/bin/env node
/**
 * Reads service-account.json and calls the Firebase Management API to download
 * the first registered Web app's SDK config — the same values needed for VITE_FIREBASE_*.
 *
 * Usage:
 *   node scripts/fetch-web-sdk-config.mjs [path/to/service-account.json]
 *
 * Then copy the printed lines into .env or .env.local and restart `npm run dev`.
 * Requires the service account to have access to the project (Firebase Admin / Editor).
 */

import { readFileSync, existsSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleAuth } from "google-auth-library";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const saPath = path.resolve(ROOT, process.argv[2] || "service-account.json");

if (!existsSync(saPath)) {
  console.error(`Missing file: ${saPath}`);
  console.error("Save your Firebase service account JSON there (never commit it).");
  process.exit(1);
}

const sa = JSON.parse(readFileSync(saPath, "utf8"));
const projectId = sa.project_id;
if (!projectId) {
  console.error("service-account.json has no project_id");
  process.exit(1);
}

const auth = new GoogleAuth({
  credentials: sa,
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

async function main() {
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) {
    console.error("Could not obtain access token. Check service account permissions.");
    process.exit(1);
  }

  const headers = { Authorization: `Bearer ${token.token}` };
  const listUrl = `https://firebase.googleapis.com/v1beta1/projects/${encodeURIComponent(projectId)}/webApps`;

  const listRes = await fetch(listUrl, { headers });
  if (!listRes.ok) {
    const t = await listRes.text();
    console.error(`List web apps failed (${listRes.status}): ${t}`);
    console.error("Ensure Firebase Management API is enabled and this key has project access.");
    process.exit(1);
  }

  const listData = await listRes.json();
  const apps = listData.apps || [];
  if (apps.length === 0) {
    console.error(`No web apps in project "${projectId}".`);
    console.error("Firebase Console → Project settings → Your apps → Add app → Web.");
    process.exit(1);
  }

  const appId = apps[0].appId;
  if (!appId) {
    console.error("Unexpected list response:", JSON.stringify(listData, null, 2));
    process.exit(1);
  }

  const configUrl = `https://firebase.googleapis.com/v1beta1/projects/${encodeURIComponent(
    projectId
  )}/webApps/${encodeURIComponent(appId)}/config`;
  const cfgRes = await fetch(configUrl, { headers });
  if (!cfgRes.ok) {
    const t = await cfgRes.text();
    console.error(`Get web app config failed (${cfgRes.status}): ${t}`);
    process.exit(1);
  }

  const cfg = await cfgRes.json();
  const sdk = cfg.sdkConfig || cfg;
  const lines = [
    `# Auto-generated from Firebase Management API (web app ${appId})`,
    `VITE_FIREBASE_API_KEY="${sdk.apiKey ?? ""}"`,
    `VITE_FIREBASE_AUTH_DOMAIN="${sdk.authDomain ?? ""}"`,
    `VITE_FIREBASE_PROJECT_ID="${sdk.projectId ?? projectId}"`,
    `VITE_FIREBASE_STORAGE_BUCKET="${sdk.storageBucket ?? ""}"`,
    `VITE_FIREBASE_MESSAGING_SENDER_ID="${sdk.messagingSenderId ?? ""}"`,
    `VITE_FIREBASE_APP_ID="${sdk.appId ?? ""}"`,
    "",
  ].join("\n");

  console.log(lines);

  const outPath = path.join(ROOT, ".env.local");
  const writeFlag = process.env.WRITE_ENV_LOCAL === "1" || process.env.WRITE_ENV_LOCAL === "true";
  if (writeFlag) {
    writeFileSync(outPath, lines, "utf8");
    console.error(`Wrote ${outPath} (restart dev server).`);
  } else {
    console.error("\nTo write this to .env.local automatically, run:");
    console.error("  WRITE_ENV_LOCAL=1 node scripts/fetch-web-sdk-config.mjs");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
