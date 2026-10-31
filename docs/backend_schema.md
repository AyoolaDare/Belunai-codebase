# BELUNAI — Consolidated Backend Schema

**File:** backend_schema.md  
**Document:** BEL-DATA-001, version 2.1  
**Date:** 2026-10-31  
**Status:** Complete revised specification for review; approval and implementation are not implied.  
**Architecture:** Next.js App Router, strict TypeScript, Tailwind CSS, Supabase Auth, PostgreSQL and Storage.  
**Deliverable:** Data specification, not application code or executable migrations.

## 1. Authority, provenance and scope

This document consolidates the original 25-table base and mandatory organisation_follows amendment into exactly **26 application tables**. It replaces separate schema amendments. prd.md governs product requirements; agents.md governs engineering conduct; this file governs persistence/security; implementation_plan.md governs development order and human gates. Identify conflicts and stop their dependent implementation for an owner decision. No silent scope changes or bypassing phase gates.

**Source history:** The retrieved “Solution Architecture Approach” conversation (6ae490a8-42e4-83ea-aec3-2bbf5d132fdf) supplied only bounded excerpts of the original documents. Version 2.1 completes the document suite at the user's request through explicit reconstruction, not claimed verbatim restoration. The active companions are prd.md, agents.md and implementation_plan.md version 2.1. Missing original text is no longer a review prerequisite. Original excerpts remain historical; if full originals later appear, compare and explicitly decide changes rather than silently replacing this baseline. Product approval is still recorded at G00, separately from document completion.

MVP includes authentication (email/password, Google OAuth, phone OTP), onboarding, profiles/interests, follows/friendships/blocks, text/image posts, likes/flat comments/private saves/public sharing, three feeds, church/ministry organisations and verification, public/private communities, scoped administration, one-to-one text messaging, in-app notifications, basic search, reporting/moderation, platform administration and founding invitations.

Excluded: video/stories/reels, group messages, voice/calls, live rooms/broadcasting, journals/discipleship, games, advertising, payments/donations/subscriptions/tickets, native-app persistence and advanced ML recommendations. No speculative tables for excluded domains.

## 2. Global contracts

- Application tables live in public; unexposed private schema contains narrow helpers. Auth and Storage are provider-managed; use supported APIs, not manual metadata rewrites.
- Entity PKs are uuid default gen_random_uuid(), except identity/composite PKs. User references target profiles.id unless explicitly referencing auth.users.id. Provider-managed references use primary keys only.
- Dictionary notation: `?` means nullable; all other fields are NOT NULL. `created_at` means timestamptz default database transaction time. `updated_at` means the same plus database-maintained modification time. Other defaults are stated; no unstated defaults exist. All timestamps are UTC.
- Statuses/roles use text with named CHECK constraints and exhaustive allowed sets. Required text rejects whitespace; optional blank strings become NULL. IDs, ownership, status, chronology and privileged evidence are protected from direct client edits.
- Row-local constraints use PK/FK/UNIQUE/CHECK. Cross-row conditions require locks/transactions and the triggers specified below. Never use a CHECK that queries other rows.
- PK updates are prohibited; FK update action is NO ACTION. Every FK needs a leading-column index unless already covered by PK/UNIQUE. Delete actions are explicit.
- RLS enabled on all 26 tables; default deny anon. Ordinary clients have **no direct table INSERT/UPDATE/DELETE grants**. Narrow authenticated operations perform all mutations. SELECT grants/projections follow section 7.
- Trusted operation means verified session caller, live eligibility and exact scope validation. A generic service-role write accepting a body-supplied actor is prohibited.

### 2.1 Concrete validation baseline

These defaults match PRD 2.1 and are accepted with the baseline at G00: body 5,000 characters; comment 2,000; message 5,000; at most four images/post; file at most 10 MiB and 20 megapixels. JPEG/PNG/WebP still images only; no SVG/animation/video. Dimensions positive. Username: 3–30 ASCII letters/digits/underscore, unique case-insensitively. Slug: lowercase ASCII letters/digits with internal hyphens, 3–80 characters (interest at most 60). Reserved names use a version-controlled server list. HTTPS URLs at most 2,048 characters; never automatically fetch them. Enforce at database and trusted-operation boundaries.

## 3. Identity and authorisation

Supabase owns passwords, sessions, verified email/phone, provider identities and OTPs. Never duplicate them in public tables. One Auth UUID maps to exactly one profile/settings pair, atomically provisioned through a minimal tested hook. Retrying cannot duplicate/reset existing rows. Reconciliation detects incomplete provisioning; participation fails closed.

Completion requires valid username/display name, accepted terms timestamp/version and privacy notice version. Only validated completion sets onboarding timestamp. Authentication alone is insufficient.

### 3.1 Account linking

Only supported verified Supabase flows may link providers. Explicit linking requires authenticated account/provider proof. Test and document configured verified automatic-linking behaviour. Never merge by client-asserted matching email/phone/name. A callback resolving to another existing UUID is a collision, not permission to transfer data. Cross-UUID data merging is outside MVP. Unlink requires recent reauthentication and another usable verified sign-in/recovery method. Audit outcome without tokens. Auth and SQL calls are not one ACID transaction; reconcile application identity by canonical UUID after callbacks.

### 3.2 Shared predicates

| Predicate | Meaning |
|---|---|
| session_user | Trusted Supabase identity, never request-body identity |
| eligible(u) | Profile/settings exist, account active, onboarding complete |
| blocked(a,b) | Block row in either direction; false for same user |
| friends(a,b) | Accepted canonical pair; both eligible and unblocked |
| org_admin(u,o) | Eligible owner/admin in active organisation |
| member(u,c) | Eligible active member in active community |
| community_staff(u,c) | Active local owner/admin/moderator |
| platform_staff(u) | Eligible account with explicit current platform role |

