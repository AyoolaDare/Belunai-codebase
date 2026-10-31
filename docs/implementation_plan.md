# BELUNAI — Master Implementation Plan

**ID:** BEL-PLAN-001 · **Version:** 2.1 · **Date:** 2026-10-31  
**Status:** Complete reconstructed chronological plan for owner review. Every implementation task initially NOT_STARTED; gates initially NOT_APPROVED.

## 1. Execution contract

Read prd.md, agents.md and backend_schema.md version 2.1. This plan replaces the partial recovered plan. No missing original chat is required to review this new baseline. It does not authorise implementation, deployment or gate approval by itself.

One bounded task at a time; preserve working features/user edits. Respect exact dependencies and named acceptance. No future features, silent schema changes, permissive RLS shortcuts, invented tests or automatic gate progression. Source roles remain PRD=product, agents=engineering, schema=data/security, plan=order/evidence. The organisation_follows amendment is integrated into the 26-table schema, not an external document to locate.

Status values: NOT_STARTED, BLOCKED, IN_PROGRESS, IN_REVIEW, COMPLETE. Gate statuses: NOT_APPROVED, FAILED, APPROVED. COMPLETE requires executed evidence; drafting these tasks does not complete them. Initialise docs/implementation_status.md when implementation begins with task status, PRD IDs, dependencies, evidence link, reviewer/date and blocker. Evidence contains no secrets/private bodies. Owner records gate decision, accepted versions, residual risks and next authorised phase. No response/time elapsed is not approval.

## 2. Dependency and delivery conventions

Tasks below form a strict sequential baseline: each depends on the preceding task and entry gate explicitly named. A phase's first task depends on previous exit gate. Tasks that could run independently remain sequential for solo Claude development unless an owner-approved plan revision changes dependency; do not infer permission to skip tasks. PRD references apply to every task in its phase; task text narrows scope. Schema migration groups M01–M13 are ordered by data dependencies; tables can exist inaccessible before feature phase, never exposed through permissive placeholder operations.

All tasks require: bounded implementation, relevant tests, no secret/unrelated diff, accurate report and traceability. Additional acceptance/verification below is mandatory. A skipped test is not passing evidence. Use synthetic isolated fixtures and ordinary authenticated actors for access tests; service-role success cannot prove RLS. Exact supported runtime/package versions are selected and locked in BEL-0101, not guessed in advance. Hosting/provider configuration decisions are recorded before dependent setup. No additional business tables beyond 26.

## 3. Chronological phase overview

| Phase | Outcome | Entry | Exit |
|---|---|---|---|
| P00 | Specification baseline | Document review authorised | G00 |
| P01 | Repository and engineering foundation | G00 APPROVED | G01 |
| P02 | Supabase and persistence foundation | G01 APPROVED | G02 |
| P03 | Authentication and onboarding | G02 APPROVED | G03 |
| P04 | Profiles, interests and account controls | G03 APPROVED | G04 |
| P05 | Roles and social relationships | G04 APPROVED | G05 |
| P06 | Organisations and communities | G05 APPROVED | G06 |
| P07 | Publishing and engagement | G06 APPROVED | G07 |
| P08 | Three feeds | G07 APPROVED | G08 |
| P09 | One-to-one text messaging | G08 APPROVED | G09 |
| P10 | Notifications and search | G09 APPROVED | G10 |
| P11 | Moderation and platform administration | G10 APPROVED | G11 |
| P12 | Founding invitations and pilot preparation | G11 APPROVED | G12 |
| P13 | Integrated verification | G12 APPROVED | G13 |
| P14 | Staging and production readiness | G13 APPROVED | G14 |
| P15 | Production deployment and controlled pilot | G14 APPROVED | G15 |

## 4. Detailed tasks and strict phase gates

### P00 — Specification baseline

**Requirements:** PRD-01–18. **Entry:** User-authorised specification review; no application coding.

#### BEL-0001 — Approve coherent baseline

- **Status:** NOT_STARTED.
- **Dependencies:** None (specification work).
- **Requirement references:** PRD-01–18; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Review all four v2.1 documents and record product decisions: open registration, proposed 18+ pilot, one church community/org, public-share boundary, blocks and invitation grants.
- **Acceptance:** Owner records accepted versions and any changes; no unresolved contradiction in active contract.
- **Verification evidence:** Walk every PRD requirement against schema and plan; record approval in decision/evidence log.

#### BEL-0002 — Resolve environment and policy decisions

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0001 COMPLETE.
- **Requirement references:** PRD-01–18; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Assign hosting/domain, support contact, terms/privacy/community standards, age safeguards, provider budget and backup/log/hold ownership.
- **Acceptance:** Every launch-sensitive decision has owner and due phase; early blockers resolved before dependent setup.
- **Verification evidence:** Review decision register; prove no hidden dependency on unavailable original chat.

#### BEL-0003 — Approve integrity and role design

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0002 COMPLETE.
- **Requirement references:** PRD-01–18; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Review 26-table inventory, scoped roles, polymorphic registry, media-only invariant, Storage ownership and erasure workflow.
- **Acceptance:** All DB-01–20 checks assigned; no creator RESTRICT/owner deletion contradiction or blanket inbox permission.
- **Verification evidence:** Threat-model ordinary/scoped/platform actors and block/owner/publishing/deletion races.

