# App vs TradingView Execution Verification Matrix

**Started:** 2026-06-01
**Stage:** v2.0.3 candidate data verification patch
**Scope:** App Data section vs TradingView `Limni ADR Verifier` indicator before automation selection.

## Release Discipline

- This verification stage has already produced app behavior changes, so it should be treated as a patch candidate rather than a silent v2.0.2 continuation.
- Current working label: `v2.0.3 candidate - data verification`, but as of 2026-06-04 this is blocked by engine redesign work and should not be treated as close to release.
- Do not update `release-manifest.json`, tag, push, deploy, or mutate `releases/v2/canon/` until Freedom explicitly approves.
- `canonVersion` remains `v2` unless frozen historical canon artifacts are intentionally rematerialized.

## June 4 Timing Contract And Blocker

The verifier and app must use separate concepts for canonical market window and strategy execution window.

Current intended contract, expressed in New York local time with `America/New_York` semantics:

| Asset class | Market-truth open | Strategy execution open | Strategy new-entry cutoff | Strategy execution close | Canonical visual close |
|---|---|---|---|---|---|
| FX | Sunday 6pm NY | Sunday 8pm NY | Friday 9am NY | Friday 11am NY | Friday 5pm NY |
| Indices/commodities/default non-crypto | Sunday 7pm NY | Sunday 8pm NY | Friday 9am NY | Friday 11am NY | Friday 5pm NY |
| Crypto | Sunday 8pm NY | Sunday 8pm NY | Next Sunday 8pm NY | Next Sunday 8pm NY | Next Sunday 8pm NY |

Status:

- Pine verifier has been updated to this timing/visual contract.
- App execution helpers have been patched for non-crypto to `execution_ny_fri9_entry_fri11_close_v1`; non-crypto execution blocks new entries at Friday 9am NY and force-closes at Friday 11am NY. Crypto is intended to use the Sunday 8pm NY to Sunday 8pm NY policy from the v2.0.3 reset/crypto contract.
- Execution weekly return derivation, strategy artifacts, and global preload stamps were bumped so new rows do not reuse old cached contracts.
- App-vs-TradingView verification should use the refreshed rows below as the current baseline.

Fresh refresh checkpoint, 2026-06-04:

- Ran `npm run db:migrate`.
- Ran `npm run performance:refresh-canonical -- --continue-on-error`.
- Repaired `tandem:weekly_hold:none` with `npm run performance:refresh-canonical -- --skip-pair-returns --key=tandem:weekly_hold:none --continue-on-error`.
- Ran `npm run verification:visible-engine-stats`.
- New execution rows for `execution_ny_fri9_entry_fri11_close_v1`: `684` weekly rows across `19` closed weeks.
- Canonical market-truth rows were refreshed separately: `684` weekly rows across the same `19` closed weeks.
- All 12 visible strategy configurations have refreshed `strategy_week_shards`.
- Source caveat: the week `2026-03-29T23:00:00.000Z` still lacks exact close-bar coverage for `SPXUSD`, `NDXUSD`, `NIKKEIUSD`, `XAUUSD`, `XAGUSD`, and `WTIUSD`; stored 1h provider bars stop early around the Good Friday market holiday. Weekly Hold logs those missing rows and computes from available canonical rows.
- Strategy shard repair result: the full refresh hit the time budget on `tandem:weekly_hold:none`; targeted repair completed that final shard.

Current visible engine stats after refresh:

| Configuration | Return | Max DD | Weekly win rate |
|---|---:|---:|---:|
| Tandem / Weekly Hold | `+175.66%` | `45.57%` | `63.16%` |
| Tandem / ADR Grid | `+1349.64%` | `177.47%` | `73.68%` |
| Tandem / ADR Grid / Pair Fill Cap | `+822.44%` | `85.38%` | `73.68%` |
| Tiered / Weekly Hold | `+75.95%` | `21.99%` | `63.16%` |
| Tiered / ADR Grid | `+293.35%` | `21.92%` | `94.74%` |
| Tiered / ADR Grid / Pair Fill Cap | `+173.98%` | `20.75%` | `89.47%` |
| Agreement / Weekly Hold | `+34.30%` | `34.54%` | `52.63%` |
| Agreement / ADR Grid | `+333.97%` | `22.39%` | `78.95%` |
| Agreement / ADR Grid / Pair Fill Cap | `+197.48%` | `23.19%` | `84.21%` |
| Selector / Weekly Hold | `-10.03%` | `63.40%` | `57.89%` |
| Selector / ADR Grid | `+525.12%` | `63.95%` | `78.95%` |
| Selector / ADR Grid / Pair Fill Cap | `+251.47%` | `33.91%` | `73.68%` |

Snapshot files:

- `reports/data-verification/app/visible-engine-stats-2026-06-04.json`
- `reports/data-verification/app/visible-engine-stats-2026-06-04.md`

## Verification Axes

Every app-vs-indicator comparison should identify these axes explicitly:

| Axis | Values | Notes |
|---|---|---|
| Period state | `current_live`, `closed_week` | Current live comparisons can drift by source/candle completion. Closed weeks are the cleaner baseline. |
| Strategy mode | `weekly_hold`, `adr_grid` | Weekly Hold verifies price windows first. ADR Grid adds fills, ordering, resets, and caps. |
| Anchor | `market_truth`, `execution` | Market truth is true session open per asset class. Execution is strategy tradable open. |
| Normalization | `raw`, `adr_normalized` | Raw first. ADR-normalized after raw agrees. |
| Live bar mode | `confirmed`, `realtime` | App Data live rows use completed provider candles. Indicator defaults to `Confirmed` for parity. |
| Asset class | `fx`, `indices`, `commodities`, `crypto` | FX first. Non-FX windows need extra TradingView session validation. |
| Direction | `long`, `short` | Direction flips raw underlying return for short tests. |
| Provider/source | App provider, TradingView chart provider | Record chart broker/symbol because live prices can differ. |
| App surface | `data`, `performance`, `indicator` | Data and Performance must also agree with each other where they expose the same execution-anchor rows. |

## Parity Scoring

Use a parity score instead of a binary pass/fail when the rule path agrees but a known source/method detail causes small numeric drift.

| Score Band | Meaning |
|---|---|
| `95-100%` | Clean pass or only rounding/source-candle dust. |
| `85-94%` | Usable parity. Rule path agrees, but one denominator/source/method needs later tightening. |
| `70-84%` | Partial parity. Continue only if the discrepancy is understood and documented. |
| `<70%` | Do not rely on the result until the mismatch is fixed. |

For the EURUSD baseline, a scenario can be marked usable when entry/exit/direction agree and return/DD values are explained by a documented denominator or source difference.

## EURUSD Baseline Coverage Plan

