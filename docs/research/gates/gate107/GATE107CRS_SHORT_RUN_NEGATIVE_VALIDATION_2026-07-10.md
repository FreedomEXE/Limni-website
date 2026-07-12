# Gate 107C-R-S - Short-Run Negative Validation

Date: 2026-07-10

Status: **REJECTED FOR SPEED-GATE ACCEPTANCE. ECONOMIC MECHANICS RECONCILE,
BUT CACHE PARITY AND DISTINCT-GRID RISK SEMANTICS REQUIRE REPAIR. THE ONE-YEAR
RUN AND GATE 108 REMAIN CLOSED.**

## Runtime identity

Freedom ran the pinned 14-day GUI profile. Codex did not run Strategy Tester.

```text
source_commit=03e7be3443709518df79b1ce790200cdf0044bff
run_id=LPEA_2025_01_01_00_00_00_R133322750
window=2025.01.01 through 2025.01.15
packet=LPEA_FX28_MEDIUM_50000_APct_RC_2025_01_01_00_00_00_R133322734
ea_wall_seconds=21.656
mt5_test_seconds=21.928
closed_m1_cycles=12960
```

The immutable local packet is under MT5 Common Files. Its file identities are:

| File | Bytes | SHA-256 |
|---|---:|---|
| `LPEA_2025_01_01_00_00_00_R133322750_receipts.csv` | 178,708,650 | `EC3DAC7B87DF4CD0E00415BF231044ECC19E9E08C3BD41BD040D72B278181DE0` |
| `LPEA_2025_01_01_00_00_00_R133322750_summary.csv` | 10,844 | `918D1471CC51E20B4C543B937A7E18389413D08F3E8AB956443BB3AC3CA19CEF` |
| `T0_R133322750_revma_add_type_summary.csv` | 437 | `9895B3B47EA974A896ED96C6A7C629E2376D83BBB2B79795C18C7E7947909DC2` |
| `T0_R133322750_revma_bucket_summary.csv` | 3,989 | `34452467C929CFB596DD146FD899B2D918304AC2CE7502178DEB2F319D0E9498` |
| `T0_R133322750_revma_capacity_pathology.csv` | 1,969 | `452A306AB83FC78BB3115128433D212D1D3B465CAA59659F79E095AEB84EFD6D` |
| `T0_R133322750_revma_grid_outcomes.csv` | 12,713 | `A841496EBE4021EFCFA00740DBFFF81B87BE40F14414DF5873BE8FAA5D489515` |
| `T0_R133322750_revma_reconciliation_summary.csv` | 306 | `360EDA38B9AE6636B4E226B2190CB589F55F7368A330800E23FF944842969D52` |
| `T0_R133322750_revma_reconciliation_unmatched.csv` | 75 | `AAD193DA515F14CC70BA9DD4A7FDD91646500F362AC9EB80915D6C496C94A7F2` |

Tester log SHA-256:
`84112AA6B3DC690920970A32C60655EAFB1F69B7A47A82C53FEFE68C95ADD421`.

## What passed

- final balance and managed/grid outcome PnL are all `$10,059.13` / `+$59.13`;
- managed PnL equals grid-outcome PnL with `$0.00` difference;
- `36` grids all ended flat: `11` grid-TP and `25` account-TP closures;
- `123` opens and `123` closes all succeeded;
- `246` deals matched and `0` were unmatched;
- ownership mismatches, owner-map conflicts, broker rejections, no-money,
  market-closed, session-metadata, lifecycle-persistence, and formula-clean
  failures were all zero;
- worst exact managed/account floating PnL was `-$67.07` (`-0.667598%`).

The curve shape is encouraging research evidence only. It is not promotion
evidence, and this run did not exercise the earlier `649`-position inventory
regime.

## Blocking cache failure

The tester inventory cache did fail closed, but it did not pass its acceptance
contract:

```text
cache_validations=151
cache_validation_passes=109
cache_validation_failures=42
cache_max_validation_difference=0.02
cache_validation_tolerance=0.000001
exact_full_scans=3946
runtime_fallbacks=3795
cached_market_reprices=9016
```

`3,946 = 151 + 3,795`: every exact scan beyond validation checkpoints came
from the cache being blocked after a parity failure.

The current aggregate winner/loser repricer is not exact for multi-leg Forex
symbols whose profit currency differs from the account currency. MT5 converts
and quantizes each position's `POSITION_PROFIT`; aggregating legs before
`OrderCalcProfit` changes that cent-level result. Raising the tolerance would
hide a real formula difference and is not an acceptable repair.

## Blocking distinct-grid semantics failure

The packet contains `17,253` risk rejections, all with
`same_direction_currency_grid_limit`. This is not duplicate-bar processing:
the `17,376` strategy open/add candidates have unique symbol/source-M1 keys.

Static source inspection found that `CurrencyExposureGuard` increments its
directional **grid** counters for every position leg and also consumes a grid
reservation for `ADD_GRID_LEG`. Therefore
`MaxSameDirectionGridsPerCurrency=4` behaves as a directional leg/depth cap,
not a distinct-grid cap.

Observed consequences are exact:

- no grid exceeded four positions;
- `26 / 36` grids reached the accidental three-add/four-position ceiling;
- `17,235` add candidates were rejected and only `87` adds executed;
- the attractive equity curve was materially shaped by unintended capacity
  semantics and cannot be interpreted as the intended Gate 107 lifecycle.

The repair must count each active or batch-reserved grid identity once per
currency direction. Every add must still consume signed lots, gross lots, and
one managed-position slot, but it must not consume another grid slot.

## Receipt-volume diagnosis

The receipt packet has `95,948` rows and `178,708,650` bytes. The top families
are:

| Family | Rows | Bytes |
|---|---:|---:|
| `revma_grid_add` | 34,644 | 87,593,089 |
| `intent` | 17,402 | 63,873,042 |
| `revma_signal` | 17,376 | 14,081,953 |
| `risk_decision` | 17,253 | 6,733,078 |
| `engine_step` | 8,211 | 5,698,950 |

The candidate pipeline is count-consistent. The generic intent and specialized
RevMA `intent_created` rows repeat much of the same multi-kilobyte metadata,
and the specialized `risk_rejected` row repeats it again. Correcting the grid
guard should remove the mechanically doomed fifth-leg rejection loop. Any
additional compact-receipt normalization must preserve every event and join by
`intent_id`; it may replace repeated immutable payloads with references, but it
must not erase candidate or outcome facts.

## Repair gate

The implementation lane remains Gate 107C-R-S. The next source revision must:

1. repair distinct active/reserved grid counting without weakening per-leg
   currency lots or managed-position limits;
2. use an exact-validated tester repricing method for cross-currency multi-leg
   rows, emit failure-only row diagnostics, and fall back immediately on any
   ambiguity;
3. preserve live per-position scanning;
4. preserve metadata with a canonical candidate plus compact joined outcome
   representation if receipt normalization is included;
5. compile and sync cleanly before Freedom reruns the same 14-day profile.

Do not run the one-year profile until that short rerun has zero cache parity
failures, intended distinct-grid semantics, clean reconciliation, and a
materially smaller/faster packet.
