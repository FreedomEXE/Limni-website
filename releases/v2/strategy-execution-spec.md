# v2 Strategy And Execution Specification

Documented: 2026-06-05

This file is the v2 source of truth for strategy-source, execution, return, and verification definitions. Code, Pine verifier behavior, tests, reports, and screenshots must reconcile to this file before v2.0.3 or a later release can be treated as a trusted strategy baseline.

## Status

This is a locked rule-definition draft for the v2.0.3 data-verification pass. It does not by itself certify that current app code already matches these rules.

Before optimization, automation, or release promotion:

- audit the app execution code against this file,
- audit the TradingView verifier against this file,
- add or correct tests for the cases below,
- re-run app-vs-Pine parity for sampled pairs/weeks,
- mark any remaining variance as data-source variance or a bug.

## Strategy Source Systems

Strategy source systems decide which pairs trade and in which direction. They do not define execution mechanics.

Active v2 source systems:

- `tandem`: independent sleeves for Dealer, Commercial, Sentiment, and Strength.
- `tiered_4w`: weighted four-source tiered system.
- `agree_3of4`: four-source agreement filter.
- `selector`: consolidated selector view.

Single-source views normalize into the same strategy framework where appropriate.

## Strategy Tie-Breakers Versus Data Fallback

Intentional tie-breakers are strategy rules. Missing data fallback is not a tie-breaker.

Any rule that forces a direction, resolves a tie, or chooses a fixed basket size must be named, versioned, and auditable at the strategy-source layer. Examples already present in active/research code include:

- Agreement tie handling where Sentiment and Strength can resolve a 2-vs-2 conflict.
- Selector strength tie-break branches where Strength chooses between Sentiment and Dealer.
- Selector commercial tie-break/support-count branches where Commercial can participate in conflict resolution.
- COT forced-lean tiers, where a source can force a final lean from available COT positioning fields.
- Sentiment forced-lean fallback tiers, where neutral sentiment can be resolved by a documented fallback step.

These are valid only when the input data for the relevant source is available and the rule is part of the named strategy definition.

Data fallback is different. If COT, sentiment, strength, ADR, or price data is stale, missing, backfilled, provider-fetched, or inferred because a canonical weekly source row is absent, the result must be marked with source-readiness metadata. It must not be silently treated as a normal strategy tie-breaker.

If a system intentionally forces a fixed trade count, such as a `36 trade` basket construction rule, the exact ranking, inclusion, and tie-break order must be documented as a strategy-source version before that result can be considered canonical.

## Source Direction Completion

Source direction completion id: `source_direction_completion-v1-current`

The active Tandem source universe is intended to resolve one direction per source for every pair in the canonical 36-pair universe:

- FX: 28 pairs.
- Indices: SPXUSD, NDXUSD, NIKKEIUSD.
- Crypto: BTCUSD, ETHUSD.
- Commodities: XAUUSD, XAGUSD, WTIUSD.

The purpose is to keep Dealer, Commercial, Sentiment, and Strength sleeves structurally comparable. A source should not normally produce 18 trades one week and 36 another week simply because neutral cases were left unresolved.

Important distinction:

- Valid source data with an unclear/neutral first-pass signal should be completed by the source's documented forced-direction rules.
- Missing, stale, or corrupt source data should not be completed silently. It must be flagged as a data-readiness issue.

### Dealer Completion

Dealer source data is COT-based.

FX dealer direction:

1. If base and quote dealer biases are opposite, use the normal pair direction:
   - base bullish and quote bearish -> LONG,
   - base bearish and quote bullish -> SHORT.
2. If base/quote are neutral, matching, or otherwise unresolved, apply `resolveDealerNeutral`:
   - Tier 1: compare dealer directional ratio between base and quote.
   - Tier 2: compare dealer delta persistence when one side clearly wins and persistence is at least 3.
   - Tier 3: use OI-confirmed dealer delta when one side has confirmed delta and the other does not; if both confirm, compare dealer delta net.
   - Tier 4: compare raw dealer delta net.
   - Tier 5: forced lean from raw dealer net difference: `base.dealer_net - quote.dealer_net`.
3. If the final score is still exactly zero or unavailable, the implementation can still emit NEUTRAL. That should be treated as an audit exception for forced-36 verification.

