# Engine

Local institutional research and backtest engine workspace.

`engine/` owns reusable research contracts, evaluator code, local price/data
adapters, warehouse helpers, command entry points, generated data, and generated
receipts. The app can consume stable engine contracts or read-only adapters, but
the app is not the source of institutional research truth.

## Active Source Layout

| Path | Owner / Purpose |
|---|---|
| `engine/src/research/` | Research decision manifest, shared evaluator, hashing, and append-only run registry. |
| `engine/src/price/` | Local/cached price adapters such as the SQLite M1 warehouse. |
| `engine/src/warehouse/` | Research matrix and macro regime warehouse helpers. |
| `engine/scripts/` | Local command entry points. |
| `engine/data/` | Ignored local/cached data artifacts. |
| `engine/reports/` | Ignored generated engine receipts and run artifacts. |

## Forward Command

```powershell
npm run engine:research-manifest:evaluate -- --manifest=<manifest.json>
```

This command scores an already frozen decision manifest. It does not derive
signals, run Strength buckets, run regime filters, combine COT and Strength,
optimize execution, add risk overlays, or promote live/MT5 behavior.

## Boundary Debt

Gate 56C moved shared DB access to `database/db/client.ts`. Remaining accepted
debt is app-owned non-UI price/path logic imported by the evaluator, especially
execution windows, ADR lookup, path bar loading, and runtime cache helpers. The
next extraction should move those shared price/path primitives out of the app
only when a focused gate proves the replacement path.
