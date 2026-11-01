# BELUNAI — Implementation Status

Statuses: NOT_STARTED, BLOCKED, IN_PROGRESS, IN_REVIEW, COMPLETE. Gates: NOT_APPROVED, FAILED, APPROVED.
IN_REVIEW means evidence is attached and the work awaits owner gate review. Evidence contains no secrets or private bodies.

## Gates

| Gate | Status | Date | Notes |
|---|---|---|---|
| G00 | APPROVED | 2026-10-31 | See decision_register.md |
| G01 | APPROVED | 2026-10-31 | See decision_register.md |
| G02–G15 | NOT_APPROVED | — | — |

## P00 — Specification baseline

| Task | Status | PRD | Evidence | Reviewer/date | Blocker |
|---|---|---|---|---|---|
| BEL-0001 | COMPLETE | PRD-01–18 | v2.1 documents committed in docs/; owner accepted decisions as written | Owner, 2026-10-31 | — |
| BEL-0002 | COMPLETE | PRD-01–18 | decision_register.md: every launch-sensitive decision has an owner and due task; values needed later remain assigned, as plan section 6 permits | Owner, 2026-10-31 | — |
| BEL-0003 | COMPLETE | PRD-01–18 | 26-table schema accepted; DB-01–20 mapped to tasks in plan; M13 task assignment carried as open item | Owner, 2026-10-31 | — |

## P01 — Repository and engineering foundation

