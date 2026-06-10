# Performance Selected Truth Evidence - 2026-06-08

Scope: audited Performance selected runtime parity for Tandem strategy on the clean14 active baseline.

## Before

Route:

`/performance?strategy=tandem&f1=adr_grid&f2=pair_fill_cap&view=summary`

Evidence:

- `performance-summary-current-selected-truth.png`
- `performance-basket-current-selected-truth.png`
- `current-playwright-evidence.json`

Observed split-brain state:

- Summary/sidebar rendered `14 WEEKS TRACKED`, `11139` total trades, and `+308.18%`.
- Basket rendered `0 trades` while also showing engine trades `11139`.
- Basket warned: `Basket header is using the engine ledger P/L. Drilldown row totals currently sum to 0.00%.`
- Basket warned: `Basket data is syncing. Kernel: error. Preload: idle.`

## After

Evidence:

- `performance-summary-after-selected-runtime-basket.png`
- `performance-basket-after-selected-runtime-basket.png`
- `performance-basket-expanded-after-selected-runtime-basket.png`
- `performance-basket-final-selected-runtime.png`
- `final-basket-evidence.json`

Observed ADR Grid / Pair Fill Cap state:

- Basket reads selected runtime rows from the active strategy-kernel payload.
- Basket renders `14 weeks`, `56 portfolios`, `1972 grids`, `11139 fills`, and engine trades `11139`.
- Basket renders P/L `+308.18%`.
- Basket has no sync warning.
- Basket has no engine-ledger/drilldown mismatch warning.
- Final Playwright evidence had no bad responses, failed requests, console errors, or page errors.

## Weekly Hold Switch Check

Evidence:

- `performance-weekly-hold-switch-current-state.png`
- `performance-weekly-hold-switch-final-state.png`
- `performance-weekly-hold-switch-final-contained.png`
- `performance-weekly-hold-basket-final-selected-runtime.png`
- `final-weekly-hold-switch-evidence.json`
- `final-weekly-hold-basket-evidence.json`

Observed final Weekly Hold state:

- Switching from ADR Grid to Weekly Hold no longer leaves old ADR Grid sidebar stats visible.
- Weekly Hold Summary renders `14 WEEKS TRACKED`, `2016` total trades, and `-42.07%`.
- Weekly Hold Basket renders `14 weeks`, `56 portfolios`, `2016 trades`, and P/L `-42.07%`.
- Weekly Hold Basket has no sync warning and no engine-ledger/drilldown mismatch warning.
- Final Playwright evidence had no bad responses, failed requests, console errors, or page errors.

## Inline Drilldown Audit

Evidence:

- `performance-basket-inline-drilldown-audit.png`
- `inline-drilldown-audit-evidence.json`

Observed active Basket drilldown state:

- Active Basket uses `BasketHierarchy`, not `BasketAllTimeBrowser`.
- Expanding the hierarchy shows inline grid/fill detail and `strategy-runtime|...` trade IDs.
- No `TradeDrilldownModal` dialog appeared in the audited active Basket path.
- No watched legacy requests fired:
  - `/api/trades/drilldown`
  - `/api/basket/weeks`
  - `/api/basket/week-pairs`
  - `/api/performance/report`
  - `/api/performance/comparison`
- No sync warning, ledger mismatch warning, bad responses, failed requests, console errors, or page errors appeared in the audit run.

## Export Source Audit

Source audit result:

- The active Performance UI does not expose an export/download control in the audited path.
- `scripts/verification/export-runtime-app-trades.ts` is the runtime-engine export for selected app-vs-TradingView checks.
- `scripts/verification/export-app-trades.ts` is the persisted database-ledger export for stored-ledger refresh checks.
- `docs/testing/APP_PARITY_TESTING.md` was updated to make that distinction explicit.

Decision:

- No active UI export patch was needed in this gate.
- Runtime/database export reconciliation remains part of the later TradingView/ledger truth gate.

## Remaining Scope

This gate verified Summary/sidebar/Basket selected runtime parity and active inline Basket drilldown behavior for the audited Performance paths. It did not complete runtime/database export reconciliation, legacy modal drilldown cleanup, weekly rollover lifecycle, durable cache, archive/current overlay, or full strategy reconciliation.
