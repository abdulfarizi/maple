# Maple ID v27

- Login / sign-up panel now has a proper light mode (it was painted with fixed dark colours).
- Light/dark switch: the new look grows as a circle out of the button you tap (View Transitions; instant swap on browsers without it or with reduced motion).
- Studio flicker fixed: one atomic swap with transitions off, and the switch no longer touches `<html style>` (that re-seeded the falling-leaf canvas on every switch).
- Card (owner/star card) has its own light/dark button and a private-message button left of Studio; it hands the switch to the top page so everything animates together.
- Header is now: menu · brand · … · private messages · Studio · mode switch. Everything else is in the slide-out menu (Feed/Home, Explore, My card, Profile, Studio, Alerts, Reports for admins, Owner, Log in/out). New files: maple-shell.js/.css, maple-mode.css.
- Forum home is just the Feed. Messages, alerts and reports open from the header button / menu and each has a "Feed" button back. Post actions: Message stays visible, Report/Pin/Delete sit behind "…".
- `/?pm=1` opens the inbox. No database changes. Re-upload the folder to Vercel as before.