**G00 — Specification baseline exit gate**

Requires all P00 tasks through BEL-0003 COMPLETE, their actual evidence attached, introduced regressions fixed, dependency/decision register current and owner review recorded. Claude must present changed deliverables, acceptance results, unresolved risks and next phase scope, then STOP dependent progression until owner approves G00. No critical security/privacy/data-loss defect may cross the gate. Record acceptance of all four v2.1 documents and the reconstructed product decisions; document completeness is not product approval.

### P01 — Repository and engineering foundation

**Requirements:** PRD-16/17. **Entry:** G00 APPROVED.

#### BEL-0101 — Initialise reproducible repository

- **Status:** NOT_STARTED.
- **Dependencies:** G00 APPROVED.
- **Requirement references:** PRD-16/17; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Inspect existing work; create minimal Next.js App Router strict TypeScript/Tailwind foundation, npm lockfile and managed configuration.
- **Acceptance:** Exact compatible runtime/package versions recorded from official guidance; local start and production build work.
- **Verification evidence:** Fresh install from lockfile; lint/type/build; verify no unrelated user edits overwritten.

#### BEL-0102 — Establish module and UI shell

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0101 COMPLETE.
- **Requirement references:** PRD-16/17; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Create needed route/module boundaries, responsive navigation, public/auth/protected layouts and error/loading boundaries.
- **Acceptance:** 360/768/1280 layouts usable, keyboard navigation works, no fake feature success.
- **Verification evidence:** Browser smoke and manual keyboard/width checks.

#### BEL-0103 — Establish tests and CI

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0102 COMPLETE.
- **Requirement references:** PRD-16/17; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Choose compatible unit/integration/E2E tools, isolated fixtures and CI lint/type/test/build.
- **Acceptance:** CI passes baseline and deliberately introduced failing test blocks merge; no production secrets.
- **Verification evidence:** Execute positive/negative CI rehearsal and clean up intentional failure.

#### BEL-0104 — Record dependency and secret controls

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0103 COMPLETE.
- **Requirement references:** PRD-16/17; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Document commands, approved toolchain, environment template, vulnerability/license review and server-only boundaries.
- **Acceptance:** No service secret in client bundle/repository; one package manager; environment setup reproducible.
- **Verification evidence:** Scan tracked/configured files and built output; inspect dependency report.

**G01 — Repository and engineering foundation exit gate**

Requires all P01 tasks through BEL-0104 COMPLETE, their actual evidence attached, introduced regressions fixed, dependency/decision register current and owner review recorded. Claude must present changed deliverables, acceptance results, unresolved risks and next phase scope, then STOP dependent progression until owner approves G01. No critical security/privacy/data-loss defect may cross the gate. Any proposed exception must name affected requirement, risk, owner and remediation date; no silent waiver.

### P02 — Supabase and persistence foundation

**Requirements:** PRD-01/15/17. **Entry:** G01 APPROVED.

#### BEL-0201 — Create isolated environments

- **Status:** NOT_STARTED.
- **Dependencies:** G01 APPROVED.
- **Requirement references:** PRD-01/15/17; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Configure local/development and staging projects; prepare production configuration without releasing application.
- **Acceptance:** Environment IDs/credentials isolated; allowed redirects and secret handling recorded.
- **Verification evidence:** Exercise local/staging connections and prove test process cannot target production.

#### BEL-0202 — Implement schema migration groups

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0201 COMPLETE.
- **Requirement references:** PRD-01/15/17; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Apply schema M01–M12 in dependency order, including all 26 tables, deny-default RLS, FKs/indexes and inaccessible helper skeletons where later operations are not yet exposed.
- **Acceptance:** Fresh database reset deterministic; no permissive placeholder or missing org follows; all constraints introspected.
- **Verification evidence:** Database reset/migrate twice on disposable environments; DB-01 inventory and grants checks.

#### BEL-0203 — Install secure helper framework

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0202 COMPLETE.
- **Requirement references:** PRD-01/15/17; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Implement real eligibility/role/access predicates, definer permissions, invoker-safe projections and transition validation before their feature exposure.
- **Acceptance:** No RLS recursion, default EXECUTE leak or raw sensitive projection; ordinary writes revoked.
- **Verification evidence:** DB-02/03/19 actor matrix, function/view permission tests.

#### BEL-0204 — Configure private Storage

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0203 COMPLETE.
- **Requirement references:** PRD-01/15/17; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Create six private buckets, registered path permissions, inspection rules and no-store delivery boundary.
- **Acceptance:** Anon/object-key guessing denied; scope checks enforced; no direct metadata manipulation.
- **Verification evidence:** Upload/read negative tests under actual client identities; inspect bucket/public flags.

#### BEL-0205 — Prepare bootstrap and lifecycle harness

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0204 COMPLETE.
- **Requirement references:** PRD-01/15/17; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Bootstrap synthetic platform owner and scoped fixtures, shared lock ordering, audit correlation, cleanup/retry harness and backup configuration.
- **Acceptance:** No first-signup owner; exact-one owner constraints work; synthetic data only.
- **Verification evidence:** Concurrent owner tests, audit minimisation and initial local backup/restore smoke.

