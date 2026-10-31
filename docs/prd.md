# BELUNAI — Product Requirements Document

**ID:** BEL-PRD-001 · **Version:** 2.1 · **Date:** 2026-10-31  
**Status:** Complete reconstructed MVP baseline for owner review. Not an implementation or launch approval.

## 1. Purpose and document authority

BELUNAI is a mobile-first Christian-values social network initially serving Nigeria. It welcomes legitimate discussion of faith, relationships, entertainment, education, technology, careers, business, sports and ordinary life. Faith-informed standards guide conduct; content is not restricted to religious topics.

This PRD defines what the MVP must do. agents.md defines engineering rules; backend_schema.md defines data/security contracts; implementation_plan.md defines delivery sequence and gates. Together these version 2.1 documents replace the incomplete recovered drafts. The original chat could not be fully retrieved. At the user's request this is a completed reconstruction using available requirements and explicit decisions, not a claim of verbatim restoration. Missing original text is no longer a prerequisite for drafting or reviewing this baseline. Owner acceptance of product decisions remains the first development gate.

Normative MUST/MUST NOT requirements are binding after baseline approval. Implementation evidence, phase approval and production authorisation are separate records. A later task instruction cannot silently override these requirements.

## 2. Problem, audience and outcomes

Users need a welcoming space for everyday conversation, trusted church/community identities, relevant discovery and private friend communication without an oversized first release. Churches need an official page and controlled community; volunteer operators need usable safety tools.

Primary users: ordinary members, church/ministry representatives, community organisers and moderators. Platform operators maintain verification and safety. The initial interface is English and responsive web; no native app, automatic translation or religious-affiliation inference.

Success means a pilot user can register, finish a profile, find relevant people/communities, publish text or images, use all three feeds, form a mutual friendship and exchange permitted messages. Operators can act on a report without accessing unrelated private data. Success metrics are pilot activation, completed onboarding, first meaningful interaction, return participation, failed-task rate and unresolved safety queue age. Establish actual baselines during pilot; do not invent existing usage figures or add a tracking warehouse. Use minimal aggregate operational measurements, excluding message bodies and sensitive evidence.

## 3. MVP scope and exclusions

Included domains map to PRD-01 through PRD-18 below. Delivery is a Next.js/TypeScript/Tailwind modular monolith with Supabase Auth/PostgreSQL/Storage and managed hosting.

Excluded: stories, reels, video uploads, livestreams, audio/video rooms, prayer/Bible-study live rooms, journals, discipleship/mentoring programmes, games/tournaments, ads/promoted posts, tickets, donations, gifts/payouts/subscriptions, group messaging, voice notes/calls, native apps, AI content generation and ML recommendation services. No speculative persistence or controls for those features. Public sharing is a link, not a repost system. Comments are flat, not nested. Only one reaction type (like).

## 4. Product decisions for this reconstructed baseline

| Decision | MVP behaviour |
|---|---|
| Registration | Open registration; founding invitations are optional onboarding/scope grants, not an unexplained global access gate |
| Age eligibility | Proposed 18+ pilot, self-attested at registration and recorded through versioned terms acceptance; no birthdate collection. Owner must approve eligibility/safeguarding before pilot |
| Profiles | Public-facing identity to eligible signed-in users; no private-profile/follow-approval system |
| Relationships | Directional user follows, independent organisation follows and separate mutual friendship |
| Personal privacy | Public or friends-only posts; own drafts private |
| Community privacy | Public/private; private group discoverable via safe metadata, content only to active members |
| Church relationship | One church community per official organisation in MVP; organisation and community roles independent |
| Public sharing | Logged-out public post route with minimal identity/media; no private/friends content |
| Uploads | Up to four still JPEG/PNG/WebP images, 10 MiB and 20 megapixels each; no video/SVG/animation |
| Messaging | Text only between accepted unblocked friends when recipient permits |
| Private media | Private storage for all assets; current permission determines delivery |
| Account deletion | Immediate participation lockout, staged erasure, transfer/archive owner duties, survivor message history retained |
| Existing content | No external content/account import in MVP |

These are explicit proposed decisions, not claims about unavailable original wording. Owner can revise them at G00 through coordinated changes to all affected documents. Routine implementation choices within an approved contract do not need repeated permission.

## 5. Functional requirements and acceptance criteria

### PRD-01 — Authentication and account access

Support email/password with verification and recovery, Google OAuth and phone OTP through Supabase. Provide sign-in/out, expired-link/OTP/error states and throttled resend. Validate callback destinations against allowed application routes. Never expose account existence unnecessarily in recovery responses. Social operations require verified identity, completed onboarding and active account; possession of a session alone is insufficient. Provider configurations and costs must be validated before enabling each method in staging.