The first baseline pass is intentionally narrow: EURUSD only, using three weekly samples per configuration before broadening to more pairs, directions, assets, and strategy surfaces.

Configuration count:

- 3 mode/cap groups:
  - `Weekly Hold`
  - `ADR Grid`
  - `ADR Grid + Pair Fill Cap`
- 4 anchor/basis combinations per group:
  - `Market Truth / Raw`
  - `Market Truth / ADR Normalized`
  - `Execution / Raw`
  - `Execution / ADR Normalized`
- Total: 12 configurations.
- EURUSD baseline target: 3 weekly samples per configuration = 36 EURUSD checks.

Configuration status:

| ID | Mode | Cap | Anchor | Basis | EURUSD Weeks Target | Status | Notes |
|---|---|---|---|---|---:|---|---|
| CFG-WH-MT-RAW | Weekly Hold | none | Market Truth | Raw | 3 | Pass for rule parity | Evidence: current live week with caveat, Weeks Back 1 confirmed, Weeks Back 2 confirmed. Confirmed-only coverage is 2/3. |
| CFG-WH-MT-ADR | Weekly Hold | none | Market Truth | ADR Normalized | 3 | 90% parity, usable caveat | Evidence: current live week with caveat, Weeks Back 1 confirmed, Weeks Back 2 confirmed. Confirmed-only coverage is 2/3. |
| CFG-WH-EXE-RAW | Weekly Hold | none | Execution | Raw | 3 | Pass for rule parity | Evidence: current live week with caveat, Weeks Back 1 confirmed, Weeks Back 2 confirmed. Confirmed-only coverage is 2/3. |
| CFG-WH-EXE-ADR | Weekly Hold | none | Execution | ADR Normalized | 3 | 95% parity, usable caveat | Evidence: current live week with caveat, Weeks Back 1 confirmed, Weeks Back 2 confirmed. ADR denominator/source drift remains documented. |
| CFG-GRID-MT-RAW | ADR Grid | none | Market Truth | Raw | 3 | Deferred, not blocking | ADR Grid source-of-truth uses Week Open levels and Execution fill window; no separate Market Truth raw screen is required while finishing the active no-cap checkpoint. |
| CFG-GRID-MT-ADR | ADR Grid | none | Market Truth | ADR Normalized | 3 | Deferred, not blocking | See active no-cap ADR Grid checkpoint; remaining exactness drift is canonical price-store/broker-feed variance. |
| CFG-GRID-EXE-RAW | ADR Grid | none | Execution | Raw | 3 | Passed for first-pass parity | Same close-and-rearm fills as accepted ADR-normalized checkpoint; Raw is covered by return math. |
| CFG-GRID-EXE-ADR | ADR Grid | none | Execution | ADR Normalized | 3 | Passed, 90%+ caveat | EURUSD no-cap accepted with canonical price-store/broker-feed caveat. |
| CFG-GRIDCAP-MT-RAW | ADR Grid | Pair Fill Cap | Market Truth | Raw | 3 | Not required for this grid model | Grid source uses weekly anchor plus execution fill window, not a separate Market Truth grid mode. |
| CFG-GRIDCAP-MT-ADR | ADR Grid | Pair Fill Cap | Market Truth | ADR Normalized | 3 | Not required for this grid model | Grid source uses weekly anchor plus execution fill window, not a separate Market Truth grid mode. |
| CFG-GRIDCAP-EXE-RAW | ADR Grid | Pair Fill Cap | Execution | Raw | 3 | Reopened after app patch | Execution windows and ordered-rearm grid behavior changed on 2026-06-04. Regenerate UI, stored ledger, `computeWeeklyHold()`, and Pine evidence before classifying. |
| CFG-GRIDCAP-EXE-ADR | ADR Grid | Pair Fill Cap | Execution | ADR Normalized | 3 | Reopened after app patch | Old capped-grid evidence is stale. Patched runtime returns EURUSD `7` fills / `+1.4%` for both May 18 and May 25 samples, replacing the old `11-12` fill checkpoints. |

Current manual checkpoint from Freedom, 2026-06-02:

- Weekly Hold EURUSD 3-week test, including current week:
  - Market Truth / Raw: passed, 100% parity.
  - Market Truth / ADR Normalized: passed, 100% parity.
  - Execution / Raw: passed, 100% parity.
  - Execution / ADR Normalized: passed, 100% parity.
- ADR Grid EURUSD no-cap checkpoint:
  - ADR Normalized / Synthetic App Window 21:00 UTC / Confirmed 1H passed at 90%+ parity.
  - Raw is covered by the same close-and-rearm fills and return math.
  - May 31 2026: exact after rounding.
  - May 24 2026: exact fills/P&L; DD delta about `0.05`.
  - May 17 2026: Pine missed one app fill; accepted as broker/feed/canonical-store variance.

Future parity depth, if reopened:

- After the 36 EURUSD baseline checks, add wider pair coverage, both long and short examples, non-FX asset windows, and automated app export vs indicator-log diffs.

## ADR Grid Rule-Definition Pause - 2026-06-02

Weekly Hold has passed the EURUSD baseline rule path for all four anchor/basis combinations, with ADR-normalized cases classified as usable because the remaining drift is the documented ADR denominator/source difference.

ADR Grid testing is paused before the first grid parity pass. The current app historical executor and the expected visual/trading model describe different rules:

- Current app historical ADR Grid: execution-window open anchor, no initial fill at week open, `0.20 ADR` levels, individual fill opens only when a level is touched, each fill closes fully at the next `0.20 ADR` target, then that level rearms on a later bar.
- Current app `grid_reset`: closes remaining active fills and stops that pair/grid for the rest of the week. It is not a basket TP or runner-preserving partial close.
- Current app grid parent rows: aggregate ledger rows over child fills, not independently traded basket positions.
- Model under review: market-truth week-open seeded position, `0.20 ADR` grid levels from that open, partial close at the first favorable level, remaining exposure/runners stay open while additional grid entries can trigger.

Reason for pause: continuing Pine styling or screenshot parity against the current app engine would only validate the close-and-rearm model. If the intended strategy is the initial-position partial-close/runner model, the historical kernel needs a separate backtest or source-of-truth decision first.

Follow-up after ADR Grid runner/refill and seed research:

- Current app close-and-rearm remains the source of truth for the ADR Grid verifier revamp.
- Runner/refill, half-runner trailing, whole-fill trailing, and execution-open seed did not beat the capped Tandem current app baseline.
- Continue ADR Grid parity against the current app model, not against a partial-runner model.
- Indicator visual requirements:
  - distinguish grid levels by activation count using line color,
  - cap visible activation states at `3+` for Pair Fill Cap,
  - use aggregate red DD, green realized-TP, and light-green favorable-excursion boxes,
  - use compact entry markers at fill levels and TP markers at the actual fill TP price,
  - avoid visuals that imply partial close or runner behavior.
