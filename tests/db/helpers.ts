import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, expect } from "vitest";
import { testDatabaseUrl } from "../../scripts/db-reset.mjs";

/**
 * One connection per test file. Each test runs inside a transaction that is
 * rolled back, so tests are isolated and leave the database unchanged.
 */
export function connectTestDatabase() {
  const db = new pg.Client({ connectionString: testDatabaseUrl().toString() });
  beforeAll(() => db.connect());
  afterAll(() => db.end());
  beforeEach(() => db.query("begin"));
  afterEach(() => db.query("rollback"));
  return db;
}

/** Runs `sql` in a savepoint and asserts it fails with the given error. */
export async function expectRejected(
  db: pg.Client,
  sql: string,
  params: unknown[],
  expected: { constraint?: string; code?: string },
) {
  await db.query("savepoint expect_rejected");
  let error: (Error & { constraint?: string; code?: string }) | undefined;
  try {
    await db.query(sql, params);
  } catch (e) {
    error = e as typeof error;
  } finally {
    await db.query("rollback to savepoint expect_rejected");
  }
  expect(error, `expected rejection: ${sql}`).toBeDefined();
  if (expected.constraint) expect(error?.constraint).toBe(expected.constraint);
  if (expected.code) expect(error?.code).toBe(expected.code);
}

/** Inserts a synthetic auth user plus profile and returns its id. */
export async function createUser(db: pg.Client, username?: string) {
  const id = randomUUID();
  await db.query("insert into auth.users (id) values ($1)", [id]);
  await db.query("insert into public.profiles (id, username) values ($1, $2)", [id, username ?? null]);
  return id;
}

/** Two user ids ordered as the canonical (low, high) pair. */
export async function createPair(db: pg.Client) {
  const a = await createUser(db);
  const b = await createUser(db);
  const { rows } = await db.query("select $1::uuid < $2::uuid as ordered", [a, b]);
  return rows[0].ordered ? [a, b] : [b, a];
}

export async function createOrganisation(db: pg.Client, slug = `org-${randomUUID().slice(0, 8)}`) {
  const { rows } = await db.query(
    "insert into public.organisations (slug, name) values ($1, 'Grace Church') returning id",
    [slug],
  );
  return rows[0].id as string;
}

export const CHECK = "23514";
export const UNIQUE = "23505";
export const FOREIGN_KEY = "23503";
export const INSUFFICIENT_PRIVILEGE = "42501";

export const RESTRICT = "23001";

export type AccountState = "eligible" | "incomplete" | "suspended" | "pending_deletion" | "no_settings";

/**
 * Inserts a synthetic account in the given state. "eligible" has a complete
 * profile, accepted terms and an active account; each other state differs from
 * it in exactly one way.
 */
export async function createAccount(db: pg.Client, state: AccountState = "eligible") {
  const id = randomUUID();
  const username = `u_${id.slice(0, 8)}`;
  await db.query("insert into auth.users (id) values ($1)", [id]);
  await db.query(
    `insert into public.profiles (id, username, display_name, onboarding_completed_at)
     values ($1, $2, 'Test Person', case when $3 then now() end)`,
    [id, username, state !== "incomplete"],
  );
  if (state !== "no_settings") {
    await db.query(
      `insert into public.account_settings
         (user_id, account_status, terms_accepted_at, terms_version, privacy_notice_version, deletion_requested_at)
       values ($1, $2, now(), '2026-10', '2026-10', case when $2 = 'pending_deletion' then now() end)`,
      [id, state === "suspended" || state === "pending_deletion" ? state : "active"],
    );
  }
  return id;
}

export async function createCommunity(
  db: pg.Client,
  { status = "active", privacy = "public" }: { status?: string; privacy?: string } = {},
) {
  const { rows } = await db.query(
    `insert into public.communities (slug, name, kind, privacy, status)
     values ($1, 'Community', 'interest', $2, $3) returning id`,
    [`c-${randomUUID().slice(0, 8)}`, privacy, status],
  );
  return rows[0].id as string;
}