Non-FX dealer direction:

- Uses the base market dealer bias only.
- Bullish base -> LONG.
- Bearish base -> SHORT.
- Neutral/missing base can still emit NEUTRAL or be skipped, which should be audited against the forced-36 intent.

### Commercial Completion

Commercial source data is COT-based.

FX commercial direction:

1. Calculate forced raw commercial direction from `base.commercial_net - quote.commercial_net`.
2. If no forced raw direction is available, the pair can still emit NEUTRAL. That should be treated as an audit exception for forced-36 verification.
3. If base and quote commercial delta persistence differ, and one side has persistence at least 3, persistence can override the forced raw direction when it points the other way.
4. Otherwise use the forced raw commercial direction.

Non-FX commercial direction:

- Uses the base market commercial bias only.
- Bullish base -> LONG.
- Bearish base -> SHORT.
- Neutral/missing base can still emit NEUTRAL or be skipped, which should be audited against the forced-36 intent.

### Sentiment Completion

Sentiment source data is weekly aggregate retail positioning.

For each canonical pair:

1. S1: if current aggregate maps to LONG or SHORT, use it.
2. A: if current aggregate is neutral but prior week S1 maps to LONG or SHORT, carry that direction.
3. R: if current aggregate is still neutral but current long percentage is above/below 50, fade the crowd:
   - long percentage above 50 -> SHORT,
   - long percentage below 50 -> LONG.
4. F prior S1: if prior S1 is directional, use it.
5. F prior lean: if prior long percentage is above/below 50, fade that prior lean.
6. F two-week lean: average prior one-week and prior two-week long percentages and fade the average.
7. F hardcoded: if no usable sentiment state remains, force SHORT.

The hardcoded fallback is a strategy-source completion rule, not permission to ignore missing or stale sentiment data. If the current week was built from backfilled/latest sentiment rather than proper week-start aggregates, that must be flagged.

### Strength Completion

Strength source data is internal/algo based.

For each canonical pair:

1. Combine available weekly pair-strength windows with exact stored prior weekly and monthly returns.
2. If the combined score is positive, resolve LONG.
3. If the combined score is negative, resolve SHORT.
4. If no direction is available from stored data, missing prior returns may be filled from provider data.
5. If still unresolved, use fallback sum of available strength spreads and prior returns.
6. If still unresolved, fall back in order:
   - monthly return direction,
   - weekly return direction,
   - 24h strength window,
   - 4h strength window,
   - 1h strength window,
   - LONG.

Provider-filled or fallback strength inputs must be surfaced as readiness/audit metadata. They are not equivalent to a clean locked weekly strength source.

### Forced-36 Verification Rule

For every source and week, the verifier should be able to report:

- expected pair count: 36,
- resolved LONG/SHORT count,
- NEUTRAL/unresolved count,
- missing source row count,
- stale/backfilled/fallback count,
- completion branch used for each forced pair.

Trusted strategy statistics require resolved count = 36 and missing/stale/fallback incidents = 0 unless a named research variant explicitly includes those fallbacks.

## Direction Data Readiness

All systems are expected to have confirmed direction data before the Sunday 20:00 New York weekly switch.

Expected source timing:

- Dealer and Commercial: COT data is normally available Friday 15:00 Eastern, well before the Sunday weekly switch.
- Sentiment and Strength: Sunday aggregation should complete before the Sunday 20:00 New York weekly switch.

Operational rule:

- A system should not normally skip a week.
- Missing or stale weekly direction data is an operational/data-readiness incident, not a valid strategy outcome.
- If confirmed direction data is unavailable by the weekly switch, the app must retry until the source is available or flag the system/week as stale/invalid for verification.
- Do not silently invent, skip, backfill, or neutralize a basket from incomplete data without an explicit readiness flag.
- Historical weeks built from fallback/backfilled/stale inputs must be discoverable in audit output and excluded from trusted strategy statistics until corrected or explicitly accepted under a named research variant.

## Return Modes

`Raw` return is the directed percent move from entry to exit:

- Long: `(exit - entry) / entry * 100`
- Short: `(entry - exit) / entry * 100`

`ADR Normalized` return is the raw return divided by that pair/week ADR percent.

