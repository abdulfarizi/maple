# M-ID v36-6 · YouTube: album covers, audio only, working lyrics + manual lyric search

**Why there was never any cover/icon on YouTube tracks**
- The artwork allow-list in `maple-collections.js` had a regex bug: the YouTube thumbnail alternative ended with `$` and was then followed by more pattern, so it could never match. Every YouTube cover was thrown away. Fixed.

**Album covers from the song title**
- `/api/yt-meta` now cleans the YouTube title ("Artist - Song (Official Video) (4K Remaster)" → Rick Astley / Never Gonna Give You Up), looks it up on iTunes (then Deezer; no API keys) and returns the album cover plus the clean song/artist name. Falls back to the video thumbnail.
- New shared helper `api/_cover.mjs`. Cover hosts allowed: `is*-ssl.mzstatic.com` (iTunes), `*cdn-images.dzcdn.net` (Deezer).
- Session cache key bumped to `mx:yt2:` so old cached (cover-less) results aren't reused.

**Audio only**
- The YouTube player is now kept out of sight (still driven by our play/pause/seek). It only appears as a fallback if a browser refuses to start playback without a tap inside it.

**Lyrics**
- Lyrics clean-title candidates now start from the iTunes/Deezer song name, so well-known songs match.
- LRCLIB is tried directly and, if the browser can't reach it, through the new `/api/lyrics` proxy.
- **Manual search**: a Search button in the Lyrics header (and on the "no lyrics" / "looking up" messages) opens title + artist fields, lists matches (marks time-synced ones) and lets you pick the right one. The pick is remembered for that track.

Cache-busters: maple-player.js ?v=9, maple-player.css ?v=5, maple-collections.js ?v=5, index-maple1.js ?v=22.
No new env vars or SQL.
