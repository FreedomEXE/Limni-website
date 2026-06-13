# v2 Data Contracts

Documented: 2026-06-12

This file records the active v2 data contracts. The current live patch is read
from the release manifests; dated sections remain historical implementation
notes.

## Release Manifest

Runtime release identity comes from [`release-manifest.json`](../../release-manifest.json) and [`src/lib/version/releaseManifest.ts`](../../src/lib/version/releaseManifest.ts).

Important fields:

- `releaseLine`: `v2`
- `liveVersion`: current public version from the manifest; at this update,
  `v2.0.5`
- `canonVersion`: `v2`
- `cacheNamespace`: current runtime namespace

The root runtime manifest may also carry the local development channel version.
Published release-line manifests and Documents history stay live-only.

## Canon Inventory

Inventory contract is defined by [`src/lib/canon/canonShardTypes.ts`](../../src/lib/canon/canonShardTypes.ts).

Core types:

- `CanonInventoryManifest`
- `CanonVariantInventory`
- `CanonWeekShard`
- `CanonShardSource`

Shard sources:

- `release-canon`: immutable release baseline derived from `releases/v2/canon/*.json`.
- `closed-week-delta`: post-release closed week, derived server-side without mutating frozen canon.

Current hardening:

- Server memoizes release artifact reads, delta inventory, and inventory manifests.
- Inventory skips dynamic delta build if the release baseline already covers the latest closed week.
- Current week remains live-only and is not a canon shard.

## Strategy Payloads

Active Performance consumes:

- `/api/performance/strategy-kernel-payload`
- `src/lib/performance/strategyClientCache.ts`
- `src/lib/performance/strategySessionStore.ts`

The payload combines:

- release-canon closed weeks,
- closed-week deltas,
- current/open week live data,
- strategy selection metadata,
- sidebar summary stats.

## Week Keys

Canonical week keys use display week open UTC semantics:

- `CANON_WEEK_KEY_SEMANTICS`
- `getDisplayWeekOpenUtc()`
- `normalizeWeekOpenUtc()`

Observed week state is runtime-derived. Do not hardcode a current or latest
closed week in this contract; use source-freeze, lifecycle, and Performance
runtime evidence.

## Return Matrix

Closed rows carry both raw and ADR-normalized reporting inputs:

- raw percent move,
- ADR percent denominator,
- ADR Grid absolute distance where execution requires it,
- canonical/market-truth anchor,
- execution anchor.

Weekly Hold parity confirmed both raw and ADR-normalized modes for EURUSD over the first 3-week test.

## ADR Grid Contract

Canonical strategy and execution definitions live in [`strategy-execution-spec.md`](strategy-execution-spec.md). That file supersedes any older handoff wording about ADR Grid reset, re-entry, Favorable Gap, same-bar ordering, and crypto week handling.

Current intended app source-of-truth:

- `0.20 ADR` grid step.
- Level prices derive from the active weekly anchor open.
- The weekly open anchor level is not tradable; this creates the `Favorable Gap`.
- Fill closes fully at the next grid step when TP is hit.
- Reset at `1.0 ADR` from the current cycle extreme closes still-active fills and can produce wins, breakevens, or losses.
- Same-bar TP/reset and same-bar re-entry are handled conservatively under the current 1H execution version.
- Pair Fill Cap limits active fills per pair when overlay is enabled.
- No historical partial runner model.
- No historical basket TP guard model.

Key implementation:

- [`src/lib/performance/weeklyHoldEngine.ts`](../../src/lib/performance/weeklyHoldEngine.ts)
- [`src/lib/performance/engineAdapter.ts`](../../src/lib/performance/engineAdapter.ts)

### P/L Unit Contract

ADR Grid return units are now treated as a release-blocking data-correctness contract:

- A `0.20 ADR` TP equals `+0.20%` in ADR-normalized reporting.
- The matching raw percent is `pairAdrPct * 0.20`.
- The engine must not multiply the raw close return by an extra grid-fill weight after entry and target have already encoded the `0.20 ADR` distance.
- Basket rows, Performance summary cards, logs, and verifier output must agree on this unit rule before final screenshots are captured.

Current Pine verifier target:

- EURUSD, display week `2026-05-31T23:00:00.000Z`.
- ADR Grid + Pair Fill Cap.
- Expected result after the P/L unit fix:
  - 4 TP fills,
  - raw P/L about `+0.3517%`,
  - ADR-normalized P/L `+0.80%`,
  - no grid reset for this pair/week.

### Drawdown And Risk Contract

The release must separate drawdown labels by measurement type:

