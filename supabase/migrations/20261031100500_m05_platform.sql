-- M05: platform roles and audit log.
-- Bootstrap, the deferred exactly-one-owner check and append-only enforcement
-- arrive with BEL-0203/0205. backend_schema.md 4.23, 4.24.

create table public.platform_roles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  role text not null,
  assigned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_roles_role_check check (role in ('owner', 'admin', 'moderator'))
);

create unique index platform_roles_single_owner_key
  on public.platform_roles (role) where role = 'owner';
create index platform_roles_assigned_by_idx on public.platform_roles (assigned_by);

create trigger platform_roles_set_updated_at
  before update on public.platform_roles
  for each row execute function private.set_updated_at();

-- resource_id is historical attribution, deliberately not a foreign key.
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action varchar(100) not null,
  resource_type varchar(60) not null,
  resource_id uuid,
  correlation_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_check check (action ~ '\S'),
  constraint audit_logs_resource_type_check check (resource_type ~ '\S'),
  constraint audit_logs_metadata_check check (private.is_bounded_object(metadata, 16384))
);

create index audit_logs_created_idx on public.audit_logs (created_at, id);
create index audit_logs_actor_idx on public.audit_logs (actor_id);
create index audit_logs_resource_idx on public.audit_logs (resource_type, resource_id);
create index audit_logs_correlation_idx on public.audit_logs (correlation_id);

alter table public.platform_roles enable row level security;
alter table public.audit_logs enable row level security;
revoke all on public.platform_roles, public.audit_logs from anon, authenticated;
