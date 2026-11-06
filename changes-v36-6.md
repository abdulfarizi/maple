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

## v36-6b · lyrics follow-up
- **The "probe" text** in the Audio Player slide was the song's note (Studio), which the slide showed whenever lyrics hadn't loaded. With lyrics on it now shows the real status ("Finding lyrics…", "No lyrics found…") with a **Search lyrics manually** button; the note only shows if lyrics are switched off.
- **Junk lyrics filtered**: LRCLIB (a community database) contains test entries like a single word; lyrics with fewer than 25 words, or a length >20 s away from the song, are ignored.
- **Manual search** also available from the Sections Audio Player slide and the star card (opens the player's search panel).
- **Covers for "Music I like"** rows/cards that were saved without one are filled in automatically (iTunes/Deezer).
- Cache-busters: maple-player.js ?v=10, maple-collections.js ?v=6, maple-deck.js ?v=8, maple-deck.css ?v=7, maple-stack.js ?v=7, maple-stack.css ?v=6.

## v36-6c · choose lyrics in Studio
- **Studio → Music → Featured track → "Lyrics for the featured track"**: search LRCLIB by title/artist (pre-filled from the song), pick the right result (time-synced ones are marked), or **paste your own lyrics**. Press Publish to save. A "Remove" button goes back to automatic lookup.
- The choice is saved on the profile as `lyricsFix` and is used for every visitor, before the automatic lookup. It is tied to the featured track (YouTube link or pinned upload); if you change the featured track, Studio warns that the saved lyrics belong to the old one.
- The "Lyrics" toggle still switches lyrics off completely (Studio warns about this).
- Cache-busters: maple-studio-x.js ?v=7, maple-player.js ?v=11, maple-collections.css ?v=3, index-maple1.js ?v=23.
