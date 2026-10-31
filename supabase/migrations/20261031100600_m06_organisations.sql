-- M06: organisations, scoped organisation roles and verification requests.
-- Creator is historical (SET NULL); control lives in organisation_roles.
-- Name/slug search indexes arrive with BEL-1003 (M13 split, decision register).
-- backend_schema.md 4.8, 4.9, 4.10.

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  slug varchar(80) not null,
  name varchar(150) not null,
  description varchar(2000),
  avatar_path text,
  banner_path text,
  website_url text,
  created_by uuid references public.profiles (id) on delete set null,
  verification_status text not null default 'unverified',
  verified_at timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organisations_slug_check check (private.is_slug(slug, 80)),
  constraint organisations_name_check check (name ~ '\S'),
  constraint organisations_description_check check (description ~ '\S'),
  constraint organisations_avatar_path_check
    check (avatar_path is null or private.is_image_object_path(avatar_path, 'organisations/' || id::text)),
  constraint organisations_banner_path_check
    check (banner_path is null or private.is_image_object_path(banner_path, 'organisations/' || id::text)),
  constraint organisations_website_url_check
    check (website_url is null or private.is_https_url(website_url)),
  constraint organisations_verification_status_check
    check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  constraint organisations_verified_at_check
    check ((verification_status = 'verified') = (verified_at is not null)),
  constraint organisations_status_check check (status in ('active', 'suspended', 'archived'))
);

create unique index organisations_slug_lower_key on public.organisations (lower(slug));
create index organisations_status_created_idx on public.organisations (status, created_at, id);
create index organisations_created_by_idx on public.organisations (created_by);

create trigger organisations_set_updated_at
  before update on public.organisations
  for each row execute function private.set_updated_at();

create table public.organisation_roles (
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null,
  assigned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (organisation_id, user_id),
  constraint organisation_roles_role_check check (role in ('owner', 'admin'))
);

create unique index organisation_roles_single_owner_key
  on public.organisation_roles (organisation_id) where role = 'owner';
create index organisation_roles_user_idx on public.organisation_roles (user_id, organisation_id);
create index organisation_roles_assigned_by_idx on public.organisation_roles (assigned_by);

create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  submitted_by uuid references public.profiles (id) on delete set null,
  status text not null default 'pending',
  statement varchar(2000) not null,
  evidence_paths jsonb not null default '[]'::jsonb,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note varchar(2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint verification_requests_status_check
    check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  constraint verification_requests_statement_check check (statement ~ '\S'),
  constraint verification_requests_review_note_check check (review_note ~ '\S'),
  constraint verification_requests_evidence_paths_check
    check (private.is_valid_evidence_paths(evidence_paths, organisation_id, id)),
  constraint verification_requests_reviewed_at_check
    check ((status in ('approved', 'rejected')) = (reviewed_at is not null)),
  -- Undecided requests carry no review; a decision's reviewer may later be erased (NULL).
  constraint verification_requests_undecided_check
    check (status in ('approved', 'rejected') or (reviewed_by is null and review_note is null))
);

create unique index verification_requests_single_pending_key
  on public.verification_requests (organisation_id) where status = 'pending';
create index verification_requests_status_created_idx
  on public.verification_requests (status, created_at, id);
create index verification_requests_organisation_idx
  on public.verification_requests (organisation_id, created_at desc, id);
create index verification_requests_submitted_by_idx on public.verification_requests (submitted_by);
create index verification_requests_reviewed_by_idx on public.verification_requests (reviewed_by);

create trigger verification_requests_set_updated_at
  before update on public.verification_requests
  for each row execute function private.set_updated_at();

alter table public.organisations enable row level security;
alter table public.organisation_roles enable row level security;
alter table public.verification_requests enable row level security;
revoke all on public.organisations, public.organisation_roles, public.verification_requests
  from anon, authenticated;