ADR Grid unit rule:

- A `0.20 ADR` TP equals `+0.20%` in ADR-normalized reporting.
- The raw percent equivalent is `pairAdrPct * 0.20`.
- A TP win greater than `+0.20 ADR` is invalid for this execution version.

Aggregation rule:

- Current v2 strategy return reporting is additive across fills, pairs, sleeves, and weeks.
- No compounding is applied in current v2 strategy metrics.
- Compounded capital modeling is a future investment/accounting layer, not part of this execution spec.

## Weekly Windows

All weekly execution windows use New York local time so daylight saving changes do not shift intended trading boundaries.

Non-crypto:

- Market anchor opens by asset class.
- Execution fill window starts Sunday 20:00 New York.
- New entries stop Friday 09:00 New York.
- Forced execution close is Friday 11:00 New York.

Crypto:

- Crypto trades 24/7.
- Crypto week switches Sunday 20:00 New York.
- There is no Friday stop or Friday forced close for crypto.
- A crypto grid that resets waits until the next Sunday 20:00 New York week switch before it can trade again.

This crypto window applies to both Weekly Hold and ADR Grid unless a future execution version explicitly overrides it.

## Weekly Hold Baseline

Execution id: `weekly_hold-baseline-v1`

Rules:

- One trade per selected pair per week.
- Direction comes from the selected strategy source system.
- Entry anchor may be Market Truth or Execution, depending on the selected verification/reporting mode.
- Baseline Weekly Hold has no TP, no stop, and no trailing stop.
- Exit is the execution close window for the asset class.
- Current-week live values mark to the latest available confirmed/live bar depending on the surface mode.

Research-only variants:

- `Weekly Hold + Trailing Stop` is not part of baseline Weekly Hold unless separately promoted into a named execution version.

## ADR Grid Baseline

Execution id: `adr_grid-close_rearm-v1-1h_conservative`

Rules:

- Direction comes from the selected strategy source system.
- Levels are mapped from the weekly market anchor open.
- The weekly open anchor itself is never tradable.
- No initial seeded fill opens at the weekly open.
- First tradable levels are one grid step above and below the weekly open.
- Grid spacing is `0.20 ADR`.
- Every fill has a predetermined TP one grid step in the trade direction.
- A TP closes that fill completely at the TP price.
- Same-level rearm is allowed after TP, subject to the 1H ambiguity policy below.
- No partial runner model is active in this version.
- No basket-level TP guard is active in this historical result model.

### Favorable Gap

ADR Grid uses the `Favorable Gap` rule.

The weekly open anchor level is skipped permanently. With `0.20 ADR` spacing:

```text
Open + 0.20 ADR  <- nearest upper tradable level
Open             <- anchor, never tradable
Open - 0.20 ADR  <- nearest lower tradable level
```

This creates a `0.40 ADR` no-trade band around the weekly open anchor.

Direction determines which side is favorable:

- Long: upper levels are favorable, lower levels are adverse.
- Short: lower levels are favorable, upper levels are adverse.

The gap is intentional for this version. It forces price to move away from the weekly open before the first fill can occur. Removing or trading the anchor level is a new strategy version.

## ADR Grid Reset

Reset id: `adr_grid-cycle_extreme_reset-v1`

Rules:

- Reset is based on the current cycle extreme.
- Long reset target: `cycleLow + 1.0 ADR`.
- Short reset target: `cycleHigh - 1.0 ADR`.
- This cycle-extreme reset basis is mandatory for the current version.
- When reset is hit, all still-active fills close at the reset price.
- After reset, that pair/grid stops trading until the next week.
- No same-week re-entry after reset is allowed in this version.

Reset outcomes:

- `grid_reset` is a valid close reason.
- Reset can close a fill for a win, breakeven, or loss.
- A reset winner below `+0.20 ADR` is valid.
- A reset loser such as `-1.00 ADR` is valid.
- A reset winner above `+0.20 ADR` is invalid if that fill's TP should have been hit first.

## 1H Conservative Ambiguity Policy

Execution id suffix: `1h_conservative`

The v2 ADR Grid historical engine uses completed 1H OHLC bars for this verification pass. Since 1H OHLC does not reveal intrabar event order, ambiguous events are handled conservatively.