Acceptance: each enabled method registers/signs in/recovers through the provider; existing linked identities resolve to one UUID. Forged callbacks, unsafe redirects, expired challenges and another user's identifiers fail. Explicit linking requires verified provider proof; unlink preserves another usable sign-in method. No cross-UUID account merging. Account status revocation takes effect even with a previously valid session token.

### PRD-02 — Onboarding, profiles and private settings

Require unique username, display name, versioned terms acceptance and privacy acknowledgement. Offer optional bio, coarse location, avatar and interests. Username is 3–30 ASCII letters/digits/underscore, case-insensitively unique; display name max 80, bio 500, location 100. Up to 20 curated interests. Profile completion is a trusted transition, not arbitrary timestamp editing. Settings provide friend-request permission, friends-only/nobody messaging and social/community/message notification toggles.

Acceptance: duplicate/reserved names are rejected; retries do not reset preferences. User can edit allowed fields, remove optional data and see accessible profiles. Public responses contain no email, phone, sessions, precise location, settings or evidence. Incomplete accounts see onboarding rather than a broken social shell. Inactive taxonomy entries cannot be newly selected.

### PRD-03 — Follows, friendships and blocks

Follow/unfollow people and organisations independently. Friendship is a single unordered pair with pending/accepted/declined states; recipient alone accepts/declines, sender cancels pending request, either friend removes accepted relationship. Reciprocal pending requests do not auto-accept. A declined pair may be requested again subject to permission/throttling.

Block removes both directional user follows and friendship, prevents future personal follows/requests/messages, and hides personal profile discovery/content both ways. Unblock restores nothing. Existing message history remains readable to participants. Blocking an organisation representative does not hide the organisation's official posts or grant immunity from scoped moderation. Blocks do not remove shared community membership. Public content remains available via logged-out public sharing; blocking is an authenticated interaction boundary, not secrecy for public posts.

Acceptance: self edges and duplicate pairs fail; races preserve one friendship. Follow/pending request never unlocks friends posts. Concurrent block versus follow/request/send cannot commit a prohibited interaction. Block lists cannot be enumerated by others.

### PRD-04 — Publishing and media

Personal posts are public/friends. Organisation posts require current scoped administration and are public. Community posts inherit community access and require active membership. Text max 5,000; image-only and mixed posts supported. Reserve/upload/inspect/finalise before publication; drafts may be empty, published posts may not. Initial publication timestamp determines chronology; editing does not bump it. No changing author/context after publication. Personal visibility can be changed through validated operation.

Acceptance: text-only/image-only/mixed posts publish; empty or unverified-media-only publication fails. Removing last image from textless publication fails unless replacement/text/unpublication/deletion is atomic. Strip image metadata. Rejected uploads show actionable error without publishing broken content. Deleting or restricting post removes detail/feed/search/media/save access and invalidates stale previews. No arbitrary remote URL attachment or impersonated author.

### PRD-05 — Engagement and sharing

Like/unlike once per user/post, create/edit/delete own flat comments (max 2,000), and privately save/unsave accessible posts. Authorised post owners/local staff may remove comments, not rewrite others' words. Sharing copies a public URL; unavailable/private content returns a neutral unavailable state. Save never snapshots content after access loss.

Acceptance: retries do not duplicate likes/saves/comments. Counts and actor lists obey current access/block rules. Saves are self-only; unsave/unlike own row remains possible after access loss. Removed text is absent from ordinary responses. Public share includes no relationship roster or private settings.

### PRD-06 — Three feeds

For You uses deterministic bounded interest/social/recency heuristics, not ML. Following merges personal posts by followed people and official posts by followed organisations. Friends shows personal public/friends posts by accepted friends. Organisation admins' personal posts are not organisation posts. Friendship does not auto-follow; membership does not create friendship.

Acceptance: all feeds use one current content-access predicate before ranking/counts. Chronological feeds use publication time/id cursors; For You fixes snapshot/score version for stable pagination. Page max 50; empty, loading, retry and end states work. Block/suspension/privacy revocation affects subsequent fetches and media. No private candidates leak through scores or counts.

### PRD-07 — Organisations and verification

Eligible human creates official church/ministry identity, receives scoped owner role, and can appoint admins. Humans authenticate; an organisation has no independent login. Owners transfer control explicitly. Verification requires an org admin's statement and up to five private image evidence documents; platform admin/owner approves/rejects with recorded decision. Only currently verified active organisation displays verified badge. Withdrawal/resubmission/revocation preserve history.

Acceptance: one pending request per organisation, request/org state atomically consistent, no ownerless active entity, no self-assigned verification. Unverified pages can be followed but cannot create church community until verified. Reviewer notes/evidence remain restricted. Creator deletion does not destroy official page after ownership resolution.

