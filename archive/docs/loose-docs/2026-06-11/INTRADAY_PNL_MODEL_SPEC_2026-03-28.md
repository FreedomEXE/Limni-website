# Intraday P&L Model Spec — 2026-03-28

## Purpose

This document defines the agreed canonical P&L model for Limni strategy systems while the new strategy engine and Matrix architecture are being rebuilt.

It exists to prevent three common problems:

1. Mixing raw weekly percentage moves with volatility-normalized intraday returns
2. Scoring winners and losers in different units
3. Letting UI sections invent their own P&L interpretation

---

## Core Principle

Limni uses **different P&L units for different strategy classes**, but each strategy class must remain internally consistent.

- **Weekly hold systems**
  Use raw market return from week open to week close
- **Intraday systems**
  Use ADR-normalized return, not raw instrument percentage

This is the agreed model for now.

---

## Canonical Terms

These concepts should remain separate in the engine and data contracts.

- `holdingPeriod`
  `weekly` or `intraday`
- `entryModel`
  How a trade is opened
  Examples: `weekly_open`, `adr_pullback`, `stoch_rsi`, `adr_stoch`
- `exitModel`
  How a trade is closed
  Examples: `week_close`, `fixed_adr_tp`
- `pnlUnit`
  The unit used to score the trade
  Current values: `raw_pct`, `adr_multiple`
- `tpModel`
  Optional take-profit definition
  Examples: `none`, `fixed_adr_fraction`

The important architectural rule is:

**P&L unit must be explicit. It should not be implied by page, component, or strategy name.**

---

## Current Agreed Model

### 1. Weekly Hold

Weekly hold remains simple for now.

- Entry: week open
- Exit: week close
- P&L unit: `raw_pct`
- Canonical calculation: open to close percentage move, direction-adjusted for long or short

Example:

- Pair rises from `100` to `102`
- Raw move = `+2.00%`
- Long weekly hold = `+2.00`
- Short weekly hold = `-2.00`

### 2. Intraday Systems

Intraday systems are scored in **ADR-normalized units**.

- Entry logic may vary by system
- Exit logic may vary by system
- The scoring unit stays the same

Current shared assumption:

- `1.00 adr_multiple = 100% of one ADR move`
- `0.25 adr_multiple = 25% of one ADR move`

This means:

- A TP at `0.25 ADR` scores `+0.25`
- A move against the trade of `0.40 ADR` scores `-0.40`
- A week-close exit that finishes at `0.12 ADR` scores `+0.12` or `-0.12`

The formula is:

`normalizedPnl = directionAdjustedRawMovePct / adrPct`

Where:

- `directionAdjustedRawMovePct` is the actual percentage move in favor of the position
- `adrPct` is the reference ADR percentage used for that trade

Example:

- Trade is long
- Entry at `100`
- Exit at `100.50`
- Raw move = `+0.50%`
- ADR for that setup = `2.00%`
- Normalized P&L = `0.50 / 2.00 = +0.25`

That trade scores `+0.25`, not `+0.50`.

---

## Critical Rule For Intraday Systems

**Do not mix units inside the same intraday strategy.**

This means:

- Winners cannot be recorded as ADR-normalized values while losers are recorded as raw weekly percentages
- TP exits, stop exits, week-close exits, and unrealized active trades must all use the same `pnlUnit`

For the current Limni intraday direction:

- Intraday winners use `adr_multiple`
- Intraday losers use `adr_multiple`
- Intraday week-close exits use `adr_multiple`
- Intraday unrealized display, if shown, should also use `adr_multiple`

This is required for clean cross-asset comparison.

---

## TP Standard For Current Intraday Work

The current take-profit standard for ADR-based intraday systems is:

- `tpModel = fixed_adr_fraction`
- `tpTarget = 0.25`

Meaning:

- If price reaches `0.25 ADR` in favor of the trade, the realized score is `+0.25`

This TP model is expected to remain reusable across future intraday systems, including:

- `adr_pullback`
- `stoch_rsi`
- `adr_stoch`

In other words:

- **entry conditions may change**
- **P&L normalization and TP logic may stay shared**

---

## Matrix Display Rules

These rules follow directly from the agreed P&L model.

### Pair % Next To Pair Name

This should always represent the raw weekly move.

- Source: weekly open to weekly close market move
- Unit: `raw_pct`
- Purpose: show what the instrument itself did that week

This value should appear regardless of Filter 2.

### Intraday P&L In Matrix Trade Column

When an intraday filter is active, the trade/triggers column should display intraday system results in the strategy's canonical unit.

For current ADR-style intraday systems:

- Unit: `adr_multiple`
- TP hit: `+0.25`
- Non-TP realized exits: actual ADR-normalized value

This is separate from the weekly pair move.

### Stats Bar

When an intraday filter is active, the top stats bar should read from canonical engine output using the same intraday scoring unit.

It must not recalculate totals separately in the UI.

### Copy LONG / SHORT Buttons

These should read from canonical basket signals, not from ad hoc Matrix filtering logic.

---

## Engine Contract Direction

The engine should be able to represent these two current cases cleanly:

### Weekly Example

- `holdingPeriod: weekly`
- `entryModel: weekly_open`
- `exitModel: week_close`
- `pnlUnit: raw_pct`
- `tpModel: none`

### Intraday Example

- `holdingPeriod: intraday`
- `entryModel: adr_pullback`
- `exitModel: fixed_adr_tp_or_week_close`
- `pnlUnit: adr_multiple`
- `tpModel: fixed_adr_fraction`
- `tpTarget: 0.25`

This keeps the architecture future-safe without forcing weekly systems to normalize by ADR yet.

---

## Future Direction

Freedom may later choose to ADR-normalize weekly systems as well.

If that happens, the architecture should already support it by changing configuration, not by redesigning the engine.

That is why the long-term model should be:

- weekly vs intraday is not the same thing as raw vs normalized
- P&L unit is a first-class field
- TP logic is a first-class field
- entry logic is a first-class field

For now, however, the agreed operational rule is:

- **Weekly systems use raw weekly percentage**
- **Intraday systems use ADR-normalized return**

---

## Decision Summary

As of **March 28, 2026**:

- Weekly hold remains raw open-to-close percentage
- Intraday systems use ADR-normalized P&L
- Intraday TP is currently standardized at `+0.25 ADR`
- Intraday wins and losses must use the same unit
- Matrix pair % and intraday trade P&L must remain visually separate
- Future ADR normalization of weekly systems is possible and should be supported architecturally
