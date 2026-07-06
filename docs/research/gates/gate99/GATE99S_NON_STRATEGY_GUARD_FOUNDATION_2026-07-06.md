# Gate 99S - Non-Strategy Guard Foundation

Date: 2026-07-06

## Scope

Gate 99S hardens infrastructure that does not depend on the first strategy
choice.

No strategy lane was implemented. No entry alpha was added. No real order
building, grid adds, close-all execution, or live-readiness claim was added.
The risk arbiter still rejects future intents after guard checks until a
strategy lane is explicitly approved.

## Changed Files

- `automation/mt5/Experts/Include/Core/BuildInfo.mqh`
- `automation/mt5/Experts/Include/Core/Config.mqh`
- `automation/mt5/Experts/Include/Core/Engine.mqh`
- `automation/mt5/Experts/Include/Core/SymbolUniverse.mqh`
- `automation/mt5/Experts/Include/Core/Types.mqh`
- `automation/mt5/Experts/Include/Execution/MagicCodec.mqh`
- `automation/mt5/Experts/Include/Execution/TradeRouter.mqh`
- `automation/mt5/Experts/Include/Market/NewsCalendar.mqh`
- `automation/mt5/Experts/Include/Market/SessionCalendar.mqh`
- `automation/mt5/Experts/Include/Portfolio/AccountHarvestGuard.mqh`
- `automation/mt5/Experts/Include/Portfolio/CurrencyExposureGuard.mqh`
- `automation/mt5/Experts/Include/Portfolio/GridBook.mqh`
- `automation/mt5/Experts/Include/Portfolio/RiskArbiter.mqh`
- `automation/mt5/Experts/Include/Receipts/ReceiptTypes.mqh`
- `automation/mt5/Experts/Include/Receipts/RunManifest.mqh`
- `automation/mt5/Experts/Include/Receipts/StateSnapshot.mqh`
- `automation/mt5/Experts/Include/Signals/LrmgState.mqh`
- `automation/mt5/Experts/Limni/LimniPortfolioEA.ex5`

## Currency Guard

`CurrencyExposureGuard.mqh` is no longer log-only.

It scans live managed positions, decodes Limni magic where possible, resolves
the canonical symbol, and maps each position into base/quote currency-token
exposure.

It now tracks:

```text
signed lots by currency
gross lots by currency
grid-long count by currency
grid-short count by currency
managed position count
snapshot hash
```

New inputs:

```text
EnableCurrencyExposureGuard = true
MaxCurrencySignedLots = 5.0
MaxCurrencyGrossLots = 10.0
MaxSameDirectionGridsPerCurrency = 4
MaxManagedPositions = 200
```

Future intents can be rejected for:

```text
invalid intent
max managed positions
unresolved symbol currency
signed currency lot limit
gross currency lot limit
same-direction currency grid limit
```

The arbiter still rejects all intents after guard checks because no strategy
lane has been approved yet.

## Grid Inventory

`GridBook.mqh` now scans managed positions and groups grid inventory by:

```text
symbol_id
lane_id
variant_id
direction
grid_family
```

It records open grid count, grid position count, lots, floating PnL, per-grid
rows, and a snapshot hash.

This does not implement grid add/close logic. It provides the inventory model
that grid logic and account winddown will consume later.

## News Guard

`Market/NewsCalendar.mqh` was added.

Manual CSV format:

```text
server_time,currency,impact,title
2026.07.06 08:30,USD,3,NFP
2026-07-06 10:00,ALL,HIGH,FOMC
```

Accepted impact values:

```text
3 / HIGH / H / RED
2 / MEDIUM / MED / M / ORANGE
1 / LOW / L / YELLOW
```

The news guard loads once at EA init, receipts load status and event count, and
blocks a symbol when a loaded event matches either its base/quote currency or
`ALL` inside the configured before/after window.

New input:

```text
NewsMinimumImpact = 3
```

## Receipts

New receipt kinds:

```text
currency_exposure
grid_inventory
news_guard
```

Engine receipts now include open grid count. Summary receipts include currency
guard limits and news minimum impact.

## Verification

Artifact folder:

- `docs/research/gates/gate99/artifacts/gate99s-non-strategy-guard-foundation-2026-07-06/`

Compile logs:

- `repo-LimniPortfolioEA-compile-log.txt`
- `active-LimniPortfolioEA-compile-log.txt`

Compile summary:

- `compile-results.txt`

Source hash parity:

- `source-hashes.txt`

Both repo and active-terminal compiles report:

```text
Result: 0 errors, 0 warnings
```

MetaEditor returned process exit code `1` while writing clean logs, matching the
known local MT5 compile pattern in this repo.

## Review Notes

This gate makes the first strategy lane safer to add because risk can now see
account inventory before approving future intents.

Open decisions before later implementation:

```text
Whether currency limits should be fixed inputs, account-balance scaled, or volatility scaled.
Whether grid_family should remain the grid identity or comment metadata should add a group id.
Whether news CSV time is broker-server time forever or needs explicit timezone columns.
Whether the next gate should be order-building dry-run plans, close execution contracts, or first strategy lane.
```
