# BELUNAI — Decision and Environment Register

Plan reference: implementation_plan.md section 6. Never store credentials here.

## Gate decisions

| Gate | Status | Date | Record |
|---|---|---|---|
| G00 | APPROVED | 2026-10-31 | Owner instruction in the development session: "build using the appropriate code and also follow the document". Recorded as acceptance of the four v2.1 documents and the section 4 PRD product decisions **as written, with no changes**. Owner may revise any decision; a revision is a coordinated document change before dependent work. |
| G01 | NOT_APPROVED | — | Evidence presented in implementation_status.md; awaiting owner review. |

### Product decisions accepted at G00 (PRD section 4, unchanged)

Open registration with optional founding invitations; proposed 18+ pilot by self-attestation in versioned terms (owner approves eligibility/safeguarding text before pilot); public profiles to eligible signed-in users; separate user follows, organisation follows and friendships; public/friends personal posts; public/private communities with safe discovery metadata; one church community per verified organisation; logged-out public share route with minimal identity/media; up to four JPEG/PNG/WebP images (10 MiB, 20 MP); text-only friend messaging; all Storage private; staged account erasure; no external import. Retention defaults in backend_schema.md 10.3 accepted as proposed operational values.

### Open items carried from G00

| Item | Owner action | Due before |
|---|---|---|
| Schema migration group M13 (deletion/retention/grants/search/query verification) is not named by any plan task; BEL-0202 lists M01–M12 | Confirm assignment. Proposed: M13 deletion/retention parts with BEL-0403/0404, search indexes with BEL-1003, final grant/query verification with BEL-1301 | BEL-0202 |
| GitHub branch protection requiring the CI check on the default branch | Enable in repository settings (Claude cannot change repository settings) | G01 |

## Environment decision register

| Decision | Owner | Value | Due task | Evidence |
|---|---|---|---|---|
| Node.js runtime | Engineering | 22.x LTS (`.nvmrc`, `engines` >=22.12 <23) | BEL-0101 | docs/development.md |
| Package manager | Engineering | npm 10 with committed package-lock.json | BEL-0101 | package-lock.json |
| Framework/package versions | Engineering | Exact pins in package.json; see docs/development.md | BEL-0101 | docs/development.md |
| Test tooling | Engineering | Vitest 5.0.5 (unit), Playwright 1.63.0 (E2E) | BEL-0103 | docs/development.md |
| CI | Engineering | GitHub Actions `.github/workflows/ci.yml` | BEL-0103 | CI runs |
| Hosting platform, domain, TLS, redirect URLs | Owner | **Unassigned** | BEL-0201 | — |
| Supabase organisation/projects (local, staging, production) and region | Owner | **Unassigned** | BEL-0201 | — |
| Email sender, Google OAuth client, phone OTP provider and budget | Owner | **Unassigned** | BEL-0301 | — |
| Platform owner bootstrap custody | Owner | **Unassigned** | BEL-0205 | — |
| Terms, privacy notice, community standards, age safeguards texts | Owner | **Unassigned** | BEL-0302 (versions) / BEL-1402 (final) | — |
| Support contact | Owner | **Unassigned** | BEL-1104 | — |
| Backup window, provider logs, legal holds | Owner | **Unassigned** | BEL-1402 | — |
| Monitoring/incident owner | Owner | **Unassigned** | BEL-1403 | — |
| Pilot cohort permission | Owner | **Unassigned** | BEL-1502 | — |
| Production cost budget | Owner | **Unassigned** | BEL-1402 | — |
