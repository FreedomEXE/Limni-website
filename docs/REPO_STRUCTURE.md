# Repo Structure

Status: active map. Repo evidence overrides this file when they conflict.

## Root Folders

| Path | Owner / Purpose |
|---|---|
| `app/` | Public app runtime: Next.js routes, UI, app libraries, public assets, release evidence, and app config. |
| `engine/` | Local institutional research/backtest engine workspace. Keep reusable engine code here; generated data and reports stay ignored. |
| `automation/` | MT5 assets, bot workers, sentiment scraper, voice helpers, and Playwright automation. |
| `database/` | Schema, migrations, and data/integration contracts. |
| `docs/` | Durable documentation, process, architecture, and backlog. |
| `poseidon/` | Limni/Poseidon project profile and control-plane notes. |
| `config/` | Config documentation for root-discovered tool files. |
| `archive/` | Historical material mirrored by original repo ownership path. |

Hidden roots `.github/` and `.husky/` are workflow hooks and remain at root.
Ignored local roots such as `Local Environment/` and `node_modules/` are not repo
truth.

## App Folders

| Path | Owner / Purpose |
|---|---|
| `app/src/` | Next.js routes, API routes, UI, app libraries, and unit tests. |
| `app/public/` | Runtime public assets. |
| `app/releases/` | Release history, release evidence, screenshots, release notes, and release canon. |

`app/releases/v2/canon/*.json` remains frozen without an explicit canon gate.
Do not create `app/scripts/`, `app/reports/`, `app/research/`, `app/services/`,
or `app/tests/` again unless a later app-refactor gate explicitly reopens that
ownership decision.

## Engine Folders

| Path | Owner / Purpose |
|---|---|
| `engine/src/cache/` | Runtime cache primitives used by engine research and app compatibility re-exports. |
| `engine/src/contracts/` | Shared non-UI contracts such as asset-class/COT market definitions and week-anchor helpers. |
| `engine/src/evaluation/` | Shared evaluator support such as execution weekly window helpers. |
| `engine/scripts/` | Reusable local research and backtest command entry points. |
| `engine/src/research/` | Research decision manifest contract, shared evaluator, hashing, and append-only run registry. |
| `engine/src/signals/` | Signal-specific source/manifest builders that emit frozen decision manifests before scoring. |
| `engine/src/price/` | Canonical price bars/windows, ADR lookup, path bars, path resolution, and local/cached price adapters such as the SQLite M1 warehouse. |
| `engine/src/warehouse/` | Research matrix and macro regime warehouse helpers. |
| `engine/data/` | Local/cached research data. Ignored by default. |
| `engine/reports/` | Generated local engine receipts and run artifacts. Ignored by default unless a gate explicitly promotes selected evidence. |

Forward research should route frozen decision manifests through:

```powershell
npm run engine:research-manifest:evaluate -- --manifest=<manifest.json>
```

The app is not the institutional research source of truth. App code may consume
stable `@engine/*` contracts or read-only adapters, but evaluator/manifest/run
registry ownership lives in `engine/`.

Current app compatibility paths such as `app/src/lib/canonicalPriceBars.ts`,
`app/src/lib/executionPriceWindows.ts`, and
`app/src/lib/performance/pathBarLoader.ts` are re-exports over `@engine/*`.
Engine code must import the engine-owned paths directly and must not import
`@/lib/*`.

## Automation Folders

| Path | Owner / Purpose |
|---|---|
| `automation/mt5/` | MT5 source, templates, generated MQL contracts, and compiled indicator assets already tracked. |
| `automation/bots/` | OANDA and Bitget bot workers. |
| `automation/sentiment-scraper/` | Sentiment scraper sidecar. |
| `automation/scripts/` | Automation command entry points, such as contract generation and coverage checks. |
| `automation/tests/` | Playwright end-to-end automation. |
| `automation/voice/` | Poseidon voice helper scripts. |

Automation can support the app later, but it is not app runtime ownership.

## Database Folders

| Path | Owner / Purpose |
|---|---|
| `database/db/` | Neutral DB client, root env loader, SQL schema, and database helpers. |
| `database/migrations/` | Durable migrations. |
| `database/contracts/` | Data and integration contracts. |

`database/db/client.ts` owns `getPool`, `query`, `queryOne`, `getClient`, and
`transaction`. App compatibility imports may re-export it through
`app/src/lib/db.ts`, but engine code imports it directly through
`@database/db/client`.

## Workflow And Deploy Anchors

| Path | Anchor |
|---|---|
| `.github/workflows/contract-artifacts-sync.yml` | Watches `database/contracts/**`, `automation/scripts/generate-contracts.ts`, `app/src/lib/mt5/**`, and generated MT5 contract output. |
| `.github/workflows/performance-coverage-nightly.yml` | Runs `npm run performance:coverage:check`. |
| `.github/workflows/force-vercel-deploy.yml` | Manual Vercel deploy hook trigger. |
| `.husky/pre-commit` | Warns when MT5 source changes lack matching compiled downloads. |
| `render.yaml` | Starts bot workers through package scripts. |
| `vercel.json` / `.vercelignore` | Vercel cron and deploy filtering. |

## Root File Policy

Root files are limited to repo manifests, package/config files, env examples,
and platform config. New scratch notes, screenshots, logs, prompts, reports, and
research outputs should go into `engine/`, `automation/`, `docs/`, `database/`,
`poseidon/`, `archive/`, or ignored `Local Environment/`.

Historical material goes under root `archive/`, mirrored by original ownership
path. Examples: `archive/docs/...`, `archive/app/reports/...`,
`archive/database/...`. Do not create per-folder archive trees inside active
areas.

`.env` and `.env.local` stay root-local because Next.js and scripts read them
there. Do not commit local secrets.
