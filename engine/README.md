# Engine

Local institutional research and backtest engine workspace.

`engine/` owns reusable research contracts, evaluator code, local price/data
adapters, warehouse helpers, command entry points, generated data, and generated
receipts. The app can consume stable engine contracts or read-only adapters, but
the app is not the source of institutional research truth.

## Active Source Layout

| Path | Owner / Purpose |
|---|---|
| `engine/src/cache/` | Runtime cache primitives shared by engine code and app compatibility re-exports. |
| `engine/src/contracts/` | Non-UI contracts such as asset classes, COT market definitions, and week-anchor helpers. |
| `engine/src/evaluation/` | Evaluator support primitives such as execution weekly windows. |
| `engine/src/research/` | Research decision manifest, shared evaluator, hashing, and append-only run registry. |
| `engine/src/signals/` | Signal-specific manifest/source builders that produce frozen decision manifests before scoring. |
| `engine/src/price/` | Canonical price bars/windows, ADR lookup, path bars, path resolution, and local/cached price adapters such as the SQLite M1 warehouse. |
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

Gate-specific manifest builders may live under `engine/scripts/verification`
when they freeze a prior accepted signal into `ResearchDecisionManifest` files.
Those builders are not scorers; they should feed the shared evaluator command.

## Boundary Rule

Engine code imports engine-owned paths directly. `engine/src` and
`engine/scripts` must not import `@/lib/*`.

The old app paths for canonical price bars/windows, execution windows, ADR
lookup, path bars, path resolution, week anchors, COT market definitions, and
runtime cache are compatibility re-exports for current app code. They are not
the owner of engine truth.
