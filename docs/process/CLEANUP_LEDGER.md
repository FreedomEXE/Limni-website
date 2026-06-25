# Cleanup Ledger

Status: current as of 2026-06-25.

This ledger is for cleanup classification and gate history. It is not proof that
app behavior is correct.

## Current Root Model

Committed visible root folders are:

- `app/`
- `engine/`
- `automation/`
- `archive/`
- `database/`
- `docs/`
- `poseidon/`
- `config/`

Hidden workflow roots `.github/` and `.husky/` remain at root because Git and
GitHub require them. Ignored local roots such as `Local Environment/`,
`node_modules/`, `engine/data/`, and `engine/reports/` are not repo truth.

## Gate 56 Public / Local Split

Gate 56 reverses the old app-folder pileup:

- `app/` is for app runtime, public assets, release evidence, and app config.
- `engine/` is for reusable local institutional research/backtest work.
- `automation/` is for MT5, bots, sidecars, voice helpers, and Playwright
  automation.
- stale reports, research workspaces, and one-off scripts move under
  `archive/app/...`, mirrored by their original app ownership path.

The old nested reports archive tree was flattened into
`archive/app/reports/legacy/...`. Do not recreate nested archive trees under
active folders.

## Historical Context

Gate 23 compressed many repo folders under `app/`, including scripts, reports,
research, services, and tests. That was useful then, but by Gate 56 it made the
app folder look like the whole repo. Gate 56 is the current ownership model.

Gate 27 corrected the archive model: active folders should not each carry local
archive trees. Historical material belongs under root `archive/`, mirrored by
original repo ownership path.

## Frozen / Separate Gates

| Path | Rule |
|---|---|
| `app/releases/v2/canon/*.json` | Frozen. Do not regenerate or rewrite without an explicit canon gate. |
| `release-manifest.json` | Root release manifest. Do not rewrite during structure cleanup. |
| `.env`, `.env.local` | Root-local toolchain anchors; do not commit secrets. |
| `engine/data/` | Local/cached research data. Ignored unless an explicit data-promotion gate says otherwise. |
| `engine/reports/` | Local generated engine receipts. Ignored unless a gate promotes selected evidence. |

## Current Cleanup Rules

- New app runtime code and public/release assets go under `app/`.
- New reusable research/backtest code goes under `engine/`.
- New MT5, bot, sidecar, voice, or Playwright automation goes under
  `automation/`.
- New database schema, migrations, and contracts go under `database/`.
- Durable documentation goes under `docs/`; stale docs go under `archive/docs/`.
- Poseidon profile/control-plane material goes under `poseidon/`.
- Stale material from any active folder goes under root `archive/`, mirroring its
  original ownership path.
- Local-only caches, agent state, logs, screenshots, temporary files, and local
  data go under ignored `Local Environment/` or ignored engine data/report
  folders.
- Do not create new loose root folders.

## Final Gate Commands

Use the smallest command set that matches the change:

```powershell
git status --short --untracked-files=all
git diff --check -- . ':!app/releases/v2/canon/*.json'
```

For app/tooling changes:

```powershell
npx tsc --noEmit --project app/tsconfig.json --pretty false
npm run build
```

Use Playwright evidence for browser behavior changes.
