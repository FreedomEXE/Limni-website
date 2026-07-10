# Gate 107C-R-S - Inventory-Scaling Speed Repair

Date: 2026-07-10

Status: **FIRST SHORT RUNTIME REJECTED. ECONOMIC LEDGERS RECONCILED, BUT CACHE
PARITY AND DISTINCT-GRID ADMISSION FAILED. THE GATE 107C-R-S2 REPAIR IS THE
ACTIVE IMPLEMENTATION LANE. GATE 108 REMAINS CLOSED.**

## Decision

The controlled Gate 107C-R validation exposed a second prerequisite defect:
runtime cost rises with accumulated RevMA inventory and historical lifecycle
state. The repair stays inside Gate 107C-R because the required validation run
must be operationally usable before Gate 108 can rely on the same execution and
telemetry foundations.

Freedom's acceptance target is a one-year FX28 Open Prices test in less than
`60` seconds on the same machine and controlled profile. That is a measured
gate target, not a forecast or a reason to weaken the evidence contract.

Codex must not run Strategy Tester, smoke runners, shard runners, benchmarks,
optimization, or any other MT5 backtest automation. Freedom owns every runtime
test.

## Frozen economic boundary

This speed subgate must not change:

- RevMA q/state signals or observation cadence;
- birth or adverse/favourable add decisions;
- grid spacing, lot size, TP, SL, account TP, HWM, or close authority;
- FX28 capacity, currency exposure, margin, risk, or broker-admission rules;
- position/deal ownership, terminal-reason attribution, or PnL equations;
- the full `CompactLongRun` receipt field and row contract;
- Gate 108 formulas, branches, shadows, or discovery logic.

No receipt family or lifecycle row may be removed merely to improve speed.
Metadata may be represented by bounded indexes, cached aggregates, or deferred
tester-only checkpoints only when the same terminal evidence remains emitted.

## Measured baseline

Rejected diagnostic run `R90662359` remains economically unusable, but it is a
valid performance profile of the pre-speed-repair implementation:

| Metric | Observations | Time | Share of `738.359 s` wall |
|---|---:|---:|---:|
| Lifecycle snapshot persistence | `16,652` | `339.381019 s` | `45.96%` |
| Full inventory refresh | `372,156` | `105.415572 s` | `14.28%` |
| RevMA signal evaluation | `10,354,616` | `72.809920 s` | `9.86%` |
| Receipt flush | `491,019` | `3.027399 s` | `0.41%` |

The run processed `372,154` completed-M1 cycles, observed as many as `649`
managed positions and `12` open grids, and wrote a `211,716,401`-byte receipt
packet. Receipt flushing itself was not the dominant cost.

The persistence timer covered birth snapshots but did not previously include
close-latch snapshot time, so `339.381019 s` understates total persistence
cost.

Static inspection identified additional inventory-scaled work outside the
existing timing buckets:

- every executed birth/add rewrote the complete lifecycle snapshot;
- consumed pending-lifecycle entries were invalidated but retained, turning
  later lookup into a historical linear scan;
- each open grid lookup scanned all historical telemetry grid rows;
- deinitialization reconciled each position history independently, retained
  growing deal arrays, and searched those arrays repeatedly;
- every completed M1 rescanned every open position and could repeat deal
  history work for commission;
- ticket-list strings and other structural aggregates were rebuilt even when
  only market price had changed.

## Repair architecture

### 1. Tester-only persistence coalescing

Live runtime keeps immediate lifecycle and close-latch persistence.

Strategy Tester keeps the exact in-memory state on every mutation, marks each
snapshot dirty, and writes one exact birth snapshot plus one exact close-latch
snapshot during finalization. Failure remains explicit, dirty-after-checkpoint
state is summarized, and no final metadata is dropped.

This intentionally removes crash-restart persistence guarantees from the
middle of a tester run. It does not change live restart safety or a completed
tester's final evidence.

### 2. Bounded active lifecycle set

Consumed pending lifecycle records are swap-removed and their tail storage is
reset. The active set therefore tracks outstanding requests rather than every
historical request. Maximum active and allocated counts are summarized.

### 3. Indexed telemetry and one-pass reconciliation

