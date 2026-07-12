# Gate 108 Phase 4 - Buffered Discovery Telemetry

Date: 2026-07-10

Status: **IMPLEMENTED FOR OUTSIDER SOURCE REVIEW. NOT GATE 108A OR RUNTIME
ACCEPTANCE.**

## Scope

Phase 4 adds the dedicated buffered transition ledger and final lifecycle
summary writer. It does not schedule telemetry from Engine, mutate R, sync
terminals, or execute MT5 runtime evidence.

Owned source:

- `automation/mt5/Experts/Include/Strategies/Revma/RevmaDiscoveryTelemetry.mqh`
- `automation/mt5/Experts/Include/Strategies/Revma/RevmaDiscoveryTypes.mqh`
- `automation/mt5/Experts/Include/Strategies/RevmaGridSleeve.mqh`

## Frozen resource identity

The formula hash includes:

```text
schema_id             = gate108-discovery-telemetry-v1
transition buffer     = 256 rows
transition flush      = 64 rows
summary buffer        = 64 rows
summary flush         = 16 rows
maximum line          = 8192 bytes
artifact byte guard   = 4294967296 bytes
encoding              = ANSI/ASCII CSV with CRLF
failure policy        = invalidate; never silently drop or cap
```

These values are implementation constants, not MT5 inputs.

## Transition boundary

The transition artifact accepts only named events:

- branch birth and every atom admission;
- first divergence;
- center-support latch;
- every center-blocked adverse candidate;
- favorable eligibility after latch;
- first infeasibility;
- grid close;
- cleanup/hard-risk latch and completion;
- cycle close;
- explicit failure.

There is no per-tick, unchanged completed-M1, per-cell-object, ticket-list,
position-history, broker, or general-receipt emission path.

## Center-policy proof fields

Rows make independently visible:

- frozen `P0`, `C0`, and `q0`;
- previous/current center and integer ticks;
- `Support0_q`, current support, revision, and all three support signs;
- center applicability, latch state, first latch time, and update count;
- adverse-block count and atoms/lots before versus after;
- favorable eligibility after latch;
- shared origin, matched opportunity, pre-candidate state hash, event hash,
  and reconciliation hash.

The before/after inventory fields allow a latch or blocked candidate to prove
that no inventory mutation occurred. First divergence and matched-opportunity
fields allow U/C divergence to be attributed only to an authorized C block.

## Final summaries

Final rows support grid, symbol, cycle, top-offender, and reconciliation
summary types. They include lifecycle money, reservation/q-cash peaks, center
applicable/triggered/not-triggered/not-applicable counts, blocked adverse and
eligible favorable counts, first infeasibility, final flat truth, cleanup
shortfall, broker contamination, formula/reconciliation cleanliness, hashes,
and output row/byte totals.

## Fail-closed behavior

Open, header, schema, row, line, buffer, byte, write, flush, and center-counter
failures invalidate telemetry. Buffer exhaustion and the 4 GiB artifact guard
are evidence invalidation, never a silent count cap.

## Static isolation

The telemetry module has no ReceiptWriter, general receipt instance,
TradeRouter, CTrade, OrderSend, position/history, or account-info dependency.
It owns only its two dedicated files and fixed pending buffers.

## Compile and size tracking

```text
Phase 1: 215878 ms
Phase 2: 467050 ms; EX5 614004 bytes
Phase 3: 378418 ms; EX5 614142 bytes
Phase 4: 441524 ms; EX5 616390 bytes
```

Phase 4 is approximately 17% slower and `2248` bytes larger than Phase 3. It
remains below the Phase 2 compile duration and does not repeat the prior 2.16×
increase.

The first Phase 4 compile reported two `uint` to `int` warnings for
`FileWriteString` return values. Both locals were corrected to `uint`. Final
receipt:

```text
Result: 0 errors, 0 warnings, 441524 ms elapsed, cpu='X64 Regular'
```

No terminal sync, terminal compile, Strategy Tester, smoke/shard runner,
benchmark, optimization, or other MT5 runtime automation was executed.

## Stop line

Stop for outsider review from a committed, pushed, clean tree. Do not mutate R
or open Engine/runtime integration until Phase 4 is accepted.
