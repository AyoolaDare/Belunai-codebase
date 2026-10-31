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
const EXPECTED_TABLES = [
  "account_settings", "audit_logs", "communities", "community_memberships", "content_reports",
  "conversations", "friendships", "interests", "invitations", "messages", "moderation_actions",
  "notifications", "organisation_follows", "organisation_roles", "organisations", "platform_roles",
  "post_comments", "post_likes", "post_media", "post_saves", "posts", "profile_interests",
  "profiles", "user_blocks", "user_follows", "verification_requests",
];

const migrationVersions = () =>
  readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => f.slice(0, 14));

const empty = (rows) => rows.length === 0;

const checks = [
  {
    name: "exactly the 26 application tables in public",
    sql: `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind in ('r','p','v','m','f') order by c.relname`,
    ok: (rows) => JSON.stringify(rows.map((r) => r.relname)) === JSON.stringify(EXPECTED_TABLES),
  },
  {
    name: "row level security enabled on every table",
    sql: `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    ok: empty,
  },
  {
    name: "no RLS policies (deny by default)",
    sql: `select tablename, policyname from pg_policies where schemaname = 'public'`,
    ok: empty,
  },
  {
    name: "anon/authenticated have no table privileges",
    sql: `select grantee, table_name, privilege_type from information_schema.role_table_grants
          where table_schema = 'public' and grantee in ('anon','authenticated')`,
    ok: empty,
  },
  {
    name: "anon/authenticated have no sequence privileges",
    sql: `select grantee, object_name from information_schema.usage_privileges
          where object_schema = 'public' and object_type = 'SEQUENCE' and grantee in ('anon','authenticated')`,
    ok: empty,
  },
  {
    name: "anon/authenticated cannot execute public or private functions",
    sql: `select p.proname, r.rolname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          cross join (values ('anon'), ('authenticated')) r(rolname)
          where n.nspname in ('public','private') and has_function_privilege(r.rolname, p.oid, 'EXECUTE')`,
    ok: empty,
  },
  {
    name: "private schema not usable by anon, authenticated or PUBLIC",
    sql: `select has_schema_privilege('anon','private','USAGE') or
                 has_schema_privilege('authenticated','private','USAGE') or
                 has_schema_privilege('public','private','USAGE') as exposed`,
    ok: (rows) => rows[0].exposed === false,
  },
  {
    name: "search_path pinned on every private function",
    sql: `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'private' and not coalesce(p.proconfig @> array['search_path=""'], false)`,
    ok: empty,
  },
  {
    name: "leading columns of every foreign key indexed",
    sql: `select c.conrelid::regclass::text as tbl, c.conname from pg_constraint c
          where c.contype = 'f' and c.connamespace = 'public'::regnamespace
            and not exists (
              select 1 from pg_index i
              where i.indrelid = c.conrelid
                and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] = c.conkey
                and (i.indpred is null
                     or (array_length(c.conkey, 1) = 1
                         and pg_get_expr(i.indpred, i.indrelid) =
                           '(' || (select attname from pg_attribute
                                   where attrelid = c.conrelid and attnum = c.conkey[1]) || ' IS NOT NULL)')))`,
    ok: empty,
  },
  {
    name: "every CHECK constraint named after its table",
    sql: `select conrelid::regclass::text as tbl, conname from pg_constraint
          where contype = 'c' and connamespace = 'public'::regnamespace
            and conname not like replace(conrelid::regclass::text, 'public.', '') || '\\_%'`,
    ok: empty,
  },
  {
    name: "recorded migration versions match supabase/migrations",
    sql: `select version from supabase_migrations.schema_migrations order by version`,
    ok: (rows) => JSON.stringify(rows.map((r) => r.version)) === JSON.stringify(migrationVersions()),
  },
];

// Statements that must fail with insufficient_privilege (42501) when run as an
// API role. Each runs in a transaction that is never committed.
const SIGNED_IN = "select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true); set local role authenticated;";
const denials = [
  ...["profiles", "posts", "organisations", "communities"].map((table) => ({
    name: `anon cannot read ${table}`,
    sql: `set local role anon; select * from public.${table} limit 1;`,
  })),
  { name: "signed-in user cannot read profiles", sql: `${SIGNED_IN} select * from public.profiles limit 1;` },
  {
    name: "signed-in user cannot update profiles",
    sql: `${SIGNED_IN} update public.profiles set bio = 'x' where id = auth.uid();`,
  },
  { name: "signed-in user cannot read messages", sql: `${SIGNED_IN} select * from public.messages limit 1;` },
];

async function expectDenied(sql) {
  try {
    await query(`begin; ${sql} rollback;`);
    return "statement succeeded";
  } catch (error) {
    return /\b42501\b/.test(error.message) ? null : error.message.slice(0, 300);
  }
}

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
  for (const denial of denials) {
    const problem = await expectDenied(denial.sql);
    if (problem) failed += 1;
    console.log(`${problem ? "FAIL" : "PASS"}  ${denial.name}${problem ? `\n      ${problem}` : ""}`);
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
