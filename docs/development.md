# BELUNAI — Development Guide

## Toolchain (recorded at BEL-0101, 2026-10-31)

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22.x LTS | `.nvmrc`; `engines` enforced via `.npmrc` `engine-strict` |
| npm | 10.9 | Only package manager; `package-lock.json` committed; exact pins (`save-exact`) |
| Next.js | 16.4.3 | App Router, `src/` dir, Turbopack, `cacheComponents` and `partialPrefetching` (stable, scaffold defaults) |
| React / React DOM | 19.3.0 | Versions selected by `create-next-app@16.4.3` |
| TypeScript | 5.9.3 | `strict: true` |
| Tailwind CSS | 4.3.3 | Via `@tailwindcss/turbopack` |
| ESLint | 9.39.5 + eslint-config-next 16.4.3 | `--max-warnings=0` |
| Vitest | 5.0.5 | Pure-rule unit tests in `tests/unit` |
| Playwright | 1.63.0 | E2E in `tests/e2e` at 360/768/1280px against the production build |
| server-only | 0.0.1 | Marks server modules so client imports fail at build |
| Supabase CLI | 2.122.0 | `npx supabase`; config in `supabase/config.toml` |
| pg (node-postgres) | 8.23.1 | Dev only: database test harness |

Next.js 16 differs from older versions: middleware is now `proxy.ts`, error boundaries receive `retry` (not `reset`), and session reads under Cache Components must sit inside `<Suspense>`. Read the version-matched docs in `node_modules/next/dist/docs/` before using a framework API.

Supabase client packages (`@supabase/supabase-js`, `@supabase/ssr`) are added when the app first connects (BEL-0201 verification / BEL-0301), not before.

## Commands

| Command | Purpose |
|---|---|
| `npm ci` | Reproducible install from the lockfile |
| `npm run dev` | Local development server |
| `npm run lint` | ESLint, zero warnings allowed |
| `npm run typecheck` | Generate route types, then `tsc --noEmit` |
| `npm test` | Unit tests |
| `npm run db:push` / `db:verify` | Apply migrations to / run DB-01 checks on the hosted test project over HTTPS |
| `npm run db:reset` | Recreate the local disposable test database and apply all migrations |
| `npm run test:db` | Database tests (DB-01 inventory, constraints) against a fresh local database |
| `npm run build` | Production build |
| `npm run check:secrets` | Scan tracked files and built client JS for credentials and server-only variable names |
| `npm run test:e2e` | Playwright against `next start` (run `npm run build` first) |
| `npm run check` | lint + typecheck + unit + build + secret scan (what CI runs before E2E) |

## Layout

```
src/app/(public)   landing and future public share routes
src/app/(auth)     sign-in and future auth/recovery/onboarding routes
src/app/(app)      signed-in shell with primary navigation
src/components     shared UI
src/lib            framework-agnostic helpers (later: Supabase clients, permissions, errors)
src/modules        business modules, created only when a phase needs one
supabase/          migrations and seed (from BEL-0202)
tests/unit|db|e2e  test layers; tests/db/supabase-shim.sql emulates Supabase roles locally
```

## Agent skills

Installed with `npx skills add supabase/agent-skills` (skills CLI 1.7.4, copied into `.claude/skills/`, pinned by hash in `skills-lock.json`): `supabase` and `supabase-postgres-best-practices`. Reviewed 2026-10-31: Markdown guidance only, no scripts. They are advisory; where they differ from backend_schema.md (for example, UUID primary keys), the schema document wins. Update with `npx skills update -p`.

## Database development

Migrations live in `supabase/migrations/`. The initial schema is `YYYYMMDDHHMMSS_mNN_name.sql`, one file per schema group (backend_schema.md section 11). M01–M12 are applied to `belunai-test` and frozen; later changes are new files named after their task, `YYYYMMDDHHMMSS_belNNNN_name.sql`. Never edit a migration that has been applied to a hosted project; add a new one.

Access predicates (`private.is_eligible`, `are_friends`, `is_organisation_admin`, …) are SECURITY DEFINER functions owned by `belunai_access_owner`, a NOLOGIN role with column-level SELECT on only the columns they read. They take explicit UUIDs; callers pass `(select auth.uid())`, never a request value. Nobody but the owner and the migration role can execute them. To use one in a policy or RPC, the migration grants EXECUTE on that exact signature to `authenticated` **as the owner** (`set local role belunai_access_owner; grant …; reset role;`) and grants USAGE on schema `private`. The Data API cannot reach `private` either way. If a predicate needs a new column, grant SELECT on that column to the owner role in the same migration.

