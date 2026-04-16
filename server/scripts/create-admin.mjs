#!/usr/bin/env node
/**
 * Creates an admin user in the database.
 *
 * Usage (run from repo root or server/):
 *   cd server
 *   node scripts/create-admin.mjs
 *
 * Reads DATABASE_URL from .env automatically.
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import { nanoid } from "nanoid";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(__dirname, "..", "..");

dotenv.config({ path: path.join(REPO_ROOT, ".env") });
dotenv.config({ path: path.join(SERVER_ROOT, ".env") });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const ADMIN_EMAIL = "admin@aavisdecor.com";
const ADMIN_PASSWORD = "ScaleGiga@111";
const ADMIN_NAME = "Admin";

async function main() {
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  const now = new Date().toISOString();

  try {
    // Check if user already exists
    const existing = await sql`SELECT id, email FROM users WHERE email = ${ADMIN_EMAIL} LIMIT 1`;

    if (existing.length) {
      const userId = existing[0].id;
      console.log(`User ${ADMIN_EMAIL} already exists (id: ${userId}). Promoting to admin...`);

      // Update password
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await sql`UPDATE users SET password_hash = ${passwordHash}, updated_at = ${now} WHERE id = ${userId}`;

      // Ensure admin role
      const roleRow = await sql`SELECT role FROM user_roles WHERE user_id = ${userId} LIMIT 1`;
      if (roleRow.length) {
        await sql`UPDATE user_roles SET role = 'admin' WHERE user_id = ${userId}`;
      } else {
        await sql`INSERT INTO user_roles (user_id, role) VALUES (${userId}, 'admin')`;
      }

      console.log(`Done. ${ADMIN_EMAIL} is now admin.`);
    } else {
      // Create new admin user
      const id = nanoid();
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

      await sql`
        INSERT INTO users (id, email, password_hash, created_at, updated_at)
        VALUES (${id}, ${ADMIN_EMAIL}, ${passwordHash}, ${now}, ${now})
      `;
      await sql`
        INSERT INTO profiles (user_id, full_name, created_at, updated_at)
        VALUES (${id}, ${ADMIN_NAME}, ${now}, ${now})
      `;
      await sql`
        INSERT INTO user_roles (user_id, role)
        VALUES (${id}, 'admin')
      `;

      console.log(`Created admin user: ${ADMIN_EMAIL}`);
    }

    console.log(`\nLogin at: https://aavisdecor.com/auth`);
    console.log(`Email:    ${ADMIN_EMAIL}`);
    console.log(`Password: ${ADMIN_PASSWORD}`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
