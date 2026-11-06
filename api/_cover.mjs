// Shared helpers: clean a YouTube title, then look the song up on iTunes (then Deezer) for its album cover.
// Both are free and need no API key.
const NOISE = /official|lyric|video|audio|visuali[sz]er|\bm\/?v\b|\bhd\b|\b4k\b|remaster|full (song|version)|explicit|karaoke|sub(title)?s?\b|\bcc\b/i;
export function tidy(s) {
  return String(s || "")
    .replace(/[\(\[\{【「『][^\)\]\}】」』]*[\)\]\}】」』]/g, (m) => (NOISE.test(m) ? "" : m))
    .replace(/\s*[|｜•·].*$/, "")
    .replace(/\b(official\s+(music\s+)?(video|audio)|lyric\s+video|lyrics?\s+video|music\s+video|lyrics?)\b/gi, "")
    .replace(/\s+/g, " ").replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, "").trim();
}
const norm = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const j = async (u) => { const r = await fetch(u, { headers: { Accept: "application/json" } }); if (!r.ok) throw new Error(String(r.status)); return r.json(); };

// "Artist - Title" → candidate pairs, best first
export function candidates(title, author) {
  const t = tidy(title), a = tidy(String(author || "").replace(/\s*-\s*Topic$/i, "").replace(/VEVO$/i, "")).trim();
  const out = [], seen = new Set();
  const add = (ti, ar) => { ti = (ti || "").replace(/\s*[\(\[]?\s*(feat|ft|featuring)\.?\s+[^\)\]]*[\)\]]?\s*$/i, "").trim(); ar = (ar || "").trim(); if (!ti) return; const k = (ti + "|" + ar).toLowerCase(); if (seen.has(k)) return; seen.add(k); out.push({ title: ti, artist: ar }); };
  const m = t.match(/^(.+?)\s+[-–—~]\s+(.+)$/);
  if (m) { add(m[2], m[1]); add(m[1], m[2]); }
  add(t, a);
  add(t, "");
  return out;
}
const big = (u) => String(u || "").replace(/\/\d+x\d+(bb)?\.(jpg|png)$/i, "/600x600bb.jpg");

async function itunes(c) {
  const d = await j("https://itunes.apple.com/search?media=music&entity=song&limit=8&term=" + encodeURIComponent((c.artist + " " + c.title).trim()));
  const want = norm(c.title);
  const list = (d.results || []).filter((x) => x.artworkUrl100 && x.trackName);
  const hit = list.find((x) => norm(x.trackName) === want && (!c.artist || norm(x.artistName).includes(norm(c.artist)) || norm(c.artist).includes(norm(x.artistName))))
    || list.find((x) => norm(x.trackName).startsWith(want) && (!c.artist || norm(x.artistName).includes(norm(c.artist))));
  return hit ? { art: big(hit.artworkUrl100), title: hit.trackName, artist: hit.artistName, album: hit.collectionName || "", durationMs: hit.trackTimeMillis || 0 } : null;
}
async function deezer(c) {
  const q = c.artist ? `artist:"${c.artist}" track:"${c.title}"` : c.title;
  const d = await j("https://api.deezer.com/search?limit=6&q=" + encodeURIComponent(q));
  const want = norm(c.title);
  const hit = (d.data || []).find((x) => norm(x.title) === want || norm(x.title_short) === want) || null;
  return hit && hit.album && hit.album.cover_big ? { art: hit.album.cover_big, title: hit.title_short || hit.title, artist: hit.artist && hit.artist.name || "", album: hit.album.title || "", durationMs: (hit.duration || 0) * 1000 } : null;
}
// → { art, title, artist, album, durationMs } or null
export async function findCover(title, author) {
  for (const c of candidates(title, author).slice(0, 3)) {
    for (const fn of [itunes, deezer]) { try { const r = await fn(c); if (r) return r; } catch {} }
  }
  return null;
}
