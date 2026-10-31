#!/usr/bin/env node
// Applies migrations to, and verifies, the hosted Supabase test project over
// HTTPS (Management API). Used where direct Postgres ports are unavailable.
// History is kept in supabase_migrations.schema_migrations, the table the
// Supabase CLI uses, so `supabase db push` stays compatible.
//
// Needs: NEXT_PUBLIC_SUPABASE_URL (project URL) and SUPABASE_ACCESS_TOKEN
// (personal access token scoped to that project).
// Usage: node scripts/supabase-remote.mjs push|verify
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = "supabase/migrations";

function projectRef() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  const match = new URL(raw).hostname.match(/^([a-z0-9]{20})\.supabase\.co$/);
  if (!match) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not a <ref>.supabase.co project URL.");
  return match[1];
}

async function query(sql) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN is not set.");
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef()}/database/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    },
  );
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Management API ${response.status}: ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : [];
}

const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;

async function push() {
  await query(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      statements text[],
      name text
    );`);
  const applied = new Set(
    (await query("select version from supabase_migrations.schema_migrations")).map((r) => r.version),
  );
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  let count = 0;
  for (const file of files) {
    const [, version, name] = file.match(/^(\d{14})_(.+)\.sql$/) ?? [];
    if (!version) throw new Error(`Unexpected migration filename: ${file}`);
    if (applied.has(version)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    // One transaction per migration: the schema change and its history row commit together.
    await query(`begin;
${sql}
insert into supabase_migrations.schema_migrations (version, name, statements)
  values (${literal(version)}, ${literal(name)}, array[${literal(sql)}]);
commit;`);
    console.log(`applied ${file}`);
    count += 1;
  }
  console.log(count ? `Applied ${count} migration(s).` : "Already up to date.");
}

// DB-01 checks run against the real project (mirrors tests/db/inventory.test.ts).
const checks = [
  {
    name: "exactly 26 application tables in public",
    sql: `select count(*)::int as n from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind in ('r','p','v','m','f')`,
    ok: (rows) => rows[0].n === 26,
  },
  {
    name: "row level security enabled on every table",
    sql: `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    ok: (rows) => rows.length === 0,
  },
  {
    name: "no RLS policies (deny by default)",
    sql: `select policyname from pg_policies where schemaname = 'public'`,
    ok: (rows) => rows.length === 0,
  },
  {
    name: "anon/authenticated have no table privileges",
    sql: `select grantee, table_name, privilege_type from information_schema.role_table_grants
          where table_schema = 'public' and grantee in ('anon','authenticated')`,
    ok: (rows) => rows.length === 0,
  },
  {
    name: "anon/authenticated cannot execute public or private functions",
    sql: `select p.proname, r.rolname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          cross join (values ('anon'), ('authenticated')) r(rolname)
          where n.nspname in ('public','private') and has_function_privilege(r.rolname, p.oid, 'EXECUTE')`,
    ok: (rows) => rows.length === 0,
  },
  {
    name: "private schema not usable by API roles",
    sql: `select has_schema_privilege('anon','private','USAGE') or
                 has_schema_privilege('authenticated','private','USAGE') as exposed`,
    ok: (rows) => rows[0].exposed === false,
  },
  {
    name: "all 12 migrations recorded",
    sql: `select count(*)::int as n from supabase_migrations.schema_migrations`,
    ok: (rows) => rows[0].n === readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).length,
  },
];

async function verify() {
  let failed = 0;
  const version = await query("select current_setting('server_version') as v");
  console.log(`PostgreSQL ${version[0].v}`);
  for (const check of checks) {
    const rows = await query(check.sql);
    const pass = check.ok(rows);
    if (!pass) failed += 1;
    console.log(`${pass ? "PASS" : "FAIL"}  ${check.name}${pass ? "" : `\n      ${JSON.stringify(rows).slice(0, 300)}`}`);
  }
  if (failed) {
    console.error(`${failed} check(s) failed.`);
    process.exit(1);
  }
  console.log("All checks passed.");
}

const command = process.argv[2];
const run = { push, verify }[command];
if (!run) {
  console.error("Usage: node scripts/supabase-remote.mjs push|verify");
  process.exit(2);
}
run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
