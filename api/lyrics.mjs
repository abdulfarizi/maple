// /api/lyrics?p=<lrclib path>  →  LRCLIB response, proxied through the server (used when the browser can't reach lrclib.net directly)
// Only "get?…" and "search?…" are allowed.
export async function GET(request) {
  const p = new URL(request.url).searchParams.get("p") || "";
  const send = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": status === 200 ? "public, s-maxage=3600" : "no-store" } });
  if (!/^(get|search)\?[^#]{1,400}$/.test(p)) return send(400, { error: "Bad request." });
  try {
    const r = await fetch("https://lrclib.net/api/" + p, { headers: { "User-Agent": "M-ID (https://github.com/) lyrics proxy" } });
    if (r.status === 404) return send(404, null);
    if (!r.ok) return send(502, { error: "LRCLIB " + r.status });
    return send(200, await r.json());
  } catch {
    return send(502, { error: "Couldn't reach LRCLIB." });
  }
}
