# Repo Structure

Status: active root map. Repo evidence overrides this file when they conflict.

## Runtime App

| Path | Owner / Purpose |
|---|---|
| `src/` | Next.js app, API routes, UI, app data logic, and tests under `src/lib/__tests__`. Clean during app-surface gates, not broad repo cleanup gates. |
| `public/` | Runtime public assets. Only assets served by the app belong here. |
| `db/`, `migrations/`, `contracts/` | Durable database and data contracts. Treat as production-sensitive. |
| `bots/`, `mt5/` | Trading automation and MT5 integration surfaces. Clean only in automation-specific gates. |
| `tests/` | Playwright E2E tests. Unit tests currently run from `src/lib/__tests__` through `vitest.config.ts`. |

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
| `scraper/` | Browser/data capture workspace with its own dependency tree. Do not mix with app cleanup. |
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
| `docs/archive/` | Stale handoffs, legacy agent notes, old planning material, and archived assets. |

## Local / Generated Folders

These should remain ignored and should not be committed as product truth:

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

Known remaining root exception: `nul` is an ignored Windows artifact. Do not
touch it casually because Windows treats that name specially.
