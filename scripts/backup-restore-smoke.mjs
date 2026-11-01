#!/usr/bin/env node
// Local backup/restore smoke test (BEL-0205). Builds a fresh local test
// database with synthetic data, backs it up with pg_dump, restores it into a
// second local database and checks that schema, data and protections survive.
// Local only: reuses the test harness guard (localhost, belunai_test* names).
// Usage: TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/belunai_test npm run db:backup-smoke
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { resetDatabase, testDatabaseUrl } from "./db-reset.mjs";

const source = testDatabaseUrl();
const target = new URL(source);
target.pathname = `/${source.pathname.slice(1)}_restore`;
const env = { ...process.env, PGPASSWORD: decodeURIComponent(source.password) };
const connection = (url) => ["-h", url.hostname, "-p", url.port || "5432", "-U", decodeURIComponent(url.username)];

function run(command, args) {
  const result = spawnSync(command, args, { env, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
}

async function withClient(url, fn) {
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function seed(db) {
  // Synthetic accounts only.
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  await db.query("begin");
  for (const [i, id] of ids.entries()) {
    await db.query("insert into auth.users (id) values ($1)", [id]);
    await db.query(
      `insert into public.profiles (id, username, display_name, onboarding_completed_at)
       values ($1, $2, 'Synthetic Person', now())`,
      [id, `synthetic_${i}`],
    );
    await db.query(
      `insert into public.account_settings (user_id, terms_accepted_at, terms_version, privacy_notice_version)
       values ($1, now(), '2026-10', '2026-10')`,
      [id],
    );
  }
  await db.query("select private.bootstrap_platform_owner($1, gen_random_uuid())", [ids[0]]);
  const org = await db.query(
    "insert into public.organisations (slug, name, created_by) values ('synthetic-church', 'Synthetic Church', $1) returning id",
    [ids[1]],
  );
  await db.query("insert into public.organisation_roles (organisation_id, user_id, role) values ($1, $2, 'owner')", [
    org.rows[0].id,
    ids[1],
  ]);
  const community = await db.query(
    "insert into public.communities (slug, name, kind) values ('synthetic-choir', 'Choir', 'interest') returning id",
  );
  for (const [user, role] of [
    [ids[1], "owner"],
    [ids[2], "member"],
  ]) {
    await db.query(
      `insert into public.community_memberships (community_id, user_id, role, status, joined_at)
       values ($1, $2, $3, 'active', now())`,
      [community.rows[0].id, user, role],
    );
  }
  await db.query("commit");
  return ids;
}

const SNAPSHOT_SQL = `
  select json_object_agg(t, n order by t) as counts from (
    select 'auth.users' as t, (select count(*) from auth.users)::int as n
    union all
    select c.relname, (xpath('/row/n/text()',
      query_to_xml(format('select count(*) as n from public.%I', c.relname), false, true, '')))[1]::text::int
    from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
  ) s`;

async function protections(db, owner) {
  const failures = [];
  const expectError = async (sql, params, code) => {
    await db.query("begin");
    try {
      await db.query(sql, params);
      await db.query("set constraints all immediate");
      failures.push(`succeeded: ${sql}`);
    } catch (error) {
      if (error.code !== code) failures.push(`${sql}: ${error.code} ${error.message}`);
    } finally {
      await db.query("rollback");
    }
  };
  await expectError("update public.audit_logs set action = 'tampered'", [], "23001");
  await expectError("delete from public.platform_roles where user_id = $1", [owner], "23514");
  await expectError("update public.profiles set id = gen_random_uuid() where id = $1", [owner], "23001");
  const eligible = await db.query("select private.is_eligible($1) as ok", [owner]);
  if (eligible.rows[0].ok !== true) failures.push("predicate is_eligible no longer works");
  const anon = await db.query(
    `select count(*)::int as n from information_schema.role_table_grants
     where table_schema = 'public' and grantee in ('anon', 'authenticated')`,
  );
  if (anon.rows[0].n !== 0) failures.push("API roles gained table grants");
  return failures;
}

const schemaOnly = (url) =>
  run("pg_dump", [...connection(url), "--schema-only", "--no-owner", url.pathname.slice(1)])
    .split("\n")
    .filter((line) => !/^\\(un)?restrict /.test(line))
    .join("\n");

const dir = mkdtempSync(join(tmpdir(), "belunai-backup-"));
try {
  await resetDatabase();
  const ids = await withClient(source, seed);
  const before = await withClient(source, (db) => db.query(SNAPSHOT_SQL));

  const file = join(dir, "belunai.dump");
  run("pg_dump", [...connection(source), "--format=custom", "--file", file, source.pathname.slice(1)]);

  const admin = new URL(source);
  admin.pathname = "/postgres";
  await withClient(admin, async (db) => {
    await db.query(`drop database if exists ${target.pathname.slice(1)} with (force)`);
    await db.query(`create database ${target.pathname.slice(1)}`);
  });
  run("pg_restore", [...connection(target), "--exit-on-error", "--dbname", target.pathname.slice(1), file]);

  const after = await withClient(target, (db) => db.query(SNAPSHOT_SQL));
  const schemaMatches = schemaOnly(source) === schemaOnly(target);
  const dataMatches = JSON.stringify(before.rows[0].counts) === JSON.stringify(after.rows[0].counts);
  const failures = await withClient(target, (db) => protections(db, ids[0]));

  console.log(`rows: ${JSON.stringify(after.rows[0].counts)}`);
  console.log(`${schemaMatches ? "PASS" : "FAIL"}  restored schema identical to source`);
  console.log(`${dataMatches ? "PASS" : "FAIL"}  restored row counts identical to source`);
  console.log(`${failures.length ? "FAIL" : "PASS"}  protections active after restore${failures.map((f) => `\n      ${f}`).join("")}`);

  await withClient(admin, (db) => db.query(`drop database ${target.pathname.slice(1)} with (force)`));
  if (!schemaMatches || !dataMatches || failures.length) process.exit(1);
  console.log("Backup/restore smoke test passed.");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
