-- BEL-0205: exactly-one-owner guarantees, platform owner bootstrap, shared
-- lock helpers and audit metadata minimisation.
-- backend_schema.md 3.3, 4.9, 4.12, 4.23, 4.24, 5.2, 8.
--
-- Nothing here is granted to anon/authenticated. Operations that use these
-- helpers arrive with their feature tasks.

-- ---------------------------------------------------------------------------
-- Shared lock order (section 8): account UUIDs ascending; canonical pair;
-- entity type/id; content parent; dependent event/case. Transaction-scoped:
-- released at commit or rollback.

-- Row-locks the accounts' settings rows in ascending UUID order, so two
-- operations on the same accounts always queue instead of deadlocking.
create function private.lock_accounts(ids uuid[])
returns void
language sql
set search_path = ''
as $$
  select null::void from (
    select 1 from public.account_settings s
    where s.user_id = any (ids)
    order by s.user_id
    for update
  ) locked;
$$;

-- One advisory lock per unordered user pair: (a,b) and (b,a) share it.
create function private.lock_pair(a uuid, b uuid)
returns void
language sql
set search_path = ''
as $$
  select pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('belunai:pair:' || least(a, b)::text || ':' || greatest(a, b)::text, 0)
  );
$$;

-- The single platform-owner lock used by bootstrap and transfer.
create function private.lock_platform_owner()
returns void
language sql
set search_path = ''
as $$
  select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('belunai:platform-owner', 0));
$$;

-- ---------------------------------------------------------------------------
-- Exactly one owner. Partial UNIQUE indexes (M05-M07) already allow at most
-- one; these deferred checks require at least one at commit, so a transfer
-- can demote then promote inside one transaction.

create function private.assert_organisation_owner(org uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  org_status text;
begin
  -- Lock the parent so concurrent role changes for it are checked in turn.
  select g.status into org_status from public.organisations g where g.id = org for update;
  if not found or org_status <> 'active' then
    return; -- deleted, suspended or archived organisations may have no owner
  end if;
  if (select count(*) from public.organisation_roles r
      where r.organisation_id = org and r.role = 'owner') <> 1 then
    raise exception 'active organisation % must have exactly one owner', org
      using errcode = 'check_violation', constraint = 'organisations_exactly_one_owner';
  end if;
end;
$$;

create function private.check_organisation_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'organisations' then
    perform private.assert_organisation_owner(new.id);
  else
    perform private.assert_organisation_owner(coalesce(new.organisation_id, old.organisation_id));
  end if;
  return null;
end;
$$;

create constraint trigger organisations_exactly_one_owner
  after insert or update of status on public.organisations
  deferrable initially deferred
  for each row execute function private.check_organisation_owner();

-- Covers grants, demotion, removal and profile-deletion cascades.
create constraint trigger organisation_roles_exactly_one_owner
  after insert or update or delete on public.organisation_roles
  deferrable initially deferred
  for each row execute function private.check_organisation_owner();

create function private.assert_community_owner(community uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  community_status text;
begin
  select c.status into community_status from public.communities c where c.id = community for update;
  if not found or community_status <> 'active' then
    return;
  end if;
  -- An owner row is always active (community_memberships_nonactive_role_check).
  if (select count(*) from public.community_memberships m
      where m.community_id = community and m.role = 'owner') <> 1 then
    raise exception 'active community % must have exactly one owner', community
      using errcode = 'check_violation', constraint = 'communities_exactly_one_owner';
  end if;
end;
$$;

create function private.check_community_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'communities' then
    perform private.assert_community_owner(new.id);
  else
    perform private.assert_community_owner(coalesce(new.community_id, old.community_id));
  end if;
  return null;
end;
$$;

create constraint trigger communities_exactly_one_owner
  after insert or update of status on public.communities
  deferrable initially deferred
  for each row execute function private.check_community_owner();

create constraint trigger community_memberships_exactly_one_owner
  after insert or update or delete on public.community_memberships
  deferrable initially deferred
  for each row execute function private.check_community_owner();

-- Platform: before bootstrap there are no platform roles at all. The first
-- role must be the owner, and once an owner exists one always remains.
create function private.check_platform_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform private.lock_platform_owner();
  if (tg_op in ('UPDATE', 'DELETE') and old.role = 'owner')
     or exists (select 1 from public.platform_roles) then
    if (select count(*) from public.platform_roles r where r.role = 'owner') <> 1 then
      raise exception 'the platform must have exactly one owner once bootstrapped'
        using errcode = 'check_violation', constraint = 'platform_roles_exactly_one_owner';
    end if;
  end if;
  return null;
end;
$$;

create constraint trigger platform_roles_exactly_one_owner
  after insert or update or delete on public.platform_roles
  deferrable initially deferred
  for each row execute function private.check_platform_owner();

-- ---------------------------------------------------------------------------
-- Non-API platform owner bootstrap (section 4.23). Run by the operator with
-- database access (`npm run db:bootstrap-owner`), never by sign-up or the app.
create function private.bootstrap_platform_owner(owner_id uuid, correlation_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if owner_id is null or correlation_id is null then
    raise exception 'owner_id and correlation_id are required' using errcode = 'null_value_not_allowed';
  end if;
  perform private.lock_platform_owner();
  perform private.lock_accounts(array[owner_id]);
  if exists (select 1 from public.platform_roles) then
    raise exception 'platform already bootstrapped; use owner transfer' using errcode = 'unique_violation';
  end if;
  if not private.is_eligible(owner_id) then
    raise exception 'bootstrap owner must be an eligible, onboarded, active account'
      using errcode = 'check_violation';
  end if;
  insert into public.platform_roles (user_id, role) values (owner_id, 'owner');
  insert into public.audit_logs (actor_id, action, resource_type, resource_id, correlation_id, metadata)
  values (null, 'platform_owner.bootstrap', 'profile', owner_id, correlation_id, '{"version": 1}');
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit minimisation (section 4.24): metadata is {} or a versioned object of
-- short, non-identifying facts. No credentials, OTPs, tokens, contact details,
-- message bodies, documents or auth dumps, at any nesting depth.
create function private.is_minimal_audit_metadata(m jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    m = '{}'::jsonb
    or (
      jsonb_typeof(m -> 'version') = 'number'
      and (m ->> 'version') ~ '^[1-9][0-9]*$'
      and not exists (
        select 1 from jsonb_path_query(m, 'lax $.** ? (@.type() == "object").keyvalue().key') k
        where k #>> '{}' ~* '(passw|passcode|secret|token|otp|e_?mail|phone|body|content|jwt|cookie|session|authori[sz]ation|api_?key|credential|address|document)'
      )
      and not exists (
        select 1 from jsonb_path_query(m, 'lax $.** ? (@.type() == "string")') v
        where char_length(v #>> '{}') > 500
           or v #>> '{}' ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
           or v #>> '{}' ~ '^eyJ[A-Za-z0-9_-]+\.'
           or v #>> '{}' ~ '^(sb_secret_|sb_publishable_|sbp_)'
           or v #>> '{}' ~ '^\+?[0-9][0-9 ().-]{7,}$'
      )
    ),
    false
  );
$$;

alter table public.audit_logs
  add constraint audit_logs_metadata_minimal_check check (private.is_minimal_audit_metadata(metadata));
