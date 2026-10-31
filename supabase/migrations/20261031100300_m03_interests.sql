-- M03: curated interest taxonomy and private profile selections.
-- The 20-selection limit is enforced under a profile lock by the selection
-- operation (BEL-0401). backend_schema.md 4.3, 4.4.

create table public.interests (
  id uuid primary key default gen_random_uuid(),
  slug varchar(60) not null,
  name varchar(80) not null,
  description varchar(300),
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint interests_slug_key unique (slug),
  constraint interests_slug_check check (private.is_slug(slug, 60)),
  constraint interests_name_check check (name ~ '\S'),
  constraint interests_description_check check (description ~ '\S'),
  constraint interests_display_order_check check (display_order >= 0)
);

create index interests_active_order_idx on public.interests (is_active, display_order, id);

create table public.profile_interests (
  user_id uuid not null references public.profiles (id) on delete cascade,
  interest_id uuid not null references public.interests (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, interest_id)
);

create index profile_interests_interest_user_idx on public.profile_interests (interest_id, user_id);

alter table public.interests enable row level security;
alter table public.profile_interests enable row level security;
revoke all on public.interests, public.profile_interests from anon, authenticated;
