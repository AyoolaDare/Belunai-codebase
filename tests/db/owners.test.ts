// BEL-0205: exactly-one-owner guarantees (DB-08, DB-15), platform owner
// bootstrap, shared lock helpers and audit minimisation.
import { randomUUID } from "node:crypto";
import type pg from "pg";
import { describe, expect, it } from "vitest";
import {
  CHECK,
  UNIQUE,
  addCommunityMember,
  addOrganisationAdmin,
  connectCommittedClients,
  connectTestDatabase,
  createAccount,
  createCommunity,
  createOrganisation,
  createOwnedCommunity,
  createOwnedOrganisation,
  expectCommitAccepted,
  expectCommitRejected,
  expectRejected,
} from "./helpers";

const ORG_OWNER = "organisations_exactly_one_owner";
const COMMUNITY_OWNER = "communities_exactly_one_owner";
const PLATFORM_OWNER = "platform_roles_exactly_one_owner";

describe("organisation owner", () => {
  const db = connectTestDatabase();
  const setRole = (o: string, u: string, role: string) =>
    db.query("update public.organisation_roles set role = $3 where organisation_id = $1 and user_id = $2", [o, u, role]);

  it("rejects an active organisation without an owner at commit", async () => {
    await createOrganisation(db);
    await expectCommitRejected(db, ORG_OWNER);
  });

  it("accepts creation with its owner in the same transaction", async () => {
    const { organisationId } = await createOwnedOrganisation(db);
    await addOrganisationAdmin(db, organisationId);
    await expectCommitAccepted(db);
  });

  it("never allows a second owner", async () => {
    const { organisationId } = await createOwnedOrganisation(db);
    const admin = await addOrganisationAdmin(db, organisationId);
    await expectRejected(db, "update public.organisation_roles set role = 'owner' where user_id = $1", [admin], {
      code: UNIQUE,
    });
  });

  it("allows a transfer that demotes then promotes in one transaction", async () => {
    const { organisationId, ownerId } = await createOwnedOrganisation(db);
    const admin = await addOrganisationAdmin(db, organisationId);
    await expectCommitAccepted(db);
    await setRole(organisationId, ownerId, "admin");
    await setRole(organisationId, admin, "owner");
    await expectCommitAccepted(db);
  });

  it("rejects demoting or removing the only owner", async () => {
    const { organisationId, ownerId } = await createOwnedOrganisation(db);
    await expectCommitAccepted(db);
    await setRole(organisationId, ownerId, "admin");
    await expectCommitRejected(db, ORG_OWNER);
  });

  it("rejects removing the owner's role row", async () => {
    const { organisationId, ownerId } = await createOwnedOrganisation(db);
    await expectCommitAccepted(db);
    await db.query("delete from public.organisation_roles where organisation_id = $1 and user_id = $2", [
      organisationId,
      ownerId,
    ]);
    await expectCommitRejected(db, ORG_OWNER);
  });

  it("stops the last owner's account erasure from leaving the organisation ownerless (DB-15)", async () => {
    const { ownerId } = await createOwnedOrganisation(db);
    await expectCommitAccepted(db);
    await db.query("delete from auth.users where id = $1", [ownerId]);
    await expectCommitRejected(db, ORG_OWNER);
  });

  it("lets erasure proceed once ownership has moved, keeping creator attribution separate", async () => {
    const { organisationId, ownerId } = await createOwnedOrganisation(db);
    await db.query("update public.organisations set created_by = $2 where id = $1", [organisationId, ownerId]);
    const admin = await addOrganisationAdmin(db, organisationId);
    await expectCommitAccepted(db);
    await setRole(organisationId, ownerId, "admin");
    await setRole(organisationId, admin, "owner");
    await db.query("delete from auth.users where id = $1", [ownerId]);
    await expectCommitAccepted(db);
    const { rows } = await db.query("select created_by from public.organisations where id = $1", [organisationId]);
    expect(rows[0].created_by).toBeNull();
  });

  it("lets suspended or archived organisations have no owner, but not on reactivation", async () => {
    for (const status of ["suspended", "archived"]) {
      await db.query("savepoint pass");
      const { organisationId, ownerId } = await createOwnedOrganisation(db);
      await expectCommitAccepted(db);
      await db.query("update public.organisations set status = $2 where id = $1", [organisationId, status]);
      await db.query("delete from public.organisation_roles where user_id = $1", [ownerId]);
      await expectCommitAccepted(db);
      await db.query("update public.organisations set status = 'active' where id = $1", [organisationId]);
      await expectCommitRejected(db, ORG_OWNER);
      await db.query("rollback to savepoint pass");
    }
  });

  it("allows deleting the whole organisation", async () => {
    const { organisationId } = await createOwnedOrganisation(db);
    await expectCommitAccepted(db);
    await db.query("delete from public.organisations where id = $1", [organisationId]);
    await expectCommitAccepted(db);
  });
});

