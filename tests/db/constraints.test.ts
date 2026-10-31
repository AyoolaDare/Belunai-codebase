// Row-local constraints from backend_schema.md section 4 reject invalid data.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CHECK,
  FOREIGN_KEY,
  UNIQUE,
  createOrganisation,
  createPair,
  createUser,
  expectRejected,
  connectTestDatabase,
} from "./helpers";

const db = connectTestDatabase();
const uuidPath = (prefix: string, ext = "jpg") => `${prefix}/${randomUUID()}.${ext}`;

describe("profiles", () => {
  it("accepts valid usernames and rejects invalid ones", async () => {
    const id = await createUser(db);
    await db.query("update public.profiles set username = 'Ada_Lovelace1' where id = $1", [id]);
    for (const bad of ["ab", "has space", "émile", "a".repeat(31)]) {
      await expectRejected(db, "update public.profiles set username = $2 where id = $1", [id, bad], {
        code: bad.length > 30 ? "22001" : CHECK,
      });
    }
  });

  it("enforces case-insensitive username uniqueness", async () => {
    await createUser(db, "GraceUser");
    const other = await createUser(db);
    await expectRejected(db, "update public.profiles set username = 'graceuser' where id = $1", [other], {
      constraint: "profiles_username_lower_key",
    });
  });

  it("requires username and display name for completed onboarding", async () => {
    const id = await createUser(db, "pending_user");
    await expectRejected(db, "update public.profiles set onboarding_completed_at = now() where id = $1", [id], {
      constraint: "profiles_onboarding_check",
    });
    await db.query(
      "update public.profiles set display_name = 'Pending', onboarding_completed_at = now() where id = $1",
      [id],
    );
  });

  it("rejects blank text and avatar paths outside the owner's prefix", async () => {
    const id = await createUser(db);
    await expectRejected(db, "update public.profiles set display_name = '   ' where id = $1", [id], {
      constraint: "profiles_display_name_check",
    });
    await expectRejected(db, "update public.profiles set avatar_path = $2 where id = $1",
      [id, uuidPath(`profiles/${randomUUID()}`)], { constraint: "profiles_avatar_path_check" });
    await expectRejected(db, "update public.profiles set avatar_path = $2 where id = $1",
      [id, uuidPath(`profiles/${id}`, "svg")], { constraint: "profiles_avatar_path_check" });
    await db.query("update public.profiles set avatar_path = $2 where id = $1", [id, uuidPath(`profiles/${id}`)]);
  });

  it("maintains updated_at in the database", async () => {
    const id = await createUser(db);
    await db.query("update public.profiles set updated_at = '2000-01-01' where id = $1", [id]);
    const { rows } = await db.query("select updated_at > '2001-01-01' as fresh from public.profiles where id = $1", [id]);
    expect(rows[0].fresh).toBe(true);
  });
});

describe("account_settings", () => {
  it("uses valid default preferences and rejects malformed ones", async () => {
    const id = await createUser(db);
    await db.query("insert into public.account_settings (user_id) values ($1)", [id]);
    const sql = "update public.account_settings set notification_preferences = $2::jsonb where user_id = $1";
    for (const bad of [
      { version: 1, social: true, community: true },
      { version: 1, social: true, community: true, messages: true, email: true },
      { version: "1", social: true, community: true, messages: true },
      { version: 1.5, social: true, community: true, messages: true },
      { version: 1, social: "yes", community: true, messages: true },
    ]) {
      await expectRejected(db, sql, [id, JSON.stringify(bad)], {
        constraint: "account_settings_notification_preferences_check",
      });
    }
  });

  it("ties pending deletion to its timestamp and terms fields together", async () => {
    const id = await createUser(db);
    await db.query("insert into public.account_settings (user_id) values ($1)", [id]);
    await expectRejected(db, "update public.account_settings set account_status = 'pending_deletion' where user_id = $1",
      [id], { constraint: "account_settings_deletion_check" });
    await expectRejected(db, "update public.account_settings set terms_accepted_at = now() where user_id = $1",
      [id], { constraint: "account_settings_terms_pair_check" });
  });
});

