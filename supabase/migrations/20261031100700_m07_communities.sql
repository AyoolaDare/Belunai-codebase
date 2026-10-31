-- M07: communities and memberships. Church communities require an
-- organisation; interest communities must not have one. The deferred
-- exactly-one-owner check arrives with BEL-0205. backend_schema.md 4.11, 4.12.

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  slug varchar(80) not null,
  name varchar(150) not null,
  description varchar(2000),
  kind text not null,
  organisation_id uuid references public.organisations (id) on delete restrict,
  privacy text not null default 'public',
  status text not null default 'active',
  created_by uuid references public.profiles (id) on delete set null,
  avatar_path text,
  banner_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint communities_slug_check check (private.is_slug(slug, 80)),
  constraint communities_name_check check (name ~ '\S'),
  constraint communities_description_check check (description ~ '\S'),
  constraint communities_kind_check check (kind in ('church', 'interest')),
  constraint communities_kind_organisation_check
    check ((kind = 'church') = (organisation_id is not null)),
  constraint communities_privacy_check check (privacy in ('public', 'private')),
  constraint communities_status_check check (status in ('active', 'suspended', 'archived')),
  constraint communities_avatar_path_check
    check (avatar_path is null or private.is_image_object_path(avatar_path, 'communities/' || id::text)),
  constraint communities_banner_path_check
    check (banner_path is null or private.is_image_object_path(banner_path, 'communities/' || id::text))
);

create unique index communities_slug_lower_key on public.communities (lower(slug));
-- One church community per organisation; also serves the organisation FK.
create unique index communities_single_church_key
  on public.communities (organisation_id) where organisation_id is not null;
create index communities_status_privacy_created_idx
  on public.communities (status, privacy, created_at, id);
create index communities_created_by_idx on public.communities (created_by);

create trigger communities_set_updated_at
  before update on public.communities
  for each row execute function private.set_updated_at();

create table public.community_memberships (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member',
  status text not null,
  requested_at timestamptz not null default now(),
  joined_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (community_id, user_id),
  constraint community_memberships_role_check
    check (role in ('owner', 'admin', 'moderator', 'member')),
  constraint community_memberships_status_check check (status in ('pending', 'active', 'banned')),
  constraint community_memberships_nonactive_role_check check (status = 'active' or role = 'member'),
  constraint community_memberships_active_joined_check
    check (status <> 'active' or joined_at is not null),
  constraint community_memberships_pending_joined_check
    check (status <> 'pending' or joined_at is null)
);

create unique index community_memberships_single_owner_key
  on public.community_memberships (community_id) where role = 'owner';
create index community_memberships_user_idx
  on public.community_memberships (user_id, status, community_id);
create index community_memberships_queue_idx
  on public.community_memberships (community_id, status, requested_at, user_id);

create trigger community_memberships_set_updated_at
  before update on public.community_memberships
  for each row execute function private.set_updated_at();

alter table public.communities enable row level security;
alter table public.community_memberships enable row level security;
revoke all on public.communities, public.community_memberships from anon, authenticated;
