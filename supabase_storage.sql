-- M-ID · media storage for the feed comments and private messages (pictures, GIFs, video, voice notes).
-- Run once in Supabase → SQL editor. Safe to run again.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('forum-media', 'forum-media', true, 26214400, array[
  'image/jpeg','image/png','image/gif','image/webp',
  'video/mp4','video/webm','video/quicktime',
  'audio/webm','audio/ogg','audio/mp4','audio/x-m4a','audio/mpeg','audio/wav','audio/aac'
])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- anyone can open a link they were sent
drop policy if exists "forum media read" on storage.objects;
create policy "forum media read" on storage.objects
  for select using (bucket_id = 'forum-media');

-- signed-in members can upload, but only into a folder named after their own user id
drop policy if exists "forum media upload" on storage.objects;
create policy "forum media upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'forum-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ... and delete their own files
drop policy if exists "forum media delete own" on storage.objects;
create policy "forum media delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'forum-media' and (storage.foldername(name))[1] = auth.uid()::text);