Check live database state even with unexpired tokens. Mutable JWT user metadata never grants roles. Suspension disables powers but does not silently remove ownership; recovery is explicit.

### 3.3 Scoped role matrix

| Role | Authority | Exclusions |
|---|---|---|
| Platform owner | Bootstrap/transfer owner; assign admins/moderators; administrative operations | No routine inbox browsing |
| Platform admin | Verification, taxonomy, invitations, entity suspension, audited owner recovery | Cannot grant owner or alter equal/higher privileged accounts |
| Platform moderator | Reports, content moderation, ordinary-account suspension | No verification approval/platform grants |
| Organisation owner | Page edit/archive, admin grants and owner transfer | Only own organisation; no implicit community/platform power |
| Organisation admin | Page edit, organisation publishing, verification submission | No owner transfer/role grants |
| Community owner | Settings, membership, local staff and owner transfer | Only own community |
| Community admin | Settings, ordinary membership decisions, local moderation | No owner/admin grants or owner demotion |
| Community moderator | Local content moderation | No membership/role grants/private inbox |

Ordinary local role is member. Each active organisation/community has exactly one owner; platform has exactly one owner after bootstrap. Verification, following, friendship, local membership and administrative roles imply none of one another. Staff access is task/case-specific, never blanket private SELECT.

## 4. Complete 26-table dictionary

### 4.1 profiles

Columns: id uuid PK/FK → auth.users.id CASCADE; username varchar(30)?; display_name varchar(80)?; bio varchar(500)?; avatar_path text?; location_label varchar(100)?; onboarding_completed_at timestamptz?; created_at; updated_at.

Unique partial expression index lower(username) where not NULL. Completed onboarding requires valid username and nonblank display_name. Avatar is validated owned asset path, not arbitrary URL. No email/phone/exact location. Own incomplete row readable for onboarding. Search indexes cover public username/display name. Own editable fields exclude ID/onboarding/chronology.

### 4.2 account_settings

Columns: user_id uuid PK/FK → auth.users.id CASCADE; account_status text default active (active|suspended|pending_deletion); message_permission text default friends_only (friends_only|nobody); allow_friend_requests boolean default true; notification_preferences jsonb default {"version":1,"social":true,"community":true,"messages":true}; terms_accepted_at timestamptz?; terms_version varchar(30)?; privacy_notice_version varchar(30)?; deletion_requested_at timestamptz?; created_at; updated_at.

Preferences have exactly the four keys with integer/boolean types. Terms timestamp/version both present or absent. pending_deletion iff deletion timestamp present. Self-only raw SELECT. Staff get minimal operational projections. Preference edits cannot alter status/terms/deletion.

### 4.3 interests

Columns: id uuid PK; slug varchar(60) UNIQUE; name varchar(80); description varchar(300)?; is_active boolean default true; display_order integer default 0 CHECK >=0; created_at.

Platform-admin curated taxonomy. Eligible users read active and own selected inactive entries. Deactivate referenced interests. Index (is_active,display_order,id).

### 4.4 profile_interests

Columns: user_id uuid → profiles CASCADE; interest_id uuid → interests RESTRICT; created_at. PK pair; reverse index (interest_id,user_id). Self-only. New selection requires active interest; max 20 under profile lock. Feed may use private selections without exposing them.

### 4.5 user_follows

Columns: follower_id uuid, following_id uuid → profiles CASCADE; created_at. PK pair; CHECK distinct. Reverse index (following_id,created_at DESC,follower_id); outbound (follower_id,created_at DESC,following_id). Both eligible/unblocked at creation. Follower derives from session; unfollow idempotent; no update. Reads require both readable endpoints. Follow grants no friendship/private membership.

### 4.6 friendships

Columns: id uuid PK; user_low_id uuid, user_high_id uuid, requested_by uuid → profiles CASCADE; status text (pending|accepted|declined); created_at; responded_at timestamptz?; updated_at.

UNIQUE pair; PostgreSQL UUID ordering defines low < high. Requester is one of pair. Pending iff responded_at NULL. Index each endpoint/status/updated_at DESC/id and requested_by/status. Participant-only reads. No reverse row or arbitrary status patch. Section 8 defines transitions.

### 4.7 user_blocks

Columns: blocker_id uuid, blocked_id uuid → profiles CASCADE; created_at. PK pair, distinct IDs; reverse index (blocked_id,blocker_id). Blocker-only list; private predicate can test both directions without revealing rows.

Block atomically removes both follows and friendship, prevents new requests/follows/messages, hides personal discovery/content both ways. Existing conversation history remains participant-readable. Unblock restores nothing. Organisation content is not hidden merely because a human admin is blocked; personal community contributions obey author blocks. Blocks do not revoke memberships or scoped moderation powers.

### 4.8 organisations

Columns: id uuid PK; slug varchar(80); name varchar(150); description varchar(2000)?; avatar_path text?; banner_path text?; website_url text?; created_by uuid? → profiles SET NULL; verification_status text default unverified (unverified|pending|verified|rejected); verified_at timestamptz?; status text default active (active|suspended|archived); created_at; updated_at.

Unique lower(slug); verified_at present iff verified. Creator required at creation, historical thereafter. **SET NULL replaces the former creator RESTRICT FK**; control lives in scoped roles. Verification/status privileged. Index status/created_at/id and name/slug search.

