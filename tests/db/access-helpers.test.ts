// BEL-0203: shared access predicates, definer hardening (DB-19), actor matrix
// for the predicates (DB-02), append-only audit/moderation and immutable keys.
import { randomUUID } from "node:crypto";
import type pg from "pg";
import { describe, expect, it } from "vitest";
import {
  type AccountState,
  RESTRICT,
  connectTestDatabase,
  createAccount,
  createCommunity,
  createOrganisation,
  expectRejected,
} from "./helpers";

const OWNER = "belunai_access_owner";

const PREDICATES = [
  "are_friends(uuid,uuid)",
  "community_role(uuid,uuid)",
  "is_blocked(uuid,uuid)",
  "is_community_member(uuid,uuid)",
  "is_community_staff(uuid,uuid)",
  "is_eligible(uuid)",
  "is_organisation_admin(uuid,uuid)",
  "is_organisation_owner(uuid,uuid)",
  "is_platform_staff(uuid)",
  "organisation_role(uuid,uuid)",
  "platform_role(uuid)",
];

const STATES: AccountState[] = ["eligible", "incomplete", "suspended", "pending_deletion", "no_settings"];

async function value(db: pg.Client, sql: string, params: unknown[] = []) {
  const { rows } = await db.query(`select ${sql} as v`, params);
  return rows[0].v;
}

async function befriend(db: pg.Client, a: string, b: string, status = "accepted") {
  const [low, high] = a < b ? [a, b] : [b, a];
  await db.query(
    `insert into public.friendships (user_low_id, user_high_id, requested_by, status, responded_at)
     values ($1, $2, $1, $3, case when $3 = 'pending' then null else now() end)`,
    [low, high, status],
  );
}