### PRD-08 — Communities and local administration

Support interest communities and one verified-organisation-linked church community per organisation. Public joins activate immediately; private join requests await owner/admin decision. Active members publish. Local owner/admin/moderator/member permissions follow schema matrix. Ban prevents self-rejoin. Organisation authority does not automatically grant local authority.

Acceptance: private discovery shows only safe metadata; pending/banned users cannot read content/member directory. Owners transfer before leaving; admins cannot demote owner or grant admin/owner. Local staff cannot administer unrelated communities or read member inboxes. Archived/suspended/linked-suspended contexts hide content. Changing public to private revokes nonmember access. Public-to-private change is allowed; converting a church to an interest group or moving organisation is excluded.

### PRD-09 — Direct messages

Exactly two fixed human participants; max 5,000-character text, chronological history and own conversation read cursor. Accepted friendship, no block, active eligibility and recipient friends-only setting required for each new send. nobody disables inbound sends. Existing history remains after unfriend/block; no new sends. No typing/presence, attachments, per-message receipts, edit/unsend or group chat.

Acceptance: pair/conversation and message retry keys avoid duplicates; nonparticipant cannot list/read/send. Scoped or platform roles cannot browse inbox. Account erasure anonymises sender/slot for surviving participant, never reuses empty slot; both erased purges conversation. Report review exposes only captured reported message.

### PRD-10 — Notifications

Provide follow, official-post, friendship, like/comment, membership decision, message and moderation events. Own inbox, unread count and mark-read; optional categories respect preferences, essential safety notices remain. No message body previews. Server derives actor/recipient and deduplicates.

Acceptance: retry produces no duplicate event, inaccessible targets reveal no private preview or count detail, stale links become neutral unavailable. No other user can mark/read inbox. Notification retention is 90 days. Notifications are in-app only; no push/email marketing system.

### PRD-11 — Basic search

Search profiles by username/display name, readable posts by text, discoverable communities and organisations by name/slug. Empty/loading/no-results/error states and bounded pagination required. Filter before excerpts/counts.

Acceptance: friends/private content never appears without permission. No messages/settings/reports/evidence/invitations/block lists indexed publicly. No external search or private-interest enumeration.

### PRD-12 — Reporting and moderation

Report accessible profile/org/community/post/comment/message for defined reasons; message reporting requires participation. Capture only bounded target evidence. Reporter sees own case status, not internal notes. Scoped staff moderate local content; platform moderator handles ordinary accounts/content; admins handle verification/entity operations; owner controls platform grants. Staff cannot change equal/higher privileges through suspension routes. Record action, reason, actor and audit correlation.

Acceptance: target existence/type/access validated at submission; duplicate open reports prevented. Target erasure retains only justified time-limited case evidence and clears live pointer. Removed content absent from normal reads. Moderated message uses fixed body tombstone through exceptional audited operation, not ordinary edit. Suspension appeal is a follow-up within own report/status support flow, not a new appeals table or private inbox with operators. Specific support contact must be configured before pilot.

### PRD-13 — Platform administration

Bootstrap owner out of band; never first-signup admin. Provide bounded queue/verification/entity/account/taxonomy/invitation controls and role-appropriate audit views. Require recent reauthentication for owner transfer, role grants and account erasure. Exactly one platform owner remains after bootstrap.

Acceptance: role changes are atomic/audited, no mutable user metadata authority, no blanket private-data access. Destructive production operations require explicit owner authorisation and recovery evidence.

### PRD-14 — Founding invitations

Open registration remains available. Unscoped invitation supports founding onboarding; community-scoped invite grants member when authorised by local owner/admin; org-scoped grants admin only from org owner. Never platform/owner grants. Single-use random token, hash-only storage, expiry/revoke and rate-limited generic failures. No persistent recipient email list.

Acceptance: current issuer authority checked on redemption; concurrent redemption has one winner; same redeemer retry safe. Invitation cannot bypass onboarding, verification or account eligibility. Failed/expired token leaks no target membership information.

### PRD-15 — Privacy, deletion and retention

Expose only minimal public identity. All Storage buckets private; read delivery checks parent access. Explicit linking never merges distinct accounts. User may request data export/deletion after reauthentication. Export is generated on demand through supported provider/application reads, includes only own data and shared messages they may read, excludes unrelated case notes/other private data, and is delivered through short-lived protected download without a new export table.

Deletion immediately locks participation and revokes sessions, then resolves active ownership via transfer/archive, purges personal/community contributions, preserves official org content without human attribution, removes/migrates user-owned objects and deletes Auth identity. Failed work stays pending/retryable. Surviving participant retains anonymised message history; both erased purges messages. Historical creator uses SET NULL rather than RESTRICT. A request remains pending if ownership cannot safely resolve; UI shows reason, not false completion.

