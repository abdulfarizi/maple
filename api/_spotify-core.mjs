// Shared by the Netlify function (netlify/functions/spotify-meta.mjs) and the Vercel function (api/spotify-meta.mjs).
const LINK = /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z]{2,5}\/)?(?:embed\/)?(track|album|playlist|episode)\/([A-Za-z0-9]{22})/i;
let token = { v: "", exp: 0 };

export async function appToken(id, secret) {
  if (token.v && token.exp > Date.now() + 30000) return token.v;
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + Buffer.from(id + ":" + secret).toString("base64") },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) throw new Error("token");
  const d = await r.json();
  token = { v: d.access_token, exp: Date.now() + (d.expires_in || 3600) * 1000 };
  return token.v;
}

export async function spotifyMeta(raw, id, secret) {
  const m = String(raw || "").trim().match(LINK);
  if (!m) return { status: 400, body: { error: "Not a Spotify track, album, playlist or episode link." } };
  const type = m[1].toLowerCase(), sid = m[2], url = `https://open.spotify.com/${type}/${sid}`;
  if (id && secret) {
    try {
      const t = await appToken(id, secret);
      const r = await fetch(`https://api.spotify.com/v1/${type}s/${sid}${type === "playlist" ? "?fields=name,owner(display_name),images" : ""}`, { headers: { Authorization: "Bearer " + t } });
      if (r.ok) {
        const d = await r.json();
        const imgs = (d.album && d.album.images) || d.images || (d.show && d.show.images) || [];
        const artist = (d.artists || []).map((a) => a.name).join(", ") || (d.owner && d.owner.display_name) || (d.show && d.show.name) || "";
        return { status: 200, body: { url, type, title: d.name || "", artist, art: (imgs[0] && imgs[0].url) || "", album: (d.album && d.album.name) || "", durationMs: d.duration_ms || 0, source: "spotify-api" } };
      }
    } catch { /* fall through to oEmbed */ }
  }
  try {
    const r = await fetch("https://open.spotify.com/oembed?url=" + encodeURIComponent(url));
    if (!r.ok) return { status: r.status === 404 ? 404 : 502, body: { error: "Spotify did not return details for that link." } };
    const d = await r.json();
    return { status: 200, body: { url, type, title: d.title || "", artist: "", art: d.thumbnail_url || "", durationMs: 0, source: "oembed" } };
  } catch {
    return { status: 502, body: { error: "Spotify could not be reached." } };
  }
}
