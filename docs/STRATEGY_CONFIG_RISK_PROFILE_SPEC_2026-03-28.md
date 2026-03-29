# Strategy Config Risk Profile Spec — 2026-03-28

## Purpose

This document defines the next evolution of `strategyConfig.ts`.

The current config model has three selection levels:

1. `strategy`
2. `f1`
3. `f2`

That is no longer enough because P&L normalization, take-profit logic, and exit behavior are currently being carried implicitly by individual intraday filters.

Those concerns should become **shared configuration**, not strategy-specific behavior.

---

## Decision

Add a new sidebar selector directly below `Strategy`.

Current sidebar:

1. `Strategy`
2. `Filter 1`
3. `Filter 2`

Proposed sidebar:

1. `Strategy`
2. `Risk Profile`
3. `Filter 1`
4. `Filter 2`

This is the agreed direction.

---

## Naming

The recommended user-facing name is:

- `Risk Profile`

Not:

- `Risk`
- `TP/SL`
- `P&L Mode`

Reason:

- It is broader than just sizing or stop placement
- It can own normalization, TP rules, exit rules, and future risk assumptions
- It stays understandable in the sidebar

Internally, the config object can still be named:

- `RiskProfileConfig`

---

## Role Of Each Selector

### 1. Strategy

Determines the **direction source**.

Examples:

- Dealer
- Commercial
- Sentiment
- Tiered V3
- 2-of-3 Agree
- Tandem

This should answer:

**Why are we long or short?**

### 2. Risk Profile

Determines the **trade scoring and exit profile**.

Examples:

- `raw_1to1`
- `adr_normalized`
- `adr_trailing_025_025`
- future: `adr_normalized_wide_tp`
- future: `atr_normalized`

This should answer:

**How is the trade measured, normalized, and exited?**

### 3. Filter 1

Determines the **basket / holding structure**.

Examples:

- `weekly_hold`
- future: `cot_gate`
- future: `net_hold_gated`

This should answer:

**What broad basket or holding structure are we using?**

### 4. Filter 2

Determines the **entry trigger / tactical setup**.

Examples:

- `none`
- `adr_pullback`
- `stoch_rsi`
- `adr_stoch`

This should answer:

**How do we actually enter the trade?**

---

## Why Risk Profile Must Exist

Right now the app is implicitly coupling:

- entry method
- take-profit model
- exit model
- P&L unit

inside `Filter 2` and `plModel`.

That is too narrow for where Limni is going.

Examples:

- `adr_pullback` and `stoch_rsi` may use different entries but share the same ADR-normalized TP model
- a future weekly strategy may also use ADR normalization
- a raw 1:1 profile may be useful as a baseline across multiple strategy types

So these rules cannot live inside one trigger filter forever.

---

## Recommended Config Shape

This is the proposed conceptual config model for `strategyConfig.ts`.

### Strategy

Unchanged in principle.

```ts
type StrategyConfig = {
  id: string;
  label: string;
  type: "single" | "tiered" | "agreement" | "tandem";
  description: string;
  cardBreakdown: "asset_class" | "tiers" | "per_model";
};
```

### Risk Profile

New shared layer.

```ts
type PnlUnit = "raw_pct" | "adr_multiple";

type TpModel =
  | "none"
  | "fixed_adr_fraction";

type ExitModel =
  | "week_close"
  | "fixed_adr_tp_or_week_close"
  | "trailing_adr_tp_or_week_close";

type RiskProfileConfig = {
  id: string;
  label: string;
  description: string;
  pnlUnit: PnlUnit;
  tpModel: TpModel;
  tpTarget: number | null;
  exitModel: ExitModel;
};
```

### Filter 1

Still basket / holding structure.

```ts
type BasketFilterConfig = {
  id: string;
  label: string;
  description: string;
};
```

### Filter 2

Narrowed to entry behavior.

```ts
type IntradayFilterConfig = {
  id: string;
  label: string;
  description: string;
  hasTradeLog: boolean;
  triggerModel: "none" | "adr_pullback" | "stoch_rsi" | "adr_stoch";
};
```

Important:

- `Filter 2` should no longer own P&L semantics by itself
- `Risk Profile` should no longer be implied by `Filter 2`

---

## Recommended Initial Profiles

These are the first profiles Limni should support conceptually.

### 1. Raw 1:1

```ts
{
  id: "raw_1to1",
  label: "1:1 Raw",
  description: "1% move on the symbol equals 1% P&L",
  pnlUnit: "raw_pct",
  tpModel: "none",
  tpTarget: null,
  exitModel: "week_close",
}
```

Meaning:

- raw instrument move
- no volatility normalization
- no separate TP model
- useful baseline and simple weekly hold profile

### 2. ADR Normalized

```ts
{
  id: "adr_normalized",
  label: "ADR",
  description: "Normalize P&L by the pair's ADR and use 0.25 ADR TP",
  pnlUnit: "adr_multiple",
  tpModel: "fixed_adr_fraction",
  tpTarget: 0.25,
  exitModel: "fixed_adr_tp_or_week_close",
}
```

Meaning:

- the trade is scored in ADR units
- TP is standardized
- losers and week-close exits must stay in ADR units too

This is the current preferred intraday profile.

---

### 3. ADR Trailing 0.25 / 0.25

```ts
{
  id: "adr_trailing_025_025",
  label: "ADR Trail 0.25",
  description: "ADR-normalized profile with trail activation at +0.25 ADR and a 0.25 ADR trailing distance",
  pnlUnit: "adr_multiple",
  tpModel: "fixed_adr_fraction",
  tpTarget: 0.25,
  exitModel: "trailing_adr_tp_or_week_close",
}
```

Meaning:

- the trade is still scored in ADR units
- trail activation starts at `+0.25 ADR`
- the trailing stop stays `0.25 ADR` behind the best excursion
- week-close remains the fallback exit
- there is no hard stop loss in the default version of this profile

This is now the leading candidate for the ADR pullback family.

---

## Research Update — 2026-03-29

Recent ADR pullback research changed the preferred exit profile.

### What held up

- The `0.25 ADR` activation / `0.25 ADR` trailing-distance profile materially improved the ADR family in the recent canonical M5 research runs.
- Improvement showed up not only in V3, but also across dealer, commercial, sentiment, and agreement variants.

### What did not hold up

- Adding a hard `1.0 ADR` stop loss on top of the trailing profile did **not** improve the system.
- In the V3 research, the hard stop reduced return and worsened drawdown versus trailing-only.

### Practical conclusion

For the app-level risk layer, the current preferred ADR candidate is:

- `pnlUnit = "adr_multiple"`
- trailing activation at `+0.25 ADR`
- trailing distance `0.25 ADR`
- no hard stop loss in the default profile
- week-close fallback exit

### Research status note

- This is the current implementation candidate for the new risk layer.
- It is stronger than the old fixed `0.25 ADR` TP profile in the recent research runs.
- It still deserves longer-window confirmation before becoming the universal default everywhere.

---

## Why TP/SL Should Not Be A Separate Sidebar Selector Yet

Do **not** add a separate TP/SL switcher to the main sidebar right now.

Reason:

- It creates too many combinations too quickly
- It increases the chance of invalid or nonsensical setups
- It makes the main product harder to use

Bad main-app direction:

- Strategy
- Risk
- Filter 1
- Filter 2
- TP
- SL

That is too much for the production sidebar.

Instead:

- keep TP and exit behavior inside `Risk Profile`
- expose granular TP/SL controls later in Research / Lab tooling if needed

This keeps the production UI simple while still allowing shared, reusable risk presets.

---

## Compatibility Rules

Once Risk Profile exists, not every combination should be allowed.

The config system should support compatibility metadata so the UI can:

- hide invalid options
- disable invalid options
- auto-fallback to a valid option

Examples:

- `weekly_hold + raw_1to1`
  valid now
- `weekly_hold + adr_normalized`
  likely future-valid, but may be disabled initially
- `weekly_hold + adr_trailing_025_025`
  valid for research once the trailing profile is wired into the engine
- `adr_pullback + adr_normalized`
  valid