### 4.9 organisation_roles

Columns: organisation_id uuid → organisations CASCADE; user_id uuid → profiles CASCADE; role text (owner|admin); assigned_by uuid? → profiles SET NULL; created_at. PK pair; reverse (user_id,organisation_id).

Partial UNIQUE organisation_id where owner. Deferred constraint triggers on parent/role/profile-delete paths require exactly one owner for every active organisation at commit. Suspended/archived may have none. Transfer locks parent, demotes old before promoting new (immediate uniqueness), then deferred existence validation. No duplicate owner_id field.

### 4.10 verification_requests

Columns: id uuid PK; organisation_id uuid → organisations CASCADE; submitted_by uuid? → profiles SET NULL; status text default pending (pending|approved|rejected|withdrawn); statement varchar(2000); evidence_paths jsonb default []; reviewed_by uuid? → profiles SET NULL; reviewed_at timestamptz?; review_note varchar(2000)?; created_at; updated_at.

Evidence array contains 0–5 distinct validated private paths. Reviewed_at required for approved/rejected, NULL otherwise. Reviewer required on decision; NULL after erasure only. Partial UNIQUE organisation_id where pending. Index status/created_at/id and org history. Org admin submits; platform admin/owner reviews. Request/org state changes atomically. Verified org cannot resubmit ordinarily. Resubmission is new history; withdrawal returns org to unverified. Review notes staff-only projection; revocation separate audited action.

### 4.11 communities

Columns: id uuid PK; slug varchar(80); name varchar(150); description varchar(2000)?; kind text (church|interest); organisation_id uuid? → organisations RESTRICT; privacy text default public (public|private); status text default active (active|suspended|archived); created_by uuid? → profiles SET NULL; avatar_path text?; banner_path text?; created_at; updated_at.

Unique lower(slug); church iff organisation present, interest iff absent. Partial UNIQUE organisation_id: one church community/org in this baseline. Church creation requires verified active org and current org admin; creator explicitly becomes local owner. Org role alone grants no local membership. Verification revocation removes badge; org suspension hides linked content. Hard deletion resolves church/post references, never NULLs church context. Private discovery exposes only id/slug/name/description/kind/privacy/avatar. Index status/privacy/created_at/id and org FK.

### 4.12 community_memberships

Columns: community_id uuid → communities CASCADE; user_id uuid → profiles CASCADE; role text default member (owner|admin|moderator|member); status text (pending|active|banned); requested_at timestamptz default now; joined_at timestamptz?; updated_at.

PK pair; partial UNIQUE community_id where owner; deferred exact-one owner trigger for active community. Non-active rows have member role. Active requires joined_at, pending requires NULL; banned may retain old joined_at. Index user_id/status/community_id and community_id/status/requested_at/user_id. Public join active, private pending; banned cannot self-rejoin. Own state readable, active members see directory, owner/admin sees pending queue. Public counts are aggregates, not roster leaks.

### 4.13 posts

Columns: id uuid PK; author_id uuid? → profiles SET NULL; organisation_id uuid? → organisations RESTRICT; community_id uuid? → communities CASCADE; body varchar(5000)?; visibility text (public|friends|community); status text default draft (draft|published|removed|deleted); published_at timestamptz?; deleted_at timestamptz?; created_at; updated_at.

Author required on insert from session. Organisation post: org present, community absent, public, current org admin actor. Community post: community present, org absent, community visibility, active member actor. Personal: both contexts absent, public/friends. No cross-posting/impersonation. NULL author only for retained org attribution after erasure; personal/community content purged.

Published requires published_at and no deleted_at. Deleted iff deleted_at present; drafts have no published_at. Removed may retain prior publication. First publication fixes chronology; edits do not bump it. Context/author immutable after publication; personal visibility change requires validation. Deleted cannot republish; moderated restoration revalidates parents.

**At commit a published post has nonblank body OR >=1 ready image, and at most four ready images.** Enforce deferred constraint triggers on BOTH posts/post_media with parent row lock for every mutation. Draft may be empty. Last image removal from textless publication must replace/add text/unpublish/delete in same transaction or rollback. Never a body-only CHECK.

Partial published indexes: author/published_at DESC/id DESC; organisation equivalent; community equivalent; global published/public time/id; GIN body search. Indexes never imply access.

### 4.14 post_media

Columns: id uuid PK; post_id uuid → posts CASCADE; uploaded_by uuid? → profiles SET NULL; bucket_id text fixed post-images; object_path text UNIQUE; mime_type text; byte_size bigint; width integer; height integer; position smallint CHECK 0–3; status text default pending (pending|ready); created_at.

UNIQUE post_id/position. Pending stores expected facts; finalisation replaces with inspected facts. Limits section 2.1. Immutable key posts/{post_id}/{media_id}.{approved_extension}. No remote URL attachment. Parent lock/deferred post invariant. Organisation assets must survive human deletion under application-controlled Storage ownership, section 9.

### 4.15 post_likes

Columns: post_id uuid → posts CASCADE; user_id uuid → profiles CASCADE; created_at. PK pair; reverse user_id/created_at DESC/post_id. Create requires readable/interactable parent; own unlike idempotent even after losing access. Actor lists require readable parent/actor; no client counters.

### 4.16 post_comments

Columns: id uuid PK; post_id uuid → posts CASCADE; author_id uuid? → profiles SET NULL; body varchar(2000) nonblank; status text default visible (visible|removed|deleted); created_at; updated_at.

