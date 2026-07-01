# Gate 82B Weekly Boundary and Anchor Contract

Status: implementation contract for Gate 82 follow-up work. This gate clarifies
the weekly boundary, anchor, reset, carryover, visual, and PR sequence before
the MT5 EA is changed.

Verdict:

`PASS_CONTRACT_READY_FOR_GATE82C_EA_REWORK_NO_BACKTEST_CLAIM`

## Scope

Gate 82B is a contract gate only. It does not promote the hedged grid, prove a
new edge, run all-28 MT5, run repo backtests, start live trading, mutate Brain,
or replace Gate 80/82 research evidence.

Gate 82B does approve a follow-up implementation gate for the current one-pair
MT5 EA prototype:

- replace stale EA mode names with V2 names;
- fix weekly boundary handling;
- make Pine-style price-anchor entry behavior explicit;
- split time/window, visuals, and logging into small MT5 include helpers where
  that reduces main-file complexity;
- keep tester speed fast by making visuals/logging optional and throttled.

## Evidence Basis

| Evidence | Read |
| --- | --- |
| Gate 80 fully hedged reference | LONG and SHORT are independent side lifecycles with side-local fills, target resets, terminal reset-limit close, and data-end open inventory. |
| Gate 82 MT5 prototype receipt | `L3_RAW` stops a side after three target resets for that symbol-side in the current MT5 week. |
| Current EA | `longWeeklyResets` and `shortWeeklyResets` are independent counters. |
| Pine indicator | Entry levels are derived from weekly anchor high/low, not from an immediate market-fill anchor. |
| Engine week contract | Canonical week identity is Sunday 19:00 ET; execution windows are separate from logical week identity. |

Important distinction: older directional research rows use pair-reset naming
such as `STOP_AFTER_3_PAIR_RESETS_WEEK`. The current fully hedged EA lane is
not that directional pair-reset lane. For this EA lane, L3 means side-local
LONG/SHORT reset limits unless a later gate explicitly opens a pair-grid reset
experiment.

## Canonical Truth Table

| Field | Contract |
| --- | --- |
| Canonical week key | Sunday 19:00 New York local time, converted to UTC. |
| Timezone | `America/New_York` semantics with DST. Do not use fixed EST. |
| Price/market anchor start | FX anchor tracking may begin at the market-open anchor window before execution. |
| Execution start | Sunday 20:00 New York local time for strategy orders. |
| Entry cutoff | Friday 09:00 New York local time for new entries. |
| Action close cutoff | Friday 11:00 New York local time. Must be explicit in code as action-window close, not silently mixed with canonical market close. |
| Canonical market close | Separate from execution close; FX market truth closes Friday 17:00 New York local time where needed for price/canonical data. |
| Weekly boundary action | Start a new week state; reset V2 anchor state and weekly reset counters; do not flatten solely because the week changed. |
| Carryover inventory | Old positions remain real inventory and count in MTM, margin, dashboard, and logs. They keep their original audit lineage and must not pollute the new week's anchor, first-entry levels, or weekly reset counters. |
| V2 raw behavior | Pine-style weekly price anchor entries, no weekly reset cap. |
| V2 L3 behavior | Pine-style weekly price anchor entries, side-local maximum of three target resets per symbol-side per canonical week. |
| Legacy comparability | Gate 80/82 raw fill-anchor evidence remains historical evidence only. V2 does not relabel that evidence. |

## Mode Contract

The EA should not keep a large set of stale variants. The implementation should
replace the current prototype-facing modes with the V2 behavior while keeping
the old research names visible in docs and comments.

| User-facing mode | Meaning |
| --- | --- |
| `RAW_V2` | Pine-style weekly price-anchor entries, no weekly reset cap. |
| `L3_V2` | Pine-style weekly price-anchor entries with side-local three-reset cap per symbol-side per canonical week. |

Historical mapping:

| Historical label | Status |
| --- | --- |
| `NO_LIMIT_RAW` | Gate 80/82 fill-anchor comparability mode; superseded in the EA by `RAW_V2`. |
| `L3_RAW` | Gate 80/82 fill-anchor comparability mode; superseded in the EA by `L3_V2`. |

## Pine Price-Anchor Contract

For each symbol and canonical week:

1. Seed the weekly anchor once the anchor window opens.
2. Track `anchorHigh` and `anchorLow` from observed chart/market prices.
3. Use the previous anchor values when deriving first entry levels so the
   current bar/tick cannot both update the anchor and trigger from that update.
4. Long first-entry level is `prevAnchorHigh - ADR * entryMultiple`.
5. Short first-entry level is `prevAnchorLow + ADR * entryMultiple`.
6. After a side target reset, that side may reseed under the same V2 anchor
   contract until its weekly reset cap is hit.
7. At a new canonical week, the new week gets a fresh anchor state regardless
   of old open positions.

This intentionally gives LONG and SHORT different first-entry gaps when the
weekly anchor range is asymmetric.

## Architecture Contract

The EA should be kept fast in tests and useful live:

| Area | Contract |
| --- | --- |
| Main EA | Owns lifecycle orchestration only: init, tick/timer dispatch, symbol loop, trade calls. |
| Time include | Owns New York week/window conversion, DST, and action-window checks. |
| State/grid include | Owns side anchor state, next adverse/favorable levels, V2 entry readiness, and reset counters. |
| Logging include | Owns CSV file names, headers, and write helpers. Must be cheap to bypass when disabled. |
| Visual include | Owns chart objects/dashboard. Must be optional and throttled. |
| Test speed | No heavy object redraws or CSV writes every tick when disabled. Timer/dashboard refresh should be configurable. |
| Live view | Chart should show weekly anchor, V2 long/short pending zones, active fills, side reset counts, MTM, spread, ADR, and last action/error. |

Use the existing MT5 include tree under `automation/mt5/Experts/Include/`.

## Gate Sequence for This PR

| Gate | Purpose | Allowed work | Stop condition |
| --- | --- | --- | --- |
| Gate 82B | Contract and truth table | Docs only; no strategy results | This document committed |
| Gate 82C | EA V2 architecture and weekly boundary fix | MT5 source/include edits only; no compile/install unless explicitly opened | Source diff and static inspection clean |
| Gate 82D | Pine-anchor visual parity review | Optional visual/dashboard EA work and local source inspection | Visual contract present; no MT5 claim without tester evidence |
| Gate 82E | One-pair tester validation | Only if Freedom opens MT5 tester scope | Evidence package from MT5 tester, not repo backtest |

## Implementation Notes for Gate 82C

- Prefer `TimeTradeServer()` or `TimeCurrent()` as the simulated/test time
  source for MT5 boundary decisions, not unverified `TimeGMT()` assumptions.
- Convert between simulated/server time and UTC explicitly before applying the
  New York boundary function.
- Make the time source auditable in logs: server time, GMT time if used,
  derived canonical week UTC, action window state, and anchor state.
- Keep old carried positions included in `GetPositionSnapshot` and account
  MTM.
- Do not force close at week boundary.
- Do not run all-28 runtime or repo backtests from this gate.

## Frozen

No all-28 runtime, risk layer, app/runtime integration, Candidate B rescue,
Brain/COT/Strength/Regime work, pair-net flatten, optimization, promotion,
final naming, live trading, or repo backtests are opened by this contract.
