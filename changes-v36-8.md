# M-ID v36-8 · transparent player + lyrics, light/dark mode, flicker fix

**Transparent**
- The full-screen player is now see-through glass (a soft tint of the cover art over the page) instead of a solid black page.
- Lyrics have no box at all: transparent, in the Audio Player sheet, the glass-deck Audio Player slide and the star card.

**Light / Dark mode now cover the player**
- The sheet used hard-coded white-on-black colours, so it ignored the mode switch. All its colours (text, buttons, lyrics, search form) now come from the site tokens (--text, --ink, --bg), so Light and Dark both work. The mini bar and the card players follow too.

**Flicker**
- paint() ran on every audio tick and rewrote the note text, title and button each time. It now only writes what changed, and is limited to one repaint per frame.
- The mini bar's pulsing ring was repainting the blur behind it constantly: replaced by a static ring while playing.
- Deck lyrics used filter:blur() on every line (re-rasterised on each line change): removed.
- The bar and sheet are on their own GPU layer; the sheet does no blur while it is off screen; no transitions during the mode swap.

Files: maple-player.js ?v=14, maple-player.css ?v=6, maple-deck.css ?v=8 (index.html), maple-stack.css ?v=7 (owner/index.html). No env vars or SQL.
