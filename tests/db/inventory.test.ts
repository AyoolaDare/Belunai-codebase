// DB-01: exactly 26 application tables with deny-by-default RLS and grants.
import { describe, expect, it } from "vitest";
import { INSUFFICIENT_PRIVILEGE, createUser, expectRejected, connectTestDatabase } from "./helpers";

const EXPECTED_TABLES = [
  "account_settings",
  "audit_logs",
  "communities",
  "community_memberships",
  "content_reports",
  "conversations",
  "friendships",
  "interests",
  "invitations",
  "messages",
  "moderation_actions",
  "notifications",
  "organisation_follows",
  "organisation_roles",
  "organisations",
  "platform_roles",
  "post_comments",
  "post_likes",
  "post_media",
  "post_saves",
  "posts",
  "profile_interests",
  "profiles",
  "user_blocks",
  "user_follows",
  "verification_requests",
];

const API_ROLES = ["anon", "authenticated"];

describe("DB-01 inventory", () => {
  const db = connectTestDatabase();

  it("has exactly the 26 application tables in public", async () => {
    const { rows } = await db.query(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
       order by c.relname`,
    );
    expect(rows.map((r) => r.relname)).toEqual(EXPECTED_TABLES);
  });

  it("enables row level security on every table", async () => {
    const { rows } = await db.query(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    expect(rows).toEqual([]);
  });

  it("defines no RLS policies yet (deny by default, no placeholders)", async () => {
    const { rows } = await db.query(`select tablename, policyname from pg_policies where schemaname = 'public'`);
    expect(rows).toEqual([]);
  });

  it("grants API roles no privilege on any table or sequence", async () => {
    const { rows } = await db.query(
      `select grantee, table_name, privilege_type from information_schema.role_table_grants
       where table_schema = 'public' and grantee = any($1)`,
      [API_ROLES],
    );
    expect(rows).toEqual([]);
    const sequences = await db.query(
      `select grantee, object_name from information_schema.usage_privileges
       where object_schema = 'public' and object_type = 'SEQUENCE' and grantee = any($1)`,
      [API_ROLES],
    );
    expect(sequences.rows).toEqual([]);
  });

  it("keeps the private schema and its functions unreachable by API roles", async () => {
    for (const role of [...API_ROLES, "public"]) {
      const usage = await db.query(`select has_schema_privilege($1, 'private', 'USAGE') as ok`, [role]);
      expect(usage.rows[0].ok, `${role} USAGE on private`).toBe(false);
    }
    const { rows } = await db.query(
      `select p.proname, r.rolname from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       cross join (select unnest($1::text[]) as rolname) r
       where n.nspname in ('public', 'private')
         and has_function_privilege(r.rolname, p.oid, 'EXECUTE')`,
      [API_ROLES],
    );
    expect(rows).toEqual([]);
  });

  it("pins search_path on every private function", async () => {
    const { rows } = await db.query(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'private'
         and not coalesce(p.proconfig @> array['search_path=""'], false)`,
    );
    expect(rows).toEqual([]);
  });

  it("indexes the leading columns of every foreign key", async () => {
    const { rows } = await db.query(`
      select c.conrelid::regclass::text as tbl, c.conname
      from pg_constraint c
      where c.contype = 'f' and c.connamespace = 'public'::regnamespace
        and not exists (
          select 1 from pg_index i
          where i.indrelid = c.conrelid
            and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] = c.conkey
            -- Partial indexes only count when the predicate is "<fk column> IS NOT NULL",
            -- which every foreign-key equality lookup implies.
            and (
              i.indpred is null
              or (array_length(c.conkey, 1) = 1
                  and pg_get_expr(i.indpred, i.indrelid) =
                    '(' || (select attname from pg_attribute
                            where attrelid = c.conrelid and attnum = c.conkey[1]) || ' IS NOT NULL)')
            )
        )`);
    expect(rows).toEqual([]);
  });

  it("names every CHECK constraint after its table", async () => {
    const { rows } = await db.query(`
      select conrelid::regclass::text as tbl, conname from pg_constraint
      where contype = 'c' and connamespace = 'public'::regnamespace
        and conname not like replace(conrelid::regclass::text, 'public.', '') || '\\_%'`);
    expect(rows).toEqual([]);
  });

  it("denies a signed-in API role direct reads and writes", async () => {
    const userId = await createUser(db, "reader");
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId]);
    await db.query("set local role authenticated");
    await expectRejected(db, "select * from public.profiles", [], { code: INSUFFICIENT_PRIVILEGE });
    await expectRejected(db, "update public.profiles set bio = 'x' where id = $1", [userId], {
      code: INSUFFICIENT_PRIVILEGE,
    });
    await expectRejected(db, "select * from public.messages", [], { code: INSUFFICIENT_PRIVILEGE });
    await db.query("reset role");
  });

  it("denies anon any read", async () => {
    await db.query("set local role anon");
    for (const table of ["profiles", "posts", "organisations", "communities"]) {
      await expectRejected(db, `select * from public.${table}`, [], { code: INSUFFICIENT_PRIVILEGE });
    }
    await db.query("reset role");
  });
});
