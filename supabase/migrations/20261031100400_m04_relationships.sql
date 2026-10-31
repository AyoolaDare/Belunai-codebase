-- M04: user follows, canonical friendships and blocks.
-- Pair locking and block cleanup operations arrive with P05.
-- backend_schema.md 4.5, 4.6, 4.7.

create table public.user_follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint user_follows_distinct_check check (follower_id <> following_id)
);

create index user_follows_following_idx
  on public.user_follows (following_id, created_at desc, follower_id);
create index user_follows_follower_idx
  on public.user_follows (follower_id, created_at desc, following_id);

-- One row per unordered pair; UUID ordering defines low < high.
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_low_id uuid not null references public.profiles (id) on delete cascade,
  user_high_id uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  status text not null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint friendships_pair_key unique (user_low_id, user_high_id),
  constraint friendships_order_check check (user_low_id < user_high_id),
  constraint friendships_requested_by_check check (requested_by in (user_low_id, user_high_id)),
  constraint friendships_status_check check (status in ('pending', 'accepted', 'declined')),
  constraint friendships_responded_check check ((status = 'pending') = (responded_at is null))
);

create index friendships_low_status_idx
  on public.friendships (user_low_id, status, updated_at desc, id);
create index friendships_high_status_idx
  on public.friendships (user_high_id, status, updated_at desc, id);
create index friendships_requested_by_idx on public.friendships (requested_by, status);

create trigger friendships_set_updated_at
  before update on public.friendships
  for each row execute function private.set_updated_at();

create table public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_distinct_check check (blocker_id <> blocked_id)
);

create index user_blocks_blocked_idx on public.user_blocks (blocked_id, blocker_id);

alter table public.user_follows enable row level security;
alter table public.friendships enable row level security;
alter table public.user_blocks enable row level security;
revoke all on public.user_follows, public.friendships, public.user_blocks from anon, authenticated;