describe("community owner", () => {
  const db = connectTestDatabase();
  const update = (c: string, u: string, set: string) =>
    db.query(`update public.community_memberships set ${set} where community_id = $1 and user_id = $2`, [c, u]);

  it("rejects an active community without an owner at commit", async () => {
    await createCommunity(db);
    await expectCommitRejected(db, COMMUNITY_OWNER);
  });

  it("accepts creation with its owner, and never a second owner", async () => {
    const { communityId } = await createOwnedCommunity(db);
    await expectCommitAccepted(db);
    await expectRejected(
      db,
      "insert into public.community_memberships (community_id, user_id, role, status, joined_at) values ($1, $2, 'owner', 'active', now())",
      [communityId, await createAccount(db)],
      { code: UNIQUE },
    );
  });

  it("allows transfer, rejects leaving, demotion, ban or erasure of the only owner", async () => {
    const { communityId, ownerId } = await createOwnedCommunity(db);
    const admin = await addCommunityMember(db, communityId, "admin");
    await expectCommitAccepted(db);

    await update(communityId, ownerId, "role = 'admin'");
    await update(communityId, admin, "role = 'owner'");
    await expectCommitAccepted(db);

    // `admin` is now the owner.
    for (const change of [
      () => update(communityId, admin, "role = 'moderator'"),
      () => update(communityId, admin, "role = 'member', status = 'banned'"),
      () => db.query("delete from public.community_memberships where user_id = $1", [admin]),
      () => db.query("delete from auth.users where id = $1", [admin]),
    ]) {
      await db.query("savepoint attempt");
      await change();
      await expectCommitRejected(db, COMMUNITY_OWNER);
      await db.query("rollback to savepoint attempt");
    }
  });

  it("lets suspended or archived communities have no owner, but not on reactivation", async () => {
    const { communityId, ownerId } = await createOwnedCommunity(db);
    await expectCommitAccepted(db);
    await db.query("update public.communities set status = 'archived' where id = $1", [communityId]);
    await db.query("delete from public.community_memberships where user_id = $1", [ownerId]);
    await expectCommitAccepted(db);
    await db.query("update public.communities set status = 'active' where id = $1", [communityId]);
    await expectCommitRejected(db, COMMUNITY_OWNER);
  });
});

describe("platform owner and bootstrap", () => {
  const db = connectTestDatabase();
  const bootstrap = (user: string) =>
    db.query("select private.bootstrap_platform_owner($1, $2)", [user, randomUUID()]);

  it("never creates a platform role on sign-up or onboarding", async () => {
    for (let i = 0; i < 3; i += 1) await createAccount(db);
    const { rows } = await db.query("select count(*)::int as n from public.platform_roles");
    expect(rows[0].n).toBe(0);
  });

  it("requires the owner first: no admin or moderator before bootstrap", async () => {
    await db.query("insert into public.platform_roles (user_id, role) values ($1, 'admin')", [await createAccount(db)]);
    await expectCommitRejected(db, PLATFORM_OWNER);
  });

  it("bootstraps one eligible owner with a minimal audit record", async () => {
    const owner = await createAccount(db);
    const correlation = randomUUID();
    await db.query("select private.bootstrap_platform_owner($1, $2)", [owner, correlation]);
    await expectCommitAccepted(db);
    const roles = await db.query("select user_id, role, assigned_by from public.platform_roles");
    expect(roles.rows).toEqual([{ user_id: owner, role: "owner", assigned_by: null }]);
    const audit = await db.query(
      "select actor_id, action, resource_type, resource_id, correlation_id, metadata from public.audit_logs",
    );
    expect(audit.rows).toEqual([
      {
        actor_id: null,
        action: "platform_owner.bootstrap",
        resource_type: "profile",
        resource_id: owner,
        correlation_id: correlation,
        metadata: { version: 1 },
      },
    ]);
  });

  it("refuses ineligible accounts and a second bootstrap", async () => {
    for (const state of ["incomplete", "suspended", "pending_deletion", "no_settings"] as const) {
      await expectRejected(db, "select private.bootstrap_platform_owner($1, gen_random_uuid())", [
        await createAccount(db, state),
      ], { code: CHECK });
    }
    await bootstrap(await createAccount(db));
    await expectRejected(db, "select private.bootstrap_platform_owner($1, gen_random_uuid())", [
      await createAccount(db),
    ], { code: UNIQUE });
  });

  it("keeps exactly one owner after bootstrap: transfer yes, removal or erasure no", async () => {
    const owner = await createAccount(db);
    const admin = await createAccount(db);
    await bootstrap(owner);
    await db.query("insert into public.platform_roles (user_id, role) values ($1, 'admin')", [admin]);
    await expectCommitAccepted(db);

    await db.query("savepoint s");
    await db.query("update public.platform_roles set role = 'admin' where user_id = $1", [owner]);
    await db.query("update public.platform_roles set role = 'owner' where user_id = $1", [admin]);
    await expectCommitAccepted(db);
    await db.query("rollback to savepoint s");

    for (const sql of [
      "delete from public.platform_roles where user_id = $1",
      "update public.platform_roles set role = 'moderator' where user_id = $1",
      "delete from auth.users where id = $1",
    ]) {
      await db.query("savepoint attempt");
      await db.query(sql, [owner]);
      await expectCommitRejected(db, PLATFORM_OWNER);
      await db.query("rollback to savepoint attempt");
    }
    // Even with no other platform roles, the owner cannot simply disappear.
    await db.query("delete from public.platform_roles where user_id = $1", [admin]);
    await db.query("delete from public.platform_roles where user_id = $1", [owner]);
    await expectCommitRejected(db, PLATFORM_OWNER);
  });
});

