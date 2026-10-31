-- BEL-0203: secure helper framework.
-- * Shared access predicates (backend_schema.md 3.2) as SECURITY DEFINER
--   functions owned by a narrowly privileged role, so later RLS policies and
--   trusted operations can call them without recursive RLS chains.
-- * Append-only enforcement for audit_logs and moderation_actions (4.22, 4.24).
-- * Primary keys immutable on every table (section 2).
-- Nothing is granted to anon/authenticated here: each predicate is granted to
-- the API roles by the task that first uses it in a policy or operation.

-- ---------------------------------------------------------------------------
-- Predicate owner: cannot log in, owns nothing but the predicates, and can read
-- only the columns they inspect. BYPASSRLS lets definer code see rows without
-- policies that would recurse; column grants are what bound it.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'belunai_access_owner') then
    create role belunai_access_owner nologin noinherit bypassrls;
  end if;
end
$$;
-- PostgreSQL 16+: the migration role needs SET on a role to give it ownership.
grant belunai_access_owner to current_user with set true, inherit false;

grant usage on schema public, private to belunai_access_owner;
grant select (id, onboarding_completed_at) on public.profiles to belunai_access_owner;
grant select (user_id, account_status, terms_accepted_at, privacy_notice_version)
  on public.account_settings to belunai_access_owner;
grant select (blocker_id, blocked_id) on public.user_blocks to belunai_access_owner;
grant select (user_low_id, user_high_id, status) on public.friendships to belunai_access_owner;
grant select (id, status) on public.organisations to belunai_access_owner;
grant select (organisation_id, user_id, role) on public.organisation_roles to belunai_access_owner;
grant select (id, status) on public.communities to belunai_access_owner;
grant select (community_id, user_id, role, status)
  on public.community_memberships to belunai_access_owner;
grant select (user_id, role) on public.platform_roles to belunai_access_owner;

-- ---------------------------------------------------------------------------
-- Predicates. All take explicit UUIDs (callers pass auth.uid(), never a body
-- value), read live rows only (never JWT claims), and return false/NULL for
-- NULL or unknown input.

-- eligible(u): profile and settings exist, account active, onboarding complete.
create function private.is_eligible(u uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.account_settings s on s.user_id = p.id
    where p.id = u
      and p.onboarding_completed_at is not null
      and s.account_status = 'active'
      and s.terms_accepted_at is not null
      and s.privacy_notice_version is not null
  );
$$;

-- blocked(a,b): a block row in either direction; false for the same user.
create function private.is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select a is distinct from b and exists (
    select 1 from public.user_blocks k
    where (k.blocker_id = a and k.blocked_id = b)
       or (k.blocker_id = b and k.blocked_id = a)
  );
$$;

-- friends(a,b): accepted canonical pair; both eligible and unblocked.
create function private.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select a is distinct from b
    and exists (
      select 1 from public.friendships f
      where f.user_low_id = least(a, b)
        and f.user_high_id = greatest(a, b)
        and f.status = 'accepted'
    )
    and private.is_eligible(a)
    and private.is_eligible(b)
    and not private.is_blocked(a, b);
$$;

