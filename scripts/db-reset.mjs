#!/usr/bin/env node
// Recreates a disposable local test database and applies the Supabase shim
// plus every migration in order. Refuses any non-local server so tests can
// never target a hosted (staging/production) database.
// Usage: TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/belunai_test node scripts/db-reset.mjs
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

export const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function testDatabaseUrl() {
  const raw =
    process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/belunai_test";
  const url = new URL(raw);
  if (!LOCAL_HOSTS.has(url.hostname.replace(/^\[|\]$/g, ""))) {
    throw new Error(`Refusing non-local test database host "${url.hostname}".`);
  }
  const name = url.pathname.slice(1);
  if (!/^belunai_test[a-z0-9_]*$/.test(name)) {
    throw new Error(`Test database name must start with "belunai_test", got "${name}".`);
  }
  return url;
}

export async function resetDatabase() {
  const url = testDatabaseUrl();
  const name = url.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = "/postgres";

  const adminClient = new pg.Client({ connectionString: admin.toString() });
  await adminClient.connect();
  await adminClient.query(`drop database if exists "${name}" with (force)`);
  await adminClient.query(`create database "${name}"`);
  await adminClient.end();

  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  try {
    await client.query(readFileSync("tests/db/supabase-shim.sql", "utf8"));
    const dir = "supabase/migrations";
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      try {
        await client.query(readFileSync(join(dir, file), "utf8"));
      } catch (error) {
        throw new Error(`Migration ${file} failed: ${error.message}`, { cause: error });
      }
    }
    return files;
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  resetDatabase()
    .then((files) => console.log(`Applied ${files.length} migrations to a fresh test database.`))
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