**G02 — Supabase and persistence foundation exit gate**

Requires all P02 tasks through BEL-0205 COMPLETE, their actual evidence attached, introduced regressions fixed, dependency/decision register current and owner review recorded. Claude must present changed deliverables, acceptance results, unresolved risks and next phase scope, then STOP dependent progression until owner approves G02. No critical security/privacy/data-loss defect may cross the gate. Any proposed exception must name affected requirement, risk, owner and remediation date; no silent waiver.

### P03 — Authentication and onboarding

**Requirements:** PRD-01/02. **Entry:** G02 APPROVED.

#### BEL-0301 — Implement session and auth journeys

- **Status:** NOT_STARTED.
- **Dependencies:** G02 APPROVED.
- **Requirement references:** PRD-01/02; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Email/password verification/recovery, Google callback and phone OTP with current supported SSR/session/origin controls.
- **Acceptance:** Each enabled provider works in staging; generic recovery errors, safe redirects and throttling.
- **Verification evidence:** Real provider smoke including expired/invalid challenge, redirect abuse and sign-out.

#### BEL-0302 — Provision identity and onboarding

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0301 COMPLETE.
- **Requirement references:** PRD-01/02; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Retry-safe profile/settings provisioning, username reservation/validation and terms/privacy completion.
- **Acceptance:** Exactly one pair, valid completion prerequisites, incomplete user cannot participate.
- **Verification evidence:** Race duplicate usernames and provisioning retries; deny social calls before completion.

#### BEL-0303 — Implement identity linking

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0302 COMPLETE.
- **Requirement references:** PRD-01/02; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Supported verified linking/unlinking, collision handling and reauth.
- **Acceptance:** One canonical UUID retained; no cross-account merge; viable sign-in remains.
- **Verification evidence:** DB-14 linking/collision/unlink scenarios; inspect audit for token absence.

#### BEL-0304 — Verify status and session revocation

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0303 COMPLETE.
- **Requirement references:** PRD-01/02; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Ensure suspension/deletion live status overrides old sessions; retain narrow account-control access.
- **Acceptance:** Old token cannot post/send; status/support/export/deletion access behaves per contract.
- **Verification evidence:** Exercise stale-token positive/negative actor tests and recovery journeys.

**G03 — Authentication and onboarding exit gate**

Requires all P03 tasks through BEL-0304 COMPLETE, their actual evidence attached, introduced regressions fixed, dependency/decision register current and owner review recorded. Claude must present changed deliverables, acceptance results, unresolved risks and next phase scope, then STOP dependent progression until owner approves G03. No critical security/privacy/data-loss defect may cross the gate. Any proposed exception must name affected requirement, risk, owner and remediation date; no silent waiver.

### P04 — Profiles, interests and account controls

**Requirements:** PRD-02/15/16. **Entry:** G03 APPROVED.

#### BEL-0401 — Implement profile and settings

- **Status:** NOT_STARTED.
- **Dependencies:** G03 APPROVED.
- **Requirement references:** PRD-02/15/16; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Public-safe profile/edit/avatar/coarse location; own preferences; curated interests.
- **Acceptance:** No email/phone/settings leak; schema limits and reserved names enforced; <=20 interests.
- **Verification evidence:** Own/other/anon projection tests, edits and concurrent interest selection.

#### BEL-0402 — Implement export

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0401 COMPLETE.
- **Requirement references:** PRD-02/15/16; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Reauthenticated on-demand own/shared-data export through protected expiring download without new table.
- **Acceptance:** No credentials/internal notes/other settings; permission checked at generation/delivery.
- **Verification evidence:** Inspect exported data for own and adversarial fixtures; expired download denied.

#### BEL-0403 — Implement erasure orchestration

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0402 COMPLETE.
- **Requirement references:** PRD-02/15/16; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Pending state, ownership transfer/archive preflight, personal purge, official attribution, survivor messages, Storage migration/removal, supported Auth deletion and reconciliation.
- **Acceptance:** No partial reactivation, zero owned objects before Auth removal, owner constraints preserved; stage status truthful.
- **Verification evidence:** DB-15/16 fault injection at each stage, double retry, creator/last-owner/both-participant tests.

#### BEL-0404 — Implement retention workers

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0403 COMPLETE.
- **Requirement references:** PRD-02/15/16; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Pending uploads/drafts, notifications/invites, verification/case/audit lifecycle and orphan reconciliation per approved policy.
- **Acceptance:** Idempotent scoped jobs; no published assets deleted by stale pending scan; bounded evidence retention.
- **Verification evidence:** Advance synthetic clocks; run cleanup twice; inspect bytes and rows and restore deletion replay.

**G04 — Profiles, interests and account controls exit gate**

Requires all P04 tasks through BEL-0404 COMPLETE, their actual evidence attached, introduced regressions fixed, dependency/decision register current and owner review recorded. Claude must present changed deliverables, acceptance results, unresolved risks and next phase scope, then STOP dependent progression until owner approves G04. No critical security/privacy/data-loss defect may cross the gate. Any proposed exception must name affected requirement, risk, owner and remediation date; no silent waiver.

### P05 — Roles and social relationships

**Requirements:** PRD-03/13. **Entry:** G04 APPROVED.

#### BEL-0501 — Implement scoped role transitions