### Active Fill TP And Reset On Same Bar

If an already-active fill touches both TP and reset inside the same 1H candle:

- if the reset target is beyond the fill's predetermined TP in the profit direction, close at TP and classify as `grid_tp`;
- mark that TP-capped case with `reset_bar_tp_precedes_reset`;
- otherwise classify the fill as `grid_reset`, close at reset, and mark with `ambiguous_1h_tp_reset`.

Rationale: a fill cannot win more than its predetermined TP. When 1H OHLC cannot prove TP preceded reset and reset does not imply a profit beyond TP, choose the conservative reset close. Lower-timeframe replay may later reclassify these cases.

### Same-Bar Rearm And Re-Entry

If a fill closes at TP on a 1H bar:

- that same level is eligible to rearm after TP,
- but same-bar re-entry is omitted under 1H conservative rules,
- mark the omitted opportunity later as `ambiguous_1h_reentry_omitted` when audit fields support it.

Lower-timeframe replay may later allow same-bar TP and re-entry if sequence is provable.

### Same-Bar Reset And New Entry

If reset is hit on a 1H bar:

- no new fills open on that same 1H bar,
- even if a candidate entry level is more than `0.20 ADR` away from the reset target,
- mark omitted opportunities later as `ambiguous_1h_entry_reset_omitted` when audit fields support it.

Lower-timeframe replay may later allow a same-bar entry if it can prove the entry occurred before reset.

## Pair Fill Cap

Overlay id: `pair_fill_cap-v1`

Rules:

- Pair Fill Cap counts active fills only.
- Closed TP, reset, week-close, and active-reporting fills do not consume capacity after closure.
- Cap does not change grid geometry, TP distance, reset target, or return math.
- Cap only blocks new fills when active fill count is at the configured threshold.

No-cap mode:

- Uses the same grid geometry and close rules.
- Does not apply active-fill capacity blocking.

## Drawdown, MAE, And Risk Terms

These labels must not be mixed.

| Term | Meaning |
|---|---|
| `MAE` | Per-fill or per-trade maximum adverse excursion from entry. |
| `Grid DD` | Synchronized grid parent/path drawdown, valid only when true path data exists. |
| `Basket DD` | Synchronized portfolio path drawdown. |
| `Close DD` | Close-to-close fallback drawdown. |
| `Legacy DD` | Imported/static historical value from older research or frozen rows. |

Rules:

- Never sum per-fill MAE and call it path DD.
- Never label realized fill sequence drawdown as path DD.
- If true path drawdown is unavailable, display a fallback label such as `Close DD` or `--`.
- Fill rows should show MAE.
- Grid parent rows should show Grid DD only when true path data exists, and may separately show max descendant MAE.

## Required Fill Audit Fields

Every ADR Grid fill should eventually expose:

- pair,
- direction,
- asset class,
- strategy source system,
- tier/source metadata where applicable,
- level side: favorable or adverse,
- level number,
- entry price,
- entry time,
- TP price,
- exit price,
- exit time,
- exit reason,
- raw return,
- ADR-normalized return,
- ADR percent,
- MAE raw percent,
- MAE ADR-normalized value,
- cap state at entry,
- ambiguity flags.

Current code may not expose all fields yet. Missing fields are implementation debt for the data-verification pass.

## Verification Requirements

Before v2.0.3 or a later release is treated as strategy-trusted:

- app engine output must match this spec,
- Pine verifier output must match this spec,
- unit tests must cover reset, TP cap, Favorable Gap, Pair Fill Cap, and 1H ambiguity behavior,
- EURUSD three-week no-cap and Pair Fill Cap checks must be re-run,
- at least one FX JPY pair, gold, oil or index CFD, and crypto pair should be sampled for pip/session behavior,
- screenshots must be replaced after rule parity is restored,
- stale artifacts/caches must be invalidated with a named version bump.

## Future Research Versions

The following are not part of this spec and require new execution ids plus tests:

- trading the weekly open anchor level,
- removing the Favorable Gap,
- reset target based on weekly open instead of cycle extreme,
- allowing same-week re-entry after reset,
- same-bar re-entry using 5m, 1m, or tick sequence data,
- partial runner/refill model,
- basket-level TP guard,
- compounded capital accounting.