describe("relationships", () => {
  it("rejects self follows and self blocks", async () => {
    const id = await createUser(db);
    await expectRejected(db, "insert into public.user_follows (follower_id, following_id) values ($1, $1)", [id],
      { constraint: "user_follows_distinct_check" });
    await expectRejected(db, "insert into public.user_blocks (blocker_id, blocked_id) values ($1, $1)", [id],
      { constraint: "user_blocks_distinct_check" });
  });

  it("stores one canonical friendship row per pair", async () => {
    const [low, high] = await createPair(db);
    const outsider = await createUser(db);
    const insert = "insert into public.friendships (user_low_id, user_high_id, requested_by, status, responded_at) values ($1, $2, $3, $4, $5)";
    await expectRejected(db, insert, [high, low, low, "pending", null], { constraint: "friendships_order_check" });
    await expectRejected(db, insert, [low, high, outsider, "pending", null], { constraint: "friendships_requested_by_check" });
    await expectRejected(db, insert, [low, high, low, "pending", new Date()], { constraint: "friendships_responded_check" });
    await expectRejected(db, insert, [low, high, low, "accepted", null], { constraint: "friendships_responded_check" });
    await db.query(insert, [low, high, low, "pending", null]);
    await expectRejected(db, insert, [low, high, high, "pending", null], { constraint: "friendships_pair_key" });
  });
});

describe("interests", () => {
  it("validates slugs and restricts deleting a selected interest", async () => {
    await expectRejected(db, "insert into public.interests (slug, name) values ('Bad Slug', 'x')", [],
      { constraint: "interests_slug_check" });
    const { rows } = await db.query("insert into public.interests (slug, name) values ('gospel-music', 'Gospel music') returning id");
    const user = await createUser(db);
    await db.query("insert into public.profile_interests (user_id, interest_id) values ($1, $2)", [user, rows[0].id]);
    await expectRejected(db, "delete from public.interests where id = $1", [rows[0].id], { code: FOREIGN_KEY });
  });
});

describe("organisations and verification", () => {
  it("ties verification status to verified_at and requires https websites", async () => {
    const org = await createOrganisation(db);
    await expectRejected(db, "update public.organisations set verification_status = 'verified' where id = $1", [org],
      { constraint: "organisations_verified_at_check" });
    await expectRejected(db, "update public.organisations set website_url = 'http://example.org' where id = $1", [org],
      { constraint: "organisations_website_url_check" });
    await expectRejected(db, "insert into public.organisations (slug, name) values ($1, 'Copy')",
      [(await db.query("select slug from public.organisations where id = $1", [org])).rows[0].slug],
      { constraint: "organisations_slug_lower_key" });
  });

  it("allows at most one organisation owner", async () => {
    const org = await createOrganisation(db);
    const [a, b] = await createPair(db);
    await db.query("insert into public.organisation_roles (organisation_id, user_id, role) values ($1, $2, 'owner')", [org, a]);
    await expectRejected(db, "insert into public.organisation_roles (organisation_id, user_id, role) values ($1, $2, 'owner')",
      [org, b], { constraint: "organisation_roles_single_owner_key" });
    await db.query("insert into public.organisation_roles (organisation_id, user_id, role) values ($1, $2, 'admin')", [org, b]);
  });

  it("keeps one pending request and validates evidence keys", async () => {
    const org = await createOrganisation(db);
    const id = randomUUID();
    const insert = "insert into public.verification_requests (id, organisation_id, statement, evidence_paths) values ($1, $2, 'We are a church', $3::jsonb)";
    const good = uuidPath(`organisations/${org}/requests/${id}`, "png");
    await expectRejected(db, insert, [id, org, JSON.stringify([uuidPath(`organisations/${org}/requests/${randomUUID()}`)])],
      { constraint: "verification_requests_evidence_paths_check" });
    await expectRejected(db, insert, [id, org, JSON.stringify([good, good])],
      { constraint: "verification_requests_evidence_paths_check" });
    const six = Array.from({ length: 6 }, () => uuidPath(`organisations/${org}/requests/${id}`));
    await expectRejected(db, insert, [id, org, JSON.stringify(six)],
      { constraint: "verification_requests_evidence_paths_check" });
    await db.query(insert, [id, org, JSON.stringify([good])]);
    await expectRejected(db, insert, [randomUUID(), org, "[]"], { constraint: "verification_requests_single_pending_key" });
    await expectRejected(db, "update public.verification_requests set status = 'approved' where id = $1", [id],
      { constraint: "verification_requests_reviewed_at_check" });
  });
});

