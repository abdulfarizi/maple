// Vercel version of /api/spotify-meta (see api/_spotify-core.mjs). Set SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET in Vercel → Settings → Environment Variables.
import { spotifyMeta } from "./_spotify-core.mjs";

export async function GET(request) {
  const url = new URL(request.url).searchParams.get("url") || "";
  const { status, body } = await spotifyMeta(url, process.env.SPOTIFY_CLIENT_ID || "", process.env.SPOTIFY_CLIENT_SECRET || "");
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": status === 200 ? "public, s-maxage=86400" : "no-store" },
  });
}