| Field | Meaning | Release rule |
|---|---|---|
| `tradeMaeRawPct` | Worst adverse excursion for one fill/trade from entry, raw percent. | Per-fill/per-trade detail only. |
| `tradeMaeAdrPct` | `tradeMaeRawPct / adrPct`. | ADR-normalized detail display only. |
| `gridPathDrawdownPct` | Synchronized path drawdown for one grid parent/pair. | Grid row/detail when available. |
| `basketPathMaxDrawdownPct` | Synchronized portfolio peak-to-trough drawdown. | Headline Performance and Simulation `Max DD`. |
| `weeklyCloseDrawdownPct` | Drawdown from weekly realized return sequence. | Fallback/reporting only. |
| `legacyStaticDrawdownPct` | Imported or static research/report value. | Legacy surfaces only. |

Rules:

- Never sum per-fill MAE into basket drawdown.
- Never label simple realized fill-return sequence drawdown as true path DD.
- Headline app drawdown must come from synchronized path data.
- Basket fill rows should display MAE, not path DD.
- Basket grid rows should display grid path DD only after that path field exists.

Implementation checkpoint:

- `ClosedHistoryRow.riskMatrix` is optional for backward compatibility with existing frozen canon rows.
- New closed-week delta rows populate fill/trade `maeRawPct` from engine `detail.maePct`.
- ADR Grid parent rows use `maeRawPct` as max child fill MAE only; UI labels it `Max fill MAE`.
- `pathDrawdownRawPct` is intentionally null until synchronized grid-level path DD is implemented.
- Basket grid detail displays `Grid DD` as `--` when no true path DD exists.
- Basket row headers now roll risk up beside P/L:
  - fill/trade rows show `MAE`,
  - grid rows show `Grid DD` when true path DD exists and `Max MAE`,
  - week, portfolio/sleeve, tier, and symbol rows show `Max DD` only from true path-DD fields and `Max MAE` from descendant rows.
- The row-header contract is strategy-family agnostic:
  - Weekly Hold and future non-grid systems use `trade` rows.
  - ADR Grid with Pair Fill Cap and ADR Grid with no cap both use the same `grid`/`fill` hierarchy; cap state remains row metadata, not a separate rendering path.

### Simulation, Calendar, And Rolling-Window Contract

Performance zoomed-in and zoomed-out views now share one display rule for P/L and DD:

- Path points may carry three synchronized return fields:
  - `balance_pct`: realized closed-trade/fill P/L carried forward.
  - `equity_pct`: mark-to-market equity using close prices for active positions.
  - `adverse_equity_pct`: adverse high/low marked equity for active positions.
- `drawdown_pct` is based on `adverse_equity_pct` against the running close-equity peak when adverse data exists.
- ADR Grid charts show `equity_pct` and `balance_pct` as separate lines when independent fills make them diverge.
- Simulation cards use the active selected sleeve/portfolio series when an intraday simulation path exists.
- Raw mode without a raw hourly path uses an additive weekly close fallback and labels DD as `Close DD`, not path DD.
- Rolling windows compute `Path DD` from the active simulation path when it is available.
- Rolling windows fall back to week-return close-to-close DD and label it `Close DD`.
- Returns calendar monthly and weekly cells aggregate active path-derived daily rows when an intraday path exists:
  - P/L is the additive sum of daily path deltas for the displayed period.
  - DD is the worst path DD observed in the displayed period.
- Returns calendar monthly and weekly cells fall back to week rows when no intraday path exists:
  - P/L is the additive sum of weekly realized returns.
  - DD is the max of available week DD and weekly close-to-close DD.
  - The displayed DD label distinguishes `Week DD` and `Close DD`.
- Returns calendar daily cells display `Path DD`; daily mode is disabled for week-close fallback paths so weekly points are not presented as daily evidence.

This contract applies to all current sleeves and future strategy paths because the parent simulation surface decides whether the active series is `intraday_path` or `weekly_close`, then passes that precision into calendar and rolling-window components.

Detailed implementation spec:

- [`../../docs/data-verification/ADR_GRID_DRAWDOWN_UNIFICATION_SPEC_2026-06-03.md`](../../docs/data-verification/ADR_GRID_DRAWDOWN_UNIFICATION_SPEC_2026-06-03.md)

### Verification Trust Model

The Pine verifier is the zoom-in source of truth for current rule interpretation, but it can only validate one chart symbol and one target week at a time. The app becomes trusted for larger periods only after:

- Pine spot checks validate sampled pair/week behavior,
- deterministic app scripts validate selected basket weeks and the full 19-week history,
- app UI surfaces and logs agree on the same P/L and drawdown contract,
- cache/artifact versions invalidate stale payloads.

Until that graduation is complete, TradingView evidence is authoritative for sampled rule parity and the app is still under data-correctness verification for basket-scale reporting.

## Screenshot Contract

App-visible screenshots live under `releases/v2/screenshots/...` and must be listed in `releases/v2/manifest.json`. Temporary verification screenshots may live in `docs/research`, but they are not app-visible unless promoted.

The earlier v2.0.3 screenshots include weekly-anchor/preloader evidence. They
predate the ADR Grid P/L unit fix and drawdown/MAE contract and should be
treated as historical evidence unless a later patch explicitly promotes
replacement screenshots.
