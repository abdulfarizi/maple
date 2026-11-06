# M-ID v36-10 · Glass slides: real Light/Dark, see-through audio player, Studio scrolls again

- **Studio can scroll again.** Cause: the pane rules for the Glass layout (`:has(.dk-deck)`) also matched the Studio, because the Studio holds the small Glass preview. The Studio got `overflow:hidden` and lost its spacers. They now only match a pane that holds the real full-screen deck.
- **Light / Dark now changes the whole Glass layout** (before, only the header and nav changed). Light = cream background, dark text, white glass cards, darker floating shapes. Dark = unchanged. Every card style (outline, solid, neon, tinted, glass) has a light version.
- **Audio player card is much more transparent** in both modes: 2.5 % tint, light 3 px blur, hairline edge, no shadow.
- **Lyrics readable in light mode**: dark text with a soft light halo; the current line uses the accent colour. Dark mode gets a soft dark shadow and slightly brighter upcoming lines.
- Floating particles recolour when you switch mode (the white ones would have vanished on light).

Files: assets/maple-deck.css ?v=10, assets/maple-deck.js ?v=10 (index.html). No env vars or SQL.

## v36-10b · lyrics clearer in light mode (from the screen recording)
- Glass slides player: the soft white glow behind the lyrics made them look washed out on the light background. Removed. Idle lines are now 58 % ink, the next line 78 %, the current line is bold and dark with a hint of the accent.
- Full-screen "Now playing" sheet: idle lyric lines were only 34 % ink, so almost invisible in light mode. Now 60 % in light mode (50 % in dark), current line full ink.
- Files: assets/maple-deck.css ?v=11, assets/maple-player.css ?v=7 (index.html).

## v36-10c/d/e · Light ↔ Dark: circle reveal kept, but lighter
- The circle reveal that grows from the button is back on every layout (the deck fade and the instant swap were removed again).
- Lighter: reveal is 0.42 s instead of 0.62 s; the button no longer gets its own extra live layer; all CSS animations are paused while it runs; the Glass deck's particle canvas skips redrawing during the switch.
- Files: assets/maple-mode.js ?v=6, assets/maple-mode.css ?v=3, assets/maple-deck.js ?v=11 (index.html, owner/index.html).