- **Status:** NOT_STARTED.
- **Dependencies:** G04 APPROVED.
- **Requirement references:** PRD-03/13; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Owner transfer, admin/moderator grants, platform recovery and current-role projections.
- **Acceptance:** Exactly one owner, no cross-scope/equal-higher escalation; recent reauth on critical grants.
- **Verification evidence:** DB-08/19 parallel transfer/delete and privilege-forgery tests.

#### BEL-0502 — Implement user/org follows

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0501 COMPLETE.
- **Requirement references:** PRD-03/13; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Session-derived endpoints, idempotent follow/unfollow and safe lists.
- **Acceptance:** Distinct user edges, active org follow, no implicit friendship/member grants.
- **Verification evidence:** Positive/negative follow tests and DB-06 source fixtures.

#### BEL-0503 — Implement friendships

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0502 COMPLETE.
- **Requirement references:** PRD-03/13; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Canonical request/response/re-request/cancel/unfriend state machine.
- **Acceptance:** Recipient-only accept/decline, reciprocal pending not auto-accept, one pair under races.
- **Verification evidence:** DB-04 including stale and duplicated requests and recipient preference changes.

#### BEL-0504 — Implement blocks

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0503 COMPLETE.
- **Requirement references:** PRD-03/13; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Canonical pair locking across follow/friend/message, cleanup, privacy predicates and neutral unavailable UI.
- **Acceptance:** Block removes both follows/friendship; unblock restores nothing; historical messages preserved.
- **Verification evidence:** DB-05 race tests; shared community/org representative scenarios.

**G05 — Roles and social relationships exit gate**

Requires all P05 tasks through BEL-0504 COMPLETE, their actual evidence attached, introduced regressions fixed, dependency/decision register current and owner review recorded. Claude must present changed deliverables, acceptance results, unresolved risks and next phase scope, then STOP dependent progression until owner approves G05. No critical security/privacy/data-loss defect may cross the gate. Any proposed exception must name affected requirement, risk, owner and remediation date; no silent waiver.

### P06 — Organisations and communities

**Requirements:** PRD-07/08. **Entry:** G05 APPROVED.

#### BEL-0601 — Implement official organisations

- **Status:** NOT_STARTED.
- **Dependencies:** G05 APPROVED.
- **Requirement references:** PRD-07/08; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Creation/initial owner, edit/assets/status, role directory, transfer/archive and follows UI.
- **Acceptance:** Historical creator is not authority; no ownerless active org, no other-org edits.
- **Verification evidence:** Create/edit/transfer/archive tests plus erased-creator fixture.

#### BEL-0602 — Implement verification workflow

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0601 COMPLETE.
- **Requirement references:** PRD-07/08; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Submit evidence, withdraw/resubmit, reviewer decision/revocation and badge rendering.
- **Acceptance:** One pending request; request/org state atomic; review notes/evidence scoped; no verified resubmit.
- **Verification evidence:** DB-18 concurrent decisions, direct evidence URL denial and revoked badge checks.

#### BEL-0603 — Implement community creation/settings

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0602 COMPLETE.
- **Requirement references:** PRD-07/08; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Interest or verified-org church, one church/org, public/private discovery, archive/suspension and privacy changes.
- **Acceptance:** No context conversion/move, safe discovery fields, linked suspended org hides church content.
- **Verification evidence:** DB-07 kind/context and public-to-private direct-read/media denial.

#### BEL-0604 — Implement membership and local staff

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0603 COMPLETE.
- **Requirement references:** PRD-07/08; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Public join/private approval, reject/leave/remove/ban and scoped staff transitions.
- **Acceptance:** Pending/banned denied, owner resolves before leaving, banned cannot self-rejoin, no automatic org membership.
- **Verification evidence:** Membership/owner concurrency tests and cross-community staff negatives.

**G06 — Organisations and communities exit gate**

Requires all P06 tasks through BEL-0604 COMPLETE, their actual evidence attached, introduced regressions fixed, dependency/decision register current and owner review recorded. Claude must present changed deliverables, acceptance results, unresolved risks and next phase scope, then STOP dependent progression until owner approves G06. No critical security/privacy/data-loss defect may cross the gate. Any proposed exception must name affected requirement, risk, owner and remediation date; no silent waiver.

### P07 — Publishing and engagement

**Requirements:** PRD-04/05. **Entry:** G06 APPROVED.

#### BEL-0701 — Implement draft and upload pipeline

- **Status:** NOT_STARTED.
- **Dependencies:** G06 APPROVED.
- **Requirement references:** PRD-04/05; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Reserve post/media, path grant, type/size/pixel inspection/re-encoding, ready finalisation and retries.
- **Acceptance:** No unverified publication, arbitrary path/upsert or EXIF leak; abandoned uploads cleanable.
- **Verification evidence:** DB-09 image-only/mixed/failed upload tests including invalid signatures and oversized decompression.

#### BEL-0702 — Implement publish/edit/delete

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0701 COMPLETE.
- **Requirement references:** PRD-04/05; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Human actor with personal/org/community scope, visibility changes, fixed publish chronology, atomic text/media checks.
- **Acceptance:** Empty/last-ready-image removal rejected, immutable author/context, removed/deleted rules obeyed.
- **Verification evidence:** Parallel media/publish/removal tests, author-forgery and membership-revoked-in-flight cases.

