# Gate 82C MT5 EA V2 Boundary and Anchor Rework

Status: source implementation receipt. This gate applies the Gate 82B contract
to the one-pair MT5 visual prototype source.

Verdict:

`PASS_SOURCE_REWORK_STATIC_ONLY_NO_MT5_COMPILE_NO_TESTER_CLAIM`

## Scope

Gate 82C updates the MT5 EA source only. It does not compile in MetaEditor, run
MT5 Strategy Tester, install terminal files, run repo backtests, start all-28
runtime, promote a strategy, or make live-readiness claims.

## Source Changes

| Area | Change |
| --- | --- |
| Mode names | Replaced prototype-facing `NO_LIMIT_RAW` / `L3_RAW` with active user-facing modes `RAW` / `GRID_CAP`. |
| Weekly boundary | Added `automation/mt5/Experts/Include/Strategy/WeeklyBoundary.mqh` for New York DST-aware Sunday 19:00 ET canonical week math and execution/action windows. |
| Time source | Added `WeekBoundaryTimeSource` and `ServerUtcOffsetHours` so tester/server-time handling is explicit and auditable. |
| Pine price anchor | Added weekly anchor high/low state, previous-anchor snapshots, and V2 first-entry levels from `prevAnchorHigh - ADR * EntryAdrMultiple` and `prevAnchorLow + ADR * EntryAdrMultiple`. |
| Entry/action windows | New entries require the Sunday 20:00 ET to Friday 09:00 ET entry window; target closes require the Sunday 20:00 ET to Friday 11:00 ET action window. |
| Grid-cap semantics | `GRID_CAP` keeps the fully hedged lane's inherited side-local three target-reset cap per symbol-side per canonical week. The cap value is not optimized for price-anchor V2. |
| Week/cycle identity | New orders receive compact comments with mode, side, week tag, and reason code so current-week cycles can be filtered independently from carried old inventory. |
| Carryover behavior | Old tagged week positions remain included in account/symbol MTM and can close if their carried week-side cycle recovers to target during an action window; they do not pollute the new week anchor or reset counters. |
| Visuals | Added optional chart H-lines for weekly anchor high/low and V2 long/short entry levels, throttled by `VisualRefreshSeconds`. |
| CSV audit | Symbol/fill/reset logs now include week tags and V2 anchor/window fields where relevant. |

## Static Checks

Performed in repo only:

- old active EA mode references checked;
- old inline week-boundary function references checked;
- brace count checked for the EA and weekly-boundary include;
- diff scope checked.

Not performed:

- MetaEditor compile;
- MT5 install;
- MT5 Strategy Tester;
- repo backtests.

## Open Validation

The next validation gate should be MT5-focused only after Freedom opens it:

1. Compile `LimniBasketHedgeEAAlphaV2.mq5` in MetaEditor.
2. Run a one-pair tester smoke with `RAW`.
3. Confirm the chart shows anchor high/low and long/short V2 entry lines.
4. Confirm first fills wait for the Pine-style entry levels rather than opening
   instantly.
5. Confirm `GRID_CAP` stops each side after the configured cap in the active
   canonical week.
6. Confirm carried tagged old-week positions remain in MTM and do not block a
   new week cycle.

## Frozen

No all-28 runtime, risk layer, app/runtime integration, Candidate B rescue,
Brain/COT/Strength/Regime work, pair-net flatten, optimization, promotion,
final naming, live trading, or repo backtests are opened by Gate 82C.