- Local Pine revamp has started with activation-count grid lines, aggregate move boxes, and exact-price TP markers. Next gate is TradingView compile and screenshot parity.

Boundary: spread, commission, slippage, and broker execution modeling are out of scope for this first parity layer and should be added after no-cost rule parity is stable.

## App Internal Parity Checks

The app has two relevant surfaces:

- Data section: exposes market-truth/execution and raw/ADR-normalized pair returns, but does not expose strategy/grid/fill drilldown.
- Performance section: strategy-scoped and execution-anchored; it exposes detailed strategy/grid/fill results, but does not currently switch to Market Truth.

Internal app parity is required anywhere the surfaces overlap:

| Check | Data Section | Performance Section | Status |
|---|---|---|---|
| Weekly Hold execution raw, same pair/direction/week | Execution raw pair row | Strategy trade raw return before/alongside normalization | Pending |
| Weekly Hold execution ADR-normalized, same pair/direction/week | Execution raw divided by Data ADR | Strategy displayed/normalized return | Pending |
| ADR Grid execution raw, same pair/direction/week | Pair execution raw context only | Grid/fill returns and weekly totals | Partial overlap only |
| ADR Grid execution ADR-normalized | Data ADR context only | Grid/fill normalized returns | Pending after ADR parity |

Rule: do not use a Performance row as TradingView evidence unless the same pair/direction/week can be reconciled against the Data section's execution row or documented as strategy-only grid/fill behavior.

## Scenario Checklist

### Weekly Hold

| ID | Period | Anchor | Basis | Live Bar | Asset | Pair | Direction | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| WH-FX-LIVE-MT-RAW-001 | current_live | market_truth | raw | realtime screenshot vs app completed H1 | fx | EURUSD | SHORT | Pass with live-candle caveat | User screenshot in chat, 2026-06-01 21:49 ET-ish; app query below |
| WH-FX-LIVE-MT-RAW-002 | current_live | market_truth | raw | confirmed | fx | EURUSD | SHORT | Pending screenshot after verifier update | Use updated Pine `Live Bar = Confirmed` |
| WH-FX-CLOSED-MT-RAW-001 | closed_week | market_truth | raw | confirmed | fx | EURUSD | SHORT | Pass, ADR method split patched | User screenshot in chat, 2026-06-01 22:02 ET-ish; app query below |
| WH-FX-CLOSED-MT-RAW-002 | closed_week_minus_2 | market_truth | raw | confirmed | fx | EURUSD | SHORT | Pass, old ADR display caveat | User screenshot in chat, 2026-06-02 11:43 ET; app query below |
| WH-FX-LIVE-MT-ADR-001 | current_live | market_truth | adr_normalized | confirmed | fx | EURUSD | SHORT | 95% parity, live-candle caveat | User screenshot in chat, 2026-06-02 12:02 ET; app live exit matches return, stored H1 explains DD |
| WH-FX-CLOSED-MT-ADR-001 | closed_week | market_truth | adr_normalized | confirmed | fx | EURUSD | SHORT | 90% parity, usable caveat | User screenshot in chat, 2026-06-02 12:01 ET; trade rule passes, ADR denominator differs |
| WH-FX-CLOSED-MT-ADR-002 | closed_week_minus_2 | market_truth | adr_normalized | confirmed | fx | EURUSD | SHORT | 90% parity, usable caveat | User screenshot in chat, 2026-06-02 11:55 ET; trade rule passes, ADR denominator differs |
| WH-FX-LIVE-EXE-RAW-001 | current_live | execution | raw | confirmed | fx | EURUSD | SHORT | Pass with live-candle caveat | User screenshot in chat, 2026-06-02 13:01 ET; app execution P/L and OANDA M5 DD match after rounding |
| WH-FX-CLOSED-EXE-RAW-001 | closed_week | execution | raw | confirmed | fx | EURUSD | SHORT | Pass | User screenshot in chat, 2026-06-02 13:02 ET; app stored execution return/DD match after rounding |
| WH-FX-CLOSED-EXE-RAW-002 | closed_week_minus_2 | execution | raw | confirmed | fx | EURUSD | SHORT | Pass | User screenshot in chat, 2026-06-02 13:03 ET; app stored execution return/DD match after rounding |
| WH-FX-LIVE-EXE-ADR-001 | current_live | execution | adr_normalized | confirmed | fx | EURUSD | SHORT | 95% parity, live-candle caveat | User screenshot in chat, 2026-06-02 13:22 ET; app normalized P/L and M5 DD agree after rounding |
| WH-FX-CLOSED-EXE-ADR-001 | closed_week | execution | adr_normalized | confirmed | fx | EURUSD | SHORT | 95% parity, usable caveat | User screenshot in chat, 2026-06-02 13:22 ET; raw rule exact, ADR denominator/source drift only |
| WH-FX-CLOSED-EXE-ADR-002 | closed_week_minus_2 | execution | adr_normalized | confirmed | fx | EURUSD | SHORT | 95% parity, usable caveat | User screenshot in chat, 2026-06-02 13:22 ET; raw rule exact, ADR denominator/source drift only |

### ADR Grid

| ID | Period | Anchor | Basis | Grid Cap | Asset | Pair/System | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| GRID-FX-CURRENT-EXE-ADR-EURUSD-NOCAP-001 | current_live | execution window | adr_normalized | none | EURUSD SHORT / ADR Grid | Pass, 90%+ caveat | 2026-06-03 app screenshot: Tiered / ADR Grid / None, FX, week `Jun 01 2026`, EURUSD `4 fills / 4W / 0L / +0.80%`; Pine/app path accepted for first pass. |
| GRID-FX-CLOSED-EXE-ADR-EURUSD-NOCAP-001 | closed_week | execution window | adr_normalized | none | EURUSD SHORT / ADR Grid | Pass | May 24 2026: Pine and app both `12 fills / +2.4%`; DD delta about `0.05`. |
| GRID-FX-CLOSED-EXE-ADR-EURUSD-NOCAP-002 | closed_week_minus_2 | execution window | adr_normalized | none | EURUSD SHORT / ADR Grid | 90%+ parity, accepted caveat | May 17 2026: Pine `11 fills / +2.2%`, app `12 fills / +2.4%`; canonical-store/broker-feed variance accepted. |
| GRID-FX-CURRENT-EXE-ADR-EURUSD-PAIRCAP-001 | current_live | execution window | adr_normalized | pair_fill_cap | EURUSD SHORT / ADR Grid | Pass on fills/P&L | May 31 2026 Pine: `4 fills / 4 TP`, `+0.8%`, Max DD `-0.41%`, status `RESET CLOSED`; app: EURUSD `4 fills`, `4W / 0L`, `+0.80%`. |
| GRID-FX-CLOSED-EXE-ADR-EURUSD-PAIRCAP-001 | closed_week | execution window | adr_normalized | pair_fill_cap | EURUSD SHORT / ADR Grid | Stale after app patch | May 24 2026 old evidence said `11 fills / +2.2%`; patched runtime now returns `7 fills / +1.4%`. Needs fresh Pine/UI/export evidence. |
| GRID-FX-CLOSED-EXE-ADR-EURUSD-PAIRCAP-002 | closed_week_minus_2 | execution window | adr_normalized | pair_fill_cap | EURUSD SHORT / ADR Grid | Stale after app patch | May 17/18 2026 old evidence said Pine `11 fills / +2.2%`, script `12 fills / +2.4%`, UI `5W / 1L / +0.19%`; patched runtime now returns `7 fills / +1.4%`. Reconcile all app surfaces again. |
| GRID-FX-CURRENT-EXE-RAW-EURUSD-PAIRCAP-001 | current_live | execution window | raw | pair_fill_cap | EURUSD SHORT / ADR Grid | Paused | Resume only after visible Basket output, stored ledger rows, `computeWeeklyHold()`, and Pine agree under `strategy-artifact-v30`. |