#### BEL-0703 — Implement media delivery and cache invalidation

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0702 COMPLETE.
- **Requirement references:** PRD-04/05; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Current-parent private/no-store routes, safe public share and bounded exceptional signed URLs.
- **Acceptance:** Visibility/block/status revokes new access across all entry points; no private shared-cache response.
- **Verification evidence:** DB-10 direct-object guessing, cross-user cache and stale signed-link lifetime verification.

#### BEL-0704 — Implement likes/comments/saves/sharing

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0703 COMPLETE.
- **Requirement references:** PRD-04/05; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Single likes/private saves, flat comments, own edits/scoped removal, public link UI and all async states.
- **Acceptance:** Idempotent retries, no private saves/removed bodies leak; inaccessible unlike/unsave works.
- **Verification evidence:** Engagement actor matrix, retry/race tests and public/private link browser checks.

**G07 — Publishing and engagement exit gate**

Requires all P07 tasks through BEL-0704 COMPLETE, their actual evidence attached, introduced regressions fixed, dependency/decision register current and owner review recorded. Claude must present changed deliverables, acceptance results, unresolved risks and next phase scope, then STOP dependent progression until owner approves G07. No critical security/privacy/data-loss defect may cross the gate. Any proposed exception must name affected requirement, risk, owner and remediation date; no silent waiver.

### P08 — Three feeds

**Requirements:** PRD-06. **Entry:** G07 APPROVED.

#### BEL-0801 — Build Following query

- **Status:** NOT_STARTED.
- **Dependencies:** G07 APPROVED.
- **Requirement references:** PRD-06; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Merge followed human personal posts and followed organisation official posts.
- **Acceptance:** No admins' unrelated personal posts; chronological cursor and unified read predicate.
- **Verification evidence:** DB-06 golden fixtures and DB-10 privacy revocation during pagination.

#### BEL-0802 — Build Friends query

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0801 COMPLETE.
- **Requirement references:** PRD-06; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Accepted-friend personal public/friends candidates only.
- **Acceptance:** Pending/unfriended/blocked excluded; no org/community expansion.
- **Verification evidence:** Positive/negative friendship fixtures and race removal tests.

#### BEL-0803 — Build For You heuristic

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0802 COMPLETE.
- **Requirement references:** PRD-06; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Document versioned deterministic bounded interest/social/recency score, fixed snapshot and cursor.
- **Acceptance:** No ML service/new feed table, candidate filtering before score/count, stable page <=50.
- **Verification evidence:** Deterministic ranking tests, no-access score leakage and performance plan.

#### BEL-0804 — Complete feed interface and query validation

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0803 COMPLETE.
- **Requirement references:** PRD-06; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Tabs/loading/empty/error/retry/end, selected columns/index plans and mobile performance.
- **Acceptance:** All three journeys usable with representative data; no N+1 remote lookups.
- **Verification evidence:** E2E feed switching/pagination and ordinary-role query plans.

**G08 — Three feeds exit gate**

Requires all P08 tasks through BEL-0804 COMPLETE, their actual evidence attached, introduced regressions fixed, dependency/decision register current and owner review recorded. Claude must present changed deliverables, acceptance results, unresolved risks and next phase scope, then STOP dependent progression until owner approves G08. No critical security/privacy/data-loss defect may cross the gate. Any proposed exception must name affected requirement, risk, owner and remediation date; no silent waiver.

### P09 — One-to-one text messaging

**Requirements:** PRD-09. **Entry:** G08 APPROVED.

#### BEL-0901 — Implement conversation/open/send

- **Status:** NOT_STARTED.
- **Dependencies:** G08 APPROVED.
- **Requirement references:** PRD-09; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Fixed canonical pair, accepted friends/recipient permission checked per send, unique request key and event.
- **Acceptance:** No empty-slot reuse/group mode/edit/unsend; sender actual participant.
- **Verification evidence:** DB-12/13 pair/send retries and concurrent block/unfriend/suspension.

#### BEL-0902 — Implement history/read cursors

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0901 COMPLETE.
- **Requirement references:** PRD-09; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Participant-only paginated history, own monotonic cutoff, survivor deleted attribution.
- **Acceptance:** Nonparticipant and staff denied; no other-slot cursor update; both-erased purge.
- **Verification evidence:** DB-13 read-cursor/deletion fixture and projection inspection.

#### BEL-0903 — Implement optional realtime delivery

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0902 COMPLETE.
- **Requirement references:** PRD-09; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Private authorised channels or polling fallback; minimal event then authorised fetch.
- **Acceptance:** No public body broadcast; revoked access cannot continue fetching/sending.
- **Verification evidence:** Cross-user channel test, reconnect/retry and membership/status revocation rehearsal.

#### BEL-0904 — Complete messaging UI

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-0903 COMPLETE.
- **Requirement references:** PRD-09; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** List/detail/compose/loading/error/no-permission states, max text limit and duplicate-send prevention.
- **Acceptance:** Permission changes produce truthful read-only state; no fabricated delivered/read status.
- **Verification evidence:** Mobile/keyboard E2E send/history/unfriend/block and retry journeys.