describe("DB-19 definer hardening", () => {
  const db = connectTestDatabase();

  it("owns exactly the predicates, all SECURITY DEFINER with an empty search_path", async () => {
    const { rows } = await db.query(
      `select p.oid::regprocedure::text as sig, p.prosecdef, p.proconfig, n.nspname
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where p.proowner = $1::regrole order by 1`,
      [OWNER],
    );
    expect(rows.map((r) => r.sig)).toEqual(PREDICATES.map((p) => `private.${p}`));
    for (const row of rows) {
      expect(row.prosecdef, row.sig).toBe(true);
      expect(row.proconfig, row.sig).toEqual(['search_path=""']);
    }
  });

  it("has no other SECURITY DEFINER function in public or private", async () => {
    const { rows } = await db.query(
      `select p.oid::regprocedure::text as sig from pg_proc p
       where p.prosecdef and p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
         and p.proowner <> $1::regrole
         -- Provisioned by Supabase (tests/db/supabase-shim.sql); M01 revokes its API grants.
         and p.oid <> 'public.rls_auto_enable()'::regprocedure`,
      [OWNER],
    );
    expect(rows).toEqual([]);
  });

  it("gives the owner role no login, no elevated attributes and only column SELECT", async () => {
    const role = await db.query(
      `select rolcanlogin, rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolinherit
       from pg_roles where rolname = $1`,
      [OWNER],
    );
    expect(role.rows[0]).toEqual({
      rolcanlogin: false,
      rolsuper: false,
      rolcreaterole: false,
      rolcreatedb: false,
      rolreplication: false,
      rolinherit: false,
    });
    const tables = await db.query(
      `select table_name, privilege_type from information_schema.table_privileges where grantee = $1`,
      [OWNER],
    );
    expect(tables.rows).toEqual([]);
    const columns = await db.query(
      `select distinct privilege_type from information_schema.column_privileges where grantee = $1`,
      [OWNER],
    );
    expect(columns.rows).toEqual([{ privilege_type: "SELECT" }]);
    for (const schema of ["public", "private"]) {
      expect(await value(db, "has_schema_privilege($1, $2, 'CREATE')", [OWNER, schema])).toBe(false);
    }
    const memberOf = await db.query(
      `select roleid::regrole::text from pg_auth_members where member = $1::regrole`,
      [OWNER],
    );
    expect(memberOf.rows).toEqual([]);
  });

  it("never lets anon or authenticated call a predicate", async () => {
    for (const role of ["anon", "authenticated", "public"]) {
      for (const fn of PREDICATES) {
        expect(
          await value(db, "has_function_privilege($1, $2, 'EXECUTE')", [role, `private.${fn}`]),
          `${role} EXECUTE ${fn}`,
        ).toBe(false);
      }
    }
  });

  it("reads live rows only, never JWT claims or settings", async () => {
    const { rows } = await db.query(
      `select proname from pg_proc
       where proowner = $1::regrole and prosrc ~* 'jwt|current_setting|auth\\.'`,
      [OWNER],
    );
    expect(rows).toEqual([]);
    const id = await createAccount(db);
    await db.query(
      `select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: id, role: "authenticated", app_metadata: { role: "owner" }, user_metadata: { role: "owner" } })],
    );
    expect(await value(db, "private.platform_role($1)", [id])).toBeNull();
    expect(await value(db, "private.is_platform_staff($1)", [id])).toBe(false);
  });

  it("lets a policy call a predicate that reads the same table without RLS recursion", async () => {
    const id = await createAccount(db);
    const other = await createAccount(db);
    // Rolled back with the test: the shape a later task uses to expose a read.
    await db.query(`set local role ${OWNER}`);
    await db.query("grant execute on function private.is_eligible(uuid) to authenticated");
    await db.query("reset role");
    await db.query("grant usage on schema private to authenticated");
    await db.query("grant select (id, username) on public.profiles to authenticated");
    await db.query(
      `create policy profiles_probe on public.profiles for select to authenticated
       using (private.is_eligible((select auth.uid())) and id = (select auth.uid()))`,
    );
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [id]);
    await db.query("set local role authenticated");
    const { rows } = await db.query("select id from public.profiles");
    await db.query("reset role");
    expect(rows.map((r) => r.id)).toEqual([id]);
    expect(rows.map((r) => r.id)).not.toContain(other);
  });
});

describe("DB-02 predicate actor matrix", () => {
  const db = connectTestDatabase();

  it("eligible(u) is true only for an active, onboarded account with settings and terms", async () => {
    for (const state of STATES) {
      const id = await createAccount(db, state);
      expect(await value(db, "private.is_eligible($1)", [id]), state).toBe(state === "eligible");
    }
    await db.query("update public.account_settings set terms_accepted_at = null, terms_version = null");
    const noTerms = await db.query("select private.is_eligible(user_id) as v from public.account_settings");
    expect(noTerms.rows.every((r) => r.v === false)).toBe(true);
    expect(await value(db, "private.is_eligible(null)")).toBe(false);
    expect(await value(db, "private.is_eligible($1)", [randomUUID()])).toBe(false);
  });

  it("blocked(a,b) holds in both directions and is false for the same user", async () => {
    const a = await createAccount(db);
    const b = await createAccount(db);
    const c = await createAccount(db);
    await db.query("insert into public.user_blocks (blocker_id, blocked_id) values ($1, $2)", [a, b]);
    expect(await value(db, "private.is_blocked($1, $2)", [a, b])).toBe(true);
    expect(await value(db, "private.is_blocked($1, $2)", [b, a])).toBe(true);
    expect(await value(db, "private.is_blocked($1, $2)", [a, c])).toBe(false);
    expect(await value(db, "private.is_blocked($1, $1)", [a])).toBe(false);
    expect(await value(db, "private.is_blocked(null, $1)", [a])).toBe(false);
  });

  it("friends(a,b) needs an accepted pair, both eligible and no block", async () => {
    const a = await createAccount(db);
    const b = await createAccount(db);
    await befriend(db, a, b);
    expect(await value(db, "private.are_friends($1, $2)", [a, b])).toBe(true);
    expect(await value(db, "private.are_friends($1, $2)", [b, a])).toBe(true);
    expect(await value(db, "private.are_friends($1, $1)", [a])).toBe(false);

    await db.query("savepoint s");
    await db.query("update public.account_settings set account_status = 'suspended' where user_id = $1", [b]);
    expect(await value(db, "private.are_friends($1, $2)", [a, b]), "suspended friend").toBe(false);
    await db.query("rollback to savepoint s");

    await db.query("insert into public.user_blocks (blocker_id, blocked_id) values ($1, $2)", [b, a]);
    expect(await value(db, "private.are_friends($1, $2)", [a, b]), "blocked pair").toBe(false);

    for (const status of ["pending", "declined"]) {
      const x = await createAccount(db);
      const y = await createAccount(db);
      await befriend(db, x, y, status);
      expect(await value(db, "private.are_friends($1, $2)", [x, y]), status).toBe(false);
    }
  });

  it("organisation roles count only for eligible users in an active organisation", async () => {
    const org = await createOrganisation(db);
    const owner = await createAccount(db);
    const admin = await createAccount(db);
    const outsider = await createAccount(db);
    const suspendedAdmin = await createAccount(db, "suspended");
    const roles = "insert into public.organisation_roles (organisation_id, user_id, role) values ($1, $2, $3)";
    await db.query(roles, [org, owner, "owner"]);
    await db.query(roles, [org, admin, "admin"]);
    await db.query(roles, [org, suspendedAdmin, "admin"]);

    const check = async (u: string) => ({
      role: await value(db, "private.organisation_role($1, $2)", [u, org]),
      admin: await value(db, "private.is_organisation_admin($1, $2)", [u, org]),
      owner: await value(db, "private.is_organisation_owner($1, $2)", [u, org]),
    });
    expect(await check(owner)).toEqual({ role: "owner", admin: true, owner: true });
    expect(await check(admin)).toEqual({ role: "admin", admin: true, owner: false });
    expect(await check(outsider)).toEqual({ role: null, admin: false, owner: false });
    expect(await check(suspendedAdmin)).toEqual({ role: null, admin: false, owner: false });

    for (const status of ["suspended", "archived"]) {
      await db.query("update public.organisations set status = $1 where id = $2", [status, org]);
      expect(await check(owner), `${status} organisation`).toEqual({ role: null, admin: false, owner: false });
    }
  });

  it("community roles count only for eligible active members of an active community", async () => {
    const community = await createCommunity(db, { privacy: "private" });
    const insert = `insert into public.community_memberships (community_id, user_id, role, status, joined_at)
                    values ($1, $2, $3, $4, case when $4 = 'pending' then null else now() end)`;
    const expected: Record<string, { role: string | null; member: boolean; staff: boolean }> = {};
    const actors: Record<string, string> = {};
    for (const [name, role, status, state] of [
      ["owner", "owner", "active", "eligible"],
      ["admin", "admin", "active", "eligible"],
      ["moderator", "moderator", "active", "eligible"],
      ["member", "member", "active", "eligible"],
      ["pending", "member", "pending", "eligible"],
      ["banned", "member", "banned", "eligible"],
      ["suspended moderator", "moderator", "active", "suspended"],
      ["incomplete member", "member", "active", "incomplete"],
    ] as const) {
      actors[name] = await createAccount(db, state);
      await db.query(insert, [community, actors[name], role, status]);
      const counts = status === "active" && state === "eligible";
      expected[name] = {
        role: counts ? role : null,
        member: counts,
        staff: counts && role !== "member",
      };
    }
    actors.outsider = await createAccount(db);
    expected.outsider = { role: null, member: false, staff: false };

    const check = async (u: string) => ({
      role: await value(db, "private.community_role($1, $2)", [u, community]),
      member: await value(db, "private.is_community_member($1, $2)", [u, community]),
      staff: await value(db, "private.is_community_staff($1, $2)", [u, community]),
    });
    for (const [name, id] of Object.entries(actors)) {
      expect(await check(id), name).toEqual(expected[name]);
    }

    // Scopes are isolated: a role in one community grants nothing in another.
    const elsewhere = await createCommunity(db);
    expect(await value(db, "private.is_community_staff($1, $2)", [actors.owner, elsewhere])).toBe(false);

    for (const status of ["suspended", "archived"]) {
      await db.query("update public.communities set status = $1 where id = $2", [status, community]);
      expect(await check(actors.owner), `${status} community`).toEqual({ role: null, member: false, staff: false });
    }
  });

  it("platform staff needs an explicit role on an eligible account", async () => {
    const insert = "insert into public.platform_roles (user_id, role) values ($1, $2)";
    for (const role of ["owner", "admin", "moderator"]) {
      const id = await createAccount(db);
      await db.query(insert, [id, role]);
      expect(await value(db, "private.platform_role($1)", [id]), role).toBe(role);
      expect(await value(db, "private.is_platform_staff($1)", [id]), role).toBe(true);
    }
    for (const state of ["suspended", "pending_deletion", "incomplete"] as const) {
      const id = await createAccount(db, state);
      await db.query(insert, [id, "admin"]);
      expect(await value(db, "private.is_platform_staff($1)", [id]), state).toBe(false);
    }
    expect(await value(db, "private.is_platform_staff($1)", [await createAccount(db)])).toBe(false);
    expect(await value(db, "private.is_platform_staff(null)")).toBe(false);
  });

  it("organisation and community roles imply no platform power and vice versa", async () => {
    const org = await createOrganisation(db);
    const community = await createCommunity(db);
    const orgOwner = await createAccount(db);
    const platformAdmin = await createAccount(db);
    await db.query("insert into public.organisation_roles (organisation_id, user_id, role) values ($1, $2, 'owner')", [
      org,
      orgOwner,
    ]);
    await db.query("insert into public.platform_roles (user_id, role) values ($1, 'admin')", [platformAdmin]);
    expect(await value(db, "private.is_platform_staff($1)", [orgOwner])).toBe(false);
    expect(await value(db, "private.is_community_member($1, $2)", [orgOwner, community])).toBe(false);
    expect(await value(db, "private.is_organisation_admin($1, $2)", [platformAdmin, org])).toBe(false);
    expect(await value(db, "private.is_community_staff($1, $2)", [platformAdmin, community])).toBe(false);
  });
});

describe("append-only audit_logs and moderation_actions", () => {
  const db = connectTestDatabase();

  async function auditRow(actor: string | null = null) {
    const { rows } = await db.query(
      `insert into public.audit_logs (actor_id, action, resource_type, resource_id, correlation_id)
       values ($1, 'platform_role.grant', 'profile', $2, $3) returning id`,
      [actor, randomUUID(), randomUUID()],
    );
    return rows[0].id as string;
  }

  async function actionRow(actor: string | null = null) {
    const { rows } = await db.query(
      `insert into public.moderation_actions (actor_id, action_type, target_type, target_id, reason)
       values ($1, 'remove_content', 'post', $2, 'Policy') returning id`,
      [actor, randomUUID()],
    );
    return rows[0].id as string;
  }

  it("rejects edits, deletes and truncation of audit_logs", async () => {
    const id = await auditRow();
    const someone = await createAccount(db);
    for (const sql of [
      "update public.audit_logs set action = 'other' where id = $1",
      "update public.audit_logs set metadata = '{\"x\": 1}' where id = $1",
      "update public.audit_logs set created_at = now() - interval '1 day' where id = $1",
      "delete from public.audit_logs where id = $1",
    ]) {
      await expectRejected(db, sql, [id], { code: RESTRICT });
    }
    // actor_id may only ever become NULL, never be reassigned.
    await expectRejected(db, "update public.audit_logs set actor_id = $2 where id = $1", [id, someone], {
      code: RESTRICT,
    });
    await expectRejected(db, "truncate public.audit_logs", [], { code: RESTRICT });
  });

  it("rejects edits, deletes and truncation of moderation_actions", async () => {
    const id = await actionRow();
    for (const sql of [
      "update public.moderation_actions set reason = 'Rewritten' where id = $1",
      "update public.moderation_actions set action_type = 'restore_content' where id = $1",
      "update public.moderation_actions set target_id = gen_random_uuid() where id = $1",
      "delete from public.moderation_actions where id = $1",
    ]) {
      await expectRejected(db, sql, [id], { code: RESTRICT });
    }
    await expectRejected(db, "truncate public.moderation_actions", [], { code: RESTRICT });
  });

  it("still lets account erasure and target cleanup NULL references", async () => {
    const actor = await createAccount(db);
    const audit = await auditRow(actor);
    const action = await actionRow(actor);
    await db.query("delete from auth.users where id = $1", [actor]);
    const a = await db.query("select actor_id, action from public.audit_logs where id = $1", [audit]);
    expect(a.rows[0]).toEqual({ actor_id: null, action: "platform_role.grant" });
    const m = await db.query("select actor_id from public.moderation_actions where id = $1", [action]);
    expect(m.rows[0].actor_id).toBeNull();
    await db.query("update public.moderation_actions set target_id = null where id = $1", [action]);
    const t = await db.query("select target_id, reason from public.moderation_actions where id = $1", [action]);
    expect(t.rows[0]).toEqual({ target_id: null, reason: "Policy" });
  });
});

describe("immutable primary keys", () => {
  const db = connectTestDatabase();

  it("guards exactly the primary key columns of every table", async () => {
    const { rows } = await db.query(`
      select c.relname,
             (select string_agg(quote_literal(a.attname), ', ' order by k.ord)
              from unnest(pk.conkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = c.oid and a.attnum = k.attnum) as pk,
             (select substring(pg_get_triggerdef(t.oid) from 'forbid_key_update\\((.*)\\)$')
              from pg_trigger t
              where t.tgrelid = c.oid and t.tgname = c.relname || '_forbid_key_update') as guarded
      from pg_class c
      join pg_constraint pk on pk.conrelid = c.oid and pk.contype = 'p'
      where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
      order by c.relname`);
    expect(rows).toHaveLength(26);
    for (const row of rows) expect(row.guarded, row.relname).toBe(row.pk);
  });

  it("rejects primary key updates, single and composite", async () => {
    const a = await createAccount(db);
    const b = await createAccount(db);
    await expectRejected(db, "update public.profiles set id = $2 where id = $1", [a, randomUUID()], { code: RESTRICT });
    await db.query("insert into public.user_follows (follower_id, following_id) values ($1, $2)", [a, b]);
    const c = await createAccount(db);
    await expectRejected(db, "update public.user_follows set following_id = $2 where follower_id = $1", [a, c], {
      code: RESTRICT,
    });
    // Non-key columns stay editable by trusted operations.
    await db.query("update public.profiles set bio = 'Hello' where id = $1", [a]);
  });
});