Local database tests need PostgreSQL 16+ on localhost. The harness only accepts a localhost URL and a database named `belunai_test*`, and drops and recreates it on every run:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/belunai_test npm run test:db
```

`tests/db/supabase-shim.sql` recreates what Supabase provisions before user migrations (API roles, `auth.users`, `auth.uid()`, Supabase's default public-schema grants). It is test-only and never applied to a Supabase project. Hosted Supabase runs PostgreSQL 17; CI tests on 17, the development container on 16.

## Supabase test project setup (REV-03)

1. In the Supabase dashboard create one project named `belunai-test`, region **West EU (London)**. Save the database password it asks for.
2. From the project, copy:
   - **Project URL** (Project Settings → Data API) → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (Project Settings → API Keys) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - **Access token**: Account → Access Tokens → generate a token scoped to the `belunai-test` project only, with database read/write permission → `SUPABASE_ACCESS_TOKEN`
3. Add all three as secrets in the Claude environment settings. Add only the two `NEXT_PUBLIC_` values to Vercel; the access token never goes to Vercel. Never commit or paste them into chat.
4. Apply migrations: `npm run db:push`; then check them: `npm run db:verify`.

The development container cannot open direct Postgres connections (ports 5432/6543 are blocked; only HTTPS leaves), so migrations go through the Supabase Management API over HTTPS (`scripts/supabase-remote.mjs`). History is written to `supabase_migrations.schema_migrations`, the same table the Supabase CLI uses. `db:verify` mirrors the DB-01 inventory (tests/db/inventory.test.ts); its role-denial checks run as `anon`/`authenticated` inside transactions that are never committed, so it writes nothing.

New Supabase projects pre-provision `public.rls_auto_enable()` and its `ensure_rls` event trigger (enables RLS on every new public table), with EXECUTE granted to the API roles. M01 revokes that grant; the trigger keeps working. `tests/db/supabase-shim.sql` reproduces the function so local tests catch a regression.

## Storage (BEL-0204)

All six buckets are private and have no Storage policies, so browsers can never touch objects directly. Server code does every transfer:

1. Reserve: build the key with `objectKey()` from server-known IDs (never a client-supplied key) and record it in the owning row as pending.
2. Upload: issue a signed upload grant for that exact key (server secret key, BEL-0301+), never upsert.
3. Inspect: download, run `inspectImage()`, store only the returned bytes, then mark the row ready in one transaction.
4. Deliver: a route checks the viewer's current access, then streams with `protectedMediaResponse()`; denied and missing both get `mediaNotFoundResponse()`. Temporary signed URLs, when unavoidable, last at most `MAX_SIGNED_URL_SECONDS` (60).

Delete bytes through the Storage API, never by deleting `storage.objects` rows.

## Environment and secrets

- All `.env*` files are git-ignored; no environment file is committed. For local development create `.env.local` by hand.
- Hosting is Vercel; the testing deployment is `https://belunai.vercel.app`. Live check 2026-10-31: landing and `/sign-in` serve over HTTPS with HSTS, and the 9 client bundles contain no secret patterns or the access token. Set each value in the Vercel project's Environment Variables, scoped separately to Development, Preview and Production. Pull local values with `vercel env pull .env.local` once the project is linked.

| Variable | Exposure | Added at |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | BEL-0201 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | BEL-0201 |
| `SUPABASE_ACCESS_TOKEN` | Tooling only (migrations/verification); never in Vercel or the app | BEL-0201 |
| `SUPABASE_SECRET_KEY` | Server-only | When a feature first needs admin access |
| `NEXT_TELEMETRY_DISABLED=1` | Build | BEL-0101 (set in CI) |

- Only `NEXT_PUBLIC_*` values reach the browser. Server secrets (`SUPABASE_SECRET_KEY`) live only in managed environment configuration and in modules that `import "server-only"`.
- Testing setup (REV-03): one Supabase project, `belunai-test`, serves development and staging. A separate production project is created only if the app launches. Automated tests never use real people's data.
- A leaked secret is rotated and reported, not just deleted from the file.

## Dependency review (BEL-0104, 2026-10-31)

- `npm audit --omit=dev`: 0 vulnerabilities in production dependencies.
- `npm audit` (all): 16 moderate findings, all in the ESLint toolchain through `minimatch` (dev-only, never shipped). The only automatic fix is a breaking major downgrade of `eslint-config-next`; not applied. Re-check when eslint-config-next updates.
- Production licences: MIT, Apache-2.0, ISC, BSD-3-Clause, 0BSD; `caniuse-lite` CC-BY-4.0 (data, build-time); `@img/sharp-libvips-*` LGPL-3.0-or-later (dynamically linked native library used by Next image optimisation; acceptable for a hosted service, review if distributing binaries).
- `sharp` 0.35.5 (BEL-0204, 2026-11-01): image decode/re-encode for upload inspection. Already installed with Next.js for image optimisation, so pinning it adds no new package; Apache-2.0, bundles LGPL libvips (reviewed above). Runs only on the server.
- New runtime dependencies need purpose, support, compatibility, size, security and licence review (agents.md section 4).
