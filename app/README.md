# App

Home for app-owned runtime code and release evidence.

## Contents

- `src/` - Next.js routes, API routes, UI, app libraries, and unit tests.
- `public/` - Runtime public assets served by the app.
- `releases/` - Release notes, screenshots, evidence, and release canon.
- `next.config.ts`, `postcss.config.mjs`, `tsconfig.json` - app build config.

Do not add local research scripts, generated reports, services, or Playwright
tests under `app/`. Use root `engine/`, `automation/`, or `archive/` according
to [docs/REPO_STRUCTURE.md](../docs/REPO_STRUCTURE.md).

## Library Boundary

`app/src/lib/` is for app runtime read models, UI/API helpers, release/canon
helpers, and app-owned tests. It is not the owner of institutional research
truth.

Forward research contracts, evaluators, hashes, local price adapters, and
warehouse helpers live under `engine/src/` and are imported through `@engine/*`
when the app needs a stable read-only adapter.

`app/src/lib/research/` currently contains only deprecated app research UI/API
support code. It must not be used as the forward backtest engine.
