# Repo Structure

Status: active root map. Repo evidence overrides this file when they conflict.

## Target Root Model

| Path | Owner / Purpose |
|---|---|
| `poseidon/` | Finance-sector control layer, project profile, Poseidon memory, and Poseidon-local state seeds. Codex remains the underlying repo driver. |
| `app/` | Target home for Limni app code and app-facing assets. Transitional manifest only until a build-system migration gate moves runtime folders. |
| `services/` | Target home for deployable non-Next services. Transitional manifest only until automation-specific migration gates move service roots. |
| `database/` | Target home for database-owned assets. Transitional manifest only until DB and contract paths are migrated together. |
| `docs/` | Active durable documentation. Archive stale docs under `archive/docs/`. |
| `archive/` | Inactive material that is no longer current truth. |
| `releases/` | Release history, evidence, screenshots, release notes, and release canon. Keep at root. |
| `config/` | Target home for movable config documentation. Most tool-discovered config files stay at root. |

## Runtime App

| Path | Owner / Purpose |
|---|---|
| `src/` | Next.js app, API routes, UI, app data logic, and tests under `src/lib/__tests__`. Transitional root until an app build-system migration gate. |
| `public/` | Runtime public assets. Transitional root until an app build-system migration gate. Only assets served by the app belong here. |
| `db/`, `migrations/`, `contracts/` | Durable database and data contracts. Treat as production-sensitive. |
| `bots/`, `mt5/`, `scraper/` | Trading automation, MT5 integration, and capture services. Transitional roots until service migration gates. |
| `tests/` | Playwright E2E tests. Transitional root until an app build-system migration gate. Unit tests currently run from `src/lib/__tests__` through `vitest.config.ts`. |

## Workflow And Deploy Anchors

| Path | Anchor |
|---|---|
| `.github/workflows/contract-artifacts-sync.yml` | Active GitHub workflow. Watches `contracts/**`, `src/lib/mt5/**`, and `mt5/Experts/Include/Generated/**`; moving contracts or MT5 requires updating this workflow and proving contract generation. |
| `.github/workflows/performance-coverage-nightly.yml` | Active scheduled workflow. Runs `npm run performance:coverage:check`; moving `scripts/` or performance report paths requires updating this job. |
| `.github/workflows/force-vercel-deploy.yml` | Active manual workflow. Does not block folder moves by itself, but still relies on Vercel deploy configuration. |
| `render.yaml` | Starts bots through `npm run bot:bitget` and `npm run bot:oanda`; moving `bots/` requires package script updates. |
| `.vercelignore` | Excludes root data/research/report/database/contract/MT5 payloads from Vercel. Moving those roots changes deploy contents unless this file moves with them. |
| `.husky/pre-commit` | Checks staged MT5 source paths. Moving `mt5/` requires updating the hook. |

## Tooling And Evidence

| Path | Owner / Purpose |
|---|---|
| `scripts/` | Repo tooling, verification scripts, maintenance scripts, and legacy research scripts. Needs continuing taxonomy cleanup. |
| `scripts/verification/` | App/indicator parity exporters and inspectors. Prefer these for Performance and TradingView verification. |
| `scripts/research/` | Research-only scripts that are not runtime app tooling. |
| `scripts/db/` | DB probes and DB maintenance helpers. Production-sensitive scripts still require focused review. |
| `reports/` | Generated reports and archived outputs. Treat as evidence, not runtime truth, unless promoted deliberately. |
| `releases/` | Release history, evidence, screenshots, release notes, and release canon. `releases/v2/canon/*.json` remains frozen without an explicit canon gate. |

## Research And Domain Workspaces

| Path | Owner / Purpose |
|---|---|
| `research/` | Non-binding research workspace. Promote durable decisions into `docs/research/` or release evidence. |
| `sports/` | Sports research and forward-test workspace. Separate from Limni app runtime unless explicitly integrated. |
| `data/` | Local/tracked data artifacts. New generated data is ignored by default; verify ownership before committing. |

## Durable Documentation

| Path | Owner / Purpose |
|---|---|
| `AGENTS.md` | Short repo manifest and recovery pointer. Do not turn it into the full rulebook. |
| `docs/process/` | Active operating rules, project profile, cleanup ledger, release template. Keep small. |
| `docs/architecture/` | Durable architecture and app-truth specs. |
| `docs/testing/` | Testing and app-parity protocols. |
| `docs/research/` | Durable research memos that support decisions but do not bind runtime behavior. |
| `docs/backlog/` | Backlog inventory. Verify entries before treating them as active work. |
| `archive/docs/` | Stale handoffs, legacy agent notes, old planning material, and archived assets. |

## Local / Generated Folders

These should remain ignored and should not be committed as product truth:

- `Local Environment/` contains local-only IDE, agent, cache, build, log, and
  screenshot artifacts that do not belong in review. Current local-only roots
  such as `.cache/`, `.claude/`, `.codex/`, `.next/`, `.next-dev-logs/`,
  `.vercel/`, `.vscode/`, `playwright-report/`, `screenshots/`, `temp/`,
  `test-results/`, and `tmp/` should live there when not actively generated by
  a tool.
- `.cache/`
- `.claude/`
- `.codex/`
- `.codex-logs/`
- `.codex-run/`
- `.next/`
- `.next-dev-logs/`
- `.vercel/`
- `.vscode/`
- `node_modules/`
- `playwright-report/`
- `screenshots/`
- `temp/`
- `test-results/`
- `tmp/`

## Root File Policy

Root should stay limited to repo manifests, package/config files, env examples,
and platform config. New scratch notes, screenshots, logs, reports, prompts, and
research outputs should go into a named folder or archive immediately.

`package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`,
`vercel.json`, `render.yaml`, and test/build config remain root-discovered tool
anchors until a dedicated toolchain migration rewrites npm, Next, Vercel,
Render, and GitHub Actions command paths together.

Known remaining root exception: `nul` is an ignored Windows artifact. Do not
touch it casually because Windows treats that name specially.