Flat only. Author required at insertion; own visible text edit/delete. Post author/current org admin can remove comments on own personal/org post; local staff moderate own community; platform moderation audited. Never rewrite others' bodies. Deleted body becomes tombstone/purged; removed text not ordinarily returned. Read requires readable parent, visible status, unblocked author. Index post_id/created_at/id and author_id/created_at/id. Removed-review projections separately scoped.

### 4.17 post_saves

Columns: user_id uuid → profiles CASCADE; post_id uuid → posts CASCADE; created_at. PK pair; indexes post_id/user_id and user_id/created_at DESC/post_id. Strictly private; save requires read, listing rechecks parent. Lost access hides save without preserving snapshot. Own unsave always allowed.

### 4.18 conversations

Columns: id uuid PK; user_low_id uuid?, user_high_id uuid? → profiles SET NULL; low_read_at timestamptz?; high_read_at timestamptz?; created_at; updated_at.

Both initially required, low < high, UNIQUE pair. At least one remains; delete conversation before both become NULL. Slots immutable except erasure and never reused. Index each participant/updated_at DESC/id. Own slot read cursor advances monotonically to database-observed cutoff no later than operation time. Surviving participant reads history. Sending requires both eligible, accepted friends, no block, recipient friends_only. Existing conversation alone never permits send. No group mode.

### 4.19 messages

Columns: id uuid PK; conversation_id uuid → conversations CASCADE; sender_id uuid? → profiles SET NULL; body varchar(5000) nonblank; client_request_id uuid; created_at.

UNIQUE conversation_id/client_request_id. Sender actual current participant at insertion, checked under conversation lock/trigger; NULL on erasure only. Immutable for participants, no unsend/edit/attachments. The sole content-update exception is an audited platform moderation operation replacing reported harmful body with a fixed nonblank tombstone; no ordinary client or scoped community role can perform it. Report evidence preserves only necessary original text under case retention. Restore, when permitted before evidence purge, uses that evidence through the same audited operation; after purge restoration is unavailable. Index conversation_id/created_at DESC/id DESC and sender. Deleted attribution displays neutral deleted-account label. Staff see only reported-message case evidence, never whole inbox.

### 4.20 notifications

Columns: id uuid PK; recipient_id uuid → profiles CASCADE; actor_id uuid? → profiles SET NULL; event_type text (follow|organisation_post|friend_request|friend_accepted|post_like|post_comment|membership_decision|message|moderation); target_type text (profile|organisation|friendship|post|comment|community|conversation|report); target_id uuid?; dedupe_key varchar(200); read_at timestamptz?; created_at.

UNIQUE recipient/dedupe_key. Target required initially; NULL only cleanup. Server-generated, own read/read-flag only. No generic private body payload. Optional events respect preferences; essential safety notices remain. Index recipient/created_at DESC/id DESC, unread partial recipient, actor, target pair. Revalidate visibility for counts/deep links. Section 5 enforces targets.

### 4.21 content_reports

Columns: id uuid PK; reporter_id uuid? → profiles SET NULL; target_type text (profile|organisation|community|post|comment|message); target_id uuid?; reason text (spam|harassment|hate|sexual_content|violence|impersonation|other); details varchar(2000)?; status text default open (open|in_review|resolved|dismissed); assigned_to uuid? → profiles SET NULL; resolution_note varchar(2000)?; resolved_at timestamptz?; evidence_snapshot jsonb; created_at; updated_at.

Reporter must access target; message requires participation. Server-built versioned evidence max 32 KiB excluding media bytes: reported content, capture time, author/context IDs, necessary private evidence paths. No inbox/community dump. Terminal iff resolved_at present. Partial UNIQUE reporter/type/target while open/in_review and non-null. Index status/created_at/id, reporter, assignee, target pair. No raw SELECT; reporter status projection only, staff case-scoped evidence. Target purge NULLs pointer after evidence handling.

### 4.22 moderation_actions

Columns: id uuid PK; report_id uuid? → content_reports SET NULL; actor_id uuid? → profiles SET NULL; action_type text (remove_content|restore_content|suspend_account|restore_account|suspend_entity|restore_entity|dismiss_report|revoke_verification); target_type text same set as reports; target_id uuid?; reason varchar(2000); created_at.

Append-only. Content actions target post/comment/message; account actions profile; entity actions org/community; revocation org. Dismiss may use preserved report evidence after target purge. Actor required at creation; NULL on erasure. Cleanup NULLs target. Index report, actor, target pair/time. Affected-user summaries exclude internal notes.

### 4.23 platform_roles

Columns: user_id uuid PK → profiles CASCADE; role text (owner|admin|moderator); assigned_by uuid? → profiles SET NULL; created_at; updated_at.

One role/user; owner supersedes others. Partial UNIQUE role where owner plus deferred exact-one owner after bootstrap. Non-API bootstrap provisions initial owner, never first signup. Transfer requires recent reauth, stable platform-owner advisory lock, both account locks, demote then promote, atomic audit. Self read/owner management projection; index assigned_by. No JWT user-metadata role.

### 4.24 audit_logs

Columns: id uuid PK; actor_id uuid? → profiles SET NULL; action varchar(100); resource_type varchar(60); resource_id uuid?; correlation_id uuid; metadata jsonb default {}; created_at.

Trusted append-only; restricted investigation projection. Versioned allowlisted metadata max 16 KiB, no credentials/OTP/tokens/phone/email/auth dumps/message bodies/documents. Resource ID is historical attribution, deliberately not live FK. Audit grants/transfers/verification/moderation/invites/linking/deletion stages. Index time/id, actor, resource pair, correlation. Retention maintenance separate from staff editing.

