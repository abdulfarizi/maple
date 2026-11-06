// Vercel version of /api/spotify-config: tells the player which Spotify app to use for "Connect Spotify".
// The client ID is a public value (Spotify's PKCE flow has no secret). Not set -> the button stays hidden.
export async function GET() {
  return new Response(JSON.stringify({ clientId: process.env.SPOTIFY_CLIENT_ID || "" }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, s-maxage=300" },
  });
}