- `adr_pullback + adr_trailing_025_025`
  now the leading ADR candidate
- `stoch_rsi + adr_normalized`
  valid
- `stoch_rsi + adr_trailing_025_025`
  likely valid once stoch entry research is stable
- `adr_pullback + raw_1to1`
  may be invalid or at least not the default

Recommended rule:

- `strategy` should almost always be independent
- `riskProfile` should declare which `f1` and `f2` combinations it supports

Conceptually:

```ts
type RiskProfileConfig = {
  id: string;
  label: string;
  description: string;
  pnlUnit: PnlUnit;
  tpModel: TpModel;
  tpTarget: number | null;
  exitModel: ExitModel;
  supportedBasketFilters?: string[];
  supportedIntradayFilters?: string[];
};
```

This is preferable to hardcoding compatibility in the component layer.

---

## URL Model

The new selector should get its own URL param.

Current:

- `?strategy=dealer&f1=weekly_hold&f2=none`

Proposed:

- `?strategy=dealer&risk=raw_1to1&f1=weekly_hold&f2=none`

Examples:

- `?strategy=tiered_v3&risk=adr_normalized&f1=weekly_hold&f2=adr_pullback`
- `?strategy=dealer&risk=raw_1to1&f1=weekly_hold&f2=none`

---

## Matrix And Performance Implications

### Performance

Performance should display results using the selected `riskProfile`.

That means:

- same direction source
- same basket structure
- same entry trigger
- same risk normalization / TP profile

### Matrix

Matrix should also respect the selected `riskProfile`.

Examples:

- `raw_1to1`
  realized trade P&L is raw %
- `adr_normalized`
  realized trade P&L is ADR multiple

The Matrix row should still keep the raw weekly pair move visible separately from intraday system P&L.

---

## Relationship To The Current P&L Spec

This document does not replace the intraday P&L rules in:

- [INTRADAY_PNL_MODEL_SPEC_2026-03-28.md](/c:/Users/User/Documents/GitHub/limni-website/docs/INTRADAY_PNL_MODEL_SPEC_2026-03-28.md)

Instead:

- that document defines the current scoring logic
- this document defines where that logic should live in config

In short:

- `INTRADAY_PNL_MODEL_SPEC` defines the unit system
- `STRATEGY_CONFIG_RISK_PROFILE_SPEC` defines the selector model

---

## Implementation Direction Later

When this is implemented, the recommended sequence is:

1. Add `RISK_PROFILES` to `strategyConfig.ts`
2. Add `risk` param helpers like `resolveRiskProfileId()` and `getRiskProfile()`
3. Update `StrategySelector` from 3-level to 4-level
4. Move P&L ownership from `Filter 2` to `Risk Profile`
5. Make engine execution depend on the selected risk profile
6. Add compatibility rules so invalid combinations cannot be selected

This should happen after the architecture rewrite is stable, not during it.

### Updated priority inside that sequence

Once the selector model exists, the first non-baseline ADR profile to implement should be:

1. `adr_trailing_025_025`

Not:

1. a hard-stop ADR profile

because the current research supports trailing-only as the stronger default candidate.

---

## Next Research Candidate

The next logical ADR test is not another risk-profile change.

It is a hybrid entry structure:

- first trade of the week: take the weekly direction immediately
- second trade and later: require the normal `1 ADR` pullback trigger

Reason:

- some strong weeks never give an ADR pullback before moving in the weekly direction
- this structure may recover those weeks without abandoning the pullback framework for follow-on entries

This should likely live as an entry or basket-structure experiment, not as a risk profile.

---

## Decision Summary

As of **March 28, 2026**:

- A new selector should be added below `Strategy`
- The selector should be called **Risk Profile**
- Risk Profile should own P&L normalization, TP model, and exit model
- `Filter 2` should focus on entry trigger behavior
- TP/SL should not become separate main-sidebar controls yet
- Invalid combinations should be controlled through config compatibility rules
- The first two conceptual profiles are `raw_1to1` and `adr_normalized`
- The first research-backed ADR expansion candidate is `adr_trailing_025_025`