**G09 — One-to-one text messaging exit gate**

Requires all P09 tasks through BEL-0904 COMPLETE, their actual evidence attached, introduced regressions fixed, dependency/decision register current and owner review recorded. Claude must present changed deliverables, acceptance results, unresolved risks and next phase scope, then STOP dependent progression until owner approves G09. No critical security/privacy/data-loss defect may cross the gate. Any proposed exception must name affected requirement, risk, owner and remediation date; no silent waiver.

### P10 — Notifications and search

**Requirements:** PRD-10/11. **Entry:** G09 APPROVED.

#### BEL-1001 — Implement notification event operations

- **Status:** NOT_STARTED.
- **Dependencies:** G09 APPROVED.
- **Requirement references:** PRD-10/11; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Derive recipients/actors, compatible target validation, preference categories, bounded dedupe and essential notices.
- **Acceptance:** No message preview/private payload; event/recipient context checked.
- **Verification evidence:** DB-11 forged targets/context, repeat event and deleted-target races.

#### BEL-1002 — Implement inbox and read flag

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-1001 COMPLETE.
- **Requirement references:** PRD-10/11; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Own pagination/unread/mark-read, revalidate inaccessible target counts/deep links.
- **Acceptance:** No cross-user reads/flags; stale targets neutral; 90-day cleanup.
- **Verification evidence:** Actor tests plus browser stale notification and mark-read retries.

#### BEL-1003 — Implement basic search

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-1002 COMPLETE.
- **Requirement references:** PRD-10/11; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Profile/post/community/org lookup, database indexes and permission-before-excerpt/count.
- **Acceptance:** No messages/settings/evidence/private interests indexed; bounded parameterised query.
- **Verification evidence:** PRD-11 negative fixtures and query plans under RLS.

#### BEL-1004 — Verify cross-entry privacy consistency

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-1003 COMPLETE.
- **Requirement references:** PRD-10/11; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Detail/feed/search/save/media/notification/share projection parity.
- **Acceptance:** Same resource inaccessible from every forbidden path after role/privacy/status change.
- **Verification evidence:** DB-10 matrix across signed-in/anon/scoped/deleting actors.

**G10 — Notifications and search exit gate**

Requires all P10 tasks through BEL-1004 COMPLETE, their actual evidence attached, introduced regressions fixed, dependency/decision register current and owner review recorded. Claude must present changed deliverables, acceptance results, unresolved risks and next phase scope, then STOP dependent progression until owner approves G10. No critical security/privacy/data-loss defect may cross the gate. Any proposed exception must name affected requirement, risk, owner and remediation date; no silent waiver.

### P11 — Moderation and platform administration

**Requirements:** PRD-12/13. **Entry:** G10 APPROVED.

#### BEL-1101 — Implement report capture/status

- **Status:** NOT_STARTED.
- **Dependencies:** G10 APPROVED.
- **Requirement references:** PRD-12/13; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Closed target types, existence/access lock, bounded server snapshot, one open report, own status projection.
- **Acceptance:** No client evidence injection or whole inbox capture; live pointers NULL on purge.
- **Verification evidence:** DB-11/12 forge/race/participant tests; inspect evidence bound/fields.

#### BEL-1102 — Implement scoped moderation

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-1101 COMPLETE.
- **Requirement references:** PRD-12/13; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Remove/restore content, message tombstone exception, account/entity suspension, case disposition and audit.
- **Acceptance:** Role/action compatibility, no unrelated private reads or equal-higher privilege change.
- **Verification evidence:** Cross-scope/equal-role negatives, restore parent revalidation and audit atomicity.

#### BEL-1103 — Implement operator console

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-1102 COMPLETE.
- **Requirement references:** PRD-12/13; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Role-filtered queues, verification/admin screens, taxonomy/invitation controls and safe audit views.
- **Acceptance:** No first-signup admin or blanket private SELECT; nonstaff cannot access routes or RPCs.
- **Verification evidence:** Direct requests under every role, keyboard queue workflow and protected-note tests.

#### BEL-1104 — Write safety/support runbook

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-1103 COMPLETE.
- **Requirement references:** PRD-12/13; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Operator ownership, queue triage, appeal/status support route, incident response and minimised evidence process.
- **Acceptance:** Configured support contact, staff understand boundaries, no new appeals table.
- **Verification evidence:** Tabletop reported message, mistaken removal, suspension appeal and severe incident.

**G11 — Moderation and platform administration exit gate**

Requires all P11 tasks through BEL-1104 COMPLETE, their actual evidence attached, introduced regressions fixed, dependency/decision register current and owner review recorded. Claude must present changed deliverables, acceptance results, unresolved risks and next phase scope, then STOP dependent progression until owner approves G11. No critical security/privacy/data-loss defect may cross the gate. Any proposed exception must name affected requirement, risk, owner and remediation date; no silent waiver.

### P12 — Founding invitations and pilot preparation

**Requirements:** PRD-14/18. **Entry:** G11 APPROVED.

#### BEL-1201 — Implement invitation lifecycle

- **Status:** NOT_STARTED.
- **Dependencies:** G11 APPROVED.
- **Requirement references:** PRD-14/18; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Hash-only strong single-use token, scoped issue/revoke/expiry and safe management.
- **Acceptance:** No recipient PII list; current issuer scope rechecked; no owner/platform grants.
- **Verification evidence:** DB-17 token leak scan, probing limits and parallel redemption.

