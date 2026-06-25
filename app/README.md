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
