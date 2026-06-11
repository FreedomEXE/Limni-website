# Investor Risk Scaling Framework (Universal Baseline)

## Status
- Draft owner: Limni team
- Last updated: 2026-02-19
- Purpose: internal memory/reference for investor-capital risk design

## 1. Core Idea
Universal is the system baseline. "God Mode" is the high-risk 1:1 baseline implementation and should be treated as an internal reference, not the default investor risk profile.

Investor sizing should be a fractional scale of God Mode exposure:
- `Scale factor S` means investor risk is `1/S` of high-risk baseline.
- Example: `S = 10` means risk/size is 10x lower than God Mode.

## 2. Definitions
- `R_w_base`: baseline weekly return (God Mode reference).
- `DD_base`: baseline max drawdown (God Mode reference).
- `S`: down-scaling factor vs baseline.
- `R_w(S) = R_w_base / S`
- `DD(S) = DD_base / S` (first-order estimate)
- `R_y_simple(S) = 52 * R_w(S)` (no compounding)
- `R_y_comp(S) = (1 + R_w(S))^52 - 1`

All return/drawdown scaling is a first-order linear approximation. Realized outcomes can deviate due to execution, spread changes, gaps, path dependency, and lot-size floors.

## 3. Baseline Scenarios Used In Planning
Two planning anchors are currently used:

1. Conservative baseline example:
- `R_w_base = 100%`
- `DD_base = 20%`

2. Peak weekly example referenced in discussion:
- `R_w_peak = 144%`
- `DD_outlier = 19%`

## 4. Scaling Table (Conservative Baseline: 100% weekly, 20% DD)

| Scale vs High Risk (`S`) | Weekly Return (Expected) | Annual Return (Simple) | Annual Return (Compounded) | Max DD (Expected) |
|---|---:|---:|---:|---:|
| 10x lower (`0.1x`) | 10.0% | 520% | 14,204% | 2.0% |
| 50x lower (`0.02x`) | 2.0% | 104% | 181% | 0.4% |
| 100x lower (`0.01x`) | 1.0% | 52% | 67.8% | 0.2% |

Notes:
- The 50x row aligns with the internal target of ~100% yearly (simple) while keeping expected DD very low.
- The 100x row aligns with a lower-risk institutional posture and still implies strong expected annual return.

## 5. Peak Scenario Quick Check (144% weekly, 19% DD)

At `S = 10`:
- Weekly peak estimate: `14.4%`
- DD estimate: `1.9%`

At `S = 50`:
- Weekly estimate: `2.88%`
- DD estimate: `0.38%`

At `S = 100`:
- Weekly estimate: `1.44%`
- DD estimate: `0.19%`

These are planning translations only, not guarantees.

## 6. Lot-Size Floor Constraint (Key Practical Limiter)
The system cannot reduce risk indefinitely on small accounts because of minimum tradable size (example: XAUUSD `0.01` lots).

Implication:
- If an account is already at min lot on key symbols, further risk reduction requires more capital.
- Required capital increase is approximately linear with desired further risk reduction.

Examples from current operating assumptions:
- If `$100,000` is at floor for "low risk" (`~0.1x` vs high risk):
  - 5x lower than that floor requires about `$500,000`.
  - 10x lower than that floor requires about `$1,000,000`.

## 7. Proposed Capital-to-Risk Bands (Planning)
- Personal/internal accounts: `1.0x` to higher-beta internal modes.
- Early investor baseline: `0.1x`.
- Larger capital mandates (targeting ~100% simple annual): `0.02x` (`S=50`).
- Lowest recommended production risk floor: `0.01x` (`S=100`), assuming capital/lot granularity supports it.

## 8. Risk Governance Rules (Recommended)
Apply hard controls at portfolio and strategy levels:

1. Portfolio drawdown gates
- Trailing DD > 8%: reduce risk mode.
- Trailing DD > 12%: defensive mode.
- Trailing DD > 15%: kill switch pending review/reset.

2. Symbol floor governance
- If min lot prevents target risk on a symbol, either:
  - increase capital,
  - remove that symbol for that account tier, or
  - reduce trade frequency/selection quality threshold.

3. Investor communication rule
- Publish both:
  - simple annualized expectation, and
  - compounded annualized expectation.
- Always label them as modeled expectations, not guaranteed returns.

## 9. Nonlinearity / Stress Adjustment
For underwriting and investor decks, apply a stress multiplier to DD scaling:
- `DD_stressed(S) = DD(S) * M`, where `M` in `[1.25, 1.5]` by policy.

Example (`DD_base=20%`, `S=50`):
- Linear DD: `0.4%`
- Stressed DD at `M=1.5`: `0.6%`

This creates a more conservative risk narrative.

## 10. Investor-Safe Language (Template)
Use wording similar to:

> "Investor risk is managed as a fraction of our internal high-risk baseline. Reported return and drawdown targets are first-order scaling estimates and may vary due to execution, liquidity, and market path effects. We apply hard drawdown controls and minimum-position-size constraints when mapping strategy risk to account capital."

## 11. Action Items
- Add explicit `risk_scale_factor` to strategy/account config (`1.0`, `0.1`, `0.02`, `0.01`).
- Add dashboard panel showing:
  - baseline vs scaled expected weekly return,
  - baseline vs scaled expected DD,
  - stressed DD.
- Add per-symbol min-lot feasibility check before deployment of a risk tier.
- Add automatic alert when target risk cannot be achieved due to lot floor.

## 12. Decision Snapshot (Current)
- Keep God Mode for personal/internal benchmark accounts.
- Use lower-risk scaling for investor funds.
- Evaluate `S=50` and `S=100` as main investor tiers depending on capital and lot-size feasibility.

