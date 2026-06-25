# Gate 56 Public / Local Repo Split

Date: 2026-06-25
Status: READY_FOR_REVIEW

## Verdict

PASS WITH CAVEATS for repo readability and public/local ownership.

The cleanup does not change app behavior, does not run new research tests, and
does not promote the candidate Gate 55H evaluator beyond its existing
diagnostic status.

## Goal

Split the repo into:

- `app/` for public app runtime and release evidence
- `engine/` for local reusable institutional research/backtest work
- `automation/` for MT5, bots, sidecars, voice helpers, and Playwright
  automation
- `archive/` for stale reports, research workspaces, and one-off scripts

## Move Inventory

Tracked active app cleanup before moves:

| Old path | Tracked files | New owner |
|---|---:|---|
| `app/reports/` | 312 | `archive/app/reports/` |
| `app/research/` | 210 | `archive/app/research/` |
| `app/scripts/` | 331 | mostly `archive/app/scripts/` |
| `app/services/` | 25 | `automation/` |
| `app/tests/` | 4 | `automation/tests/` |
| Total | 882 | split by current owner |

The old nested reports archive tree is gone. Its contents were flattened
under `archive/app/reports/legacy/...`.

## Kept In App

`app/` now owns:

- `app/src/`
- `app/public/`
- `app/releases/`
- app build config files

`app/src/lib/research/` remains for now because the existing app research and
automation routes import it. That is app refactor work, not this cleanup gate.

## Moved To Engine

Forward reusable local research surface:

- `engine/scripts/verification/evaluate-research-decision-manifest.ts`
- `engine/data/` for local cached price/data artifacts, ignored by default
- `engine/reports/` for generated engine artifacts, ignored by default

Blessed forward command:

```powershell
npm run engine:research-manifest:evaluate -- --manifest=<manifest.json>
```

## Moved To Automation

Automation surface:

- `automation/mt5/`
- `automation/bots/`
- `automation/sentiment-scraper/`
- `automation/scripts/`
- `automation/tests/`
- `automation/voice/`

Forward commands:

```powershell
npm run automation:contracts
npm run performance:coverage:check
npm run bot:bitget
npm run bot:oanda
```

## Updated Routing

- Vercel ignores `engine/`, `automation/`, and `archive/`.
- Contract artifact workflow watches `automation/scripts/generate-contracts.ts`
  and generated MT5 output under `automation/mt5/...`.
- Playwright config points to `automation/tests/e2e`.
- Local M1 SQLite default moved from `data/canonical-m1/...` to
  `engine/data/canonical-m1/...`.
- Research candidate registry default moved from `data/...` to `engine/data/...`.

## Caveats

- Gate 55H manifest/evaluator remains candidate shared architecture until a
  Gate 55G equivalent-manifest parity receipt proves identical frozen metrics.
- Historical archived scripts may still reference old paths. They are evidence,
  not blessed commands.
- `app/src/lib/research/` still contains app-route support code and should be
  refactored later only as an app gate.

## No-Go List

- no new Strength bucket tests
- no regime filters
- no COT + Strength combination
- no execution optimization
- no risk or live/MT5 promotion
- no new backtest engine
- no release canon rewrite
