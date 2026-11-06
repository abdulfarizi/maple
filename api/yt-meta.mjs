// /api/yt-meta?url=<youtube link>  →  { id, url, title, artist, songTitle, songArtist, album, cover, art }
// Uses YouTube's public oEmbed endpoint on the server (the browser can't call it: no CORS). No API key needed.
// Then looks the song up on iTunes / Deezer for its album cover and clean name (art = album cover if found, else the video thumbnail).
import { findCover } from "./_cover.mjs";
const ID = /^[A-Za-z0-9_-]{11}$/;
function parse(raw) {
  const s = String(raw || "").trim();
  if (ID.test(s)) return s;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : "https://" + s);
    const h = u.hostname.replace(/^(www\.|m\.|music\.)/, "");
    if (h === "youtu.be") return ID.test(u.pathname.slice(1, 12)) ? u.pathname.slice(1, 12) : "";
    if (h === "youtube.com" || h === "youtube-nocookie.com") {
      if (ID.test(u.searchParams.get("v") || "")) return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/);
      if (m) return m[1];
    }
  } catch {}
  return "";
}
export async function GET(request) {
  const id = parse(new URL(request.url).searchParams.get("url"));
  const send = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": status === 200 ? "public, s-maxage=86400" : "no-store" } });
  if (!id) return send(400, { error: "Not a YouTube link." });
  const url = "https://www.youtube.com/watch?v=" + id;
  try {
    const r = await fetch("https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent(url));
    if (!r.ok) return send(r.status === 404 || r.status === 401 ? 404 : 502, { error: "That video isn't available or can't be embedded." });
    const d = await r.json();
    const author = String(d.author_name || "").replace(/\s*-\s*Topic$/i, "").replace(/VEVO$/i, "");
    const c = await findCover(String(d.title || ""), author).catch(() => null);
    return send(200, {
      id, url, title: String(d.title || ""), artist: author,
      songTitle: c ? c.title : "", songArtist: c ? c.artist : "", album: c ? c.album : "", durationMs: c ? c.durationMs : 0,
      cover: c ? c.art : "", art: c ? c.art : "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg", source: "oembed",
    });
  } catch {
    return send(502, { error: "Couldn't reach YouTube." });
  }
}
