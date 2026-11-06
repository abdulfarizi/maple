# M-ID v36-10 · Glass slides: real Light/Dark, see-through audio player, Studio scrolls again

- **Studio can scroll again.** Cause: the pane rules for the Glass layout (`:has(.dk-deck)`) also matched the Studio, because the Studio holds the small Glass preview. The Studio got `overflow:hidden` and lost its spacers. They now only match a pane that holds the real full-screen deck.
- **Light / Dark now changes the whole Glass layout** (before, only the header and nav changed). Light = cream background, dark text, white glass cards, darker floating shapes. Dark = unchanged. Every card style (outline, solid, neon, tinted, glass) has a light version.
- **Audio player card is much more transparent** in both modes: 2.5 % tint, light 3 px blur, hairline edge, no shadow.
- **Lyrics readable in light mode**: dark text with a soft light halo; the current line uses the accent colour. Dark mode gets a soft dark shadow and slightly brighter upcoming lines.
- Floating particles recolour when you switch mode (the white ones would have vanished on light).

Files: assets/maple-deck.css ?v=10, assets/maple-deck.js ?v=10 (index.html). No env vars or SQL.