-- Organisation role of an eligible user in an active organisation, else NULL.
create function private.organisation_role(u uuid, o uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select r.role
  from public.organisation_roles r
  join public.organisations g on g.id = r.organisation_id
  where r.user_id = u
    and r.organisation_id = o
    and g.status = 'active'
    and private.is_eligible(u);
$$;

-- org_admin(u,o): eligible owner or admin in an active organisation.
create function private.is_organisation_admin(u uuid, o uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.organisation_role(u, o) in ('owner', 'admin'), false);
$$;

create function private.is_organisation_owner(u uuid, o uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.organisation_role(u, o) = 'owner', false);
$$;

-- Local role of an eligible, active member of an active community, else NULL.
-- Pending and banned rows never count.
create function private.community_role(u uuid, c uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.community_memberships m
  join public.communities k on k.id = m.community_id
  where m.user_id = u
    and m.community_id = c
    and m.status = 'active'
    and k.status = 'active'
    and private.is_eligible(u);
$$;

-- member(u,c): eligible active member (any local role) in an active community.
create function private.is_community_member(u uuid, c uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.community_role(u, c) is not null;
$$;

-- community_staff(u,c): active local owner, admin or moderator.
create function private.is_community_staff(u uuid, c uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.community_role(u, c) in ('owner', 'admin', 'moderator'), false);
$$;

-- Explicit current platform role of an eligible account, else NULL.
create function private.platform_role(u uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select r.role from public.platform_roles r
  where r.user_id = u and private.is_eligible(u);
$$;

-- platform_staff(u): eligible account with an explicit platform role.
create function private.is_platform_staff(u uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.platform_role(u) is not null;
$$;

-- Hand the predicates to their owner. ALTER OWNER requires the new owner to
-- hold CREATE on the schema, so it is granted only for these statements.
grant create on schema private to belunai_access_owner;
alter function private.is_eligible(uuid) owner to belunai_access_owner;
alter function private.is_blocked(uuid, uuid) owner to belunai_access_owner;
alter function private.are_friends(uuid, uuid) owner to belunai_access_owner;
alter function private.organisation_role(uuid, uuid) owner to belunai_access_owner;
alter function private.is_organisation_admin(uuid, uuid) owner to belunai_access_owner;
alter function private.is_organisation_owner(uuid, uuid) owner to belunai_access_owner;
alter function private.community_role(uuid, uuid) owner to belunai_access_owner;
alter function private.is_community_member(uuid, uuid) owner to belunai_access_owner;
alter function private.is_community_staff(uuid, uuid) owner to belunai_access_owner;
alter function private.platform_role(uuid) owner to belunai_access_owner;
alter function private.is_platform_staff(uuid) owner to belunai_access_owner;
revoke create on schema private from belunai_access_owner;

-- Grants on the predicates must come from their owner.
do $$
declare
  migrator text := current_user;
  fn regprocedure;
begin
  set local role belunai_access_owner;
  for fn in
    select p.oid::regprocedure from pg_proc p
    where p.pronamespace = 'private'::regnamespace
      and p.proowner = 'belunai_access_owner'::regrole
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to %I', fn, migrator);
  end loop;
  reset role;
end
$$;

-- ---------------------------------------------------------------------------
-- Append-only tables. Rows are never edited or deleted; the only permitted
-- update sets listed reference columns to NULL (foreign-key SET NULL on
-- account erasure, target cleanup). Retention maintenance (M13) gets its own
-- controlled path.
create function private.enforce_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  old_row jsonb;
  new_row jsonb;
  col text;
begin
  if tg_op <> 'UPDATE' then
    raise exception '% on %.% is not allowed: table is append-only', tg_op, tg_table_schema, tg_table_name
      using errcode = 'restrict_violation';
  end if;
  old_row := to_jsonb(old);
  new_row := to_jsonb(new);
  for col in select jsonb_object_keys(old_row) loop
    if (new_row -> col) is distinct from (old_row -> col)
       and not (col = any (tg_argv) and new_row -> col = 'null'::jsonb) then
      raise exception 'column %.% is append-only and cannot be changed', tg_table_name, col
        using errcode = 'restrict_violation';
    end if;
  end loop;
  return new;
end;
$$;

create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function private.enforce_append_only('actor_id');
create trigger audit_logs_no_truncate
  before truncate on public.audit_logs
  for each statement execute function private.enforce_append_only();

create trigger moderation_actions_append_only
  before update or delete on public.moderation_actions
  for each row execute function private.enforce_append_only('report_id', 'actor_id', 'target_id');
create trigger moderation_actions_no_truncate
  before truncate on public.moderation_actions
  for each statement execute function private.enforce_append_only();

-- ---------------------------------------------------------------------------
-- Primary keys are immutable (section 2). Arguments name the key columns.
create function private.forbid_key_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  old_row jsonb := to_jsonb(old);
  new_row jsonb := to_jsonb(new);
  col text;
begin
  foreach col in array tg_argv loop
    if (new_row -> col) is distinct from (old_row -> col) then
      raise exception 'primary key column %.% cannot be changed', tg_table_name, col
        using errcode = 'restrict_violation';
    end if;
  end loop;
  return new;
end;
$$;

create trigger account_settings_forbid_key_update before update of user_id on public.account_settings
  for each row execute function private.forbid_key_update('user_id');
create trigger audit_logs_forbid_key_update before update of id on public.audit_logs
  for each row execute function private.forbid_key_update('id');
create trigger communities_forbid_key_update before update of id on public.communities
  for each row execute function private.forbid_key_update('id');
create trigger community_memberships_forbid_key_update
  before update of community_id, user_id on public.community_memberships
  for each row execute function private.forbid_key_update('community_id', 'user_id');
create trigger content_reports_forbid_key_update before update of id on public.content_reports
  for each row execute function private.forbid_key_update('id');
create trigger conversations_forbid_key_update before update of id on public.conversations
  for each row execute function private.forbid_key_update('id');
create trigger friendships_forbid_key_update before update of id on public.friendships
  for each row execute function private.forbid_key_update('id');
create trigger interests_forbid_key_update before update of id on public.interests
  for each row execute function private.forbid_key_update('id');
create trigger invitations_forbid_key_update before update of id on public.invitations
  for each row execute function private.forbid_key_update('id');
create trigger messages_forbid_key_update before update of id on public.messages
  for each row execute function private.forbid_key_update('id');
create trigger moderation_actions_forbid_key_update before update of id on public.moderation_actions
  for each row execute function private.forbid_key_update('id');
create trigger notifications_forbid_key_update before update of id on public.notifications
  for each row execute function private.forbid_key_update('id');
create trigger organisation_follows_forbid_key_update
  before update of follower_id, organisation_id on public.organisation_follows
  for each row execute function private.forbid_key_update('follower_id', 'organisation_id');
create trigger organisation_roles_forbid_key_update
  before update of organisation_id, user_id on public.organisation_roles
  for each row execute function private.forbid_key_update('organisation_id', 'user_id');
create trigger organisations_forbid_key_update before update of id on public.organisations
  for each row execute function private.forbid_key_update('id');
create trigger platform_roles_forbid_key_update before update of user_id on public.platform_roles
  for each row execute function private.forbid_key_update('user_id');
create trigger post_comments_forbid_key_update before update of id on public.post_comments
  for each row execute function private.forbid_key_update('id');
create trigger post_likes_forbid_key_update before update of post_id, user_id on public.post_likes
  for each row execute function private.forbid_key_update('post_id', 'user_id');
create trigger post_media_forbid_key_update before update of id on public.post_media
  for each row execute function private.forbid_key_update('id');
create trigger post_saves_forbid_key_update before update of user_id, post_id on public.post_saves
  for each row execute function private.forbid_key_update('user_id', 'post_id');
create trigger posts_forbid_key_update before update of id on public.posts
  for each row execute function private.forbid_key_update('id');
create trigger profile_interests_forbid_key_update
  before update of user_id, interest_id on public.profile_interests
  for each row execute function private.forbid_key_update('user_id', 'interest_id');
create trigger profiles_forbid_key_update before update of id on public.profiles
  for each row execute function private.forbid_key_update('id');
create trigger user_blocks_forbid_key_update before update of blocker_id, blocked_id on public.user_blocks
  for each row execute function private.forbid_key_update('blocker_id', 'blocked_id');
create trigger user_follows_forbid_key_update
  before update of follower_id, following_id on public.user_follows
  for each row execute function private.forbid_key_update('follower_id', 'following_id');
create trigger verification_requests_forbid_key_update
  before update of id on public.verification_requests
  for each row execute function private.forbid_key_update('id');