Acceptance: old tokens, media links/caches and search cannot expose revoked content; deletion survives crash/retry at every stage. No disabled constraints or ownerless active entities. Follow schema retention: pending upload 24h; drafts seven inactive days; notifications 90d; terminal invitations 30d; verification evidence 30d after decision; decision/audit minimal history 365d; closed case evidence up to 180d; ordinary deleted bytes within 30d. Owner-approved backup/log/hold policy required before production; restored backups replay deletions. Already downloaded public bytes cannot be recalled.

### PRD-16 — Responsive and accessible experience

Provide landing/public share, auth/recovery, onboarding, feed tabs, compose/detail, profile/settings, relationships, org/community detail and administration, messages, notifications/search, report/status and account deletion/export screens. Navigation mobile-first with desktop adaptation. Keyboard operation, visible focus, semantic labels, sufficient contrast, meaningful alternative text, reduced-motion support and accessible errors are required. Target WCAG 2.2 AA where applicable; verify with manual keyboard/screen-reader sampling as well as automated checks.

Acceptance: core journeys work at 360, 768 and 1280px widths without horizontal overflow. Every async feature includes loading/empty/failed/retry states. Confirmation for destructive actions describes affected resource. No fake success, silent data loss or technical implementation details in user-facing flows.

### PRD-17 — Reliability, performance and operations

Use separate development/staging/production credentials/data; never production data in tests. Log correlation/status without sensitive bodies/tokens. Establish error monitoring, health checks, scheduled cleanup reconciliation, backup/restore and rollback runbooks. Rate-limit registration/OTP, relationship churn, publishing, messaging, reports and token endpoints using approved managed/server controls; do not invent extra business tables.

Proposed pilot acceptance target: 100 concurrent authenticated sessions against representative 10,000 profiles/100,000 posts in staging; ordinary feed/search/message read API p95 <=1s excluding cold start and network transfer, failed valid requests <1% during 15-minute steady run. Mobile page field performance is observed during pilot; initial staging target LCP <=2.5s and CLS <=0.1 under documented representative test conditions. These are targets to measure, not current claims. Failed targets require diagnosis and owner-approved launch exception or correction, never falsified results.

### PRD-18 — Release and pilot acceptance

All scoped requirements and schema DB-01…DB-20 verified; type/lint/build/unit/integration/RLS/E2E pass; no open critical security or data-loss issue. Test real enabled providers, private-media denial, moderation queue, export/deletion and backup restore. Production credentials/domain/redirects/OTP budget, support contact, age/terms/privacy/community standards, retention/backup policy, monitoring and operator ownership recorded. Owner explicitly authorises production deployment and pilot expansion. Functional completion does not imply legal/policy approval.

## 6. Canonical privacy and role references

backend_schema.md sections 3, 6 and 7 define exact permission predicates/matrices. This PRD requires those behaviours without duplicating database implementation details. Views, cached content, counts, notifications, realtime and Storage routes must enforce the same privacy model. Role display is not authorisation. “Private” must be true under direct requests, not only hidden navigation.

## 7. Requirement-to-delivery mapping

| Requirements | Plan phase | Primary schema domains |
|---|---|---|
| PRD-01/02 | P03/04 | Auth, profiles/settings, interests |
| PRD-03 | P05 | follows/friendships/blocks/roles |
| PRD-07/08 | P06 | orgs/verification/communities/memberships |
| PRD-04/05 | P07 | posts/media/engagement |
| PRD-06 | P08 | feed queries + organisation_follows |
| PRD-09 | P09 | conversations/messages |
| PRD-10/11 | P10 | notifications/search |
| PRD-12/13 | P11 | reports/actions/platform roles/audit |
| PRD-14 | P12 | invitations |
| PRD-15/16/17 | P02–P14 | Cross-cutting security, lifecycle, UI, operations |
| PRD-18 | P13–P15 | Full acceptance and release gates |

## 8. Approval record and changes

All work is initially NOT_STARTED; no feature, test, provider or deployment is claimed complete. G00 records owner acceptance of version 2.1 and product decisions above. Runtime/package versions, hosting/domain, provider configuration/budget, support contact and policy texts are environment decisions recorded in the plan before dependent work. No unavailable original file is required to review this reconstructed baseline. If original files later surface, compare them as historical evidence and explicitly approve any change rather than silently replacing this contract.

Change record: 2.1 reconstructs missing PRD, aligns full MVP with consolidated schema, establishes requirement IDs, concrete acceptance and release criteria. Changes to scope/data/privacy require coordinated document revision and impact review.
