# M-ID v36-1 · tab fix, YouTube player, automatic lyrics

**Fixed: Home and Explore couldn't be opened after a Glass slides card was shown**
- The Glass slides layout was `position:fixed` over the whole screen, so it stayed on top of the Home and Explore panes. It now lives inside its own pane (card or Profile), so the dock, swiping and arrow keys work again. Keyboard slide navigation also pauses while another pane is on screen.

**Music player**
- **YouTube links**: paste a YouTube link (watch, youtu.be, shorts, music.youtube.com) as the Featured track or in Music I like. Plays through YouTube's official player (the video shows in the expanded player) with the same play/pause, ±10 s and seek controls. Title, channel and thumbnail are filled in automatically (new `/api/yt-meta` function, no API key needed).
- **Automatic lyrics** for every source (Spotify, YouTube, uploads), on by default; switch off in Studio → Music. Titles are cleaned of "(Official Video)", "[Lyrics]", "feat. …", "- Topic" etc., "Artist - Title" is split, and LRCLIB is tried with several fallbacks (exact match, fuzzy search, title only), preferring time-synced lyrics.
- **Uploads**: MP3 title, artist and embedded cover art are read from the file's ID3 tags automatically.
- Uploads still need `supabase_songs.sql` run once (same as before). No other database change.
- Star cards: a YouTube featured track plays in the bottom player (the star card's own inline player is Spotify-only).
- **Private messages**: the conversation's message bar now sits at the very bottom of the screen. A later style capped the chat at 52% of the screen height and left a blank gap under the bar (maple-m.css).
- **Private messages (blank space, follow-up)**: the earlier fix was in `maple-m.css`, but the page still loaded it as `?v=2`, so phones kept the cached old file. Bumped `maple-m.css` to `?v=3` and `maple-forum.js` to `?v=5`. The 52vh cap in `maple-forum.js` now excludes the conversation view (`.fm-chat.fm-th-chat`), and `.fm-th` has a `100vh` fallback before `100dvh`.
- **Star card: two players + missing lyrics**: the card showed a "now playing" strip and the big Audio Player section at once; the strip is gone, so there is one player. Lyrics were hidden unless `lyrics` was explicitly `true` on the profile (the bottom player treats a missing value as on), so they never appeared for most profiles. Now they show unless switched off in Studio → Music. `maple-stack.js` is `?v=4` in `owner/index.html`.
- **Spotify-style Audio Player + "Your songs" (v36-3)**: styled after the MIT-licensed PradeepTiwarii/Spotify-Clone (flat dark surface, white round play button, green progress on hover/touch). New **Your songs** section under the player: a Spotify-style list of the card's uploaded MP3s (featured upload + uploads in Music I like), with hover play, green current row and an equalizer while playing. Uploaded songs no longer repeat in the Music I like grid. Needs no Spotify. `maple-stack.js ?v=5`, `maple-stack.css ?v=4`.
- **v36-5 · profile music = YouTube link or uploaded file; albums one by one**
  - Studio → Featured track: only a YouTube link or an uploaded song (Spotify links are refused with a message; an existing Spotify value is left untouched until the owner changes it).
  - Music I like still accepts Spotify and YouTube links, and now splits **albums and playlists into separate songs** (Spotify albums/playlists, YouTube playlists). Existing album rows get a **Split into songs** button.
  - On the card, Music I like is a one-by-one list (Spotify-Clone style rows, first 8 shown + "Show all"). The separate "Your songs" block from v36-4 is merged into it.
  - New `/api/album-tracks`. Needs `SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET` (already used by spotify-meta) for Spotify, and a free `YOUTUBE_API_KEY` (YouTube Data API v3) for YouTube playlists. Without them the Studio says so; a Spotify album is then kept as one entry with a Split button for later.
  - Cache-busters: index-maple1.js ?v=21, maple-studio-x.js ?v=6, maple-stack.js ?v=6, maple-stack.css ?v=5.
