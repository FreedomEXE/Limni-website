# Gate 107C-R-S2 - Distinct-Grid and Exact Cache Repair

Date: 2026-07-10

Status: **SOURCE REPAIR, INDEPENDENT STATIC REVIEW, THREE CLEAN COMPILES, AND
TWO-TERMINAL SOURCE/PROFILE SYNC COMPLETE. FREEDOM-OWNED 14-DAY RERUN
REQUIRED. THE ONE-YEAR RUN AND GATE 108 REMAIN CLOSED.**

## Why this repair exists

Freedom's first Gate 107C-R-S short run, `R133322750`, reconciled all economic,
ownership, lifecycle, broker, and final-flat ledgers. It nevertheless failed
the speed gate for two independent reasons:

1. `42` aggregate cache validations differed from MT5 position truth by as
   much as `$0.02`, forcing `3,795` exact fallback scans;
2. `MaxSameDirectionGridsPerCurrency=4` counted every position leg as another
   grid, creating an unintended four-position depth cap and `17,253` repeated
   risk rejections.

The immutable negative packet and file hashes are pinned in
`GATE107CRS_SHORT_RUN_NEGATIVE_VALIDATION_2026-07-10.md`.

## Economic stop line

This pass does not change:

- RevMA q/state, direction, anchor, stochastic, spacing, birth, or add formula;
- adverse/favourable add eligibility or completed-M1 cadence;
- lot size, TP, SL, account TP/HWM, close ordering, or broker authority;
- currency signed-lot, gross-lot, managed-position, or distinct-grid limits;
- live exact position accounting;
- lifecycle, deal, ownership, reconciliation, or final outcome equations;
- Gate 108 branch or shadow formulas.

The CompactLongRun representation is versioned because repeated inline payloads
are now joined rather than copied. Every candidate and outcome event remains.

## 1. Canonical grid identity

`MagicCodec` now owns one resolver for every grid action. It:

- derives a missing grid family only for `OPEN_GRID` using the existing
  `(intent_id % 9000) + 1` rule;
- requires add/reduce/close/TP-sync actions to supply a key;
- rebuilds the canonical key from symbol, lane, variant, direction, and family;
- rejects any supplied key that disagrees with those fields.

`RiskArbiter` carries that same resolved key/family through reservation, plan,
magic, operator comment, and receipt identity. It also requires the broker
symbol to resolve to the supplied `symbol_id` before any reservation or order.

This preserves the older TrendFollow zero-key birth path while preventing the
risk guard and executor from reasoning about different grid identities.

## 2. Distinct-grid currency semantics

`CurrencyExposureGuard` now maintains checked active and batch-reserved grid
key sets.

For each active position:

- signed lots and gross lots accrue per leg;
- managed-position count accrues per leg;
- the base/quote directional grid count accrues once for the first occurrence
  of a distinct grid key;
- later legs reuse that identity without consuming another grid slot.

For each approved candidate:

- `OPEN_GRID` reserves lots, one managed-position slot, and one distinct grid
  slot;
- `ADD_GRID_LEG` requires an actually active key, reserves lots and one
  managed-position slot, and reserves zero grid slots;
- a duplicate active/reserved open, stale add, malformed key, allocation
  failure, or broker-symbol/direction identity mismatch fails closed;
- topology identity validation remains active even when numerical currency
  limits are disabled.

Receipts expose `grid_count_basis=distinct_grid_key`, active/reused key counts,
stable allocation/mismatch degradation counters, resolved candidate key,
reservation scope, and `grid_slot_reserved=true|false`.

## 3. Exact tester valuation cache

The aggregate `OrderCalcProfit` path is no longer used by runtime valuation.
It could not be terminal-exact for cross-currency multi-leg rows because MT5
converts and quantizes position economics separately.

At each authoritative structural/daily scan, GridBook caches the selected MT5
position enumeration order as:

```text
position_index -> ticket -> grid_row
```

Between structural changes, tester valuation:

1. verifies `PositionsTotal`, ticket order, row bounds, and topology counts;
2. uses `PositionGetTicket(index)` to select the exact cached ticket;
3. reads MT5's authoritative `POSITION_PROFIT` for every position;
4. aggregates those exact values into scratch rows;
5. commits rows only after the complete scan succeeds;
6. adds the exact structural scan's swap and commission components.

The server-day checkpoint refreshes swap/commission. Trade transactions mark
the topology dirty and force a structural rebuild. Live runtime remains on the
full ownership scan.

This path is still `O(N)` in open positions because MQL5 exposes no exact
per-grid account-currency scalar. The speed gain comes from eliminating the
repeated magic decoding, ownership classification, commission history,
currency reconstruction, leg sorting, and ticket-string rebuild from every M1
valuation. It does not relabel an estimate as exact.

Any ticket/order/topology/value failure emits a failure-only receipt, performs
the authoritative full refresh immediately, and revalidates the rebuilt cache
in the same cycle. One failure no longer creates thousands of blocked fallback
cycles until the next day.

Runtime summaries preserve the older counter names for compatibility and add:

```text
runtime_profile_inventory_cache_valuation_basis
runtime_profile_inventory_cached_position_profit_reprices
runtime_profile_inventory_position_profit_reads
runtime_profile_inventory_position_profit_read_failures
```

## 4. Metadata-preserving CompactLongRun joins

The packet showed that the same multi-kilobyte lifecycle candidate was copied
into generic intent and terminal outcome rows. The new contract is:

```text
receipt_payload_contract=revma_lifecycle_join_v1
```

- `revma_grid_birth/add : intent_created` remains the full canonical candidate;
- generic lifecycle intent retains its request envelope and references the
  canonical row;
- risk/order rows retain their existing risk/broker ownership;
- specialized risk/router/broker/fill outcome retains execution truth and
  references the canonical row;
- all joins use `run_id + intent_id + referenced receipt type/status`;
- Full mode keeps the inline candidate payload;
- a lifecycle-reason mismatch falls back to the original inline message rather
  than hiding the disagreement.

No row, candidate, rejection, fill, or lifecycle outcome is removed. Add
candidate headers intentionally keep frozen identity while outcome payloads may
carry the current divergent signal identity; join audits must not require those
two variant/direction fields to be equal.

## Build identity

```text
LP_EA_VERSION=0.1.28-gate107crs2-grid-cache-integrity
LP_BUILD_GATE=Gate107C-R-S2
LP_BUILD_SCOPE=revma-distinct-grid-exact-cache-receipt-integrity
```

Exact reviewed source commit:

```text
ead31a79a76f3fe7a1871234191ea960c35fc0e0
```

Pinned repository profile identities:

| Profile | SHA-256 |
|---|---|
| `limni-portfolio-revma-gate107crs-speed-smoke-20250101-20250115.ini` | `B72BA8072BC3664FED316229022C7C6FB94DA3AD900088FBC6E2A3092AB52903` |
| `limni-portfolio-revma-gate107cr-validation-20250101-20260101.ini` | `82E8C7E2E55F0D49A9B24850D9766F7EECDD08CFF0354220B654FE12878110AB` |
| `limni-portfolio-revma-fx28-fast-smoke.set` | `3AB3224D471BD704E76B5EDF5909C86263A6D5BF5DE0890DC180A6019610FB04` |
| `limni-portfolio-revma-gate107cr-validation.set` | `F93B0A96FBD9662192842905188F7443A1C9CE1AA05509465B8F23C2F491D276` |

## Compile proof

Repository preflight artifact:
`docs/research/gates/gate107/artifacts/gate107crs2-grid-cache-repair-preflight-20260710/`.

Latest result:

```text
Result: 0 errors, 0 warnings, 197706 ms elapsed, cpu='X64 Regular'
```

MetaEditor returned the known local exit code `1`; the clean result line is the
compile gate signal. Codex did not run Strategy Tester or any backtest tool.

Final compile-and-sync artifact:
`docs/research/gates/gate107/artifacts/gate107crs2-compile-sync-20260710/`.

```text
repository:     0 errors, 0 warnings, 216348 ms
terminal 14275: 0 errors, 0 warnings, 229844 ms
terminal 94497: 0 errors, 0 warnings, 193350 ms
EX5 SHA-256:    810A9E6FC7B9101DA4925BC8007B83702B064CD29067FA20FF212AD84E824D8D
```

The repository EX5 and both installed terminal EX5 files have that same hash.
The sync gate recorded zero source-hash mismatches, zero short-profile hash
mismatches, zero compile failures, zero active/stored stale-input matches, and
zero unknown running terminals.

Profile-only sync artifacts:

- `gate107crs2-one-year-profile-sync-20260710/`: both terminals match the
  pinned one-year INI hash;
- `gate107crs2-canonical-set-sync-20260710/`: both terminals match the pinned
  canonical `.set` hash.

Both profile-only passes used `SkipCompile`; their empty compile summaries are
therefore expected. They did not start Strategy Tester.

Independent static reviews found no remaining blocker in the distinct-grid
guard, exact tester cache, or CompactLongRun join contract. The cache remains
inventory-scaled `O(N)`, and dormant aggregate-estimator helpers remain
maintenance debt to remove only after runtime acceptance. Neither point is a
claim that the short-run or sub-60-second target has passed.

## Short-rerun acceptance

Freedom should rerun only the same 2025.01.01--2025.01.15 GUI profile after
the final source/profile sync. Acceptance requires:

1. zero position-profit cache validation/read failures and no repeated blocked
   fallback lane;
2. currency receipts proving distinct-grid counts rather than leg counts;
3. adds beyond four positions when the strategy path reaches them and other
   real risk limits permit them;
4. clean managed/grid PnL, ownership, lifecycle, broker, and final-flat
   reconciliation;
5. every compact lifecycle reference resolving to exactly one canonical
   candidate;
6. materially lower receipt bytes and wall time than `R133322750`.

Only after that short packet passes may Freedom run the pinned one-year
profile. A sub-60-second year remains a measured target, not a promise; exact
per-position MT5 valuation is necessarily inventory-scaled, while Gate 108's
uncapped discovery branches are designed as deterministic broker-free shadow
ledgers.
