# Repo Structure

Status: active map. Repo evidence overrides this file when they conflict.

## Root Folders

| Path | Owner / Purpose |
|---|---|
| `app/` | App-owned code, assets, scripts, services, research, reports, releases, and tests. |
| `database/` | Schema, migrations, and data/integration contracts. |
| `docs/` | Durable documentation, process, architecture, backlog, and archive. |
| `poseidon/` | Limni/Poseidon project profile and control-plane notes. |
| `config/` | Config documentation for root-discovered tool files. |

Hidden roots `.github/` and `.husky/` are workflow hooks and remain at root.
Ignored local roots such as `Local Environment/` and `node_modules/` are not repo
truth.

## App Folders

| Path | Owner / Purpose |
|---|---|
| `app/src/` | Next.js routes, API routes, UI, app libraries, and unit tests. |
| `app/public/` | Runtime public assets. |
| `app/scripts/` | App tooling, verification scripts, maintenance scripts, and research runners. |
| `app/services/` | Deployable automation services, MT5 assets, bots, and sidecars. |
| `app/research/` | Non-binding research workspaces. Promote durable decisions into `docs/` or `app/releases/`. |
| `app/reports/` | Generated reports and evidence outputs. Treat as evidence unless promoted deliberately. |
| `app/releases/` | Release history, release evidence, screenshots, release notes, and release canon. |
| `app/tests/` | Playwright end-to-end tests. |

`app/releases/v2/canon/*.json` remains frozen without an explicit canon gate.

## Database Folders

| Path | Owner / Purpose |
|---|---|
| `database/db/` | SQL schema and database helpers. |
| `database/migrations/` | Durable migrations. |
| `database/contracts/` | Data and integration contracts. |

## Workflow And Deploy Anchors

| Path | Anchor |
|---|---|
| `.github/workflows/contract-artifacts-sync.yml` | Watches `database/contracts/**`, `app/scripts/generate-contracts.ts`, `app/src/lib/mt5/**`, and generated MT5 contract output. |
| `.github/workflows/performance-coverage-nightly.yml` | Runs `npm run performance:coverage:check`. |
| `.github/workflows/force-vercel-deploy.yml` | Manual Vercel deploy hook trigger. |
| `.husky/pre-commit` | Warns when MT5 source changes lack matching compiled downloads. |
| `render.yaml` | Starts bot workers through package scripts. |
| `vercel.json` / `.vercelignore` | Vercel cron and deploy filtering. |

## Root File Policy

Root files are limited to repo manifests, package/config files, env examples,
and platform config. New scratch notes, screenshots, logs, prompts, reports, and
research outputs should go into `app/`, `docs/`, `database/`, `poseidon/`, or
ignored `Local Environment/`.

`.env` and `.env.local` stay root-local because Next.js and scripts read them
there. Do not commit local secrets.
