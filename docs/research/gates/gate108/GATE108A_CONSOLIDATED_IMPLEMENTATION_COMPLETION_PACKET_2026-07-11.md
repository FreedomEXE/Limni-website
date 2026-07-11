# Gate 108A Consolidated Implementation Completion Packet

Date: 2026-07-11  
Baseline: `f929440669dc53bbefc9aad952ae15ca1362227d`  
Gate: `Gate108A`  
Formula: `revma-adaptive-grid-discovery-v1`  
Profile: `gate108-core-institutional-v1`

## Decision requested

Review the actual consolidated Gate 108A implementation for authorization of
the first Freedom-owned controlled Strategy Tester run.

This packet does not request strategy promotion, economic acceptance, funding
readiness, live readiness, parameter optimization, or permission for Codex to
run MT5. Phase 4R remains accepted and closed; it is not reopened here.

## Delivered boundary

Gate 108A now integrates the previously accepted formula/type, U/C book,
signed-center, and buffered-telemetry foundations with:

- one immutable FX28 completed-M1 observation cohort;
- shared signal, q, center, executable bid/ask and valuation provenance;
- a bounded R book with one `0.01` birth and one optional `0.01` add;
- Engine-owned lifecycle scheduling and close continuation;
- true concurrent branch risk and peak state;
- transition, terminal-grid, symbol, cycle, reconciliation and run summaries;
- exact terminal book/row/writer equivalence checks;
- compile-frozen strategy authority and one broker-suffix input;
- source/profile/formula/compiler/standard-library/EX5 proof tooling;
- defensive invalid-run execution quarantine.

## Architecture-to-code and invariant proof

The required pre-edit impact map and complete frozen invariant table are in
`GATE108A_REMAINING_INTEGRATION_CODE_IMPACT_AND_INVARIANTS_2026-07-11.md` in
this directory. That table remains the acceptance checklist; this packet does
not replace or weaken it.

| Authority | Implemented owner |
| --- | --- |
| Frozen profile, formula and input surface | `Core/Config.mqh`, `Core/BuildInfo.mqh`, `RevmaDiscoveryTypes.mqh` |
| One shared completed-M1 cohort and valuation | `Core/Engine.mqh`, `RevmaDiscoveryValuation.mqh` |
| R broker envelope and exact money book | `RevmaRealPortfolio.mqh`, `RevmaGridSleeve.mqh` |
| Broker-free U/C books and C support latch | `RevmaShadowPortfolio.mqh`, `RevmaCenterSupportPolicy.mqh` |
| Lifecycle scheduling and thin forwarding | `Core/Engine.mqh`, `StrategyRegistry.mqh` |
| R execution, attribution and quarantine | `TradeRouter.mqh`, `Core/Engine.mqh` |
| Transition and terminal equivalence evidence | `RevmaDiscoveryTelemetry.mqh`, `RevmaDiscoveryTelemetryBridge.mqh` |
| Source/profile/compiler/terminal proof | `Test-Gate108SourceBundle.ps1`, `Test-Gate108ControlledProfile.ps1`, `Sync-Gate108A-Terminals.ps1` |

## What the implementation does

1. Engine waits for one coherent completed-M1 snapshot for every canonical FX28
   symbol. It hashes the ordered 28-symbol snapshot, signal and strategy-state
   sets and registers that identity with the telemetry writer.
2. Each symbol uses the same frozen RevMA state signal, q, center, decision
   price, bid/ask executable prices, q-cash stress value and margin proxy in R,
   U and C.
3. Existing close owners continue before new candidates. The completed-M1
   order is mark/path, hard-risk/cleanup authority, local harvest, then
   candidate construction and allocation.
4. R may own one active grid per symbol. It can execute exactly one `0.01`
   birth and one optional adverse or favorable `0.01` add. It reserves the
   complete two-atom envelope at birth and never exceeds `0.02` lots.
5. U and C are broker-free aggregate arithmetic books. They build all
   completed-M1 candidates, sort by incremental reservation then canonical
   symbol and candidate identity, allocate, and commit independently after an
   authorized divergence. They are not silently count-capped.
6. C alone can freeze future adverse adds for a center-aligned grid after the
   first signed support transition from positive to non-positive. Existing
   inventory and favorable adds remain eligible.
7. Local harvest requires a completed excursion and at least one positive
   minor currency unit after the declared cost model. Cleanup and hard risk
   are branch-local, latched and reconciled through confirmed flat state.
8. R routes only a staged, allocated, nonterminal candidate with exact formula,
   branch, grid, symbol, direction, source-M1, snapshot, state and `0.01` lot
   identities. FOK is required and the complete canonical order deal set must
   reconcile before the real book commits.
