// BEL-0204: private Storage buckets. API roles have no direct path to objects;
// all transfers go through server code that checks current authorisation.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { BUCKETS } from "../../src/lib/storage/buckets";
import { connectTestDatabase, createAccount, expectRejected, INSUFFICIENT_PRIVILEGE } from "./helpers";

const BUCKET_IDS = Object.keys(BUCKETS).sort();

describe("Storage buckets", () => {
  const db = connectTestDatabase();

  it("creates exactly the six buckets, all private, with the section 2.1 limits", async () => {
    const { rows } = await db.query(
      `select id, public, file_size_limit::int as limit, allowed_mime_types
       from storage.buckets order by id`,
    );
    expect(rows.map((r) => r.id)).toEqual(BUCKET_IDS);
    for (const row of rows) {
      expect(row, row.id).toEqual({
        id: row.id,
        public: false,
        limit: 10 * 1024 * 1024,
        allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
      });
    }
  });

  it("defines no Storage policies, so API roles have no direct object access", async () => {
    const { rows } = await db.query(`select tablename, policyname from pg_policies where schemaname = 'storage'`);
    expect(rows).toEqual([]);
  });

  for (const role of ["anon", "authenticated"] as const) {
    it(`denies ${role} listing, reading, uploading and editing objects`, async () => {
      const owner = await createAccount(db);
      const key = `profiles/${owner}/${randomUUID()}.jpg`;
      const {
        rows: [object],
      } = await db.query(
        `insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
         values ('profile-assets', $1, $2, $3, '{"mimetype": "image/jpeg"}') returning id`,
        [key, owner, owner],
      );

      if (role === "authenticated") {
        // The owner themself: even their own object is not directly reachable.
        await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [owner]);
      }
      await db.query(`set local role ${role}`);

      const buckets = await db.query("select id from storage.buckets");
      expect(buckets.rows, "bucket list").toEqual([]);
      const guessed = await db.query("select id from storage.objects where bucket_id = 'profile-assets' and name = $1", [
        key,
      ]);
      expect(guessed.rows, "read by exact key").toEqual([]);

      for (const sql of [
        "update storage.objects set metadata = '{\"mimetype\": \"image/svg+xml\"}' where id = $1",
        "update storage.objects set owner = null, owner_id = null where id = $1",
        "update storage.objects set name = 'profiles/x/moved.jpg' where id = $1",
        "delete from storage.objects where id = $1",
      ]) {
        const result = await db.query(sql, [object.id]);
        expect(result.rowCount, sql).toBe(0);
      }

      await expectRejected(
        db,
        `insert into storage.objects (bucket_id, name, owner, owner_id)
         values ('profile-assets', $1, $2, $3)`,
        [`profiles/${owner}/${randomUUID()}.png`, owner, owner],
        { code: INSUFFICIENT_PRIVILEGE },
      );
      expect((await db.query("update storage.buckets set public = true")).rowCount, "make bucket public").toBe(0);
      await expectRejected(db, "insert into storage.buckets (id, name, public) values ('open', 'open', true)", [], {
        code: INSUFFICIENT_PRIVILEGE,
      });
      await db.query("reset role");

      const open = await db.query("select id from storage.buckets where public");
      expect(open.rows).toEqual([]);
      const after = await db.query("select name, metadata, owner from storage.objects where id = $1", [object.id]);
      expect(after.rows[0]).toEqual({ name: key, metadata: { mimetype: "image/jpeg" }, owner });
    });
  }
});