### 4.25 invitations

Columns: id uuid PK; token_hash text UNIQUE; created_by uuid? → profiles SET NULL; organisation_id uuid? → organisations CASCADE; community_id uuid? → communities CASCADE; status text default pending (pending|accepted|revoked|expired); expires_at timestamptz; accepted_by uuid? → profiles SET NULL; accepted_at timestamptz?; created_at.

Token >=256 random bits; store SHA-256 digest only (64 lowercase hex). Deliver once, redact logs. Scope org OR community OR neither. Expiry > creation. Accepted iff accepted_at; acceptor NULL after erasure only. Single row-locked redemption. Unscoped supports founding onboarding; community invite grants member when issuer current local owner/admin; org invite grants admin only when issuer org owner. Recheck issuer at redemption; never owner/platform grants. Eligible verified redeemer required before grant. Hash never client SELECT. Rate-limit generic token failures. Index status/expiry and all FKs.

### 4.26 organisation_follows — integrated mandatory amendment

Columns: follower_id uuid → profiles CASCADE; organisation_id uuid → organisations CASCADE; created_at. PK pair; reverse organisation_id/created_at DESC/follower_id; outbound follower_id/created_at DESC/organisation_id.

Eligible session follower, active organisation; verification independent. Idempotent unfollow, no update. Read requires readable organisation/follower. Follow grants no role/private membership/friendship; roles/membership never auto-follow. Following selects organisation-authored posts by organisation_id, not admins' personal posts. Suspension/archive hides content despite retained edge. Never overload user_follows or add another follower table.

## 5. Cross-table integrity

### 5.1 Closed polymorphic registry

Mapping: profile→profiles; organisation→organisations; community→communities; friendship→friendships; post→posts; comment→post_comments; conversation→conversations; report→content_reports; message→messages. Each reference uses only its dictionary subset.

Notification pairings: follow/profile; organisation_post/post; friendship events/friendship; like/post; comment/comment; membership/community; message/conversation; moderation/report,post,profile,organisation,community. Validate recipient/actor/context, not only existence. No arbitrary deep links.

Private validation locks target against deletion, verifies type/existence/caller scope. Every target table has deletion cleanup triggers synchronously NULLing notifications/reports/actions before target deletion. Referring inserts and deletes use compatible lock order; test races. Null links are never guessed back. Renderers recheck current access; notification possession grants nothing. Reports retain bounded private evidence, not dangling IDs. Audit references are historical exceptions and never access capabilities.

### 5.2 Enforcement register

| Invariant | Mechanism |
|---|---|
| Account pair/onboarding | Atomic provisioning, uniqueness, locked completion, protected timestamp, reconciliation |
| Block versus follows/friendship/send | Stable canonical pair advisory lock on every related transition; defensive validation |
| One active owner | Partial UNIQUE, parent/advisory lock, deferred checks on parent/role/profile deletion |
| Church context | Local CHECK/FK plus live org checks on creation/read |
| Publishing authority | Session actor, live role/member/account locks, immutable context, trigger validation |
| Text or ready images | Parent lock; deferred checks from both post/media mutations |
| Sender participant | Conversation lock/insert trigger, immutable pair |
| Verification consistency | Org lock, pending uniqueness, atomic request/org update |
| Polymorphic integrity | Locked closed registry and target cleanup triggers |
| Erasure ownership | Transfer/archive preflight plus constraint checks during cascades |

Never substitute unlocked read-then-write for concurrency control. Maintenance bypassing RLS must still preserve constraints and invariants.

## 6. Privacy, feeds and search

Ordinary post read requires published, not removed/deleted, active contexts and active personal/community author. Personal public requires no author/viewer block. Personal friends additionally requires own author or accepted friendship. Organisation post requires active org; erased human attribution allowed. Community requires active community/linked org, no personal author block, and active membership if private. Public community is readable to eligible users. Draft requires own active author/current scope; org admins may review org drafts. Removed review is separately scoped. Personal NULL-author posts are purged, not republished anonymously.

Anon has no table SELECT. A narrow server public share route may return currently public published personal/org/public-community post, minimal identity and authorised media only. No private/friends content, roster, relationship lists or settings. Logged-out public viewing has no block identity; blocking limits authenticated interactions, not secrecy of public content. This boundary matches PRD-03/05/15 version 2.1.

| Feed | Candidates | Order |
|---|---|---|
| For You | Readable public personal/org and readable community content; bounded interest/social heuristic | Deterministic score/time/id |
| Following | Personal author in user_follows OR org in organisation_follows | published_at DESC,id DESC |
| Friends | Accepted friends' personal public/friends posts | published_at DESC,id DESC |

All candidates filtered before ranking/counts/return. No implicit follows from friendship; no feed table. Chronological cursor time/id; For You fixed request snapshot and versioned score tuple. Max page 50. No inaccessible IDs/scores/counts.

Search public identity fields, readable post bodies, discoverable community metadata and org name/slug. Filter before excerpts/counts; never index messages/settings/evidence/internal cases/blocks/invites publicly. Database-local GIN/name indexes; no extra search service. Saves, notifications, old URLs and caches never override current access.

## 7. RLS, grants and projections

All mutations operation-only. Matrix lists ordinary SELECT, not broad UPDATE permission.