#### BEL-1202 — Implement redemption/onboarding UI

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-1201 COMPLETE.
- **Requirement references:** PRD-14/18; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Open registration plus optional founding token and bounded post-onboarding scope grant.
- **Acceptance:** Invite never bypasses verification/eligibility; expired/revoked generic state; retry safe.
- **Verification evidence:** Fresh/existing account E2E and lost-issuer-authority case.

#### BEL-1203 — Prepare synthetic pilot and training

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-1202 COMPLETE.
- **Requirement references:** PRD-14/18; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Representative fixtures, welcome/onboarding guidance, moderator/admin training and documented pilot support.
- **Acceptance:** No imported/real private data; pilot cohort expansion not executed without approval.
- **Verification evidence:** Dry-run member/org/community/moderator journeys with synthetic accounts.

**G12 — Founding invitations and pilot preparation exit gate**

Requires all P12 tasks through BEL-1203 COMPLETE, their actual evidence attached, introduced regressions fixed, dependency/decision register current and owner review recorded. Claude must present changed deliverables, acceptance results, unresolved risks and next phase scope, then STOP dependent progression until owner approves G12. No critical security/privacy/data-loss defect may cross the gate. Any proposed exception must name affected requirement, risk, owner and remediation date; no silent waiver.

### P13 — Integrated verification

**Requirements:** PRD-01–18. **Entry:** G12 APPROVED.

#### BEL-1301 — Run full regression and traceability

- **Status:** NOT_STARTED.
- **Dependencies:** G12 APPROVED.
- **Requirement references:** PRD-01–18; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Execute every PRD acceptance and DB-01–20; units/integration/RLS/E2E/type/lint/build.
- **Acceptance:** All scoped requirements have evidence or explicit blocking failure; no critical privacy/data-loss defect.
- **Verification evidence:** Review traceability report, reproduce failures and rerun only affected checks after fixes.

#### BEL-1302 — Run accessibility and responsive review

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-1301 COMPLETE.
- **Requirement references:** PRD-01–18; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Automated checks plus keyboard/screen-reader samples at 360/768/1280 widths.
- **Acceptance:** Core journeys usable, focus/labels/contrast/error states meet target; no overflow.
- **Verification evidence:** Record browser/device/check conditions and screenshots of material findings.

#### BEL-1303 — Run representative performance/security tests

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-1302 COMPLETE.
- **Requirement references:** PRD-01–18; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** 100 concurrent sessions/10k profiles/100k posts/15min steady workload, abuse limits and secret/dependency review.
- **Acceptance:** Measure PRD targets; no sensitive logs/client secrets; no assertion of unmeasured performance.
- **Verification evidence:** Attach p95/error rate/query plans, dependency review and actor/abuse reports.

#### BEL-1304 — Rehearse lifecycle and recovery

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-1303 COMPLETE.
- **Requirement references:** PRD-01–18; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Crash injection deletion/upload/moderation, cleanup, backup restore with deletion replay and forward repair.
- **Acceptance:** Retry converges, no re-exposure after restore, operations owner can execute runbook.
- **Verification evidence:** Recorded disposable-environment restore and DB-15/16/20 evidence.

**G13 — Integrated verification exit gate**

Requires all P13 tasks through BEL-1304 COMPLETE, their actual evidence attached, introduced regressions fixed, dependency/decision register current and owner review recorded. Claude must present changed deliverables, acceptance results, unresolved risks and next phase scope, then STOP dependent progression until owner approves G13. No critical security/privacy/data-loss defect may cross the gate. Any proposed exception must name affected requirement, risk, owner and remediation date; no silent waiver.

### P14 — Staging and production readiness

**Requirements:** PRD-17/18. **Entry:** G13 APPROVED.

#### BEL-1401 — Deploy release candidate to staging

- **Status:** NOT_STARTED.
- **Dependencies:** G13 APPROVED.
- **Requirement references:** PRD-17/18; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Exact locked build/migration set, configured real enabled providers/Storage/realtime and scheduled jobs.
- **Acceptance:** No environment bleed; production-like configuration tested, no destructive production action.
- **Verification evidence:** Staging smoke all critical journeys and integration settings review.

#### BEL-1402 — Complete release/policy package

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-1401 COMPLETE.
- **Requirement references:** PRD-17/18; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Terms/privacy/standards/age approval, retention/backup/log policy, support/incident contact, domain/redirect/OTP budgets and operator roster.
- **Acceptance:** Every owner decision resolved; no placeholder contact/policy; cost and retention known.
- **Verification evidence:** Owner review of checklist and safety/provider/operational evidence.

#### BEL-1403 — Prepare deployment and recovery plan

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-1402 COMPLETE.
- **Requirement references:** PRD-17/18; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Build identifier, migration sequencing/backup, monitoring thresholds, rollback/forward fix, smoke/abort criteria.
- **Acceptance:** Concrete reviewable release and explicit owner production authorisation; no deployment before approval.
- **Verification evidence:** Tabletop failed migration/login/media leak and verify rollback/restore commands on staging.

**G14 — Staging and production readiness exit gate**

