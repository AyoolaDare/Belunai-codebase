-- M09: likes, flat comments and private saves. backend_schema.md 4.15–4.17.

create table public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index post_likes_user_idx on public.post_likes (user_id, created_at desc, post_id);

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body varchar(2000) not null,
  status text not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_comments_body_check check (body ~ '\S'),
  constraint post_comments_status_check check (status in ('visible', 'removed', 'deleted'))
);

create index post_comments_post_idx on public.post_comments (post_id, created_at, id);
create index post_comments_author_idx on public.post_comments (author_id, created_at, id);

create trigger post_comments_set_updated_at
  before update on public.post_comments
  for each row execute function private.set_updated_at();

create table public.post_saves (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index post_saves_post_idx on public.post_saves (post_id, user_id);
create index post_saves_user_created_idx on public.post_saves (user_id, created_at desc, post_id);

alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_saves enable row level security;
revoke all on public.post_likes, public.post_comments, public.post_saves from anon, authenticated;
