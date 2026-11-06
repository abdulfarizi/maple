// /api/album-tracks?url=<spotify album/playlist or youtube playlist link>
//   -> { kind, title, tracks: [{ url, title, artist, art, durationMs }] }
// Lets the Studio turn an album or playlist link into separate songs ("one by one").
// Spotify needs SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET (already used by /api/spotify-meta).
// YouTube playlists need a free YOUTUBE_API_KEY (YouTube Data API v3, "playlistItems.list").
import { appToken } from "./_spotify-core.mjs";

const SP = /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z]{2,5}\/)?(?:embed\/)?(album|playlist)\/([A-Za-z0-9]{22})/i;
const MAX = 50;
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": status === 200 ? "public, s-maxage=3600" : "no-store" } });

async function spotifyList(kind, id) {
  const cid = process.env.SPOTIFY_CLIENT_ID, secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!cid || !secret) return json(501, { error: "Splitting Spotify albums needs SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET set on the server." });
  const t = await appToken(cid, secret);
  const h = { Authorization: "Bearer " + t };
  if (kind === "album") {
    const r = await fetch(`https://api.spotify.com/v1/albums/${id}`, { headers: h });
    if (!r.ok) return json(r.status === 404 ? 404 : 502, { error: "Spotify did not return that album." });
    const d = await r.json(), art = (d.images && d.images[0] && d.images[0].url) || "";
    let items = (d.tracks && d.tracks.items) || [], next = d.tracks && d.tracks.next;
    while (next && items.length < MAX) { const n = await fetch(next, { headers: h }); if (!n.ok) break; const nd = await n.json(); items = items.concat(nd.items || []); next = nd.next; }
    return json(200, { kind, title: d.name || "", tracks: items.slice(0, MAX).filter((x) => x && x.id).map((x) => ({ url: "https://open.spotify.com/track/" + x.id, title: x.name || "", artist: (x.artists || []).map((a) => a.name).join(", "), art, durationMs: x.duration_ms || 0 })) });
  }
  const fields = "items(track(id,name,duration_ms,artists(name),album(images))),next";
  let url = `https://api.spotify.com/v1/playlists/${id}/tracks?limit=${MAX}&fields=${encodeURIComponent(fields)}`, out = [];
  const meta = await fetch(`https://api.spotify.com/v1/playlists/${id}?fields=name`, { headers: h }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  while (url && out.length < MAX) {
    const r = await fetch(url, { headers: h });
    if (!r.ok) return json(r.status === 404 || r.status === 403 ? 404 : 502, { error: "Spotify did not return that playlist (private or Spotify-made playlists can't be read)." });
    const d = await r.json();
    out = out.concat((d.items || []).map((i) => i && i.track).filter((x) => x && x.id));
    url = d.next;
  }
  return json(200, { kind, title: meta.name || "", tracks: out.slice(0, MAX).map((x) => ({ url: "https://open.spotify.com/track/" + x.id, title: x.name || "", artist: (x.artists || []).map((a) => a.name).join(", "), art: (x.album && x.album.images && x.album.images[0] && x.album.images[0].url) || "", durationMs: x.duration_ms || 0 })) });
}

async function youtubeList(list) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return json(501, { error: "Splitting YouTube playlists needs a YOUTUBE_API_KEY set on the server (free, YouTube Data API v3)." });
  const base = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,status&maxResults=${MAX}&playlistId=${encodeURIComponent(list)}&key=${encodeURIComponent(key)}`;
  const r = await fetch(base);
  if (!r.ok) return json(r.status === 404 ? 404 : 502, { error: "YouTube did not return that playlist (it may be private)." });
  const d = await r.json();
  const tracks = (d.items || []).filter((i) => i.snippet && i.snippet.resourceId && i.snippet.resourceId.videoId && i.snippet.title !== "Private video" && i.snippet.title !== "Deleted video").map((i) => {
    const s = i.snippet, id = s.resourceId.videoId;
    return { url: "https://www.youtube.com/watch?v=" + id, title: s.title || "", artist: String(s.videoOwnerChannelTitle || s.channelTitle || "").replace(/\s*-\s*Topic$/i, "").replace(/VEVO$/i, ""), art: "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg", durationMs: 0 };
  });
  return json(200, { kind: "youtube-playlist", title: "", tracks });
}

export async function GET(request) {
  const raw = new URL(request.url).searchParams.get("url") || "";
  try {
    const m = raw.trim().match(SP);
    if (m) return await spotifyList(m[1].toLowerCase(), m[2]);
    const u = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : "https://" + raw.trim());
    const h = u.hostname.replace(/^(www\.|m\.|music\.)/, "");
    const list = u.searchParams.get("list") || "";
    if ((h === "youtube.com" || h === "youtu.be") && /^[A-Za-z0-9_-]{10,60}$/.test(list)) return await youtubeList(list);
  } catch {}
  return json(400, { error: "Use a Spotify album or playlist link, or a YouTube playlist link." });
}
