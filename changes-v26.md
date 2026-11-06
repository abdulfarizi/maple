# Maple ID v26

- Forum: profile pictures now show next to every post, comment, alert and message (new `/api/forum/avatars` route in the Supabase bridge, thumbnails cached 6 h).
- New design system: `assets/maple-design.css` (loaded last) + light/dark tokens. Toggle in the top bar, remembered, follows the device until you choose. All 30+ card themes only set accents, so they work in both modes. Owner card follows the mode too.
- New logo and icon set (icon.svg, favicon, 192/512, maskable, Apple icon), new brand mark in the header, updated manifest colours.
- Smoothness: removed the full-screen grain layer, blur on the top bar / dock, per-frame pane fading and layout-based dock highlight; falling-leaf canvas effects stay on (off only for reduced-motion or data-saver) and are capped at 30 fps; forum cards skip off-screen rendering.
- No database changes. Re-upload the folder to Vercel as before.
