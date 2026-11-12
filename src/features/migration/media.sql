-- ==============================================================================
-- Tabula — Media
-- ------------------------------------------------------------------------------
-- The bucket that holds the images published with an insight.
--
-- The bucket is public: an insight is public, and its images have to load
-- without a session. Writing is restricted to administrators.
--
-- Requires: accounts.sql, roles.sql
-- ==============================================================================


-- ------------------------------------------------------------------------------
-- The bucket
-- ------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-media',
  'post-media',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- ------------------------------------------------------------------------------
-- Policies
-- ------------------------------------------------------------------------------
drop policy if exists "Post media is publicly readable" on storage.objects;
create policy "Post media is publicly readable"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'post-media');

drop policy if exists "Admins can upload post media" on storage.objects;
create policy "Admins can upload post media"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'post-media' and public.is_admin());

drop policy if exists "Admins can update post media" on storage.objects;
create policy "Admins can update post media"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'post-media' and public.is_admin())
  with check (bucket_id = 'post-media' and public.is_admin());

drop policy if exists "Admins can delete post media" on storage.objects;
create policy "Admins can delete post media"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'post-media' and public.is_admin());
