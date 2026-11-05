# M-ID v28
- Renamed Maple ID to M-ID (wordmark in Unbounded, titles, manifest, footer). The domain shown on the claim bar follows the address bar, so it becomes m-id.site by itself once you move the domain.
- New homepage intro: "Stop pasting your IDs. Share one link instead."
- Feed: removed the "Feed" heading and the card/button borders. Message is now an envelope icon beside the name; the ... menu is in the top-right corner of each post and opens a small popover.
- Comment button opens a bottom widget with the comments and a bar: + (picture, GIF or video), text, send.
- Private messages: full-screen chat with the message bar fixed to the bottom; + for pictures/GIFs/videos and a mic for voice notes.
- Media is uploaded to /api/uploads and stored as a [[img|vid|aud:https://...]] token at the end of the text. No database change.
- NEEDS CHECKING: /api/uploads is not in this zip. It must accept video/* and audio/* (webm, mp4, ogg) and the kind values forum-img, forum-vid, forum-aud.