describe("audit minimisation", () => {
  const db = connectTestDatabase();
  const insert = (metadata: unknown) =>
    db.query(
      `insert into public.audit_logs (action, resource_type, correlation_id, metadata)
       values ('test.event', 'profile', gen_random_uuid(), $1::jsonb)`,
      [JSON.stringify(metadata)],
    );

  it("accepts empty or versioned, non-identifying metadata", async () => {
    for (const metadata of [
      {},
      { version: 1 },
      { version: 2, from_role: "admin", to_role: "owner", organisation_id: randomUUID() },
      { version: 1, stage: "storage_purge", counts: { objects: 3 }, outcome: "retry" },
    ]) {
      await insert(metadata);
    }
  });

  it("rejects unversioned metadata, secrets, contact details and bodies at any depth", async () => {
    for (const metadata of [
      { stage: "x" },
      { version: 0 },
      { version: "1" },
      { version: 1, password: "x" },
      { version: 1, access_token: "x" },
      { version: 1, otp: "123456" },
      { version: 1, email: "x" },
      { version: 1, phone_number: "x" },
      { version: 1, message_body: "x" },
      { version: 1, request: { headers: { Authorization: "x" } } },
      { version: 1, note: "someone@example.com" },
      { version: 1, value: "eyJhbGciOiJIUzI1NiJ9.e30.x" },
      { version: 1, key: "sb_secret_abc" },
      { version: 1, contact: "+44 20 7946 0958" },
      { version: 1, list: ["ok", "x".repeat(501)] },
    ]) {
      await expectRejected(
        db,
        `insert into public.audit_logs (action, resource_type, correlation_id, metadata)
         values ('test.event', 'profile', gen_random_uuid(), $1::jsonb)`,
        [JSON.stringify(metadata)],
        { constraint: "audit_logs_metadata_minimal_check" },
      );
    }
  });
});