Historical grid identity uses a deterministic open-addressed index rather than
linear lookup. Final reconciliation builds a position-identifier ownership map
once, selects the run history once, and streams the deal history once.

The independent ledgers remain separate:

- every mapped position deal contributes to its exact grid outcome;
- only exact expected RevMA magic contributes to the managed account ledger;
- mapped wrong-magic deals remain ownership contamination;
- valid RevMA deals without an executed grid identity remain unmatched;
- duplicate position identities with conflicting owners invalidate the run.

### 4. Tester-only structural inventory cache

The exact position scan remains authoritative on initialization, structural
trade changes, position-count changes, daily checkpoints, finalization, and
any cache/parity failure.

Between structural changes, a tester-only market refresh may reprice the
already validated aggregate grid rows with broker profit calculation rather
than rebuilding all position ownership and history state. This path is allowed
only when every managed position belongs to a known grid and no external,
unknown, or entry-state position is present.

The structural checkpoint retains each grid leg's open price and lots in a
sorted bounded cache. At each market refresh, legs are partitioned by the
current close price into winning and losing groups and each sign partition is
valued separately. This preserves broker conversion-side semantics for
cross-currency grids; one net average-price calculation is not assumed to be
equivalent when winning and losing legs coexist.

At an authoritative scan, aggregate repricing is compared with the exact
position result within the configured money quantum. A calculation failure or
parity difference disables the fast path and immediately returns to exact
scanning. Live runtime remains on the existing exact scan path.

Commission history is cached by position identifier and invalidated only for
the identifier affected by a new deal rather than clearing every position's
history result on every trade transaction.

## Required runtime summaries

The repaired packet must expose enough timing and fallback evidence to prove
that speed did not come from silently skipping work:

- persistence policy, deferred mutations, final checkpoints, failures, dirty
  state before/after final checkpoint, and per-snapshot timing;
- pending lifecycle maximum active and allocated counts;
- telemetry grid-index and reconciliation owner-map entries/lookups/collisions
  plus conflicting-owner contamination;
- exact structural scans, market-only reprices, daily checkpoints, cache
  fallbacks, profit-calculation failures, and maximum parity difference;
- existing signal, inventory, persistence, receipt, broker, ownership, PnL,
  capacity, and artifact summaries.

## Acceptance

The speed repair is acceptable only if the Freedom-owned runtime evidence
shows all of the following:

1. source revision and controlled profile are exact;
2. the one-year FX28 Open Prices wall time is below `60` seconds;
3. all required `CompactLongRun + AUTO` artifacts and receipt rows remain;
4. managed-account and grid-outcome PnL reconcile within `0.01`;
5. ownership mismatches, conflicting owner-map identities, unmatched deals,
   broker rejections, market-closed submissions, metadata failures, persistence
   failures, and cache parity failures are zero;
6. all grids end flat and terminal-owner/lifecycle counts reconcile;
7. the fast path reports authoritative checkpoints and does not silently stay
   active after any invalidating condition.

## Minimal Freedom-owned validation ladder

This is two controlled tests, not an optimization sweep:

1. a short mechanics/timing window to prove cache parity, fallback telemetry,
   persistence finalization, and formula reconciliation without wasting a full
   run on a mechanical defect;
2. one full-year test using the pinned Gate 107C-R validation profile for final
   integrity and speed acceptance.

If the short run is not clean, stop and repair. Do not proceed to the one-year
test. If the full-year packet is clean but misses the target, keep Gate 108
closed and profile the remaining measured bucket; do not remove metadata or
change strategy formulas to force the number.

## Implemented source identity

The exact speed-repair source commit is:

```text
03e7be3443709518df79b1ce790200cdf0044bff
```

Build identity:

```text
LP_EA_VERSION = 0.1.27-gate107crs-speed-integrity
LP_BUILD_GATE = Gate107C-R-S
LP_BUILD_SCOPE = revma-inventory-scaling-speed-integrity
```

Implemented boundaries:

- live persistence remains immediate; tester persistence is coalesced to exact
  final birth and close-latch checkpoints;
- consumed pending lifecycle entries are swap-removed and their retained
  signal strings are reset;
