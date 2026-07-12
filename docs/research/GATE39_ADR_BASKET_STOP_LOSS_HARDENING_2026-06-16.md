# Gate 39 ADR Basket Stop-Loss Hardening

Date: 2026-06-16

Status: research-only. No live strategy logic changed.

## Scope

Goal: determine whether the two current Gate 38 graduates benefit from a
weekly ADR basket hard stop before expanding backward in time.

## Why This Gate Exists

The current 2026 window has been unusually choppy, which is friendly to an ADR
Grid. A grid can look strong in chop because repeated reversions harvest many
small `0.20` ADR exits, while the same engine can stack bad inventory in a more
directional year.

The purpose of Gate 39 is therefore robustness, not maximizing current-2026
return. The source layers have two current graduates, but they should not be
trusted across older market regimes until the engine has separate risk pistons:

- basket-level stop bands for whole-source/week failure,
- pair-level average-inventory stops for local pair-side inventory failure,
- later, separate take-profit architecture for basket exits and grid runners.

It is acceptable to sacrifice headline ADR if the return/DD ratio and inventory
quality remain strong. The test should answer when holding a losing grid stops
being economically rational, especially after accounting for opportunity cost
and the risk that a prior choppy sample overstates recoverability.

Graduated rows tested:

- `cot_faces_v1_commercial_delta_contrarian_open_friday_strength_agree`
- `dealer_commercial_agreement_open_friday_strength_agree`

Fixed terms:

- Same current-2026 closed-week window: `2026-01-05` through `2026-06-08`.
- Excluded partial/current `2026-06-15`.
- ADR Grid terms unchanged: `0.20` ADR spacing, `0.20` ADR TP, `1.0` ADR
  reset, `0.20` ADR reset-entry buffer.
- No SL inside the pair grid, no costs, no margin, no slippage, no spread.
- Basket SL definition: if the selected basket marked path reaches `-N` ADR
  from week-open baseline, close active selected fills at that mark and block
  later selected fills for the rest of the displayed week.

Receipts:

- Coarse sweep, `3,5,7.5,10,12.5,15,17.5,20,25,30` ADR:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-124910.md`
- Refined sweep, `11,12,13,14,15,16` ADR:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-125153.md`

## Refined Matrix

| Variant | Basket SL ADR | Hit Wks | Total ADR | Worst Path DD | R/DD | Week-Close ADR | Skipped Fills |
|---|---:|---:|---:|---:|---:|---:|---:|
| COT open+Friday Strength | none | 0 | `+113.61` | `-18.91` | `6.01` | `-65.57` | 0 |
| COT open+Friday Strength | 11 | 4 | `+56.12` | `-13.60` | `4.13` | `-33.19` | 159 |
| COT open+Friday Strength | 12 | 4 | `+51.76` | `-16.57` | `3.12` | `-33.19` | 139 |
| COT open+Friday Strength | 13 | 3 | `+74.96` | `-16.57` | `4.53` | `-33.19` | 89 |
| COT open+Friday Strength | 14 | 2 | `+82.35` | `-16.57` | `4.97` | `-53.82` | 33 |
| COT open+Friday Strength | 15 | 1 | `+98.48` | `-16.57` | `5.94` | `-53.82` | 33 |
| COT open+Friday Strength | 16 | 1 | `+96.14` | `-18.91` | `5.08` | `-53.82` | 33 |
| Dealer/Commercial open+Friday Strength | none | 0 | `+58.88` | `-12.46` | `4.73` | `-9.99` | 0 |
| Dealer/Commercial open+Friday Strength | 11 | 1 | `+44.75` | `-12.46` | `3.59` | `-9.99` | 19 |
| Dealer/Commercial open+Friday Strength | 12 | 1 | `+44.75` | `-12.46` | `3.59` | `-9.99` | 19 |
| Dealer/Commercial open+Friday Strength | 13 | 0 | `+58.88` | `-12.46` | `4.73` | `-9.99` | 0 |
| Dealer/Commercial open+Friday Strength | 14 | 0 | `+58.88` | `-12.46` | `4.73` | `-9.99` | 0 |
| Dealer/Commercial open+Friday Strength | 15 | 0 | `+58.88` | `-12.46` | `4.73` | `-9.99` | 0 |
| Dealer/Commercial open+Friday Strength | 16 | 0 | `+58.88` | `-12.46` | `4.73` | `-9.99` | 0 |