describe("communities and memberships", () => {
  it("ties church communities to exactly one organisation", async () => {
    const org = await createOrganisation(db);
    const insert = "insert into public.communities (slug, name, kind, organisation_id) values ($1, 'Community', $2, $3)";
    await expectRejected(db, insert, ["church-no-org", "church", null], { constraint: "communities_kind_organisation_check" });
    await expectRejected(db, insert, ["interest-with-org", "interest", org], { constraint: "communities_kind_organisation_check" });
    await db.query(insert, ["grace-church", "church", org]);
    await expectRejected(db, insert, ["grace-church-two", "church", org], { constraint: "communities_single_church_key" });
    await expectRejected(db, "delete from public.organisations where id = $1", [org], { code: FOREIGN_KEY });
  });

  it("enforces membership role/status/joined_at rules and one owner", async () => {
    const { rows } = await db.query("insert into public.communities (slug, name, kind) values ('choir', 'Choir', 'interest') returning id");
    const community = rows[0].id;
    const [a, b] = await createPair(db);
    const insert = "insert into public.community_memberships (community_id, user_id, role, status, joined_at) values ($1, $2, $3, $4, $5)";
    await expectRejected(db, insert, [community, a, "admin", "pending", null], { constraint: "community_memberships_nonactive_role_check" });
    await expectRejected(db, insert, [community, a, "member", "active", null], { constraint: "community_memberships_active_joined_check" });
    await expectRejected(db, insert, [community, a, "member", "pending", new Date()], { constraint: "community_memberships_pending_joined_check" });
    await db.query(insert, [community, a, "owner", "active", new Date()]);
    await expectRejected(db, insert, [community, b, "owner", "active", new Date()], { constraint: "community_memberships_single_owner_key" });
  });
});

