-- M10: organisation follows, independent of user_follows; mandatory before the
-- Following feed. Feed queries arrive with P08. backend_schema.md 4.26.

create table public.organisation_follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, organisation_id)
);

create index organisation_follows_organisation_idx
  on public.organisation_follows (organisation_id, created_at desc, follower_id);
create index organisation_follows_follower_idx
  on public.organisation_follows (follower_id, created_at desc, organisation_id);

alter table public.organisation_follows enable row level security;
revoke all on public.organisation_follows from anon, authenticated;
