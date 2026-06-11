# Public

Runtime public assets served by the Next.js app.

## Contents

| Path | Purpose |
|---|---|
| `brand/` | Brand assets. |
| `downloads/` | Downloadable runtime artifacts. |
| `scalp-bot/` | Public scalp-bot assets excluded from Vercel upload. |
| `*.svg` | App-visible static SVG assets. |

## Rules

- Only assets served by the app belong here.
- Do not use this folder for scratch screenshots, reports, or evidence.
- Future move target is `app/public/`, but only in an app build-system
  migration gate.