describe("posts and media", () => {
  it("enforces one context with matching visibility", async () => {
    const author = await createUser(db);
    const org = await createOrganisation(db);
    const { rows } = await db.query("insert into public.communities (slug, name, kind) values ('readers', 'Readers', 'interest') returning id");
    const insert = "insert into public.posts (author_id, organisation_id, community_id, visibility) values ($1, $2, $3, $4)";
    await expectRejected(db, insert, [author, org, rows[0].id, "public"], { constraint: "posts_context_check" });
    await expectRejected(db, insert, [author, org, null, "friends"], { constraint: "posts_context_check" });
    await expectRejected(db, insert, [author, null, rows[0].id, "public"], { constraint: "posts_context_check" });
    await expectRejected(db, insert, [author, null, null, "community"], { constraint: "posts_context_check" });
    await db.query(insert, [author, null, null, "friends"]);
    await db.query(insert, [author, org, null, "public"]);
    await db.query(insert, [author, null, rows[0].id, "community"]);
  });

  it("enforces lifecycle timestamps", async () => {
    const author = await createUser(db);
    const { rows } = await db.query("insert into public.posts (author_id, visibility, body) values ($1, 'public', 'Hello') returning id", [author]);
    const id = rows[0].id;
    await expectRejected(db, "update public.posts set status = 'published' where id = $1", [id], { constraint: "posts_published_check" });
    await expectRejected(db, "update public.posts set published_at = now() where id = $1", [id], { constraint: "posts_draft_check" });
    await expectRejected(db, "update public.posts set status = 'deleted' where id = $1", [id], { constraint: "posts_deleted_check" });
    await db.query("update public.posts set status = 'published', published_at = now() where id = $1", [id]);
    await expectRejected(db, "update public.posts set body = '  ' where id = $1", [id], { constraint: "posts_body_check" });
  });

  it("blocks author erasure while personal posts remain but keeps organisation posts", async () => {
    const author = await createUser(db);
    const org = await createOrganisation(db);
    await db.query("insert into public.posts (author_id, visibility) values ($1, 'public')", [author]);
    await db.query("insert into public.posts (author_id, organisation_id, visibility) values ($1, $2, 'public')", [author, org]);
    await expectRejected(db, "delete from auth.users where id = $1", [author], { constraint: "posts_author_check" });
    await db.query("delete from public.posts where author_id = $1 and organisation_id is null", [author]);
    await db.query("delete from auth.users where id = $1", [author]);
    const { rows } = await db.query("select author_id from public.posts where organisation_id = $1", [org]);
    expect(rows).toEqual([{ author_id: null }]);
  });

  it("validates media keys, limits and positions", async () => {
    const author = await createUser(db);
    const { rows } = await db.query("insert into public.posts (author_id, visibility) values ($1, 'public') returning id", [author]);
    const post = rows[0].id;
    const insert = `insert into public.post_media (id, post_id, bucket_id, object_path, mime_type, byte_size, width, height, position)
                    values ($1, $2, 'post-images', $3, $4, $5, $6, $7, $8)`;
    const media = () => randomUUID();
    let id = media();
    await expectRejected(db, insert, [id, post, `posts/${post}/${id}.png`, "image/jpeg", 1000, 100, 100, 0],
      { constraint: "post_media_object_path_check" });
    id = media();
    await expectRejected(db, insert, [id, post, `posts/${post}/${id}.gif`, "image/gif", 1000, 100, 100, 0],
      { constraint: "post_media_mime_type_check" });
    id = media();
    await expectRejected(db, insert, [id, post, `posts/${post}/${id}.jpg`, "image/jpeg", 10485761, 100, 100, 0],
      { constraint: "post_media_byte_size_check" });
    id = media();
    await expectRejected(db, insert, [id, post, `posts/${post}/${id}.jpg`, "image/jpeg", 1000, 5000, 4001, 0],
      { constraint: "post_media_dimensions_check" });
    id = media();
    await expectRejected(db, insert, [id, post, `posts/${post}/${id}.jpg`, "image/jpeg", 1000, 100, 100, 4],
      { constraint: "post_media_position_check" });
    id = media();
    await db.query(insert, [id, post, `posts/${post}/${id}.webp`, "image/webp", 1000, 5000, 4000, 0]);
    id = media();
    await expectRejected(db, insert, [id, post, `posts/${post}/${id}.jpg`, "image/jpeg", 1000, 100, 100, 0],
      { constraint: "post_media_post_position_key" });
  });
});

describe("messaging", () => {
  it("keeps a surviving participant and rejects erasing both", async () => {
    const [low, high] = await createPair(db);
    const { rows } = await db.query(
      "insert into public.conversations (user_low_id, user_high_id) values ($1, $2) returning id", [low, high]);
    await expectRejected(db, "insert into public.conversations (user_low_id, user_high_id) values ($1, $2)",
      [high, low], { constraint: "conversations_order_check" });
    const request = randomUUID();
    const send = "insert into public.messages (conversation_id, sender_id, body, client_request_id) values ($1, $2, 'Hi', $3)";
    await db.query(send, [rows[0].id, low, request]);
    await expectRejected(db, send, [rows[0].id, low, request], { constraint: "messages_request_key" });

    await db.query("delete from auth.users where id = $1", [low]);
    const after = await db.query("select user_low_id, user_high_id from public.conversations where id = $1", [rows[0].id]);
    expect(after.rows[0]).toEqual({ user_low_id: null, user_high_id: high });
    const sender = await db.query("select sender_id from public.messages where conversation_id = $1", [rows[0].id]);
    expect(sender.rows[0].sender_id).toBeNull();
    await expectRejected(db, "delete from auth.users where id = $1", [high], { constraint: "conversations_survivor_check" });
  });
});