Requires all P14 tasks through BEL-1403 COMPLETE, their actual evidence attached, introduced regressions fixed, dependency/decision register current and owner review recorded. Claude must present changed deliverables, acceptance results, unresolved risks and next phase scope, then STOP dependent progression until owner approves G14. No critical security/privacy/data-loss defect may cross the gate. Production deployment requires explicit release-specific authorisation in addition to technical readiness.

### P15 — Production deployment and controlled pilot

**Requirements:** PRD-18. **Entry:** G14 APPROVED.

#### BEL-1501 — Deploy approved release

- **Status:** NOT_STARTED.
- **Dependencies:** G14 APPROVED.
- **Requirement references:** PRD-18; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Apply reviewed production migration/release with backup and monitored health; no unrelated changes.
- **Acceptance:** Correct build/config/migration inventory; critical health and privacy smoke pass or abort.
- **Verification evidence:** Record release ID/time, migration results, logs and approved smoke actor evidence.

#### BEL-1502 — Validate controlled pilot

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-1501 COMPLETE.
- **Requirement references:** PRD-18; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Only authorised pilot cohort, monitor errors/latency/queues/providers/jobs and support.
- **Acceptance:** No critical unresolved safety/data-loss issue; meaningful pilot findings triaged.
- **Verification evidence:** Pilot member/operator journeys, live safe probes and operational dashboard review.

#### BEL-1503 — Handoff and decide expansion

- **Status:** NOT_STARTED.
- **Dependencies:** BEL-1502 COMPLETE.
- **Requirement references:** PRD-18; applicable schema dictionary, operation and DB acceptance contracts.
- **Deliverable / bounded work:** Record actual metrics/issues/runbooks/owners, reconcile docs to implementation and request pilot expansion decision.
- **Acceptance:** No fabricated success; owner accepts release outcome and explicitly approves expansion or corrective work.
- **Verification evidence:** Final traceability/evidence/release report and bounded follow-up backlog.

**G15 — Production deployment and controlled pilot exit gate**

Requires all P15 tasks through BEL-1503 COMPLETE, their actual evidence attached, introduced regressions fixed, dependency/decision register current and owner review recorded. Claude must present changed deliverables, acceptance results, unresolved risks and next phase scope, then STOP dependent progression until owner approves G15. No critical security/privacy/data-loss defect may cross the gate. Pilot expansion requires separate explicit owner decision; deployment alone is not permission to expand.

## 5. Cross-cutting traceability and evidence register

| Coverage | Primary tasks | Required independent evidence |
|---|---|---|
| PRD-01/02 identity/onboarding | P03/P04 | Real provider flows, collisions, username races, protected fields |
| PRD-03 relationships | P05 | Canonical pairs, block races, direct-access negatives |
| PRD-04/05 publishing | P07 | Media-only/last-image/concurrency, private bytes, engagement |
| PRD-06 feeds | P08 | Both follow sources, deterministic cursors, current privacy |
| PRD-07/08 entities | P06 | Verification/state consistency, scoped roles, private memberships |
| PRD-09 messages | P09 | Participants only, send permission races, erasure history |
| PRD-10/11 discovery | P10 | No private excerpts/counts, safe notification targets |
| PRD-12/13 safety/admin | P11 | Scoped case access, owner constraints, audited actions |
| PRD-14 invites | P12 | Single winner, hash-only, bounded grants |
| PRD-15 lifecycle | P04/P07/P13 | Export boundaries, Storage owner conflict, erasure retry and restore replay |
| PRD-16 interface | Every feature/P13 | Responsive/keyboard/error/loading/manual accessibility |
| PRD-17/18 operations | P13–P15 | Performance/security/restore, policy signoff, release-specific permission |

DB-01–DB-20 in backend_schema.md are the exact database acceptance catalogue. BEL-1301 must map each ID to actual executable check and result; no generic “security tested” substitute. Fixtures include active/incomplete/suspended/deleting users, accepted/pending/blocked pairs, org owner/admin, community owner/admin/moderator/pending/banned, platform owner/admin/moderator, anonymous viewer and erased participants.

## 6. Environment decision register template

At G00/G01 record exact owner, chosen value, due task and evidence for: eligibility/terms/privacy/community standards; hosting/domain/TLS/redirects; Node/package versions; email/Google/phone provider setup/budget; support contact; admin bootstrap custody; pilot cohort permission; retention/backup/provider logs/holds; monitoring/incident owner; production costs. A value needed for implementation is resolved before that task; a release-only value may remain assigned until P14. No placeholder is accepted at release. Never store actual credentials in this register.

## 7. Recovery and change rules

If task fails, preserve evidence, correct within bounded scope and rerun affected checks. If requirement/schema must change, coordinate document revision/ADR and owner approval before dependent implementation. Never relax tests, disable RLS/FKs or silently delete conflicting records. Recover deployment with pretested forward repair or restore; a rollback losing new user data is not safe merely because code reverted. After restore replay deletion/visibility state before exposing traffic. No production destructive action without specific authorisation.

Final handoff contains release/migration identifiers, actual PRD/DB evidence, known issues, monitoring/cleanup/backup ownership, support/incident contacts and next approved scope. Unbuilt product remains unbuilt regardless of document completion.

