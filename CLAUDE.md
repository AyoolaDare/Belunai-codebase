# BELUNAI

Before any change, read the active v2.1 baseline in `docs/`:

- `docs/prd.md` — what to build (PRD-01…PRD-18)
- `docs/agents.md` — how to build it (engineering rules; mandatory)
- `docs/backend_schema.md` — persistence and security contract (26 tables, DB-01…DB-20)
- `docs/implementation_plan.md` — order, tasks and human phase gates (P00…P15)

Then check `docs/implementation_status.md` (task/gate status), `docs/decision_register.md` (owner decisions) and `docs/development.md` (toolchain and commands).

Current phase: P02. BEL-0201 is BLOCKED on the owner-created `belunai-test` Supabase project (REV-03: one project, three secrets, testing only); BEL-0202 proceeds locally under plan revision REV-01 and cannot be COMPLETE until verified on Supabase. Do not start BEL-0203+ until BEL-0202 is COMPLETE.

@AGENTS.md
