# Gate 99R - Portfolio Harvest Governor Foundation

Date: 2026-07-06

## Scope

Gate 99R adds the first zero-trading account-level harvest foundation to
`LimniPortfolioEA`.

No strategy entry logic was added. No grid execution was added. No account
close-all execution was added. The EA still defaults to execution disabled.

## Changed Files

- `automation/mt5/Experts/Include/Core/BuildInfo.mqh`
- `automation/mt5/Experts/Include/Core/Config.mqh`
- `automation/mt5/Experts/Include/Core/Engine.mqh`
- `automation/mt5/Experts/Include/Core/Types.mqh`
- `automation/mt5/Experts/Include/Execution/MagicCodec.mqh`
- `automation/mt5/Experts/Include/Portfolio/AccountHarvestGuard.mqh`
- `automation/mt5/Experts/Include/Portfolio/PositionIndex.mqh`
- `automation/mt5/Experts/Include/Receipts/ReceiptTypes.mqh`
- `automation/mt5/Experts/Include/Receipts/RunManifest.mqh`
- `automation/mt5/Experts/Include/Receipts/StateSnapshot.mqh`
- `automation/mt5/Experts/Limni/LimniPortfolioEA.ex5`

## Contract Added

Position attribution now separates:

```text
entry managed positions
grid managed positions
external/manual positions
unknown managed positions
```

The position index now refreshes every engine step so floating PnL is live for
high-watermark decisions. The position identity hash remains based on position
identity and attribution group, not floating PnL, so attribution receipts do not
flood on every tick.

`MagicCodec` now decodes Limni magic numbers into:

```text
major_version
symbol_id
lane_id
variant_id
direction
grid_family
```

`grid_family > 0` is classified as managed grid inventory. `grid_family == 0`
is classified as managed entry inventory. External/manual positions are counted
and receipted, but not included in managed EA harvest PnL.

## Harvest Governor

`AccountHarvestGuard.mqh` now owns a non-executing high-watermark state machine:

```text
disabled
config_invalid
armed_initial_target
hwm_active
soft_lock_active
grid_winddown_active
emergency_liquidation_armed
```

Inputs added under `Portfolio Harvest Governor`:

```text
EnablePortfolioHarvestGovernor = false
HarvestInitialTargetMoney = 0.0
HarvestTrailMoney = 0.0
HarvestSoftLockOnBreach = true
HarvestGridWinddownOnBreach = true
HarvestArmEmergencyLiquidation = false
```

When enabled with valid thresholds, the governor tracks managed EA floating PnL,
arms at the initial target, records a high-watermark, and latches a breach state
when managed PnL falls through the trail floor.

The governor may set `block_new_entries` on config-invalid or breach states, so
later strategy lanes cannot bypass the portfolio-level soft lock. It does not
send orders and does not close positions.

## Receipts

New receipt kinds:

```text
position_attribution
harvest_state
```

Run manifest and summary receipts now include harvest-governor config fields.
Engine-step receipts include current harvest state and whether new entries are
blocked by the governor.

## Verification

Artifact folder:

- `docs/research/gates/gate99/artifacts/gate99r-portfolio-harvest-governor-2026-07-06/`

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

This gate intentionally implements account-level harvest state before strategy
entries. The next reviewer should focus on whether the attribution model,
HWM latch behavior, soft-lock semantics, and receipt surface are sufficient
before any real entry lane or close execution is added.

Open decisions before the next implementation gate:

```text
Whether HWM should remain managed-floating-PnL based or move to equity/balance delta.
Whether emergency_liquidation_armed should ever become an execution state.
Whether grid_family alone is enough for grid grouping or whether comment metadata needs a group id.
What reset/unlock rule releases a latched soft-lock after a harvest breach.
```
