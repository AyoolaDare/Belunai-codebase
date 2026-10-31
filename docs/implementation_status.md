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
| BEL-0103 | COMPLETE | PRD-16/17 | Vitest + Playwright; `.github/workflows/ci.yml` runs lint/typecheck/unit/build/secret scan/prod audit/E2E. Local rehearsal: deliberate failing unit test → `npm test` exit 1; removed → exit 0. GitHub Actions run 1 on commit 21ce03a: success (https://github.com/AyoolaDare/Belunai-codebase/actions/runs/41173164121) | Owner (G01), 2026-10-31 | Follow-up: owner to enable branch protection so CI blocks merges |
| BEL-0104 | COMPLETE | PRD-16/17 | Environment variable list in development.md (no env file committed, at owner request 2026-10-31); `scripts/check-secrets.mjs` scans tracked files and `.next/static`. Rehearsal: planted `sb_secret_…` in client bundle → exit 1. Licence/audit review in development.md. One package manager (npm) | Owner (G01), 2026-10-31 | — |

## P02 — Supabase and persistence foundation

| Task | Status | PRD | Evidence | Reviewer/date | Blocker |
|---|---|---|---|---|---|
| BEL-0201 | BLOCKED | PRD-01/15/17 | Repo side done: Supabase CLI 2.122.0 pinned, `supabase/config.toml` (project_id `belunai`, local site URL and `/auth/callback` redirect). Test harness refuses non-local hosts and non-`belunai_test*` databases (verified: hosted host → exit 1; `postgres` db → exit 1) | — | Owner to create London development/staging projects and add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_ACCESS_TOKEN` and the staging DB password as Claude environment secrets |
| BEL-0202 | IN_PROGRESS | PRD-01/15/17 | REV-01 local evidence: migrations M01–M12 (12 files, 26 tables) applied to fresh PostgreSQL 16 with Supabase role/default-grant shim; reset twice → identical `pg_dump --schema-only`. `npm run test:db` 36/36: DB-01 inventory (exactly 26 tables, RLS on all, no policies, zero anon/authenticated table/sequence/function grants despite Supabase default grants, private schema unreachable, pinned search_path, FK index coverage, named CHECKs, signed-in and anon direct reads/writes denied) plus constraint behaviour per table. Mutation check: removing `posts_author_check` fails the suite | — | Must pass on a real Supabase project (PostgreSQL 17) before COMPLETE |
| BEL-0203 | NOT_STARTED | PRD-01/15/17 | — | — | BEL-0202 COMPLETE |
| BEL-0204 | NOT_STARTED | PRD-01/15/17 | — | — | BEL-0203 COMPLETE |
| BEL-0205 | NOT_STARTED | PRD-01/15/17 | — | — | BEL-0204 COMPLETE |

### Schema items deliberately left to their owning tasks

Tables exist with row-local constraints, indexes and deny-by-default access. These cross-row mechanisms are not yet built and nothing is exposed that depends on them:

| Mechanism | Task |
|---|---|
| Profile/settings provisioning hook, onboarding completion transition | BEL-0302 |
| Eligibility/role predicates, definer projections, audit/moderation append-only enforcement | BEL-0203 |
| Storage buckets and object policies | BEL-0204 |
| Deferred exactly-one-owner checks (platform, organisation, community) | BEL-0205 |
| Interest selection limit (20) under profile lock | BEL-0401 |
| Canonical pair advisory locks, block cleanup | BEL-0503/0504 |
| Deferred text-or-ready-image publication check, publishing authority | BEL-0701/0702 |
| Sender-participant trigger, conversation pair creation | BEL-0901 |
| Locked polymorphic target validation and target-deletion cleanup | BEL-1001/1101 |
| Search indexes (REV-02) | BEL-1003 |

Optional text columns reject blank strings at the database; operations normalise blank input to NULL before writing (schema section 2).

## Known limitations of P01 evidence

- Docker is unavailable in the development container, so the local Supabase stack cannot run there; BEL-0201 needs a Supabase project (or a Docker-capable machine) chosen by the owner.
- Accessibility evidence is automated structure/keyboard checks plus screenshots at 360 and 1280px; screen-reader sampling is scheduled for BEL-1302.
- No authentication exists; (app) routes render static placeholder text only and hold no user data. Session gating is added in BEL-0301/0302.