9. A Gate 108 R grid closes at most one hedged broker position per routing
   step. Engine refreshes and reconciles inventory before closing the next
   atom. Reservation remains frozen until confirmed flat.
10. If a post-send result is partial, placed, history-linkage ambiguous, or a
    later post-fill invariant fails, the run is invalidated and Engine enters
    close-only quarantine. New exposure stays blocked while managed orders are
    cancelled and managed RevMA inventory is defensively flattened/retried.
11. Account history captured from `OnTradeTransaction`, router-proven deal
    sets, and final history must contain the exact same sorted ticket set and
    canonical deal values after subtracting the exact initialization baseline.
12. Dedicated telemetry writes transition rows only for named changes. It has
    fixed buffers and batched flushes; no unchanged-M1, per-tick or per-cell
    row path exists. Finalization fails closed on state, row, chain, count,
    hash, file or flush disagreement.

## Institutional hardening added during consolidation

The final review did not accept a clean compile as sufficient. It found and
closed the following implementation risks before source sealing:

| Risk found | Implemented correction |
| --- | --- |
| A possible broker mutation could be followed by a permanent fatal halt | Added Engine execution quarantine that preserves the invalid result while continuing managed-order cancellation and defensive R flattening |
| R state could partially mutate after a real fill and before a later check failed | Build the next grid, portfolio, candidate and telemetry state in local copies; commit together and roll back all book state if post-commit validation fails |
| Two hedged atoms could produce a mixed close batch that poisoned a valid first deal | Route at most one Gate 108 grid position close per Engine routing step |
| Callback-order and sorted-history hashes were structurally different | Store exact unique ticket sets, sort once, and compare callback, router and final-history sets plus canonical hashes |
| Same-time initialization balance/history could contaminate the run set | Capture and subtract the exact initialization history ticket set |
| Any decoded RevMA magic could pass account contamination checks | Require exact canonical symbol, RevMA variant, direction/entry/deal type, expert reason, order linkage and `0.01` deal volume |
| Deal update/delete mutations were ignored | Any post-start deal update or deletion invalidates and enters quarantine |
| Aggregate telemetry accepted arbitrary nonzero FX28 provenance | Producer registers the ordered cohort identities; writer requires exact equality for every aggregate row |
| R book invalidity was omitted from sleeve operational validity | Added symmetric R validity and invalid-reason propagation |
| Reference and actual account equity were quantized through the same positive-ceil path | Preserve the frozen distinction: reference equity uses ceil; actual/final equity proof uses mathematical floor |
| Derived R q-cash/atom/grid/equity fields could be silently healed at validation | Refresh them only at named mutation boundaries and compare them at all other reconciliations |
| Formula payload named terminal book v1 while code used v2 | Formula identity now declares terminal book v2 |
| Legacy TP/SL and TP-sync scans still ran despite frozen disabled authority | Engine now skips those scans entirely when the controlled profile disables them |
| A two-to-one R close could lose the closed atom's opening costs from the surviving marked grid | Bind each R atom to its exact position identity and opening deal money; carry the closed atom's opening and closing deal money until final flat reconciliation |
| A partial R close could expose one-atom topology with a stale two-atom mark/margin snapshot | Add an explicit stale-valuation latch; no risk snapshot or terminal seal is valid until a fresh completed-M1 mark or confirmed flat |
| Quarantine pending-order cancellation could reach another managed RevMA variant | Require the exact Gate 108 RevMA reversion lane and variant; any other order is foreign contamination and blocks mutation |
| A nonexact close volume could be treated as one closed atom | Require canonical executed volume `0.01`; every other confirmed mutation invalidates and enters quarantine |
| A long synchronization could finish after the repository was concurrently resealed | Require identical pre/post source-bundle identity and recheck the repository controlled preset after all compiles |
| Account escalation could overwrite grid-origin PnL attribution | Partition `H` and `R_nonharvest`, close counts and owner PnL by immutable origin reason; retain active close owner separately for execution and re-entry authority |
| An estimated local harvest could be discarded when actual broker realization was zero or negative | Preserve the signed, exact after-cost result in `H`; cleanup still requires `H > 0`, and hard risk continues to use the signed cycle mark |
| A flat signed-harvest loss could latch hard risk with no close work and never complete its cycle | Permit only an exact zero-inventory hard-risk latch, then require authority-complete and cycle-close linkage before reset |
| Engine could stage an old close owner before same-M1 cleanup/risk escalation and then admit exposure behind the pending close | On completed-M1 steps mark/evaluate authority first, stage closes once, and make any active grid close work block the R candidate batch |
| Missing broker session metadata on a close could be retried as if it were an ordinary closed session | Treat session-metadata absence as a fatal provenance/resource failure before order send |

## Frozen identity and input proof

