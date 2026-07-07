# Gate 99ZZ - Revma One-Pair Visual Mechanics Proof

Date: 2026-07-07

Branch: `codex/gate88-mt5-lifecycle-protection-controls`

Head at recovery: `59c439f818870d333cee044922ca580ef5b8c372`

## Verdict

`PARTIAL`

Gate 99ZZ proves the four Revma sleeve birth/add mechanics cases in one-pair
visual Strategy Tester runs on `AUDCHF.i`.

It does not prove that adds continue from frozen birth policy after current
classification changes. All observed add receipts still have matching
`birth_*` and `current_*` direction/sleeve/anchor fields. Source inspection
confirms the current add lookup still keys open-grid discovery by current
`signal.variant_id` and `signal.direction` before using the birth snapshot.

Do not move to all-28, optimization, exposure/grid-cap validation, performance
claims, or live-readiness from this gate.

## Scope

Allowed scope used:

- One pair only: `AUDCHF.i`.
- Visual Strategy Tester mechanics proof only.
- Birth/add receipts and screenshots.
- Revma `q_profile_id`, frozen birth fields, and current fields.

Frozen areas respected:

- No all-28.
- No optimization.
- No profitability or performance claim.
- No live-readiness claim.
- No Katarakti work.
- No q-state semantics change.
- No exposure guard or grid cap testing.
- No EA source change in this proof gate.

The proof used `RevmaGridSpacingQ=0.10` to force add mechanics inside short
visual windows. This is a mechanics-stress setting, not a selected performance
parameter.

## Evidence Folder

Artifacts:

`docs/research/gates/gate99/artifacts/gate99zz-revma-one-pair-visual-mechanics-proof-2026-07-07/`

Key files:

- `audchf-one-pair-scan-summary.csv`
- `visual-case-runs.csv`
- `visual-receipt-field-audit.csv`
- `screenshots/*.png`
- `visual-receipts/*-receipts.csv`
- `visual-receipts/*-summary.csv`
- `artifact-sha256.txt`
- `run-audchf-scan.ps1`
- `run-visual-cases.ps1`

## Tester Setup

Terminal path:

`C:\Users\User\AppData\Roaming\Five Percent Online MetaTrader 5 - alt\terminal64.exe`

Account shown in corrected screenshots:

`EightcapGlobal-Live - Hedge`

Common inputs:

- `Symbol=AUDCHF.i`
- `Period=M1`
- `Optimization=0`
- `Visual=1` for visual proof reruns
- `ExecutionMode=LP_EXECUTION_TESTER_ONLY`
- `EnableTrading=true`
- `EnableStrategyEvaluation=true`
- `EnableOpenOrderRouting=true`
- `EnableCloseExecution=false`
- `EnableAccountCloseExecution=false`
- `EnableCurrencyExposureGuard=false`
- `EnableRevmaSystem=true`
- `RevmaUniverseMode=CURRENT_CHART`
- `RevmaQProfile=MEDIUM`
- `RevmaMaxM1Bars=50000`
- `RevmaGridSpacingQ=0.10`

Visual proof summaries show:

- `revma_q_profile_id=MEDIUM_50000`
- `revma_grid_spacing_q=0.10`
- `active_system=revma-v001`

## Four Sleeve Cases

`visual-receipt-field-audit.csv` confirms:

| Case | Window | Birth | Add policy | Add rows | Screenshot | Receipt |
| --- | --- | --- | --- | ---: | --- | --- |
| LONG above anchor -> continuation -> add higher | 2026-04-01 to 2026-04-11 | `LONG / ABOVE / CONTINUATION` | `continuation_add_higher` | 1 | `screenshots/long_above_continuation_add_higher.png` | `visual-receipts/long_above_continuation_add_higher-receipts.csv` |
| SHORT below anchor -> continuation -> add lower | 2025-02-01 to 2025-02-11 | `SHORT / BELOW / CONTINUATION` | `continuation_add_lower` | 20 | `screenshots/short_below_continuation_add_lower.png` | `visual-receipts/short_below_continuation_add_lower-receipts.csv` |
| LONG below anchor -> reversion -> add lower | 2025-03-01 to 2025-03-11 | `LONG / BELOW / REVERSION` | `reversion_add_lower` | 105 | `screenshots/long_below_reversion_add_lower.png` | `visual-receipts/long_below_reversion_add_lower-receipts.csv` |
| SHORT above anchor -> reversion -> add higher | 2025-09-01 to 2025-09-11 | `SHORT / ABOVE / REVERSION` | `reversion_add_higher` | 35 | `screenshots/short_above_reversion_add_higher.png` | `visual-receipts/short_above_reversion_add_higher-receipts.csv` |

The Gate 99ZY receipt surface names the setup type as `sleeve`
(`CONTINUATION` / `REVERSION`). There is no separate literal `setup_type` key
in current Revma receipts.

## Receipt Field Proof

Each visual proof receipt includes:

- Birth receipt:
  - `q_profile_id=MEDIUM_50000`
  - `direction`
  - `anchor_location`
  - `sleeve`
  - `add_policy`
  - `q_at_entry`, `q_pips`, `entry_anchor`, `entry_price`
  - `source_m1_time`
- Add receipt:
  - `add_policy`
  - `birth_snapshot=in_memory`
  - `birth_direction`
  - `birth_anchor_location`
  - `birth_sleeve`
  - `birth_add_policy`
  - `birth_q_profile_id=MEDIUM_50000`
  - `current_direction`
  - `current_anchor_location`
  - `current_sleeve`
  - `current_q_profile_id=MEDIUM_50000`

The add receipt audit has `divergent=False` for all four first-add examples,
meaning the observed adds happened while current classification still matched
the frozen birth classification.

## Caveat: Frozen Birth Policy After Current Classification Change

This caveat remains unresolved.

Static source inspection:

`automation/mt5/Experts/Include/Strategies/RevmaGridSleeve.mqh:352`
through `:359` calls:

```mql5
grid_book.FindGrid(
   signal.symbol_id,
   LP_LANE_REVMA,
   signal.variant_id,
   signal.direction,
   same_grid
);
```

The add path then derives `add_policy` from current `signal.sleeve` and
`signal.direction` at lines `:367` through `:378`, and `BuildIntent()` copies
current `signal.variant_id` and `signal.direction` into the add intent.

Read: the birth snapshot proves what the grid was born as, but the active add
lookup still requires the current signal to match the open grid's variant and
direction before any add receipt can be emitted. The current proof therefore
does not demonstrate continuation from frozen birth policy after a current
classification change.

## Result

Four-case one-pair visual mechanics proof: `PASS`.

Frozen-policy add continuity across current classification change: `NOT
PROVEN / LIKELY BLOCKED BY CURRENT LOOKUP`.

Recommended next gate:

`Gate 99ZZA - Revma Frozen Birth Add Lookup Repair`

That gate should be code-only and narrow: keep the open grid keyed by its birth
identity/add policy for add decisions, emit explicit locked setup/add-policy
fields, add a literal `setup_type` alias if Pro wants that receipt name, and
rerun a one-pair visual proof that includes at least one add where
`birth_*` and `current_*` classification differ.
