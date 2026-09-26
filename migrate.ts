// DB harness: applies supabase/migrations in filename order against the
// local PostgreSQL (docker niaverp-pg). Used by tests; no Supabase CLI needed.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

export const DB_URL = process.env.NIAVERP_DB_URL ?? "postgres://postgres:niaverp-dev-only@localhost:5433/niaverp";

export function migrationsDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..", "..", "supabase", "migrations");
}

export async function applyMigrations(url = DB_URL): Promise<string[]> {
  const dir = migrationsDir();
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    for (const f of files) {
      await client.query(readFileSync(join(dir, f), "utf8"));
    }
  } finally {
    await client.end();
  }
  return files;
}

export async function freshDb(): Promise<void> {
  const admin = new Client({ connectionString: DB_URL });
  await admin.connect();
  try {
    await admin.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await admin.query("GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;");
  } finally {
    await admin.end();
  }
  await applyMigrations();
}
