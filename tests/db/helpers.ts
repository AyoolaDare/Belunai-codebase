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

/**
 * Runs the transaction's deferred constraint checks now (as COMMIT would)
 * and expects them to fail with the named constraint. The test transaction
 * itself is still rolled back afterwards.
 */
export async function expectCommitRejected(db: pg.Client, constraint: string) {
  await expectRejected(db, "set constraints all immediate", [], { constraint });
  await db.query("set constraints all deferred");
}

/** Runs the deferred checks now and expects them to pass. */
export async function expectCommitAccepted(db: pg.Client) {
  await db.query("set constraints all immediate");
  await db.query("set constraints all deferred");
}

// ---------------------------------------------------------------------------
// Scoped fixtures. Synthetic data only.

export async function createOwnedOrganisation(db: pg.Client, owner?: string) {
  const ownerId = owner ?? (await createAccount(db));
  const organisationId = await createOrganisation(db);
  await db.query("insert into public.organisation_roles (organisation_id, user_id, role) values ($1, $2, 'owner')", [
    organisationId,
    ownerId,
  ]);
  return { organisationId, ownerId };
}

export async function addOrganisationAdmin(db: pg.Client, organisationId: string, user?: string) {
  const userId = user ?? (await createAccount(db));
  await db.query("insert into public.organisation_roles (organisation_id, user_id, role) values ($1, $2, 'admin')", [
    organisationId,
    userId,
  ]);
  return userId;
}

export async function createOwnedCommunity(db: pg.Client, owner?: string) {
  const ownerId = owner ?? (await createAccount(db));
  const communityId = await createCommunity(db);
  await addCommunityMember(db, communityId, "owner", ownerId);
  return { communityId, ownerId };
}

export async function addCommunityMember(db: pg.Client, communityId: string, role = "member", user?: string) {
  const userId = user ?? (await createAccount(db));
  await db.query(
    `insert into public.community_memberships (community_id, user_id, role, status, joined_at)
     values ($1, $2, $3, 'active', now())`,
    [communityId, userId, role],
  );
  return userId;
}

// ---------------------------------------------------------------------------
// Committed-data harness for concurrency tests. Each client autocommits unless
// the test opens a transaction. Everything created through `track` is removed
// afterwards, including platform roles, which the owner guarantee otherwise
// keeps forever (removed with triggers disabled: local superuser test only).

export function connectCommittedClients(count: number) {
  const clients = Array.from({ length: count }, () => new pg.Client({ connectionString: testDatabaseUrl().toString() }));
  const created = { users: new Set<string>(), organisations: new Set<string>(), communities: new Set<string>() };
  beforeAll(() => Promise.all(clients.map((c) => c.connect())));
  afterAll(() => Promise.all(clients.map((c) => c.end())));
  afterEach(async () => {
    const [admin] = clients;
    await Promise.all(clients.map((c) => c.query("rollback").catch(() => undefined)));
    await admin.query("begin");
    await admin.query("set local session_replication_role = replica");
    await admin.query("delete from public.platform_roles where user_id = any($1)", [[...created.users]]);
    await admin.query("delete from public.audit_logs where resource_id = any($1)", [[...created.users]]);
    await admin.query("commit");
    await admin.query("delete from public.communities where id = any($1)", [[...created.communities]]);
    await admin.query("delete from public.organisations where id = any($1)", [[...created.organisations]]);
    await admin.query("delete from auth.users where id = any($1)", [[...created.users]]);
    created.users.clear();
    created.organisations.clear();
    created.communities.clear();
  });
  return {
    clients,
    track: {
      user: (id: string) => (created.users.add(id), id),
      organisation: (id: string) => (created.organisations.add(id), id),
      community: (id: string) => (created.communities.add(id), id),
    },
  };
}
