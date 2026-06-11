# Cleanup Ledger

Status: current as of 2026-06-11.

This ledger is for cleanup classification and gate history. It is not proof that
app behavior is correct.

## Current Root Model

Committed visible root folders are:

- `archive/`
- `app/`
- `database/`
- `docs/`
- `poseidon/`
- `config/`

Hidden workflow roots `.github/` and `.husky/` remain at root because Git and
GitHub require them. Ignored local roots such as `Local Environment/` and
`node_modules/` are not repo truth.

## Gate 23 Root Compression

Moved app-owned folders under `app/`:

- `src/` -> `app/src/`
- `public/` -> `app/public/`
- `tests/` -> `app/tests/`
- `scripts/` -> `app/scripts/`
- `reports/` -> `app/reports/`
- `research/` -> `app/research/`
- `sports/` -> `app/research/sports/`
- `releases/` -> `app/releases/`
- `services/`, `bots/`, `mt5/`, and `scraper/` -> `app/services/`

Moved database-owned folders under `database/`:

- `db/` -> `database/db/`
- `migrations/` -> `database/migrations/`
- `contracts/` -> `database/contracts/`

Moved inactive archive material under `docs/archive/`.

Gate 27 corrected the archive model: active folders should not each carry local
archive trees. Historical material now belongs under root `archive/`, mirrored by
original repo ownership path. Existing `docs/archive/` was moved to
`archive/docs/`.

Updated package scripts, TypeScript/Vitest/Playwright config, GitHub workflow
paths, Vercel ignores, MT5 hook paths, runtime release/report readers, app
script report outputs, and local cache/data defaults.

## Frozen / Separate Gates

| Path | Rule |
|---|---|
| `app/releases/v2/canon/*.json` | Frozen. Do not regenerate or rewrite without an explicit canon gate. |
| `release-manifest.json` | Root release manifest. Do not rewrite during structure cleanup. |
| `app/scripts/migrate-trades-to-unified-ledger.ts` | Production-sensitive DB mutator; requires a dedicated DB review gate. |
| `.env`, `.env.local` | Root-local toolchain anchors; do not commit secrets. |

## Current Cleanup Rules

- New app code, scripts, reports, research, services, releases, and public assets
  go under `app/`.
- New database schema, migrations, and contracts go under `database/`.
- Durable documentation goes under `docs/`; stale docs go under `archive/docs/`.
- Poseidon profile/control-plane material goes under `poseidon/`.
- Stale material from any active folder goes under root `archive/`, mirroring its
  original ownership path, such as `archive/app/src/` or `archive/config/`.
- Local-only caches, agent state, logs, screenshots, temporary files, and local
  data go under ignored `Local Environment/`.
- Do not create new loose root folders.

## Final Gate Commands

Use the smallest command set that matches the change:

```powershell
git status --short --untracked-files=all
git diff --check -- . ':!app/releases/v2/canon/*.json'
```

For app/tooling changes:

```powershell
npm test
npm run build
```

Use Playwright evidence for browser behavior changes.
