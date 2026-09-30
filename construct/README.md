# construct ANALYST — the site

A one-page site for [construct-analyst](https://github.com/mfurlong64/construct-analyst),
with the published boards embedded live as the primary demo.

- `index.html` — the page. No build step, no framework, no CDN beyond two Google Fonts.
- `demos/` — the boards themselves, copied verbatim from `construct-analyst/reports/`.
  Each is one self-contained file; the 3D pages carry their renderer and data inline.
- `shots/` — screenshots of those boards, taken with `construct-analyst/tools/shot.py`.

Open `index.html` directly, or serve the folder with any static server.
Every number on the page was measured on `main` the day the site was built
(932 tests, 51 modules, the terminal captures are real stdout).