| Table | Read scope | Mutation authority |
|---|---|---|
| profiles | Own/readable eligible unblocked identity | Own edit/provision/erasure |
| account_settings | Own | Preferences; dedicated status/terms/delete |
| interests | Active/own selected inactive | Platform admin |
| profile_interests | Own | Own selections |
| user_follows | Both readable endpoints | Follower/block cleanup |
| friendships | Participants | Request/respond/remove |
| user_blocks | Blocker | Own block/unblock |
| organisations | Active public/scoped operational | Scoped edit/platform status |
| organisation_roles | Self/scoped directory | Owner/recovery |
| verification_requests | No raw SELECT; org state/evidence projection | Org submit/platform review |
| communities | Discovery-safe columns; member details projection | Scoped create/edit/status |
| community_memberships | Self/active directory/admin queue | Join/decision/role |
| posts | Section 6, authorised drafts | Publish/edit/delete/moderate |
| post_media | Readable parent/authorised pending draft | Reserve/finalise/remove |
| post_likes | Readable parent/actor | Own like/unlike |
| post_comments | Readable parent/visible/unblocked | Own edit/delete/scoped remove |
| post_saves | Own/readable parent | Own save/unsave |
| conversations | Actual surviving participant | Open/send/own read cursor |
| messages | Actual participant | Send/lifecycle purge |
| notifications | Own/revalidated targets | Server generation/own read flag |
| content_reports | No raw SELECT; own status/case projection | Submit/case review |
| moderation_actions | No raw SELECT; safe case/affected-user projection | Authorised scoped moderation |
| platform_roles | Self/owner management projection | Bootstrap/owner |
| audit_logs | No raw SELECT | Trusted append/restricted retention |
| invitations | No raw SELECT; safe management projection | Issue/revoke/redeem |
| organisation_follows | Readable endpoints | Follower/lifecycle |

RLS cannot redact allowed-row columns. Sensitive raw tables above have SELECT revoked and explicit allowlisted projections; never generic row JSON. Communities direct column grants expose discovery fields only; other details use scoped operation. Staff projections check role/case/scope. Suspended users retain own status, report state and existing conversation history read-only; no social writes, but deletion/data controls allowed. Pending-deletion sessions only deletion status/export workflow, not messages/social access.

Private predicates avoid recursive RLS chains. Necessary SECURITY DEFINER helpers use narrowly privileged owner, empty fixed search_path, fully qualified objects, no arbitrary dynamic SQL, explicit validation and revoked PUBLIC/anon EXECUTE. Grant exact authenticated RPC signatures. Definer projections enforce full access independently. Prefer invoker reads; views need supported invoker semantics or no direct access. Audit default EXECUTE grants. No blanket admin private-data clauses. Service secrets server-only, not ordinary user write path.

Realtime optional: authorised private channels, minimal events, no private bodies on public broadcasts. Revalidate fetch/send and channel revocation after status/membership changes. No unrestricted sensitive replication feed.

## 8. Transactions and state transitions

Authenticate/validate, lock consistently, recheck live state, commit database effects/audit/events together. Never hold SQL transaction during network/provider/upload. Lock order: account UUIDs ascending; canonical-pair advisory lock; entity type/id; content parent; dependent event/case. Bounded deadlock retries require idempotency.

| Operation | Preconditions/transition | Atomic outcome/retry |
|---|---|---|
| Onboard/preferences | Own valid fields/terms or allowlisted keys | Completion once; no status/role escalation |
| Follow/unfollow | Eligible active target/unblocked pair | Unique insert/delete missing no-op |
| Friend request | Distinct eligible pair, recipient allows | Missing→pending; existing pending/accepted returned, reciprocal never auto-accepts |
| Accept/decline | Pending recipient only | Set decision/time; same retry safe, opposing stale decision rejected |
| Re-request | Declined, permitted/rate-limited | Reuse canonical row/new requester/time/pending |
| Cancel/remove | Pending sender/either accepted friend | Delete row; no implied follow change |
| Block/unblock | Self blocker/pair lock | Remove both follows/friendship; unblock restores nothing |
| Entity create | Eligible/verified org authority for church | Parent plus initial owner one commit |
| Owner transfer | Owner or audited recovery/eligible consenting replacement | Parent lock/demote then promote/exact-one check |
| Join/decide | Active/nonbanned; admin for pending decision | Public active/private pending; approve active or remove declined request |
| Leave/remove/ban | Scoped; owner resolves ownership first | Delete or banned/member, never last-owner loss |
| Verification | Org submits/platform reviews pending | Request/org matching state plus audit |
| Publish/edit/media | Current authority/inspected assets | Parent lock/deferred content check/immutable publication time |
| Like/comment/save | Readable/interactable parent | Pair UNIQUE; caller UUID comment retry |
| Open/send | Eligible unblocked friends/recipient permits | Unique pair/message request key/time/event one commit |
| Read cursor | Participant own slot | Monotonic database cutoff |
| Report | Accessible target/participant if message | Target lock/bounded snapshot/one open report |
| Moderate | Exact role/scope/compatible action | Status/action/audit/case/notice; restore revalidates parents |
| Redeem invite | Pending/not expired/current issuer authority | Row lock/bounded grant/accepted; same redeemer retry safe, another denied |
| Delete account | Recent self reauth/authorised case | Section 10 staged workflow |

Friend-request dedupe includes relationship ID plus request occurrence; like/follow recreate cycles rate-limited. Caller UUIDs and uniqueness provide retry keys without generic job/idempotency tables. Correlation IDs group stages, not access tokens. No global exactly-once external-delivery claim.

## 9. Storage and external consistency

All buckets private: profile-assets, organisation-assets, community-assets, post-images, verification-evidence, moderation-evidence. Public bucket URLs cannot enforce later privacy revocation.

