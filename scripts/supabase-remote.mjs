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

const BUCKET_IDS = [
  "community-assets", "moderation-evidence", "organisation-assets", "post-images", "profile-assets",
  "verification-evidence",
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
  // BEL-0203 secure helper framework.
  {
    name: "predicate owner role cannot log in and holds only column SELECT",
    sql: `select r.rolcanlogin or r.rolsuper or r.rolcreaterole or r.rolcreatedb as elevated,
                 (select count(*)::int from information_schema.table_privileges where grantee = r.rolname) as table_grants,
                 (select coalesce(string_agg(distinct privilege_type, ','), '') from information_schema.column_privileges
                  where grantee = r.rolname) as column_privileges,
                 has_schema_privilege(r.rolname, 'private', 'CREATE') or
                 has_schema_privilege(r.rolname, 'public', 'CREATE') as can_create
          from pg_roles r where r.rolname = 'belunai_access_owner'`,
    ok: (rows) =>
      rows.length === 1 && rows[0].elevated === false && rows[0].table_grants === 0 &&
      rows[0].column_privileges === "SELECT" && rows[0].can_create === false,
  },
  {
    name: "11 predicates owned by that role, SECURITY DEFINER, empty search_path",
    sql: `select count(*)::int as n,
                 count(*) filter (where not p.prosecdef or p.proconfig is distinct from array['search_path=""'])::int as bad
          from pg_proc p where p.proowner = 'belunai_access_owner'::regrole
            and p.pronamespace = 'private'::regnamespace`,
    ok: (rows) => rows[0].n === 11 && rows[0].bad === 0,
  },
  {
    name: "no other SECURITY DEFINER function in public or private (except Supabase's rls_auto_enable)",
    sql: `select p.oid::regprocedure::text as sig from pg_proc p
          where p.prosecdef and p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
            and p.proowner <> 'belunai_access_owner'::regrole and p.proname <> 'rls_auto_enable'`,
    ok: empty,
  },
  {
    name: "primary keys guarded on all 26 tables",
    sql: `select count(*)::int as n from pg_trigger t join pg_class c on c.oid = t.tgrelid
          where c.relnamespace = 'public'::regnamespace and t.tgname = c.relname || '_forbid_key_update'`,
    ok: (rows) => rows[0].n === 26,
  },
  // BEL-0204 private Storage.
  {
    name: "exactly six private buckets, 10 MiB, JPEG/PNG/WebP only",
    sql: `select id, public, file_size_limit::int as size_limit, array_to_string(allowed_mime_types, ',') as types
          from storage.buckets order by id`,
    ok: (rows) =>
      JSON.stringify(rows.map((r) => r.id)) === JSON.stringify(BUCKET_IDS) &&
      rows.every((r) => r.public === false && r.size_limit === 10485760 && r.types === "image/jpeg,image/png,image/webp"),
  },
  {
    name: "no Storage policies (no direct object access for API roles)",
    sql: `select tablename, policyname from pg_policies where schemaname = 'storage'`,
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
  {
    name: "signed-in user cannot write a Storage object row, even in their own folder",
    sql: `${SIGNED_IN} insert into storage.objects (bucket_id, name, owner_id)
          values ('profile-assets', 'profiles/' || auth.uid() || '/' || gen_random_uuid() || '.jpg', auth.uid()::text);`,
  },
  {
    name: "anon cannot write a Storage object row",
    sql: `set local role anon; insert into storage.objects (bucket_id, name)
          values ('post-images', 'posts/' || gen_random_uuid() || '/' || gen_random_uuid() || '.jpg');`,
  },
];

// Statements run as an API role that must see or change no rows. Never committed.
const zeroRows = [
  { name: "signed-in user sees no buckets or objects", sql: `${SIGNED_IN} select (select count(*) from storage.buckets) + (select count(*) from storage.objects) as n;` },
  { name: "signed-in user cannot make a bucket public", sql: `${SIGNED_IN} with u as (update storage.buckets set public = true returning 1) select count(*) as n from u;` },
  { name: "anon cannot make a bucket public", sql: "set local role anon; with u as (update storage.buckets set public = true returning 1) select count(*) as n from u;" },
];

// Real Storage API requests with the publishable key, as an anonymous browser.
async function storageProbes() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) return [{ name: "Storage API probes", problem: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set" }];
  const uuid = () => crypto.randomUUID();
  const objectKey = `profiles/${uuid()}/${uuid()}.jpg`;
  // A valid 1x1 JPEG, so a refusal is about access, not file content.
  const jpeg = Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
    "base64",
  );
  const call = async (method, path, body, contentType = "application/json") => {
    const response = await fetch(`${base}/storage/v1${path}`, {
      method,
      headers: { apikey: key, Authorization: `Bearer ${key}`, ...(body ? { "Content-Type": contentType } : {}) },
      body: body && contentType === "application/json" ? JSON.stringify(body) : body,
    });
    const text = await response.text();
    return { status: response.status, text };
  };
  const denied = (r) => (r.status >= 400 ? null : `HTTP ${r.status}: ${r.text.slice(0, 200)}`);
  // Refused by row-level security, not by a missing bucket or bad input.
  const rlsDenied = (r) =>
    r.status >= 400 && /row-level security/.test(r.text) ? null : `HTTP ${r.status}: ${r.text.slice(0, 200)}`;
  const emptyList = (r) => (r.status === 200 && r.text.trim() === "[]" ? null : `HTTP ${r.status}: ${r.text.slice(0, 200)}`);
  return [
    { name: "anon Storage API: list buckets returns none", problem: emptyList(await call("GET", "/bucket")) },
    {
      name: "anon Storage API: list objects returns none",
      problem: emptyList(await call("POST", "/object/list/profile-assets", { prefix: "", limit: 100 })),
    },
    { name: "anon Storage API: read by guessed key denied", problem: denied(await call("GET", `/object/profile-assets/${objectKey}`)) },
    { name: "anon Storage API: public URL denied", problem: denied(await call("GET", `/object/public/profile-assets/${objectKey}`)) },
    { name: "anon Storage API: upload denied", problem: rlsDenied(await call("POST", `/object/profile-assets/${objectKey}`, jpeg, "image/jpeg")) },
    { name: "anon Storage API: upsert denied", problem: rlsDenied(await call("PUT", `/object/profile-assets/${objectKey}`, jpeg, "image/jpeg")) },
    { name: "anon Storage API: signed upload grant denied", problem: rlsDenied(await call("POST", `/object/upload/sign/profile-assets/${objectKey}`, {})) },
    { name: "anon Storage API: signed read URL denied", problem: denied(await call("POST", `/object/sign/profile-assets/${objectKey}`, { expiresIn: 60 })) },
    { name: "anon Storage API: create bucket denied", problem: denied(await call("POST", "/bucket", { id: "open", name: "open", public: true })) },
  ];
}

