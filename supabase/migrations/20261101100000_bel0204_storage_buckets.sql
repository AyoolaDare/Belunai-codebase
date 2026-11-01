-- BEL-0204: six private Storage buckets (backend_schema.md section 9).
--
-- No policies are created on storage.objects or storage.buckets, so the API
-- roles cannot list, read, upload, upsert, move, delete or edit metadata of any
-- object directly. Every transfer goes through server code that checks current
-- authorisation first: uploads use a short-lived signed upload grant for a
-- reserved, registered key; reads stream through a private, no-store route.
--
-- Limits match section 2.1: still JPEG/PNG/WebP only, at most 10 MiB. Pixel
-- limits and re-encoding are enforced by server inspection before an object
-- is marked ready (src/lib/storage/inspect.ts).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('profile-assets', 'profile-assets', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('organisation-assets', 'organisation-assets', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('community-assets', 'community-assets', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('post-images', 'post-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('verification-evidence', 'verification-evidence', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('moderation-evidence', 'moderation-evidence', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
