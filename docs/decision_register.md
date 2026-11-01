# BELUNAI — Decision and Environment Register

Plan reference: implementation_plan.md section 6. Never store credentials here.

## Gate decisions

| Gate | Status | Date | Record |
|---|---|---|---|
| G00 | APPROVED | 2026-10-31 | Owner instruction in the development session: "build using the appropriate code and also follow the document". Recorded as acceptance of the four v2.1 documents and the section 4 PRD product decisions **as written, with no changes**. Owner may revise any decision; a revision is a coordinated document change before dependent work. |
| G01 | APPROVED | 2026-10-31 | Owner instruction "Okay proceed" after P01 evidence and gate request were presented. |

### Product decisions accepted at G00 (PRD section 4, unchanged)

Open registration with optional founding invitations; proposed 18+ pilot by self-attestation in versioned terms (owner approves eligibility/safeguarding text before pilot); public profiles to eligible signed-in users; separate user follows, organisation follows and friendships; public/friends personal posts; public/private communities with safe discovery metadata; one church community per verified organisation; logged-out public share route with minimal identity/media; up to four JPEG/PNG/WebP images (10 MiB, 20 MP); text-only friend messaging; all Storage private; staged account erasure; no external import. Retention defaults in backend_schema.md 10.3 accepted as proposed operational values.

### Open items carried from G00

| Item | Owner action | Due before |
|---|---|---|
| GitHub branch protection requiring the CI check on the default branch | Enable in repository settings (Claude cannot change repository settings) | G01 |

## Plan revisions

| ID | Date | Decision | Effect |
|---|---|---|---|
| REV-01 | 2026-10-31 | Owner approved writing and testing BEL-0202 migrations against local PostgreSQL while BEL-0201 waits for owner-created Supabase projects | BEL-0202 may proceed before BEL-0201 is COMPLETE. BEL-0202 cannot be COMPLETE until the migrations pass on a real Supabase project. Strict order otherwise unchanged |
| REV-03 | 2026-10-31 | Owner: the app is for testing, not production; keep setup simple | One Supabase project (`belunai-test`) serves as both development and staging. Only three secrets are needed: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_ACCESS_TOKEN` (project-scoped; replaced `SUPABASE_DB_URL` on 2026-10-31 because the development container blocks direct Postgres ports, so migrations run over the HTTPS Management API). `SUPABASE_SECRET_KEY` is added only when a feature first needs server-side admin access. Production-only items (separate production project, domain, backups, monitoring, policies) stay deferred until the owner decides to launch |
| REV-02 | 2026-10-31 | Owner assigned schema group M13 by topic | Deletion/retention structures with BEL-0403/0404; search indexes (post body GIN, profile/community/organisation name and slug) with BEL-1003; final grant and query-plan verification with BEL-1301 |

## Environment decision register

| Decision | Owner | Value | Due task | Evidence |
|---|---|---|---|---|
| Node.js runtime | Engineering | 22.x LTS (`.nvmrc`, `engines` >=22.12 <23) | BEL-0101 | docs/development.md |
| Package manager | Engineering | npm 10 with committed package-lock.json | BEL-0101 | package-lock.json |
| Framework/package versions | Engineering | Exact pins in package.json; see docs/development.md | BEL-0101 | docs/development.md |
| Test tooling | Engineering | Vitest 5.0.5 (unit), Playwright 1.63.0 (E2E) | BEL-0103 | docs/development.md |
| CI | Engineering | GitHub Actions `.github/workflows/ci.yml` | BEL-0103 | CI runs |
| Hosting platform | Owner | Vercel (decided 2026-10-31) | BEL-0201 | Owner instruction |
| Domain, TLS, allowed redirect URLs | Owner | Testing (REV-03): `https://belunai.vercel.app` on Vercel's default domain, HTTPS with HSTS by Vercel. Supabase Auth target: site URL `https://belunai.vercel.app`; redirect allowlist `https://belunai.vercel.app/auth/callback` and `http://localhost:3000/auth/callback` (owner to apply; checked 2026-10-31: still site URL `http://localhost:3000`, allowlist empty). Custom domain deferred until launch | BEL-0301 | Owner shared deployment URL 2026-10-31 |
| Environment file policy | Owner | No `.env*` file committed; variables live in Vercel project settings and are listed in development.md | BEL-0104 | Owner instruction 2026-10-31 |
| Supabase projects | Owner | One test project `belunai-test` (REV-03); owner adds its URL, publishable key and a project-scoped access token as Claude environment secrets, never pasted into chat | BEL-0201 | Owner decision 2026-10-31 |
| Supabase region | Owner | EU West (London), eu-west-2 | BEL-0201 | Owner decision 2026-10-31 |
| Email sender, Google OAuth client, phone OTP provider and budget | Owner | **Unassigned** | BEL-0301 | — |
| Platform owner bootstrap custody | Owner | **Unassigned** | BEL-0205 | — |
| Terms, privacy notice, community standards, age safeguards texts | Owner | **Unassigned** | BEL-0302 (versions) / BEL-1402 (final) | — |
| Support contact | Owner | **Unassigned** | BEL-1104 | — |
| Backup window, provider logs, legal holds | Owner | **Unassigned** for production. Testing (REV-03): `belunai-test` holds synthetic data only and relies on Supabase's plan defaults; no backup requirement. Restore procedure rehearsed locally with `npm run db:backup-smoke` (BEL-0205) | BEL-1402 | REV-03 |
| Monitoring/incident owner | Owner | **Unassigned** | BEL-1403 | — |
| Pilot cohort permission | Owner | **Unassigned** | BEL-1502 | — |
| Production cost budget | Owner | **Unassigned** | BEL-1402 | — |
