# App

Target home for the Limni application workspace.

This folder is intentionally a staging manifest for now. Runtime Next.js files
still live at the repo root (`src/`, `public/`, `tests/`, and related root
config) because moving them requires a dedicated build-system migration gate.

## Target Contents

Future app gates may move or map:

- `src/`
- `public/`
- app-facing tests
- app-facing scripts
- app-facing reports and research that are active product inputs

Do not move runtime app folders here without updating Next.js, TypeScript,
package scripts, imports, tests, and deployment config in the same gate.
