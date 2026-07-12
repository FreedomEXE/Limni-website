# Gate 71B Basket ADR Path Diagnostics Runtime Blocker

Generated: `2026-06-28`

## Verdict

`BLOCKED_GATE71B_FULL_1M_PATH_DIAGNOSTICS__NEEDS_BATCH_OR_WAREHOUSE_MATERIALIZATION`

## Scope

Gate 71B is intended to build the full 373-week Candidate B clean basket ADR
path diagnostic ledger using the Gate 71A protocol.

The clean model is valid, but the full 1m path build is not currently practical
as a single foreground script run.

## What Passed

- Gate 71A protocol freeze passed:
  `PASS_GATE71A_EXIT_TESTING_PROTOCOL_FREEZE__CLEAN_BASKET_PATH_REQUIRED`.
- Two-week Gate 71B smoke runs passed with no missing price weeks and no default
  ADR weeks.
- The smoke hash remained stable across the initial, sqlite, and optimized
  smoke runs:
  `219D4177C4C9A9178A6A00D447708BE75CB51B3FD6779C05D8DCCBC19A74CB9C`.
- Two-week Gate 71C smoke passed:
  `PASS_GATE71C_EXIT_BASELINE_MATRIX__PREDECLARED_BASKET_RULES_SCORED`.
- TypeScript passed after the Gate 71 script changes.

## What Failed / Blocked

- Initial full Gate 71B run hit Node heap OOM after path-cache accumulation.
- Cache clearing and ADR preloading fixed the OOM class, but did not make the
  full 373-week 1m materialization fast enough for same-turn execution.
- A full background run reached only `2/373` weeks before being stopped for
  runtime triage.
- A 10-week timed sample exceeded the 5-minute tool limit before completing.

## Technical Diagnosis

The bottleneck is the clean basket 1m path materialization itself:

- Each week requires approximately 28 symbols x the full Sunday-to-Friday 1m
  window.
- Legacy ADR Grid is intentionally not used as the Gate 71B foundation because
  Gate 71A classified it as coupled entry+exit behavior.
- The existing pair-week outcome warehouse is useful for ADR Grid / weekly-hold
  controls, but it does not contain the basket floating P/L time path needed for
  Gate 71B threshold and trailing diagnostics.

## Required Next Engineering Step

Before claiming Gate 71B complete, build a durable Gate 71 basket-path
materialization layer that can run incrementally:

1. Materialize weekly clean basket path diagnostics in batches.
2. Persist progress after each week or batch.
3. Avoid retaining full path bars in process memory.
4. Reuse preloaded ADR maps.
5. Keep legacy ADR Grid as a control only.
6. Produce a final 373-week ledger and hash.

Until that exists, Gate 71B and Gate 71C are implementation-ready but not fully
executed.

## Stop Line

Do not promote any exit rule from smoke results. Do not open Gate 72 risk work,
pair-specific exits, regime-specific exits, fair-value pruning, execution,
MT5/live, app/runtime work, or Alpha v2 from this blocker state.
