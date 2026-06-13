# v2 Active Systems

Documented: 2026-06-12

This file records the active strategy and app systems for the v2 release line.
The current live patch is read from `manifest.json`; dated rejection notes below
remain historical design decisions.

Canonical rule definitions for source systems, execution styles, return modes, ADR Grid reset behavior, Favorable Gap, Pair Fill Cap, and 1H ambiguity handling live in [`strategy-execution-spec.md`](strategy-execution-spec.md). This file is a high-level active-systems index only.

## Active Strategy Sources

Visible signal systems come from [`src/lib/performance/strategyConfig.ts`](../../src/lib/performance/strategyConfig.ts):

- `tandem`: independent sleeves for Dealer, Commercial, Sentiment, and Strength.
- `tiered_4w`: weighted four-source tiered system.
- `agree_3of4`: four-source agreement filter.
- `selector`: consolidated selector view.

Single-source entries such as Dealer, Commercial, Sentiment, and Strength normalize into Tandem where appropriate.

## Active Execution Styles

- `weekly_hold`: baseline weekly open-to-close model.
- `adr_grid`: app close-and-rearm `0.20 ADR` grid with Favorable Gap and conservative 1H ambiguity handling.

Rejected in the current v2 app source-of-truth:

- Initial seeded grid position at market-truth week open.
- Partial-close runner/refill model.
- Basket-level TP guard as historical ADR Grid result model.

Those may be researched later, but they are not the current app source-of-truth.

## Active Risk Overlays

- `none`: no cap. This remains valid for ADR Grid comparison.
- `pair_fill_cap`: active pair fill cap. This is the ADR Grid default overlay.

The user-visible regression to watch for: ADR Grid must not force Pair Fill Cap in a way that makes `None` unavailable.

## Active Surfaces

- Performance: primary strategy result and drilldown surface. Kernel-gated for active strategy history.
- Data: pair-level bias, anchor, raw, and ADR-normalized verification surface.
- Accounts: account and execution-monitoring surface.
- Status: kernel diagnostics and release/data health.
- Documents: release history, architecture docs, screenshots, and version notes.

Matrix remains provisional/degraded and is outside the active v2 Performance
kernel readiness gate.

## Active Verifier

TradingView verifier file:

- [`scripts/pinescript/limni-adr-verifier.pine`](../../scripts/pinescript/limni-adr-verifier.pine)

Modes and controls:

- `Weekly Hold`
- `ADR Grid`
- `Market Truth`
- `Execution`
- `Raw`
- `ADR Normalized`
- `Grid Cap: Off | Pair Fill Cap`
- `ADR Grid Price Bars: Chart / 1m | Confirmed 1H`

Pine cannot be locally compiled in this repo. TradingView paste/compile remains the syntax authority.
