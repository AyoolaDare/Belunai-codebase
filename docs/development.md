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

Next.js 16 differs from older versions: middleware is now `proxy.ts`, error boundaries receive `retry` (not `reset`), and session reads under Cache Components must sit inside `<Suspense>`. Read the version-matched docs in `node_modules/next/dist/docs/` before using a framework API.

Supabase packages (`@supabase/supabase-js`, `@supabase/ssr`) and the Supabase CLI are added at BEL-0201, not before.

## Commands

| Command | Purpose |
|---|---|
| `npm ci` | Reproducible install from the lockfile |
| `npm run dev` | Local development server |
| `npm run lint` | ESLint, zero warnings allowed |
| `npm run typecheck` | Generate route types, then `tsc --noEmit` |
| `npm test` | Unit tests |
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
tests/unit|e2e     test layers (integration/RLS tests arrive with BEL-0202)
```

## Environment and secrets

- All `.env*` files are git-ignored; no environment file is committed. For local development create `.env.local` by hand.
- Hosting is Vercel: set each value in the Vercel project's Environment Variables, scoped separately to Development, Preview and Production. Pull local values with `vercel env pull .env.local` once the project is linked.

| Variable | Exposure | Added at |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Public | BEL-0201 |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | BEL-0201 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | BEL-0201 |
| `SUPABASE_SECRET_KEY` | Server-only | BEL-0201 |
| `NEXT_TELEMETRY_DISABLED=1` | Build | BEL-0101 (set in CI) |

- Only `NEXT_PUBLIC_*` values reach the browser. Server secrets (`SUPABASE_SECRET_KEY`) live only in managed environment configuration and in modules that `import "server-only"`.
- Local, staging and production use separate projects and credentials. Tests never use production credentials or data.
- A leaked secret is rotated and reported, not just deleted from the file.

## Dependency review (BEL-0104, 2026-10-31)

- `npm audit --omit=dev`: 0 vulnerabilities in production dependencies.
- `npm audit` (all): 16 moderate findings, all in the ESLint toolchain through `minimatch` (dev-only, never shipped). The only automatic fix is a breaking major downgrade of `eslint-config-next`; not applied. Re-check when eslint-config-next updates.
- Production licences: MIT, Apache-2.0, ISC, BSD-3-Clause, 0BSD; `caniuse-lite` CC-BY-4.0 (data, build-time); `@img/sharp-libvips-*` LGPL-3.0-or-later (dynamically linked native library used by Next image optimisation; acceptable for a hosted service, review if distributing binaries).
- New runtime dependencies need purpose, support, compatibility, size, security and licence review (agents.md section 4).
