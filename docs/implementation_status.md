# BELUNAI — Implementation Status

Statuses: NOT_STARTED, BLOCKED, IN_PROGRESS, IN_REVIEW, COMPLETE. Gates: NOT_APPROVED, FAILED, APPROVED.
IN_REVIEW means evidence is attached and the work awaits owner gate review. Evidence contains no secrets or private bodies.

## Gates

| Gate | Status | Date | Notes |
|---|---|---|---|
| G00 | APPROVED | 2026-10-31 | See decision_register.md |
| G01 | NOT_APPROVED | — | P01 evidence below; awaiting owner review |
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
| BEL-0101 | IN_REVIEW | PRD-16/17 | Scaffolded with `create-next-app@16.4.3`; exact pins and Node 22 recorded in development.md. `rm -rf node_modules .next && npm ci && npm run check` exit 0; `next start` serves all routes | — | — |
| BEL-0102 | IN_REVIEW | PRD-16/17 | Route groups (public)/(auth)/(app); responsive nav (bottom bar <768px, sidebar ≥768px); root error, global-error, not-found, (app) loading. Playwright at 360/768/1280: one h1 + main landmark, no horizontal overflow, skip link, keyboard nav with aria-current, unbuilt screens expose no controls, 404 neutral | — | — |
| BEL-0103 | IN_REVIEW | PRD-16/17 | Vitest + Playwright; `.github/workflows/ci.yml` runs lint/typecheck/unit/build/secret scan/prod audit/E2E. Local rehearsal: deliberate failing unit test → `npm test` exit 1; removed → exit 0. GitHub Actions run 1 on commit 21ce03a: success (https://github.com/AyoolaDare/Belunai-codebase/actions/runs/41173164121) | — | Branch protection must be enabled by owner for CI to block merges |
| BEL-0104 | IN_REVIEW | PRD-16/17 | `.env.example`; `scripts/check-secrets.mjs` scans tracked files and `.next/static`. Rehearsal: planted `sb_secret_…` in client bundle → exit 1. Licence/audit review in development.md. One package manager (npm) | — | — |

## Known limitations of P01 evidence

- Docker is unavailable in the development container, so the local Supabase stack cannot run there; BEL-0201 needs a Supabase project (or a Docker-capable machine) chosen by the owner.
- Accessibility evidence is automated structure/keyboard checks plus screenshots at 360 and 1280px; screen-reader sampling is scheduled for BEL-1302.
- No authentication exists; (app) routes render static placeholder text only and hold no user data. Session gating is added in BEL-0301/0302.