| Task | Status | PRD | Evidence | Reviewer/date | Blocker |
|---|---|---|---|---|---|
| BEL-0101 | COMPLETE | PRD-16/17 | Scaffolded with `create-next-app@16.4.3`; exact pins and Node 22 recorded in development.md. `rm -rf node_modules .next && npm ci && npm run check` exit 0; `next start` serves all routes | Owner (G01), 2026-10-31 | — |
| BEL-0102 | COMPLETE | PRD-16/17 | Route groups (public)/(auth)/(app); responsive nav (bottom bar <768px, sidebar ≥768px); root error, global-error, not-found, (app) loading. Playwright at 360/768/1280: one h1 + main landmark, no horizontal overflow, skip link, keyboard nav with aria-current, unbuilt screens expose no controls, 404 neutral | Owner (G01), 2026-10-31 | — |
| BEL-0103 | COMPLETE | PRD-16/17 | Vitest + Playwright; `.github/workflows/ci.yml` runs lint/typecheck/unit/build/secret scan/prod audit/E2E. Local rehearsal: deliberate failing unit test → `npm test` exit 1; removed → exit 0. GitHub Actions run 1 on commit 21ce03a: success (https://github.com/AyoolaDare/Belunai-codebase/actions/runs/41173164121) | Owner (G01), 2026-10-31 | Follow-up done 2026-11-01 (owner-reported): `main` ruleset requires the CI check "Lint, typecheck, unit tests, build, E2E" to pass and blocks force pushes |
| BEL-0104 | COMPLETE | PRD-16/17 | Environment variable list in development.md (no env file committed, at owner request 2026-10-31); `scripts/check-secrets.mjs` scans tracked files and `.next/static`. Rehearsal: planted `sb_secret_…` in client bundle → exit 1. Licence/audit review in development.md. One package manager (npm) | Owner (G01), 2026-10-31 | — |

## P02 — Supabase and persistence foundation

| Task | Status | PRD | Evidence | Reviewer/date | Blocker |
|---|---|---|---|---|---|
| BEL-0201 | COMPLETE | PRD-01/15/17 | Supabase CLI 2.122.0 pinned, `supabase/config.toml` (project_id `belunai`, local site URL and `/auth/callback` redirect). Hosted project `belunai-test` (REV-03): eu-west-2 (London), ACTIVE_HEALTHY, PostgreSQL 17.11; the three secrets are set as Claude environment secrets only. Connections exercised 2026-10-31: Management API (`npm run db:push`/`db:verify`) and Data API with the publishable key (anon reads of profiles/posts/messages → 42501). Hosted Auth redirects recorded: site URL `http://localhost:3000`, additional redirect allowlist empty (callback and Vercel URLs added at BEL-0301). No production project exists (REV-03), so nothing can target one; local test harness refuses non-local hosts and non-`belunai_test*` databases (verified: hosted host → exit 1; `postgres` db → exit 1) | Pending G02 | — |
| BEL-0202 | COMPLETE | PRD-01/15/17 | Migrations M01–M12 (12 files, 26 tables). Hosted (`belunai-test`, PostgreSQL 17.11, 2026-10-31): `npm run db:push` applied all 12 and recorded them in `supabase_migrations.schema_migrations`; `npm run db:verify` 18/18 PASS: exact 26 table names, RLS on all, no policies, zero anon/authenticated table/sequence/function grants, private schema unusable by anon/authenticated/PUBLIC, pinned search_path, FK index coverage, named CHECKs, recorded versions match files, anon and signed-in direct reads/writes denied with 42501 (executed as those roles, never committed). First hosted verify found Supabase's pre-provisioned `public.rls_auto_enable()` (SECURITY DEFINER, backs the `ensure_rls` event trigger) executable by anon/authenticated; M01 now revokes it (guarded), the local shim mirrors the function so `npm run test:db` fails without the revoke, and the event trigger was confirmed still to enable RLS on a rolled-back probe table. Local (PostgreSQL 16): `npm run test:db` 36/36 including constraint behaviour per table; reset twice → `pg_dump --schema-only` identical except pg_dump's random `\restrict` token. CI run 4 passed on PostgreSQL 17. Mutation check: removing `posts_author_check` fails the suite | Pending G02 | — |
| BEL-0203 | COMPLETE | PRD-01/15/17 | Migration `20261031130000_bel0203_access_helpers.sql`. Predicates (schema 3.2) in `private`: `is_eligible`, `is_blocked`, `are_friends`, `organisation_role`/`is_organisation_admin`/`is_organisation_owner`, `community_role`/`is_community_member`/`is_community_staff`, `platform_role`/`is_platform_staff`. Each is SECURITY DEFINER, `search_path=''`, owned by `belunai_access_owner` (NOLOGIN, BYPASSRLS, no other attributes, column SELECT on the 20 columns it reads only, no CREATE), EXECUTE revoked from PUBLIC/anon/authenticated; reads live rows, never JWT claims. Append-only `audit_logs`/`moderation_actions`: UPDATE only to NULL listed references (erasure SET NULL, target cleanup), DELETE and TRUNCATE rejected (23001). Primary keys immutable on all 26 tables. Evidence: `npm run test:db` 54/54 (18 new): DB-19 owner/definer/search_path/EXECUTE/no-JWT checks and a rolled-back policy calling `is_eligible` on `profiles` returns only the caller's row without recursion; DB-02 predicate matrix over eligible/incomplete/suspended/pending-deletion/no-settings accounts, org owner/admin, community owner/admin/moderator/member/pending/banned, platform owner/admin/moderator, suspended/archived entities and cross-scope isolation. Mutation checks caught: eligibility ignoring suspension (5 tests fail), SECURITY INVOKER predicates (2, incl. recursion), predicates granted to authenticated (2), moderation append-only removed (1). Reset twice → identical schema dump. Hosted `belunai-test`: applied; `npm run db:verify` 26/26 PASS; Data API cannot reach predicates (PGRST202/PGRST106) | Pending G02 | — |
| BEL-0204 | COMPLETE | PRD-01/15/17 | Migration `20261101100000_bel0204_storage_buckets.sql`: six private buckets (profile-assets, organisation-assets, community-assets, post-images, verification-evidence, moderation-evidence), each 10 MiB, JPEG/PNG/WebP only. No Storage policies: anon and signed-in roles cannot list, read, upload, upsert, move, delete or edit metadata directly; all transfers go through server code (short upload grant for a reserved key; private no-store streaming after a current access check). `src/lib/storage/`: `buckets.ts` (registered key builder/parser matching the DB CHECKs; lowercase UUIDs only; 60 s signed-URL cap), `inspect.ts` (signature sniff before decode, so SVG/GIF/TIFF/HEIF/PDF never reach the decoder; declared-type match; 20 MP pixel cap; single frame; decode and re-encode with orientation applied, EXIF/GPS/XMP removed), `delivery.ts` (private, no-store, CDN no-store, nosniff, sandbox CSP; denied and missing both 404). `sharp` 0.35.5 pinned (already shipped with Next.js; Apache-2.0). Evidence: `npm test` 18/18 with real images (GPS-tagged JPEG stripped and rotated, two-frame WebP rejected, 20,005,000-pixel PNG rejected, disguised PNG, SVG, GIF, TIFF, PDF, truncated and corrupt files rejected, crafted/traversal keys rejected); `npm run test:db` 58/58 (bucket flags, no policies, anon and the object owner cannot see, read by exact key, insert, move, re-type, disown, delete or make a bucket public). Mutation checks caught: public bucket (3 tests), permissive read policy (2), SVG allowed (1), animation check removed (1), orientation not applied (1), pixel cap removed (1). Hosted `belunai-test`: applied; `npm run db:verify` 41/41, including real Storage API calls with the publishable key: bucket and object lists empty, guessed-key read, public URL and signed read URL denied, upload, upsert and signed upload grant refused by RLS | Pending G02 | — |
| BEL-0205 | COMPLETE | PRD-01/15/17 | Migration `20261101120000_bel0205_owners_locks_audit.sql`. Deferred exactly-one-owner constraint triggers: every active organisation and community has exactly one owner at commit (suspended/archived may have none; reactivation needs one); the platform's first role must be the owner and once bootstrapped an owner always remains. Checks lock the parent, so racing changes are checked in turn. Non-API bootstrap `private.bootstrap_platform_owner` (eligible account only, refuses a second run, writes a `{"version":1}` audit row with correlation ID; `npm run db:bootstrap-owner -- <uuid>`); sign-up never creates a role. Shared lock helpers: `lock_accounts` (ascending row locks), `lock_pair` (order-independent advisory lock), `lock_platform_owner`. Audit minimisation CHECK: metadata `{}` or versioned; no secret/contact/body/document keys at any depth, no email/JWT/Supabase-key/phone-like or >500-char strings. Harness: scoped fixtures, commit-time check helpers, multi-connection committed-data harness with cleanup, `src/lib/db/retry.ts` (bounded retry of 40001/40P01 only). Evidence: `npm run test:db` 85/85 (27 new), stable over three runs: DB-08 races with two real connections (racing bootstraps → one owner; transfer vs removal of new owner → removal rolled back; two transfers → one wins; erasure vs transfer → one owner), DB-15 last-owner erasure rolled back, creator SET NULL after transfer; `npm test` 22/22. Mutation checks caught: owner trigger removed (5 tests), solo platform owner allowed to vanish (1), email pattern removed (1), order-dependent pair lock (1). `npm run db:backup-smoke`: synthetic data → pg_dump → restore into a new database → identical schema and row counts; append-only, owner and key protections and predicates still active. Hosted `belunai-test`: applied; `npm run db:verify` 46/46 | Pending G02 | — |

### Schema items deliberately left to their owning tasks

Tables exist with row-local constraints, indexes and deny-by-default access. These cross-row mechanisms are not yet built and nothing is exposed that depends on them:

| Mechanism | Task |
|---|---|
| Profile/settings provisioning hook, onboarding completion transition | BEL-0302 |
| Granting a predicate to `authenticated` (with USAGE on `private`) for the first policy or RPC that uses it | Each feature task, starting BEL-0301/0302 |
| Allowlisted read projections for sensitive tables (verification, reports, actions, audit, invitations, settings) | The feature task that first exposes each table |
| Transition operations and their forged-actor tests (DB-03) | Each operation's task (section 8) |
| Audit retention path through the append-only trigger | M13 retention work |
| Upload reservation, signed upload grant, inspection-to-ready and streaming routes for each asset type | Each feature task (avatars BEL-0302, organisation/community images, post media BEL-07xx, evidence) |
| Signed-in end-to-end Storage API probe (needs real sign-in) | BEL-0301 |
| Pending upload cleanup (24 h), inactive draft media (7 days), orphan reconciliation, erasure asset migration | M13 retention/deletion work |
| Owner transfer/recovery operations using the lock helpers and deferred checks | P05/P06 role tasks |
| Platform owner bootstrap on `belunai-test` (needs a real signed-up, onboarded account) | Owner, after BEL-0302 |
| Interest selection limit (20) under profile lock | BEL-0401 |
| Canonical pair advisory locks, block cleanup | BEL-0503/0504 |
| Deferred text-or-ready-image publication check, publishing authority | BEL-0701/0702 |
| Sender-participant trigger, conversation pair creation | BEL-0901 |
| Locked polymorphic target validation and target-deletion cleanup | BEL-1001/1101 |
| Search indexes (REV-02) | BEL-1003 |

Optional text columns reject blank strings at the database; operations normalise blank input to NULL before writing (schema section 2).

## Known limitations of P01 evidence

- Docker is unavailable in the development container, so the local Supabase stack cannot run there; local tests use plain PostgreSQL plus `tests/db/supabase-shim.sql`, and hosted checks run against `belunai-test` over HTTPS.
- Accessibility evidence is automated structure/keyboard checks plus screenshots at 360 and 1280px; screen-reader sampling is scheduled for BEL-1302.
- No authentication exists; (app) routes render static placeholder text only and hold no user data. Session gating is added in BEL-0301/0302.