describe("DB-08 concurrency and shared locks (committed transactions)", () => {
  const { clients, track } = connectCommittedClients(2);
  const [a, b] = clients;

  async function setup(fn: (db: pg.Client) => Promise<void>) {
    await a.query("begin");
    await fn(a);
    await a.query("commit");
  }

  async function account() {
    return track.user(await createAccount(a));
  }

  const owners = async (organisationId: string) =>
    (
      await a.query("select user_id from public.organisation_roles where organisation_id = $1 and role = 'owner'", [
        organisationId,
      ])
    ).rows.map((r) => r.user_id);

  it("racing bootstraps: exactly one platform owner", async () => {
    const [x, y] = [await account(), await account()];
    await a.query("begin");
    await b.query("begin");
    await a.query("select private.bootstrap_platform_owner($1, gen_random_uuid())", [x]);
    const second = b.query("select private.bootstrap_platform_owner($1, gen_random_uuid())", [y]).then(
      () => null,
      (error: { code?: string }) => error.code,
    );
    await a.query("commit");
    expect(await second).toBe(UNIQUE);
    await b.query("rollback");
    const { rows } = await a.query("select user_id from public.platform_roles where role = 'owner'");
    expect(rows.map((r) => r.user_id)).toEqual([x]);
  });

  it("transfer racing removal of the new owner: the removal fails, one owner remains", async () => {
    const [x, y] = [await account(), await account()];
    let organisationId = "";
    await setup(async (db) => {
      ({ organisationId } = await createOwnedOrganisation(db, x));
      track.organisation(organisationId);
      await addOrganisationAdmin(db, organisationId, y);
    });

    await a.query("begin");
    await a.query("select 1 from public.organisations where id = $1 for update", [organisationId]);
    await a.query("update public.organisation_roles set role = 'admin' where user_id = $1", [x]);
    await a.query("update public.organisation_roles set role = 'owner' where user_id = $1", [y]);
    await b.query("begin");
    const removal = b.query("delete from public.organisation_roles where organisation_id = $1 and user_id = $2", [
      organisationId,
      y,
    ]);
    await a.query("commit");
    await removal;
    await expect(b.query("commit")).rejects.toMatchObject({ constraint: ORG_OWNER });
    expect(await owners(organisationId)).toEqual([y]);
  });

  it("two racing transfers: one wins, the other cannot add a second owner", async () => {
    const [x, y, z] = [await account(), await account(), await account()];
    let organisationId = "";
    await setup(async (db) => {
      ({ organisationId } = await createOwnedOrganisation(db, x));
      track.organisation(organisationId);
      await addOrganisationAdmin(db, organisationId, y);
      await addOrganisationAdmin(db, organisationId, z);
    });
    const transfer = async (db: pg.Client, to: string) => {
      await db.query("begin");
      await db.query("update public.organisation_roles set role = 'admin' where user_id = $1", [x]);
      await db.query("update public.organisation_roles set role = 'owner' where user_id = $1", [to]);
      await db.query("commit");
    };
    await a.query("begin");
    await a.query("update public.organisation_roles set role = 'admin' where user_id = $1", [x]);
    await a.query("update public.organisation_roles set role = 'owner' where user_id = $1", [y]);
    const other = transfer(b, z).then(
      () => null,
      (error: { code?: string }) => error.code,
    );
    await a.query("commit");
    expect(await other).toBe(UNIQUE);
    await b.query("rollback");
    expect(await owners(organisationId)).toEqual([y]);
  });

  it("owner erasure racing a transfer away from them: both succeed in order, one owner remains", async () => {
    const [x, y] = [await account(), await account()];
    let organisationId = "";
    await setup(async (db) => {
      ({ organisationId } = await createOwnedOrganisation(db, x));
      track.organisation(organisationId);
      await addOrganisationAdmin(db, organisationId, y);
    });
    await a.query("begin");
    await a.query("update public.organisation_roles set role = 'admin' where user_id = $1", [x]);
    await a.query("update public.organisation_roles set role = 'owner' where user_id = $1", [y]);
    await b.query("begin");
    const erasure = b.query("delete from auth.users where id = $1", [x]);
    await a.query("commit");
    await erasure;
    await b.query("commit");
    expect(await owners(organisationId)).toEqual([y]);
  });

  it("owner erasure without a transfer is rolled back at commit", async () => {
    const x = await account();
    await setup(async (db) => {
      const { organisationId } = await createOwnedOrganisation(db, x);
      track.organisation(organisationId);
    });
    await b.query("begin");
    await b.query("delete from auth.users where id = $1", [x]);
    await expect(b.query("commit")).rejects.toMatchObject({ constraint: ORG_OWNER });
    const { rows } = await a.query("select count(*)::int as n from public.profiles where id = $1", [x]);
    expect(rows[0].n).toBe(1);
  });

  it("lock_pair and lock_accounts take the same locks whatever the argument order", async () => {
    const [x, y] = [await account(), await account()];
    await a.query("begin");
    await a.query("select private.lock_pair($1, $2)", [x, y]);
    await a.query("select private.lock_accounts($1)", [[x, y]]);
    await b.query("begin");
    await b.query("set local lock_timeout = '200ms'");
    await expectRejected(b, "select private.lock_pair($1, $2)", [y, x], { code: "55P03" });
    await expectRejected(b, "select private.lock_accounts($1)", [[y, x]], { code: "55P03" });
    await a.query("commit");
    await b.query("select private.lock_pair($1, $2)", [y, x]);
    await b.query("select private.lock_accounts($1)", [[y, x]]);
    await b.query("commit");
  });
});
