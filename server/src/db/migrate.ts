/**
 * Applies drizzle/migrations/*.sql in order. Run: DATABASE_URL=... npm run db:migrate
 */
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "../../drizzle/migrations");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const sql = postgres(url, { max: 1 });
  await sql`CREATE TABLE IF NOT EXISTS _migrations (id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL, applied_at TIMESTAMPTZ DEFAULT NOW())`;

  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const done = await sql`SELECT 1 FROM _migrations WHERE name = ${file}`;
    if (done.length) continue;
    const body = await readFile(join(migrationsDir, file), "utf8");
    await sql.unsafe(body);
    await sql`INSERT INTO _migrations (name) VALUES (${file})`;
    console.log("Applied migration:", file);
  }

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
