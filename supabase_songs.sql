-- M-ID · storage for uploaded songs and their covers (replaces Netlify Blobs, so uploads work on Vercel).
-- Run once in Supabase → SQL editor. Safe to run again.
-- Note: Supabase's free plan caps a single file at 50 MB; 18 MB songs are fine.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('song-media', 'song-media', true, 18874368, array[
  'audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/aac','audio/ogg','audio/webm','audio/wav','audio/x-wav','audio/flac','audio/x-flac',
  'image/jpeg'
])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- anyone can play a song / see a cover
drop policy if exists "song media read" on storage.objects;
create policy "song media read" on storage.objects
  for select using (bucket_id = 'song-media');

-- signed-in members can upload, but only into a folder named after their own user id
drop policy if exists "song media upload" on storage.objects;
create policy "song media upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'song-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ... replace their own cover (upsert) ...
drop policy if exists "song media update own" on storage.objects;
create policy "song media update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'song-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'song-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ... and delete their own files
drop policy if exists "song media delete own" on storage.objects;
create policy "song media delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'song-media' and (storage.foldername(name))[1] = auth.uid()::text);