| Bucket | Path/access |
|---|---|
| profile-assets | profiles/{user_id}/{asset_uuid}.{ext}; own upload/profile read |
| organisation-assets | organisations/{id}/{asset_uuid}.{ext}; org admin/org read |
| community-assets | communities/{id}/{asset_uuid}.{ext}; local owner/admin/discovery-safe image |
| post-images | posts/{post_id}/{media_id}.{ext}; registered draft/parent predicate |
| verification-evidence | organisations/{id}/requests/{request_id}/{asset_uuid}.{ext}; applicant/reviewer scope |
| moderation-evidence | reports/{report_id}/{asset_uuid}.{ext}; trusted capture/case staff |

Reserve authorised path before upload. No arbitrary key/upsert. Inspect signature, decode/re-encode still image, strip EXIF/location, enforce limits. Verification evidence same formats; no PDF in baseline. Reserve draft/pending→short upload grant→private upload→inspection→verified object→atomic ready/publish. Failure stays nonpublic. Pending cleanup after 24h under parent lock; inactive draft after seven days.

Protected media uses current-authorisation streaming route, private/no-store responses. No long-lived signed URL in post data. Operational temporary signed URLs max 60 seconds after access check, documented residual validity. Privacy/status changes invalidate pages/images/CDN/previews; downloaded bytes cannot be recalled. Share routes revalidate public visibility.

SQL/files are not atomic: hide/mark lifecycle, delete through Storage API, purge metadata, retry idempotently; missing object succeeds. Never delete storage.objects directly or assume SQL cascade removes bytes. Reconcile orphan objects without deleting recent legitimate uploads.

**Storage owner/Auth deletion conflict:** enumerate all objects owned by user UUID. Delete personal objects. Retained org/community/evidence assets are copied with supported server-controlled upload into verified application-owned objects; then atomically switch references and delete old objects. Never rewrite Storage ownership metadata manually. Confirm zero user-owned objects before Auth deletion. Failure leaves deletion pending/retryable.

## 10. Deletion and retention

Creator attribution uses SET NULL, actual ownership preserved separately. Never disable FK checks, leave active entities ownerless or NULL church parent to force erasure. RESTRICT remains for referenced interests and organisation contexts.

### 10.1 Account erasure stages

1. Recent reauthentication; lock account/resources. Platform owner transfers first. Commit pending_deletion/time and start audit/correlation before external destruction.
2. Deny social use via live status despite old JWT; revoke sessions through supported Auth API. Worker uses separate scoped operational authority.
3. Transfer each active owned org/community to eligible consenting replacement or explicitly archive. If neither succeeds remain pending with surfaced blocker; no silent successor or claimed completion. Resolve roles before erasure.
4. Purge personal/community posts/comments, personal assets, likes/saves/interests/follows/friendships/blocks. Retain org posts with NULL human attribution; null historical actor/creator references. Remove own notifications; clean purged target links. Retain only justified bounded case evidence.
5. Keep surviving participant history with NULL erased participant/sender. No sends to empty slot; delete conversation before both participants would become NULL.
6. Delete/migrate Storage objects and verify none owned. Delete Auth identity through admin API. Cascades remove profile/settings and designated joins; owner checks still pass. Failure stays pending, never reactivate partially erased identity.
7. Verify references/bytes, append minimised completion and reconcile stages. Local FK effects are atomic with Auth deletion; entire API/Storage workflow is not.

Progress uses restricted audit stage/correlation plus actual state. Worker scans pending accounts and incomplete start/completion pairs; crash after Auth deletion reconciles missing identity against audit. No extra jobs table or contact credentials in progress metadata.

### 10.2 FK summary

| Reference class | Delete |
|---|---|
| profiles/settings→Auth | CASCADE |
| Personal joins/memberships/roles→profile | CASCADE subject to owner checks |
| Historical creator/actor/assigner/reviewer/sender | SET NULL |
| Post/comment author/media uploader | SET NULL defensively; proactive personal purge |
| Conversation participant | SET NULL after no-survivor cleanup |
| Community/post→organisation; selection→interest | RESTRICT |
| Org roles/follows/verification→org | CASCADE |
| Membership/posts→community | CASCADE |
| Media/likes/comments/saves→post | CASCADE |
| Messages→conversation; notification→recipient | CASCADE |
| Scoped invitation→org/community | CASCADE |
| Action→report | SET NULL |
| Live polymorphic link | Explicit trigger NULL cleanup |
| Audit resource | Historical minimised ID, not FK |

Container hard deletion first resolves visibility/evidence/files. Cascades never replace Storage cleanup.

### 10.3 Proposed retention defaults for approval

| Data | Retention |
|---|---|
| Pending upload/stale draft | 24h/seven inactive days |
| Notifications | 90 days |
| Terminal/expired invitation hashes | 30 days |
| Verification evidence | 30 days after decision; minimal decision history 365 days |
| Case evidence | Open while necessary; closed up to 180 days then purge/minimise |
| Audit metadata | 365 days then restricted minimisation/purge |
| Deleted ordinary content | Hidden immediately; bytes within 30 days except justified separate evidence |
| Message after one erasure | Surviving history; purge when both erased or formally revised policy |
| Backups | Managed window documented before launch; replay deletion ledger before restored service |

These operational values match PRD-15 version 2.1 and are not legal conclusions. Owner must approve backup/provider-log/hold policy before production. Holds scoped/time-bounded/restricted, never public reactivation. No instantaneous backup-erasure promise.

### 10.4 Export and reconstructed product decisions

