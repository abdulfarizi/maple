# M-ID v36-9 · glass layout: no "click to enter", star zoom opens it by itself

- The Glass slides layout no longer shows the "click to enter" screen. Nothing to press.
- Instead it opens with the same hollow-star zoom as the card intro: the star pops in, holds a beat, then zooms and spins until the slides are revealed (about 1.7 s). The slides, dots and counter fade in as it opens.
- The star uses the profile's accent colour and the current Light/Dark background.
- Music still starts by itself (profile autoplay from v36-7); the old tap used to be what started it.
- Reduced-motion visitors and the Studio preview skip the animation and see the deck straight away.
- Safety: the overlay is removed after 4 s at most, so it can never get stuck.

Files: assets/maple-deck.js ?v=9, assets/maple-deck.css ?v=9 (index.html). No env vars or SQL.

## v36-9b · autoplay without a tap
- Music now starts by itself on every profile, with nothing to press. If the browser refuses sound (it only allows it after a touch), the song starts **muted** and the **first touch anywhere turns the sound on**, in time with the song. Works for uploaded songs and YouTube; Spotify links can only start after a tap (a Spotify rule).
- Pressing play/pause yourself always gives sound and stops the automatic behaviour for that song.
- maple-player.js ?v=15.