- telemetry grid lookup is indexed with checked allocation, checked insertion,
  complete counters, and a linear correctness fallback;
- final reconciliation uses one full-history deal pass, while preserving the
  prior independent full-position and run-window account ledgers;
- owner-map allocation/insertion conflict and identifier-set failure are
  explicit formula contamination, never false-clean evidence;
- tester inventory uses structural leg caches, sign-partitioned Forex broker
  repricing, exact structural/daily/deinit checkpoints, and immediate exact
  fallback;
- live inventory remains on exact per-position scans;
- commission history is cached by `DEAL_POSITION_ID` and invalidated only for
  the affected position, with full invalidation as fail-safe;
- the complete existing receipt families and fields remain enabled.

No RevMA strategy formula, receipt family, or lifecycle outcome row was removed.

## Static and compile proof

Independent reviews found and repaired three material pre-compile issues:

- the first aggregate repricer incorrectly assumed one net cross-currency
  winner/loser conversion side;
- the first one-pass reconciliation narrowed recovered-position grid outcomes
  to the current run window;
- the first hash implementation did not fail safely on allocation/insertion
  failure.

The accepted source partitions winning and losing legs, preserves the two
reconciliation windows, and checks every new allocation/insertion path.

Repository preflight compile receipt:
`docs/research/gates/gate107/artifacts/gate107crs-speed-repair-repo-preflight-20260710/`.

Result: `0 errors, 0 warnings` in `172700 ms`.

Canonical two-terminal compile/sync receipt:
`docs/research/gates/gate107/artifacts/gate107crs-speed-repair-compile-sync-20260710/`.

Results:

- repository compile: `0 errors, 0 warnings` in `33730 ms`;
- terminal `14275`: `0 errors, 0 warnings` in `33621 ms`;
- terminal `94497`: `0 errors, 0 warnings` in `34639 ms`;
- source hash mismatches: `0`;
- one-year tester-profile mismatches: `0`;
- active-Experts stale-input matches: `0`;
- tester-profile stale-input matches: `0`;
- unknown running terminals: `0`.

The canonical repository EX5 produced by the final sync has SHA-256:

```text
35B6CE452E7060ABB9BBFDD0E10118BF819AF7D5AFFACF98A9ED711425D99F3D
```

The installed EX5 on terminals `14275` and `94497` matches that hash exactly.

Codex did not run Strategy Tester, a smoke runner, benchmark, optimization, or
any MT5 runtime test.

## Installed GUI profiles

Both profiles are UTF-16LE GUI-loadable Strategy Tester `.ini` files and pin
source commit `03e7be3443709518df79b1ce790200cdf0044bff`.

Short mechanics/timing profile:

```text
repo: automation/mt5/tester-presets/limni-portfolio-revma-gate107crs-speed-smoke-20250101-20250115.ini
terminal: LimniPortfolioEA.EURUSD.i.M1.20250101_20250115.200.ini
window: 2025.01.01 through 2025.01.15
SHA-256: 84F1D3047B711E401565FA82444DACEAE65609B87FC0398A888A1C0F510AAA49
```

Short-profile sync receipt:
`docs/research/gates/gate107/artifacts/gate107crs-speed-smoke-profile-sync-20260710/`.

Full acceptance profile:

```text
repo: automation/mt5/tester-presets/limni-portfolio-revma-gate107cr-validation-20250101-20260101.ini
terminal: LimniPortfolioEA.EURUSD.i.M1.20250101_20260101.200.ini
window: 2025.01.01 through 2026.01.01
SHA-256: D367EE761532E258471D1936AFDE0C2FB046F4F4F7C568514F5A5AEABDA02CE2
```

Both installed copies match their repository source on terminals `14275` and
`94497`.

## Stop line

The first short run and its two blocking defects are pinned in:

- `GATE107CRS_SHORT_RUN_NEGATIVE_VALIDATION_2026-07-10.md`;
- `GATE107CRS2_DISTINCT_GRID_EXACT_CACHE_REPAIR_2026-07-10.md`.

Gate 108 implementation remains closed until the S2 source compiles, syncs,
and passes Freedom's 14-day runtime validation together with the original Gate
107C-R integrity boundary. The one-year profile must not be run before that
short packet is clean.