// Statements that must fail with restrict_violation (23001): append-only and
// immutable-key enforcement (BEL-0203). Never committed.
const AUDIT_ROW = `insert into public.audit_logs (action, resource_type, correlation_id)
  values ('verify.probe', 'probe', gen_random_uuid());`;
const restricted = [
  { name: "audit_logs rows cannot be edited", sql: `${AUDIT_ROW} update public.audit_logs set action = 'x' where action = 'verify.probe';` },
  { name: "audit_logs rows cannot be deleted", sql: `${AUDIT_ROW} delete from public.audit_logs where action = 'verify.probe';` },
  { name: "moderation_actions cannot be truncated", sql: "truncate public.moderation_actions;" },
];

async function expectError(sql, code) {
  try {
    await query(`begin; ${sql} rollback;`);
    return "statement succeeded";
  } catch (error) {
    return new RegExp(`\\b${code}\\b`).test(error.message) ? null : error.message.slice(0, 300);
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
  for (const denial of [
    ...denials.map((d) => ({ ...d, code: "42501" })),
    ...restricted.map((d) => ({ ...d, code: "23001" })),
  ]) {
    const problem = await expectError(denial.sql, denial.code);
    if (problem) failed += 1;
    console.log(`${problem ? "FAIL" : "PASS"}  ${denial.name}${problem ? `\n      ${problem}` : ""}`);
  }
  for (const check of zeroRows) {
    const rows = await query(`begin; ${check.sql} rollback;`);
    const pass = rows.length === 1 && Number(rows[0].n) === 0;
    if (!pass) failed += 1;
    console.log(`${pass ? "PASS" : "FAIL"}  ${check.name}${pass ? "" : `\n      ${JSON.stringify(rows).slice(0, 300)}`}`);
  }
  for (const probe of await storageProbes()) {
    if (probe.problem) failed += 1;
    console.log(`${probe.problem ? "FAIL" : "PASS"}  ${probe.name}${probe.problem ? `\n      ${probe.problem}` : ""}`);
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
