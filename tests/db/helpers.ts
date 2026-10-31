import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, expect } from "vitest";
import { HOSTED, hostedClientConfig } from "../../scripts/db-hosted.mjs";
import { testDatabaseUrl } from "../../scripts/db-reset.mjs";

/**
 * One connection per test file. Each test runs inside a transaction that is
 * rolled back, so tests are isolated and leave the database unchanged. That
 * rollback is what makes hosted runs against `belunai-test` safe.
 */
export function connectTestDatabase() {
  const db = new pg.Client(
    HOSTED ? hostedClientConfig() : { connectionString: testDatabaseUrl().toString() },
  );
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
