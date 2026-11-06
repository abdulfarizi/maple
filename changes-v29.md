# M-ID v29 · fix: file upload and voice notes

Cause: `/api/uploads` in index.html only knew how to shrink card images into a data link. Pictures, GIFs, video and voice notes from the feed comments and private messages need a real https link, so every upload failed.

Fix:
- index.html: `/api/uploads?kind=forum-img|forum-vid|forum-aud` now uploads the file to Supabase Storage (bucket `forum-media`, into a folder named after the member's id) and returns its public link. Checks login, file type and size (picture 3 MB, video 25 MB, voice note 8 MB). Clear messages if storage is not set up.
- NEW supabase_storage.sql: creates the public `forum-media` bucket with the allowed types, plus policies (anyone can view, members upload only into their own folder).

**You must run supabase_storage.sql once** in Supabase → SQL editor, then re-upload the folder to Vercel. No other change.