```text
CapitalBudgetFraction=0.10
source_bundle_algorithm=sha256-canonical-local-include-closure-v1
source_bundle_id=sha256:73b802f48ded0eee9029e91fbf6235e49a8b2129da54dd79b385ed2c6b362141
source_files=57
external_include=Trade/Trade.mqh
profile_hash_expected_fnv1a64=5876431486502579717
formula_hash_expected_fnv1a64=5186801232550464544
underlying_revma_formula_hash_expected_fnv1a64=907110450252532080
pair_direction_formula_hash_expected_fnv1a64=8337305153952970193
preset_bytes=22
preset_sha256=57A2AECDE64179F4363E66EC85242A31BADC5AB9EACD7A862CB65AF53F454F1C
```

The canonical operator surface is:

```text
input group "Gate 108 Broker Compatibility"
input string BrokerSymbolSuffix = ".i";
```

Classification:

```text
input_group_metadata_count=1
broker_compatibility_inputs=1
strategy_inputs=0
lifecycle_inputs=0
capital_inputs=0
account_size_authority=tester_account_contract
```

The offline expected profile/formula hashes are not presented as runtime
parity. Runtime-emitted identity parity remains part of Freedom's first
controlled evidence review.

## Static and compile evidence

- Shadow book direct includes: discovery types, center support and canonical
  symbol universe only.
- Shadow forbidden dependency scan: no router, CTrade, order, position,
  history, account, symbol-info, receipt or file API.
- Transition header/serializer cardinality: `137/137`.
- Summary header/serializer cardinality: `139/139`.
- Dedicated telemetry schema: `gate108-discovery-telemetry-v16`.
- Repository compile checkpoint after final lifecycle hardening:
  `0 errors, 0 warnings`, reused from the canonical-terminal compile receipt
  compiler; the final source-bundle identity is resealed before canonical
  synchronization.

## Final synchronization evidence

Final canonical-terminal synchronization is recorded in
`docs/research/gates/gate108/artifacts/gate108a-canonical-consolidation-20260711-183200/`.
The repository and canonical receipts are both `0 errors, 0 warnings`; the
source bundle is `sha256:73b802f48ded0eee9029e91fbf6235e49a8b2129da54dd79b385ed2c6b362141`.
The final synchronized EX5 is 904680 bytes with SHA256
`D1AC7BFFD7F14C6E9490FFEA9165D7E4BBC57277E7B7DB4BBB5556E4AF58D57C` in both
the repository and canonical terminal. No tester or backtest automation ran.

## Explicit model declarations and limitations

- U/C remaining close commission/fee and historical swap are compile-frozen
  zero proxies and are included in formula/profile identity. Spread is modeled
  through executable bid/ask. These assumptions must remain visible when
  interpreting deep inventory; they are not a claim that broker carry is zero.
- R records actual attributed deal profit, swap, commission and fee and marks
  from the shared completed-M1 executable-price valuation contract.
- U/C are model-feasible research books, not broker execution proof after
  divergence.
- Gate 108A has no parameter ladder and no performance-selected constant.
- No runtime mechanics, speed, output-volume, economics, survivability or
  formula usefulness has been demonstrated in this implementation packet.
- Nothing here is a promotion or live-readiness claim.

## First Freedom-owned tiny mechanics settings

These settings are fixed for the first mechanics run so its result is
comparable with the prior short Gate 107 evidence while using the Gate 108
USD `1,000` / `0.01`-lot discovery constraint:

```text
terminal=94497 (canonical Limni/Poseidon terminal)
expert=Limni\LimniPortfolioEA.ex5
host_symbol=EURUSD.i
period=M1
model=Open prices only (Model=2)
from=2025.01.01
to=2025.01.15
optimization=Disabled
forward=Disabled
visual=Disabled
execution_delay=No delay (ExecutionMode=0 in the tester)
deposit=1000
currency=USD
leverage=1:100
input_profile=MQL5\Profiles\Tester\LimniPortfolioEA.set
BrokerSymbolSuffix=.i
```

Start from a flat tester account and do not change the deposit, leverage,
window, model, suffix or synchronized `.set`. This first run is a mechanics,
identity, reconciliation and bounded-output audit only. Open-prices modeling
does not prove broker fill quality, real-tick parity, speed projection,
economics or survivability. Return the standard EA artifacts plus the three
`gate108_<run-id>_{transitions,summaries,completion}.csv` files, then stop for
review; do not extend the window or run a ladder if capacity or hard risk is
reached early.

## Commands deliberately not run

```text
strategy_tester_run=false
smoke_runner_run=false
shard_runner_run=false
benchmark_run=false
optimization_run=false
backtest_automation_run=false
```

Freedom owns the first MT5 Strategy Tester execution and every later runtime
or economic decision.
