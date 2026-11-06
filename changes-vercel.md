# M-ID · Vercel fix

- Song uploads no longer use Netlify Blobs (`/api/songs`, which can't run on Vercel). Songs and covers now go straight to a Supabase Storage bucket called `song-media`. **Run `supabase_songs.sql` once** in Supabase → SQL editor.
- Added `api/spotify-config.mjs` (it only existed as a Netlify function, so "Connect Spotify" got an HTML page instead of JSON on Vercel).
- `vercel.json`: `/api/*` and `/assets/*` are never rewritten to the app page, and `/spotify-callback` is served explicitly.
- Removed the Netlify-only files (`netlify/`, `netlify.toml`, `@netlify/blobs`, package-lock) so the Vercel build installs nothing it doesn't need.
- Optional env vars (Vercel → Settings → Environment Variables): `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`.