PRD-15 export is an on-demand reauthenticated read workflow, not a 27th table. Produce only own public/private settings and authorised shared conversation data, excluding secrets, unrelated internal case notes and other users' private settings. Validate current access at capture and delivery. Use bounded server processing, protected temporary download and deletion after delivery/expiry; do not place exports in public buckets. Use a temporary protected object in profile-assets under profiles/{user_id}/exports/{export_uuid}, with download expiry at most 15 minutes and cleanup within 24 hours. Do not apply image decoding rules to server-generated export objects; clients cannot upload to this subpath. Track minimised outcome/correlation in audit, never export contents. Old export access does not survive pending deletion/status revocation.

Open registration and optional invitations match PRD-14; no founding-token gate is inferred. Proposed 18+ pilot self-attestation is part of versioned terms acceptance, with no birthdate or extra application table. Owner approves eligibility and policy texts before pilot. Community privacy may change through owner/admin operation with revocation/invalidation; community kind/organisation association remains immutable. Account export, moderation tombstones and privacy changes require explicit operation validation and acceptance tests in the relevant plan tasks.

## 11. Migration order and operational gates

| Group | Deliverable |
|---|---|
| M01 | Version/extensions/private schema/default privileges |
| M02 | Identity pair/provisioning/eligibility |
| M03 | Interests/onboarding/terms |
| M04 | Blocks/follows/friends/pair locks |
| M05 | Platform roles/audit/bootstrap |
| M06 | Organisations/roles/verification |
| M07 | Communities/membership/owner constraints |
| M08 | Posts/media/publishing/storage/access |
| M09 | Engagement/scoped moderation primitives |
| M10 | organisation_follows and feeds, mandatory before Following |
| M11 | Conversations/messages |
| M12 | Notifications/reports/actions/invitations/full target cleanup |
| M13 | Deletion/retention/jobs/grants/search/query verification |

Table creation and deny-default RLS/grants occur together before exposure. No temporary permissive helpers. Resolve cycles by inaccessible tables first, then final functions/triggers before feature exposure. Human phase gates remain.

Existing deployments use expand/validate/contract: inventory; detect duplicate pairs/invalid targets/empty posts/ownerless entities/orphans; reviewed repairs/backfill; validate constraints; switch consumers; remove superseded structures last. Never edit deployed migrations or silently discard conflicts. Destructive production changes require explicit approval, verified backup and recovery plan. Rollback losing new data is not safe; use tested restore/forward repair.

FK indexes are not automatically created. Verify dictionary/FK coverage without duplicate PK-prefix indexes. Parameterised bounded queries, selected columns/cursors, current-permission counts. No unapproved cached counters/feed tables. Inspect representative plans under ordinary RLS credentials for feeds, relationship directions, memberships/roles, inbox, notifications and search; service-role plans alone insufficient. Avoid N+1 remote calls.

## 12. Acceptance tests required during implementation

These are required future evidence, not tests claimed executed for this document.

| ID | Required proof |
|---|---|
| DB-01 | Exactly 26 application tables and intended constraints/RLS/grants |
| DB-02 | Real anon/incomplete/active/suspended/deleting/scoped/platform actors match matrix |
| DB-03 | Forged actor/role/status/ownership/terms/timestamps rejected via API/RPC |
| DB-04 | Concurrent reverse requests one pair; recipient decisions/retries correct |
| DB-05 | Block/follow/request/send races cannot commit prohibited interaction |
| DB-06 | Following both sources, no private leak/admin personal expansion |
| DB-07 | Pending/banned private membership denied, scopes isolated |
| DB-08 | Concurrent transfer/removal/erasure preserves exact-one active owner |
| DB-09 | Text/image/mixed publish succeeds; empty/last-image failure; upload failure private |
| DB-10 | Visibility/status revokes detail/media/search/feed/save/notification/caches |
| DB-11 | Forged targets fail; target-delete race safe NULL/evidence |
| DB-12 | Nonparticipants/staff cannot browse inbox; report review bounded |
| DB-13 | Send/open retries, cursor ownership, erased history/nonreusable slots |
| DB-14 | Linking one UUID; collision no merge; viable sign-in preserved |
| DB-15 | Creator erasure works after ownership resolution; last-owner cannot bypass |
| DB-16 | Storage-owner conflicts/retained assets/crash retries handled |
| DB-17 | Invitation expiry/revoke/racing redemption one bounded winner/no hash leak |
| DB-18 | Verification races preserve pending uniqueness/org consistency/evidence privacy |
| DB-19 | No RLS recursion/definer/search_path/EXECUTE/view escalation |
| DB-20 | Retention removes bytes/metadata; restored backup replays erasure |

Record actual migration version, actor, expected/actual result, concurrency observations and query evidence. Build success/schema review does not mean tests passed.

## 13. Consolidation decisions and final review gate

Resolved: integrated org follows; historical creator SET NULL versus real owner preservation; independent scoped roles; locked polymorphic integrity; deferred image-only publication; one privacy model; private Storage and owner-aware erasure; verified identity linking; explicit state transitions; staged idempotent deletion.

Before coding approve the complete reconstructed v2.1 product decisions/retention, confirm deployed platform compatibility, review role/privacy matrices and pass implementation-plan G00. No unavailable original source is a prerequisite. This is the single consolidated proposed contract; approval is not presumed. Version 2.1 reconciles all four completed documents, adds bounded export delivery and resolves message moderation versus participant immutability.

## 14. Primary technical references

Platform mechanics, not product approval; use deployed-version guidance:

- [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html).
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [Supabase functions](https://supabase.com/docs/guides/database/functions).
- [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data), including Storage ownership blocking identity deletion.
- [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking).
- [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api).

End of consolidated specification.