## First Evidence: EURUSD Live Weekly Hold Market Truth Raw

TradingView screenshot settings:

- Symbol: `EURUSD`
- Bias list: `SHORT`
- Mode: `Weekly Hold`
- Anchor: `Market Truth`
- Basis: `Raw`
- Live Bar: previous indicator version, effectively realtime

Screenshot table:

- Entry: `1.16543`
- Exit: `1.16295`
- P/L: `+0.21%`
- Max DD: `-0.09%`

App Data query after live canonical-window patch:

| App row | Entry | Exit | Underlying raw | SHORT raw | Max DD |
|---|---:|---:|---:|---:|---:|
| Market Truth, completed H1 | `1.16543` | `1.16315` | `-0.1956%` | `+0.1956%` | `-0.0901%` |
| Execution, completed H1 | `1.16486` | `1.16315` | `-0.1468%` | `+0.1468%` | `-0.1391%` |

Result:

- Market Truth entry matches exactly at `1.16543`.
- Market Truth drawdown matches within rounding at `-0.09%`.
- P/L direction and magnitude agree.
- Remaining exit/P&L delta is expected because the screenshot used TradingView realtime/in-progress candle near `1.16295`, while the app Data row used OANDA's latest completed H1 candle at `1.16315`.

Classification:

- Not an indicator bug.
- Not a TradingView/app rule mismatch after the app patch.
- Previous app issue fixed locally: current-week canonical live rows were using the display week key rather than the canonical market-truth window helper.
- Remaining difference: source/candle-completion timing.

## Second Evidence: EURUSD Closed-Week Weekly Hold Market Truth Raw

Scenario:

- ID: `WH-FX-CLOSED-MT-RAW-001`
- Symbol: `EURUSD`
- Bias list: `SHORT`
- Mode: `Weekly Hold`
- Anchor: `Market Truth`
- Basis: `Raw`
- Live Bar: `Confirmed`
- Weeks Back: `1`

TradingView screenshot table:

- Week: `May 24 2026`
- Entry: `1.16394`
- Exit: `1.16621`
- P/L: `-0.2%`
- Max DD: `-0.4%`
- ADR: `57.4 pips`

App Data values for `2026-05-24T23:00:00.000Z`:

| Anchor | Window Open UTC | Window Close UTC | Entry | Exit | Underlying Raw | SHORT Raw | SHORT Max DD |
|---|---|---|---:|---:|---:|---:|---:|
| Market Truth | `2026-05-24T21:00:00.000Z` | `2026-05-29T21:00:00.000Z` | `1.16394` | `1.16621` | `+0.195027%` | `-0.195027%` | `-0.399505%` |
| Execution | `2026-05-25T00:00:00.000Z` | `2026-05-29T21:00:00.000Z` | `1.16418` | `1.16621` | `+0.174372%` | `-0.174372%` | `-0.378807%` |

Result:

- Market Truth entry matches exactly at `1.16394`.
- Market Truth exit matches exactly at `1.16621`.
- SHORT raw return matches after rounding: app `-0.195027%`, indicator `-0.2%`.
- SHORT max DD matches after rounding: app `-0.399505%`, indicator `-0.4%`.

Classification:

- Raw Weekly Hold Market Truth passes for closed-week EURUSD SHORT.
- ADR mismatch was an indicator-method issue, not simply stale current-week ADR. The screenshot shows historical absolute ADR distance (`57.4 pips`), while app Data ADR-normalization uses average daily range percent (`0.4522089263%`, about `52.6 pips` at entry `1.16394`).
- ADR decision: keep the app model as source of truth. Do not change app ADR behavior to match the old indicator display. The app needs percent ADR for normalized reporting and absolute ADR distance for ADR Grid execution.
- The verifier was patched to expose both:
  - `ADR`: app-style percent ADR converted to pips at the Weekly Hold entry price.
  - `ADR Dist`: absolute ADR distance used by ADR Grid entry/TP logic.
- Recheck this scenario after pasting the patched indicator. Expected verifier rows: `ADR` near `52.6p / 0.45%`, `ADR Dist` near `57.4 pips`.

## Third Evidence: EURUSD Closed-Week Minus 2 Weekly Hold Market Truth Raw

Scenario:

- ID: `WH-FX-CLOSED-MT-RAW-002`
- Symbol: `EURUSD`
- Bias list: `SHORT`
- Mode: `Weekly Hold`
- Anchor: `Market Truth`
- Basis: `Raw`
- Live Bar: `Confirmed`
- Weeks Back: `2`

TradingView screenshot table:

- Week: `May 17 2026`
- Entry: `1.16196`
- Exit: `1.16023`
- P/L: `+0.15%`
- Max DD: `-0.36%`
- ADR: `60.9 pips`

App Data values for `2026-05-17T23:00:00.000Z`:

| Anchor | Window Open UTC | Window Close UTC | Entry | Exit | Underlying Raw | SHORT Raw | SHORT Max DD |
|---|---|---|---:|---:|---:|---:|---:|
| Market Truth | `2026-05-17T21:00:00.000Z` | `2026-05-22T21:00:00.000Z` | `1.16196` | `1.16023` | `-0.148886%` | `+0.148886%` | `-0.363179%` |
| Execution | `2026-05-18T00:00:00.000Z` | `2026-05-22T21:00:00.000Z` | `1.16140` | `1.16023` | `-0.100740%` | `+0.100740%` | `-0.411572%` |

ADR context from app Data normalization lookup:

- App ADR percent: `0.4957311017%`.
- App ADR percent converted at entry `1.16196`: about `57.6 pips`.
- App absolute ADR distance from canonical daily bars: about `58.1 pips`.
- Screenshot still shows the old single ADR row (`60.9 pips`), so ADR display parity remains pending until the patched split-row indicator is pasted and rechecked.

Result:

- Market Truth entry matches exactly at `1.16196`.
- Market Truth exit matches exactly at `1.16023`.
- SHORT raw return matches after rounding: app `+0.148886%`, indicator `+0.15%`.
- SHORT max DD matches after rounding: app `-0.363179%`, indicator `-0.36%`.

Classification:

- Raw Weekly Hold Market Truth passes for EURUSD SHORT at `Weeks Back = 2`.
- ADR display is not used to block raw pass. It remains a display-method verification item because the screenshot does not yet show the patched `ADR` plus `ADR Dist` rows.

## Fourth Evidence: EURUSD Closed-Week Minus 2 Weekly Hold Market Truth ADR Normalized

Scenario:

- ID: `WH-FX-CLOSED-MT-ADR-002`
- Symbol: `EURUSD`
- Bias list: `SHORT`
- Mode: `Weekly Hold`
- Anchor: `Market Truth`
- Basis: `ADR Normalized`
- Live Bar: `Confirmed`
- Weeks Back: `2`

TradingView screenshot table:

- Week: `May 17 2026`
- Entry: `1.16196`
- Exit: `1.16023`
- ADR: `60.4p / 0.52%`
- ADR Dist: `60.9 pips`
- P/L: `+0.29%`
- Max DD: `-0.7%`

App Data values for `2026-05-17T23:00:00.000Z`:

| Field | Value |
|---|---:|
| SHORT raw return | `+0.148886%` |
| SHORT max DD raw | `-0.363179%` |
| App ADR percent | `0.4957311017%` |
| App ADR percent at entry | `57.6 pips` |
| App absolute ADR distance | `58.1 pips` |
| App SHORT ADR-normalized return | `+0.300336%` |
| App SHORT ADR-normalized max DD | `-0.732614%` |

Result:

- Entry, exit, and raw trade direction still agree with the passed raw scenario.
- Indicator normalized P/L is explained by its displayed ADR denominator: `0.148886 / 0.52 = +0.2863%`, rounded to `+0.29%`.
- App normalized P/L uses app ADR denominator: `0.148886 / 0.4957311017 = +0.300336%`.
- Indicator max DD is also explained by displayed ADR denominator: `-0.363179 / 0.52 = -0.6984%`, rounded to `-0.7%`.
- App max DD normalized is `-0.732614%`.

Classification:

- Not a Weekly Hold rule failure.
- Not a raw price-window failure.
- Parity score: `90%`.
- Usable pass with caveat: the trade path, entry, exit, direction, raw return, and raw DD agree; only the ADR denominator differs.
- The indicator currently derives ADR from TradingView daily bars/session handling, while the app Data section uses the app's `canonical_price_bars` ADR lookup.
- Save both indicator and app DD values for later drawdown-specific verification:
  - Indicator ADR-normalized max DD: `-0.7%`.
  - App ADR-normalized max DD: `-0.732614%`.
  - App raw max DD: `-0.363179%`.
- Continue raw/execution-window tests. Return later to tighten ADR source parity if the accumulated scorecard says the remaining drift is worth fixing.

## Fifth Evidence: EURUSD Closed-Week Minus 1 Weekly Hold Market Truth ADR Normalized

Scenario:

- ID: `WH-FX-CLOSED-MT-ADR-001`
- Symbol: `EURUSD`
- Bias list: `SHORT`
- Mode: `Weekly Hold`
- Anchor: `Market Truth`
- Basis: `ADR Normalized`
- Live Bar: `Confirmed`
- Weeks Back: `1`

TradingView screenshot table:

- Week: `May 24 2026`
- Entry: `1.16394`
- Exit: `1.16621`
- ADR: `57.2p / 0.49%`
- ADR Dist: `57.4 pips`
- P/L: `-0.4%`
- Max DD: `-0.81%`

App Data values for `2026-05-24T23:00:00.000Z`:

| Field | Value |
|---|---:|
| SHORT raw return | `-0.195027%` |
| SHORT max DD raw | `-0.399505%` |
| App ADR percent | `0.4522089263%` |
| App ADR percent at entry | `52.6 pips` |
| App SHORT ADR-normalized return | `-0.431277%` |
| App SHORT ADR-normalized max DD | `-0.883453%` |

Result:

- Entry, exit, direction, raw P/L, and raw DD agree with the passed raw scenario.
- Indicator normalized P/L is explained by its displayed ADR denominator: `-0.195027 / 0.49 = -0.3980%`, rounded to `-0.4%`.
- App normalized P/L uses app ADR denominator: `-0.195027 / 0.4522089263 = -0.431277%`.
- Indicator max DD is explained by displayed ADR denominator: `-0.399505 / 0.49 = -0.8153%`, rounded to `-0.81%`.

Classification:

- Parity score: `90%`.
- Usable pass with caveat. Trade path agrees; remaining drift is the ADR denominator source/method.
- Save both indicator and app DD values for later drawdown-specific verification:
  - Indicator ADR-normalized max DD: `-0.81%`.
  - App ADR-normalized max DD: `-0.883453%`.
  - App raw max DD: `-0.399505%`.

## Sixth Evidence: EURUSD Current Week Weekly Hold Market Truth ADR Normalized

Scenario:

- ID: `WH-FX-LIVE-MT-ADR-001`
- Symbol: `EURUSD`
- Bias list: `SHORT`
- Mode: `Weekly Hold`
- Anchor: `Market Truth`
- Basis: `ADR Normalized`
- Live Bar: `Confirmed`
- Weeks Back: `0`

TradingView screenshot table:

- Week: `May 31 2026`
- Entry: `1.16543`
- Exit: `1.16406`
- ADR: `50.3p / 0.43%`
- ADR Dist: `50.3 pips`
- P/L: `+0.27%`
- Max DD: `-0.21%`

App values for `2026-05-31T23:00:00.000Z`:

| Field | Value |
|---|---:|
| Market Truth window open | `2026-05-31T21:00:00.000Z` |
| Market Truth window close | `2026-06-05T21:00:00.000Z` |
| App live entry | `1.16543` |
| App live exit | `1.16406` |
| SHORT live raw return | `+0.1176%` |
| App ADR percent | `0.4396176699%` |
| App ADR percent at entry | `51.2 pips` |
| App SHORT live ADR-normalized return | `+0.2674%` |
| App stored-H1 SHORT max DD raw | `-0.090096%` |
| App stored-H1 SHORT max DD ADR-normalized | `-0.204941%` |

Result:

- Entry matches exactly at `1.16543`.
- Live exit matches exactly at `1.16406`.
- Indicator P/L `+0.27%` agrees with app live ADR-normalized return after rounding.
- Indicator max DD `-0.21%` agrees with stored-H1 app DD after rounding.
- ADR percent differs slightly (`0.43%` vs app `0.4396176699%`), but this is smaller than the prior closed-week denominator drift.

Classification:

- Parity score: `95%`.
- Pass with live-candle caveat. This is current-week evidence, so it is useful but less clean than closed-week evidence.
- Save both indicator and app DD values for later drawdown-specific verification:
  - Indicator ADR-normalized max DD: `-0.21%`.
  - App ADR-normalized max DD: `-0.204941%`.
  - App raw max DD: `-0.090096%`.

## Seventh Evidence: EURUSD Current Week Weekly Hold Execution Raw

Scenario:

- ID: `WH-FX-LIVE-EXE-RAW-001`
- Symbol: `EURUSD`
- Bias list: `SHORT`
- Mode: `Weekly Hold`
- Anchor: `Execution`
- Basis: `Raw`
- Live Bar: `Confirmed`
- ADR Source: `Synthetic 21:00 UTC`
- Weeks Back: `0`

TradingView screenshot table:

- Week: `May 31 2026`
- Entry: `1.16486`
- Exit: `1.16284`
- ADR: `50.7p / 0.44%`
- ADR Dist: `50.6 pips`
- P/L: `+0.17%`
- Max DD: `-0.14%`

App/OANDA values for `2026-05-31T23:00:00.000Z`:

| Field | Value |
|---|---:|
| Execution window open | `2026-06-01T00:00:00.000Z` |
| App execution entry | `1.16486` |
| App live exit | `1.16284` |
| App execution underlying raw return | `-0.1734113971%` |
| SHORT execution raw return | `+0.1734113971%` |
| OANDA M5 max high since execution open | `1.16648` |
| SHORT max DD raw | `-0.1390725066%` |
| App ADR percent | `0.4396176699%` |

Result:

- Entry matches exactly at `1.16486`.
- Exit matches exactly at `1.16284`.
- Indicator P/L `+0.17%` agrees with app execution raw return after short-direction flip and rounding.
- Indicator max DD `-0.14%` agrees with OANDA M5 high-based DD after rounding.
- The synthetic ADR display is also close to app ADR (`0.44%` displayed vs app `0.4396176699%`).

Classification:

- Parity score: `95-100%`.
- Pass with live-candle caveat. This is current-week evidence; closed-week execution raw samples are still required before marking `CFG-WH-EXE-RAW` complete.

## Eighth Evidence: EURUSD Closed-Week Weekly Hold Execution Raw

Scenario:

- ID: `WH-FX-CLOSED-EXE-RAW-001`
- Symbol: `EURUSD`
- Bias list: `SHORT`
- Mode: `Weekly Hold`
- Anchor: `Execution`
- Basis: `Raw`
- Live Bar: `Confirmed`
- ADR Source: `Synthetic 21:00 UTC`
- Weeks Back: `1`

TradingView screenshot table:

- Week: `May 25 2026`
- Entry: `1.16418`
- Exit: `1.16621`
- ADR: `54.2p / 0.47%`
- ADR Dist: `54.4 pips`
- P/L: `-0.17%`
- Max DD: `-0.38%`

App stored execution values:

| Field | Value |
|---|---:|
| Execution window open | `2026-05-25T00:00:00.000Z` |
| Execution window close | `2026-05-29T21:00:00.000Z` |
| Entry | `1.16418` |
| Exit | `1.16621` |
| High | `1.16859` |
| Low | `1.15864` |
| Underlying raw return | `+0.174372%` |
| SHORT raw return | `-0.174372%` |
| SHORT max DD raw | `-0.378807%` |
| App ADR percent | `0.4522089263%` |

Result:

- Entry and exit match exactly.
- Indicator P/L `-0.17%` agrees with the app short-direction return after rounding.
- Indicator max DD `-0.38%` agrees with app high-based DD after rounding.
- Raw execution rule parity is clean. ADR display still has the known denominator/source caveat but does not affect this raw-return check.

Classification:

- Parity score: `95-100%`.
- Pass.

## Ninth Evidence: EURUSD Closed-Week Minus 2 Weekly Hold Execution Raw

Scenario:

- ID: `WH-FX-CLOSED-EXE-RAW-002`
- Symbol: `EURUSD`
- Bias list: `SHORT`
- Mode: `Weekly Hold`
- Anchor: `Execution`
- Basis: `Raw`
- Live Bar: `Confirmed`
- ADR Source: `Synthetic 21:00 UTC`
- Weeks Back: `2`

TradingView screenshot table:

- Week: `May 18 2026`
- Entry: `1.16140`
- Exit: `1.16023`
- ADR: `59.1p / 0.51%`
- ADR Dist: `59.7 pips`
- P/L: `+0.10%`
- Max DD: `-0.41%`

App stored execution values:

| Field | Value |
|---|---:|
| Execution window open | `2026-05-18T00:00:00.000Z` |
| Execution window close | `2026-05-22T21:00:00.000Z` |
| Entry | `1.16140` |
| Exit | `1.16023` |
| High | `1.16618` |
| Low | `1.15763` |
| Underlying raw return | `-0.100740%` |
| SHORT raw return | `+0.100740%` |
| SHORT max DD raw | `-0.411572%` |
| App ADR percent | `0.4957311017%` |

Result:

- Entry and exit match exactly.
- Indicator P/L `+0.10%` agrees with the app short-direction return after rounding.
- Indicator max DD `-0.41%` agrees with app high-based DD after rounding.
- Raw execution rule parity is clean. ADR display is close enough for context but remains out of scope for this raw-return check.

Classification:

- Parity score: `95-100%`.
- Pass.

## Tenth Evidence: EURUSD Current Week Weekly Hold Execution ADR Normalized

Scenario:

- ID: `WH-FX-LIVE-EXE-ADR-001`
- Symbol: `EURUSD`
- Bias list: `SHORT`
- Mode: `Weekly Hold`
- Anchor: `Execution`
- Basis: `ADR Normalized`
- Live Bar: `Confirmed`
- ADR Source: `Synthetic 21:00 UTC`
- Weeks Back: `0`

TradingView screenshot table:

- Week: `Jun 01 2026`
- Entry: `1.16486`
- Exit: `1.16284`
- ADR: `50.7p / 0.44%`
- ADR Dist: `50.6 pips`
- P/L: `+0.40%`
- Max DD: `-0.32%`

App/OANDA values for `2026-05-31T23:00:00.000Z`:

| Field | Value |
|---|---:|
| Execution window open | `2026-06-01T00:00:00.000Z` |
| Entry | `1.16486` |
| Exit | `1.16284` |
| SHORT raw return | `+0.1734113971%` |
| OANDA M5 max high since execution open | `1.16648` |
| SHORT max DD raw | `-0.1390725066%` |
| App ADR percent | `0.4396176699%` |
| App SHORT ADR-normalized return | `+0.394460%` |
| App SHORT ADR-normalized DD | `-0.316349%` |

Result:

- Entry and exit match the execution raw evidence.
- Indicator P/L `+0.40%` agrees with app ADR-normalized return after rounding.
- Indicator max DD `-0.32%` agrees with app ADR-normalized DD after rounding.
- Current-week live evidence remains subject to provider/candle-completion caveats.

Classification:

- Parity score: `95%`.
- Pass with live-candle caveat.

## Eleventh Evidence: EURUSD Closed-Week Weekly Hold Execution ADR Normalized

Scenario:

- ID: `WH-FX-CLOSED-EXE-ADR-001`
- Symbol: `EURUSD`
- Bias list: `SHORT`
- Mode: `Weekly Hold`
- Anchor: `Execution`
- Basis: `ADR Normalized`
- Live Bar: `Confirmed`
- ADR Source: `Synthetic 21:00 UTC`
- Weeks Back: `1`

TradingView screenshot table:

- Week: `May 25 2026`
- Entry: `1.16418`
- Exit: `1.16621`
- ADR: `54.2p / 0.47%`
- ADR Dist: `54.4 pips`
- P/L: `-0.37%`
- Max DD: `-0.81%`

App stored execution values:

| Field | Value |
|---|---:|
| Execution window open | `2026-05-25T00:00:00.000Z` |
| Execution window close | `2026-05-29T21:00:00.000Z` |
| Entry | `1.16418` |
| Exit | `1.16621` |
| SHORT raw return | `-0.174372%` |
| SHORT max DD raw | `-0.378807%` |
| App ADR percent | `0.4522089263%` |
| App SHORT ADR-normalized return | `-0.385601%` |
| App SHORT ADR-normalized DD | `-0.837682%` |

Result:

- Raw execution rule path is exact from prior evidence.
- Indicator P/L `-0.37%` and max DD `-0.81%` are slightly less negative than the app values because the indicator synthetic ADR denominator is larger (`0.47%` displayed vs app `0.4522089263%`).
- The discrepancy is denominator/source drift only, not entry, exit, direction, or drawdown logic.

Classification:

- Parity score: `95%`.
- Usable caveat. Keep app ADR as source of truth for production normalization.

## Twelfth Evidence: EURUSD Closed-Week Minus 2 Weekly Hold Execution ADR Normalized

Scenario:

- ID: `WH-FX-CLOSED-EXE-ADR-002`
- Symbol: `EURUSD`
- Bias list: `SHORT`
- Mode: `Weekly Hold`
- Anchor: `Execution`
- Basis: `ADR Normalized`
- Live Bar: `Confirmed`
- ADR Source: `Synthetic 21:00 UTC`
- Weeks Back: `2`

TradingView screenshot table:

- Week: `May 18 2026`
- Entry: `1.16140`
- Exit: `1.16023`
- ADR: `59.1p / 0.51%`
- ADR Dist: `59.7 pips`
- P/L: `+0.20%`
- Max DD: `-0.81%`

App stored execution values:

| Field | Value |
|---|---:|
| Execution window open | `2026-05-18T00:00:00.000Z` |
| Execution window close | `2026-05-22T21:00:00.000Z` |
| Entry | `1.16140` |
| Exit | `1.16023` |
| SHORT raw return | `+0.100740%` |
| SHORT max DD raw | `-0.411572%` |
| App ADR percent | `0.4957311017%` |
| App SHORT ADR-normalized return | `+0.203215%` |
| App SHORT ADR-normalized DD | `-0.830233%` |

Result:

- Raw execution rule path is exact from prior evidence.
- Indicator P/L `+0.20%` agrees with app normalized return after rounding.
- Indicator max DD `-0.81%` is close to app normalized DD `-0.830233%`; the residual difference is the ADR denominator/source drift.

Classification:

- Parity score: `95%`.
- Usable caveat. Keep app ADR as source of truth for production normalization.

## Screenshot Evidence Handling

When Freedom provides a screenshot, record it here or in a follow-up evidence log with:

- scenario ID,
- chart symbol and broker/source,
- app/indicator settings,
- visible table values,
- whether the screenshot is realtime or confirmed-bar,
- conclusion and discrepancy classification.

Recommended local evidence path for saved screenshots:

`reports/data-verification/screenshots/<scenario-id>-<short-description>.png`

The chat-provided screenshot for `WH-FX-LIVE-MT-RAW-001` has not been saved as a local file by Codex; it is documented from the conversation context.

## Remaining ADR Grid Checkpoint

No-cap ADR Grid is accepted for first-pass EURUSD parity. The remaining block is Pair Fill Cap.

Accepted no-cap scenario:

- EURUSD
- SHORT list
- ADR Grid
- No Cap
- ADR Normalized
- Synthetic App Window ADR, 21:00 UTC rollover
- Confirmed 1H grid bars
- Weeks Back `0`, `1`, and `2`

Preliminary side-by-side result from prior app query and TradingView screenshots:

| Week label | TradingView Pine result | App canonical result | Classification |
|---|---:|---:|---|
| May 31 2026 | `4 fills / 4 TP`, P/L `+0.8%`, Max DD `-0.41%`, ADR `50.5p / 0.44%` | `4 fills / 4 TP`, P/L `+0.8%`, Max DD `-0.4102%`, ADR `0.4396%` | Exact after rounding. |
| May 24 2026 | `12 fills / 12 TP`, P/L `+2.4%`, Max DD `-1.63%`, ADR `54.1p / 0.47%` | `12 fills / 12 TP`, P/L `+2.4%`, Max DD `-1.6813%`, ADR `0.4522%` | Exact fills/P&L; DD delta about `0.05`. |
| May 17 2026 | `11 fills / 11 TP`, P/L `+2.2%`, Max DD `-0.94%`, ADR `59.1p / 0.51%` | `12 fills / 12 TP`, P/L `+2.4%`, Max DD `-0.9963%`, ADR `0.4957%` | One-fill drift; accepted as broker/feed/canonical-store variance. |

Current-week app screenshot detail from 2026-06-03:

| Row | App value |
|---|---|
| App surface | Performance -> Basket |
| System | Tiered / ADR Grid / Risk Overlay None |
| Metric | ADR-normalized |
| Week | `Jun 01 2026` chip, panel `May 31 2026 / Jun 01 2026` |
| EURUSD summary | SHORT, `4 fills`, `4W / 0L`, `+0.80%` |
| Fill 1 | Entry `1.16441`, Exit/TP `1.16338`, ADR `0.44%`, MAE `0.18%`, Result `GRID_TP`, `+0.20%` |
| Fill 2 | Entry `1.16645`, Exit/TP `1.16543`, ADR `0.44%`, MAE `0.00%`, Result `GRID_TP`, `+0.20%` |
| Fill 3 | Entry `1.16645`, Exit/TP `1.16543`, ADR `0.44%`, MAE `0.00%`, Result `GRID_TP`, `+0.20%` |
| Fill 4 | Entry `1.16338`, Exit/TP `1.16236`, ADR `0.44%`, MAE `0.12%`, Result `GRID_TP`, `+0.20%` |

App UI follow-up, not blocking parity: fills show MAE, but the grid row and tier headers do not visibly show their DD/MAE next to returns. Desired behavior is modular across the hierarchy like returns: tier header DD next to tier return, grid row DD next to grid return, and fill MAE/DD in child rows.

Prior Weekly Hold app Data context for `2026-05-24T23:00:00.000Z`:

| Anchor | Window Open UTC | Window Close UTC | Entry | Exit | Underlying Raw | SHORT Raw | SHORT Max DD |
|---|---|---|---:|---:|---:|---:|---:|
| Market Truth | `2026-05-24T21:00:00.000Z` | `2026-05-29T21:00:00.000Z` | `1.16394` | `1.16621` | `+0.195027%` | `-0.195027%` | `-0.399505%` |
| Execution | `2026-05-25T00:00:00.000Z` | `2026-05-29T21:00:00.000Z` | `1.16418` | `1.16621` | `+0.174372%` | `-0.174372%` | `-0.378807%` |

ADR for the app Data row: `0.4522089263%`.

Prior Weekly Hold status after screenshot:

- Raw Market Truth: passed.
- Raw Execution: passed.
- ADR Execution: usable parity with documented denominator/source drift.
- App ADR model: accepted as source of truth; indicator display split is the fix.

Captured Pair Fill Cap TradingView Pine ADR-normalized evidence from 2026-06-03 chat screenshots:

These screenshots are historical/stale after the 2026-06-04 app patch that changed execution windows and ADR Grid ordered rearm behavior. Use them only to understand the previous mismatch, not as current pass/fail evidence.

| Week label | Pine result | Notes |
|---|---:|---|
| May 31 2026 | `4 fills / 4 TP`, P/L `+0.8%`, Max DD `-0.41%`, ADR `50.5p / 0.44%` | Current week, `Grid Cap Pair Fill Cap 3`, status `RESET CLOSED`, entry `1.16340`, TP `1.16239`. |
| May 24 2026 | `11 fills / 11 TP`, P/L `+2.2%`, Max DD about `-1.6%`, ADR `54.1p / 0.47%` | `Weeks Back = 1`; exact DD text is partly obscured by the chart labels. |
| May 17 2026 | `11 fills / 11 TP`, P/L `+2.2%`, Max DD `-0.94%`, ADR `59.1p / 0.51%` | `Weeks Back = 2`, status `Completed`. |

App-side Pair Fill Cap ADR-normalized screenshots from 2026-06-03:

These app screenshots are also stale under `strategy-artifact-v30`; visible rows may still be served from persisted/preloaded artifacts until the affected shards are rebuilt.

| Week chip | App value | Parity note |
|---|---|---|
| Jun 01 2026 | EURUSD SHORT `4 fills`, `4W / 0L`, `+0.80%`; fills match entries/exits from the current-week app grid row. | Matches Pine fills/P&L. |
| May 25 2026 | Expanded capped grid shows `11` SHORT fills at `+0.20%` each; header shows `MAX MAE -1.17%`, grid max fill MAE `-0.82%`, and per-fill MAEs. | Stale after ordered-rearm patch; patched runtime is `7` fills / `+1.4%`. |
| May 18 2026 | Screenshot-visible EURUSD child row shows `1 grid`, `5W / 1L`, `+0.19%`; expanded window `May 18 05:00 -> May 19 14:00`, cap `2/3 max active`. Old `computeWeeklyHold()` returned EURUSD `12` fills and `+2.4%`. | Stale after ordered-rearm patch; patched runtime is `7` fills / `+1.4%`. Reconcile visible UI after shard/cache rebuild. |

Canonical app-script comparison:

| Week | Script command | App result | Pine comparison |
|---|---|---:|---|
| May 31 2026 | `inspect-adr-grid-week --week=2026-05-31T23:00:00.000Z` | EURUSD `4` fills, raw `+0.351694%`, ADR-normalized `+0.8%` | Exact fills/P&L. |
| May 24 2026 | `inspect-adr-grid-week --week=2026-05-24T23:00:00.000Z` | Patched runtime: EURUSD `7` fills, raw `+0.633092%`, ADR-normalized `+1.4%`; all-system `118` fills, raw `+16.312718%`. | Reopened. Old exact `11 fills / +2.2%` result was from the inflated pre-patch engine. |
| May 17 2026 | `inspect-adr-grid-week --week=2026-05-17T23:00:00.000Z` | Patched runtime: EURUSD `7` fills, raw `+0.694024%`, ADR-normalized `+1.4%`; all-system `132` fills, raw `-0.642149%`. | Reopened. Old script/Pine/UI mismatch must be retested against the patched engine and rebuilt app rows. |

Additional notes:

- May 25 demonstrates the desired hierarchy behavior where week/grid/fill rows show MAE alongside returns; the behavior was not visible/consistent in the other screenshots.
- Some fill rows display `0.00%` MAE. Defer investigation until parity logic is settled.
- Pine verifier fix applied after this screenshot set: full reset closes now stop grid cycle tracking and prevent the light green/red boxes from continuing after reset.

Next action: research the May 18 visible app output discrepancy before more screenshots.

Pair Fill Cap research targets:

- Reconcile the visible app row (`2/3 max active`, `5W / 1L`, `+0.19%`) with `inspect-adr-grid-week` / `computeWeeklyHold()` (`12` fills, `+2.4%`).
- Query or export stored ledger rows once database access is available; check whether the visible row is stale, filtered, grouped differently, or generated by an older artifact.
- Inspect active-fill count before/after TP, level rearm, same-bar open/close, and reset-close processing if stored ledger rows disagree with patched `computeWeeklyHold()`. The runtime engine now closes existing fills before opening new fills and requires a fresh retouch after TP.
- Confirm cap scope is per pair and not accidentally per grid row, source, sleeve, or tier in the visible Basket composition.
- Document the 1H OHLC ordering assumption shared by Pine and `computeWeeklyHold()`.
- Add a May 18 EURUSD Pair Fill Cap regression after the app path is fixed.
- Fix MAE/DD hierarchy rendering so week/tier/grid headers and fill rows consistently show values; distinguish true zero MAE from missing/unknown MAE.