describe("notifications, reports, moderation and invitations", () => {
  it("rejects incompatible notification event/target pairs", async () => {
    const user = await createUser(db);
    const insert = "insert into public.notifications (recipient_id, event_type, target_type, target_id, dedupe_key) values ($1, $2, $3, $4, $5)";
    await expectRejected(db, insert, [user, "message", "post", randomUUID(), "k1"], { constraint: "notifications_pairing_check" });
    await expectRejected(db, insert, [user, "follow", "community", randomUUID(), "k2"], { constraint: "notifications_pairing_check" });
    await db.query(insert, [user, "moderation", "report", randomUUID(), "k3"]);
    await expectRejected(db, insert, [user, "moderation", "report", randomUUID(), "k3"], { constraint: "notifications_dedupe_key" });
  });

  it("keeps one open report per reporter and target and bounds evidence", async () => {
    const reporter = await createUser(db);
    const target = randomUUID();
    const insert = "insert into public.content_reports (reporter_id, target_type, target_id, reason, evidence_snapshot) values ($1, 'post', $2, 'spam', $3::jsonb)";
    await expectRejected(db, insert, [reporter, target, JSON.stringify({ text: "x".repeat(33000) })],
      { constraint: "content_reports_evidence_check" });
    await expectRejected(db, insert, [reporter, target, "[]"], { constraint: "content_reports_evidence_check" });
    await db.query(insert, [reporter, target, '{"version": 1}']);
    await expectRejected(db, insert, [reporter, target, '{"version": 1}'], { constraint: "content_reports_single_open_key" });
    await expectRejected(db, "update public.content_reports set status = 'resolved' where reporter_id = $1", [reporter],
      { constraint: "content_reports_terminal_check" });
  });

  it("rejects moderation actions that do not fit their target", async () => {
    const insert = "insert into public.moderation_actions (action_type, target_type, target_id, reason) values ($1, $2, $3, 'Policy')";
    await expectRejected(db, insert, ["suspend_account", "post", randomUUID()], { constraint: "moderation_actions_compatibility_check" });
    await expectRejected(db, insert, ["revoke_verification", "community", randomUUID()], { constraint: "moderation_actions_compatibility_check" });
    await db.query(insert, ["remove_content", "message", randomUUID()]);
  });

  it("stores only digest tokens with a single scope", async () => {
    const org = await createOrganisation(db);
    const { rows } = await db.query("insert into public.communities (slug, name, kind) values ('youth', 'Youth', 'interest') returning id");
    const insert = "insert into public.invitations (token_hash, organisation_id, community_id, expires_at) values ($1, $2, $3, now() + interval '7 days')";
    const hash = "a".repeat(64);
    await expectRejected(db, insert, ["not-a-hash", null, null], { constraint: "invitations_token_hash_check" });
    await expectRejected(db, insert, [hash, org, rows[0].id], { constraint: "invitations_scope_check" });
    await db.query(insert, [hash, org, null]);
    await expectRejected(db, insert, [hash, null, null], { constraint: "invitations_token_hash_key" });
    await expectRejected(db, "insert into public.invitations (token_hash, expires_at) values ($1, now() - interval '1 day')",
      ["b".repeat(64)], { constraint: "invitations_expiry_check" });
  });

  it("allows only one platform owner", async () => {
    const [a, b] = await createPair(db);
    await db.query("insert into public.platform_roles (user_id, role) values ($1, 'owner')", [a]);
    await expectRejected(db, "insert into public.platform_roles (user_id, role) values ($1, 'owner')", [b],
      { constraint: "platform_roles_single_owner_key" });
    await expectRejected(db, "insert into public.platform_roles (user_id, role) values ($1, 'superuser')", [b],
      { code: CHECK });
  });

  it("keeps unique constraints on likes and saves", async () => {
    const user = await createUser(db);
    const { rows } = await db.query("insert into public.posts (author_id, visibility) values ($1, 'public') returning id", [user]);
    await db.query("insert into public.post_likes (post_id, user_id) values ($1, $2)", [rows[0].id, user]);
    await expectRejected(db, "insert into public.post_likes (post_id, user_id) values ($1, $2)", [rows[0].id, user], { code: UNIQUE });
    await db.query("insert into public.post_saves (user_id, post_id) values ($1, $2)", [user, rows[0].id]);
    await expectRejected(db, "insert into public.post_saves (user_id, post_id) values ($1, $2)", [user, rows[0].id], { code: UNIQUE });
  });
});
