-- M08: posts and post media. Row-local context, visibility and lifecycle
-- rules are CHECKs here. The deferred text-or-ready-image publication check,
-- publishing authority and Storage policies arrive with P02/P07 tasks; the
-- body search index arrives with BEL-1003. backend_schema.md 4.13, 4.14.

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles (id) on delete set null,
  organisation_id uuid references public.organisations (id) on delete restrict,
  community_id uuid references public.communities (id) on delete cascade,
  body varchar(5000),
  visibility text not null,
  status text not null default 'draft',
  published_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_body_check check (body ~ '\S'),
  constraint posts_visibility_check check (visibility in ('public', 'friends', 'community')),
  constraint posts_status_check check (status in ('draft', 'published', 'removed', 'deleted')),
  -- Exactly one of personal, organisation or community context, each with its visibility.
  constraint posts_context_check check (
    (organisation_id is not null and community_id is null and visibility = 'public')
    or (community_id is not null and organisation_id is null and visibility = 'community')
    or (organisation_id is null and community_id is null and visibility in ('public', 'friends'))
  ),
  -- A NULL author is only retained organisation attribution after erasure;
  -- personal and community content must be purged before the author is deleted.
  constraint posts_author_check check (author_id is not null or organisation_id is not null),
  constraint posts_published_check
    check (status <> 'published' or (published_at is not null and deleted_at is null)),
  constraint posts_draft_check check (status <> 'draft' or published_at is null),
  constraint posts_deleted_check check ((status = 'deleted') = (deleted_at is not null))
);

-- Foreign-key indexes (all statuses).
create index posts_author_idx on public.posts (author_id);
create index posts_organisation_idx on public.posts (organisation_id);
create index posts_community_idx on public.posts (community_id);
-- Published timelines.
create index posts_author_published_idx
  on public.posts (author_id, published_at desc, id desc) where status = 'published';
create index posts_organisation_published_idx
  on public.posts (organisation_id, published_at desc, id desc) where status = 'published';
create index posts_community_published_idx
  on public.posts (community_id, published_at desc, id desc) where status = 'published';
create index posts_public_published_idx
  on public.posts (published_at desc, id desc) where status = 'published' and visibility = 'public';

create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function private.set_updated_at();

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  uploaded_by uuid references public.profiles (id) on delete set null,
  bucket_id text not null,
  object_path text not null,
  mime_type text not null,
  byte_size bigint not null,
  width integer not null,
  height integer not null,
  position smallint not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint post_media_object_path_key unique (object_path),
  constraint post_media_post_position_key unique (post_id, position),
  constraint post_media_bucket_check check (bucket_id = 'post-images'),
  constraint post_media_mime_type_check check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  -- Immutable key posts/{post_id}/{media_id}.{extension matching mime type}.
  constraint post_media_object_path_check check (
    object_path = 'posts/' || post_id::text || '/' || id::text || '.'
      || case mime_type
           when 'image/jpeg' then 'jpg'
           when 'image/png' then 'png'
           when 'image/webp' then 'webp'
         end
  ),
  constraint post_media_byte_size_check check (byte_size between 1 and 10485760),
  constraint post_media_dimensions_check
    check (width > 0 and height > 0 and width::bigint * height <= 20000000),
  constraint post_media_position_check check (position between 0 and 3),
  constraint post_media_status_check check (status in ('pending', 'ready'))
);

create index post_media_uploaded_by_idx on public.post_media (uploaded_by);

alter table public.posts enable row level security;
alter table public.post_media enable row level security;
revoke all on public.posts, public.post_media from anon, authenticated;