## Read

The hard-stop evidence is asymmetric.

For COT commercial-delta + open + Friday Strength, an active stop below `14`
ADR is too tight. It cuts many fills and destroys too much recovery. The only
defensible active stop in this current-2026 window is around `15` ADR: it hits
one week, trims worst path DD from `-18.91` to `-16.57`, improves week-close
drag from `-65.57` to `-53.82`, and keeps most of the return (`+98.48` ADR
versus `+113.61`). At `16` ADR the stop is worse than `15`, and at `20+` it
does nothing.

For Dealer/Commercial + open + Friday Strength, the row is already clean in
this window. A stop at `11` or `12` ADR hits one week and cuts total ADR from
`+58.88` to `+44.75` without improving the measured worst path DD or
week-close drag. At `13+` ADR it does not trigger. There is no current-2026
evidence for an active basket stop on this row.

Working threshold read before going backward:

- COT graduated row: carry `15` ADR as the only hard-stop candidate.
- Dealer/Commercial graduated row: carry no active stop, or a non-binding
  emergency threshold above `12.5` ADR only as a guardrail.
- Do not promote either to live logic. The next proof should run these exact
  definitions backward, not tune the ADR Grid.

## 39b Pair Inventory Average-Price Stop

Freedom clarified that the basket stop is useful but does not answer the
pair-inventory question. Gate 39b adds a separate pair-side stop:

- For each selected pair and direction, inspect active fills through the week.
- Compute the active average entry price for that pair-side. Fills are equal
  size in this research model, so the average is a simple active-fill average.
- Measure adverse distance from that average entry in the pair's own ADR units.
- If adverse distance reaches the threshold, close active fills for that
  pair-side at the mark and block later fills for that pair-side for the rest
  of the displayed week.
- Pair stop runs before the basket stop when both are enabled.

Receipts:

- Broad pair sweep, `0.5,0.75,1.0,1.25,1.5,2.0` ADR, with optional `15` ADR
  basket band:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-132732.md`
- Dealer/Commercial refined pair sweep, `0.6,0.7,0.75,0.8,0.9` ADR:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-133045.md`
- COT refined pair sweep, `1.1,1.2,1.25,1.3,1.4` ADR, with optional `15` ADR
  basket band:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-133329.md`

### Dealer/Commercial Pair Stop

| Pair SL ADR | Pair Hits | Hit Weeks | Skipped Fills | Total ADR | Worst Path DD | R/DD | Week-Close ADR |
|---:|---:|---:|---:|---:|---:|---:|---:|
| none | 0 | 0 | 0 | `+58.88` | `-12.46` | `4.73` | `-9.99` |
| `0.60` | 9 | 6 | 62 | `+32.08` | `-6.10` | `5.26` | `-2.68` |
| `0.70` | 4 | 4 | 45 | `+52.28` | `-6.31` | `8.29` | `-2.68` |
| `0.75` | 4 | 4 | 26 | `+49.84` | `-6.31` | `7.90` | `-2.68` |
| `0.80` | 4 | 4 | 21 | `+43.84` | `-9.78` | `4.48` | `-2.68` |
| `0.90` | 3 | 3 | 15 | `+40.68` | `-12.71` | `3.20` | `-4.97` |

Read: Dealer/Commercial benefits from a pair inventory stop in this current
window. The best current threshold is `0.70` ADR from active average entry. It
sacrifices `6.60` ADR of headline return versus no stop, but cuts worst path DD
about in half and improves R/DD from `4.73` to `8.29`. `0.60` is too tight;
`0.80+` starts losing the risk benefit.

### COT Pair Stop

| Pair SL ADR | Basket SL ADR | Pair Hits | Pair Hit Weeks | Total ADR | Worst Path DD | R/DD | Week-Close ADR |
|---:|---:|---:|---:|---:|---:|---:|---:|
| none | none | 0 | 0 | `+113.61` | `-18.91` | `6.01` | `-65.57` |
| none | `15` | 0 | 0 | `+98.48` | `-16.57` | `5.94` | `-53.82` |
| `1.10` | none | 4 | 4 | `+102.38` | `-18.91` | `5.41` | `-32.93` |
| `1.10` | `15` | 4 | 4 | `+86.79` | `-16.57` | `5.24` | `-29.41` |
| `1.20` | none | 2 | 2 | `+105.95` | `-18.91` | `5.60` | `-48.88` |
| `1.20` | `15` | 2 | 2 | `+90.81` | `-16.57` | `5.48` | `-37.13` |
| `1.25` | none | 2 | 2 | `+104.74` | `-18.91` | `5.54` | `-48.88` |
| `1.25` | `15` | 2 | 2 | `+89.61` | `-16.57` | `5.41` | `-37.13` |
| `1.40` | none | 0 | 0 | `+113.61` | `-18.91` | `6.01` | `-65.57` |
| `1.40` | `15` | 0 | 0 | `+98.48` | `-16.57` | `5.94` | `-53.82` |

Read: COT does not improve on pure R/DD with pair stops in current 2026. Pair
stops at `1.10-1.25` ADR materially reduce week-close drag, but they also cut
return and leave worst path DD unchanged unless paired with the basket band.
The stronger current-2026 COT robustness candidate remains the `15` ADR basket
band. A `1.10` pair stop is worth carrying as a secondary "inventory-quality"
candidate only if backward proof shows week-close drag is a bigger regime risk
than headline R/DD suggests.

Updated working threshold read:

- COT: primary hardening candidate remains `15` ADR basket SL. Pair inventory
  SL is not primary from current 2026; optionally carry `1.10` ADR as a
  week-close-drag reduction candidate into broader proof.
- Dealer/Commercial: carry `0.70` ADR pair inventory SL as the current
  hardening candidate. Basket SL remains non-binding/no active stop in current
  2026.
- Do not combine this with take-profit or runner research until Gate 40.

## Review / Stop-Event Addendum

Fresh-chat Gate 39 review on 2026-06-16 found the high-level stop logic
coherent, but the original receipts did not expose enough per-stop evidence to
prove opportunity cost. The research-only side-selector audit now emits a
stop-event ledger in JSON, Markdown, and `-stop-events.csv`.

Regenerated review receipts:

- Refined basket SL sweep with stop events:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-160225.md`
- Dealer/Commercial refined pair SL sweep with stop events:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-160515.md`
- COT refined pair + `15` ADR basket SL sweep with stop events:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-161014.md`

The regenerated totals matched the original Gate 39 receipts exactly for total
ADR, worst path drawdown, and week-close ADR on the reviewed rows.

Stop-event read:

- COT `15` ADR basket SL hit once, on `2026-04-13`. It closed `39` active
  fills at `-18.69` ADR versus `-9.40` ADR if those same active fills had
  resolved normally, and blocked `33` later fills that would have produced
  `+5.85` ADR in the unstopped run. This confirms the basket stop is a
  robustness piston, not free edge: it reduces measured path/week-close risk by
  sacrificing recovery.
- Dealer/Commercial `0.70` ADR pair inventory SL hit `4` pair-sides across `4`
  weeks. Its accepted benefit remains drawdown and week-close cleanup, not
  headline return. The event ledger shows the `6.60` ADR headline sacrifice is
  explainable by marked active-fill deltas and skipped-fill opportunity cost.
- COT `1.10` ADR pair inventory SL reduces week-close drag, but it still does
  not improve current-2026 pure R/DD; it stays secondary and conditional.

Review decision: Gate 39 passes as a research base for Gate 40 only. These stop
definitions are still not live strategy logic and still need backward proof
before promotion.
