# Gate 40 Take-Profit Runner Review Handoff

Date: 2026-06-16

Status: complete as a current-2026 research gate. Gate 39 was reviewed and
accepted as a research base only; no live strategy logic is promoted.

## Completion Decision

Gate 40 is complete. It produced solid exit-system candidates but did not prove
regime robustness.

Promoted to Gate 41 candidate testing:

- COT + `15` ADR basket SL + pure BE runner at `20%` and `25%`.
- Dealer/Commercial + `0.70` ADR pair inventory SL + pure BE runner at `20%`
  and `25%`.

Rejected or frozen from this gate:

- basket TP,
- pure reset-point trailing,
- BE-then-reset trailing,
- broad trailing-stop matrix,
- ADR Grid spacing or base TP changes.

Next handoff:

- `docs/research/GATE41_BACKWARD_REGIME_VALIDATION_HANDOFF_2026-06-16.md`

## Gate 40 First-Pass Result

Gate 40 tested the two Gate 38/39 graduated rows over the same closed displayed
2026 window, `2026-01-05` through `2026-06-08`, excluding the partial/current
`2026-06-15` week.

Fixed hardening rows carried into this pass:

- COT commercial-delta + open + Friday Strength agreement: `15` ADR basket SL.
- Dealer/Commercial + open + Friday Strength agreement: `0.70` ADR pair
  inventory SL.

First-pass read:

- Basket TP is not validated. `10` ADR is too tight and gives back edge; `15`
  ADR is mostly weak/non-helpful; `20` and `25` ADR are non-binding in this
  window.
- Break-even runners are the only constructive mechanism from this pass.
- Trailing runners improved some headline return rows but worsened drawdown,
  stop churn, or week-close quality enough that they should not be promoted
  from this pass.
- This remains a current-2026, no-cost, no-margin, no-spread research result.
  It must not be treated as a live strategy change.

Best COT fixed-hardening row from this pass:

```txt
COT + 15 ADR basket SL + 20% runner BE
Total ADR:       +114.31
Worst path DD:   -17.08
Return/DD:         6.69
Week-close ADR:   +3.17
Grid TP ADR:    +165.28
Runner ADR:      +56.70
Runner giveback: +14.70
Stop ADR:        -18.52
```

Baseline comparison:

- COT no stop/no runner: `+113.61` ADR / `-18.91` DD / `6.01` R/DD /
  `-65.57` week-close ADR.
- COT `15` ADR basket SL/no runner: `+98.48` ADR / `-16.57` DD / `5.94` R/DD /
  `-53.82` week-close ADR.
- The `20%` BE runner restores and slightly exceeds no-stop return while
  keeping most of the basket-stop drawdown benefit and flipping week-close ADR
  positive in this sample.

Best Dealer/Commercial fixed-hardening row from this pass:

```txt
Dealer/Commercial + 0.70 ADR pair inventory SL + 20% runner BE
Total ADR:       +67.48
Worst path DD:    -6.83
Return/DD:         9.88
Week-close ADR:  +27.66
Grid TP ADR:     +60.48
Runner ADR:      +30.13
Runner giveback: +14.81
Stop ADR:        -18.72
```

Baseline comparison:

- Dealer/Commercial no stop/no runner: `+58.88` ADR / `-12.46` DD /
  `4.73` R/DD / `-9.99` week-close ADR.
- Dealer/Commercial `0.70` pair SL/no runner: `+52.28` ADR / `-6.31` DD /
  `8.29` R/DD / `-2.68` week-close ADR.
- The `20%` BE runner adds `+15.20` ADR versus the fixed Gate 39 row, worsens
  worst path DD by about `0.52` ADR, improves R/DD, and flips week-close ADR
  strongly positive in this sample.

Receipts:

- COT Gate 40 sweep:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-163225.md`
- COT Gate 40 stop/TP event ledger:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-163225-stop-events.csv`
- Dealer/Commercial Gate 40 sweep:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-163524.md`
- Dealer/Commercial Gate 40 stop/TP event ledger:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-163524-stop-events.csv`

Recommended next Gate 40 action: test BE runner sizing more tightly before any
backward expansion, probably `5%`, `10%`, `15%`, `20%`, and `25%`, with basket
TP and trailing runners frozen unless Freedom explicitly reopens them.

## Gate 40 Reset-Point Trailing Follow-Up

Freedom proposed a distinct runner idea: keep a runner fraction open after the
normal `+0.20` ADR grid TP, then start trailing only after the move reaches the
normal reset area around `+1.0` ADR. This is different from the first trailing
test, which armed at `+0.60` ADR.

The research script now supports three runner families:

- `be`: current BE runner. Close most at `+0.20` ADR, keep a runner, exit the
  runner at entry if it gives the move back, otherwise week-close.
- `reset-trail`: Freedom reset-point trail. Close most at `+0.20` ADR, keep a
  runner, do not use a pre-arm BE stop, arm trail at `+1.0` ADR.
- `be-reset-trail`: hybrid. Close most at `+0.20` ADR, keep a runner, use BE
  protection until `+1.0` ADR, then trail.

Tested configs:

```txt
BE sizing: 5%, 10%, 15%, 20%, 25%
Reset trail: 10%, 15%, 20% at 1.0 ADR arm / 0.4 and 0.6 ADR trail
BE reset trail: 10%, 15%, 20% at 1.0 ADR arm / 0.4 and 0.6 ADR trail
```

Receipts:

- COT reset-trail matrix:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-174946.md`
- Dealer/Commercial reset-trail matrix:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-175407.md`

Fixed-hardening COT result:

```txt
COT + 15 ADR basket SL + 25% runner BE
Total ADR:       +118.27
Worst path DD:   -17.21
Return/DD:         6.87
Week-close ADR:  +17.41
Runner ADR:      +70.87
Runner BE exits: 191.0 weighted fills
Runner WC exits:  66.5 weighted fills
```

Useful comparison rows:

- COT + `15` ADR basket SL + `20%` BE:
  `+114.31` ADR / `-17.08` DD / `6.69` R/DD / `+3.17` week-close ADR.
- COT + `15` ADR basket SL + `20%` BE reset trail `1.0/0.4`:
  `+114.79` ADR / `-17.08` DD / `6.72` R/DD / `-34.72` week-close ADR.
- COT + `15` ADR basket SL + `20%` pure reset trail `1.0/0.4`:
  `+73.65` ADR / `-25.47` DD / `2.89` R/DD / `-37.13` week-close ADR.

Read: pure reset trail without BE protection is not viable for COT in this
window. The BE reset-trail hybrid is mechanically viable but gives away the
strong week-close rescue that pure BE captured. Pure BE remains the COT leader
in this current-window pass, with `25%` slightly ahead of `20%` on return/DD
and week-close quality.

Fixed-hardening Dealer/Commercial result:

```txt
Dealer/Commercial + 0.70 ADR pair SL + 25% runner BE
Total ADR:       +71.28
Worst path DD:    -6.96
Return/DD:        10.24
Week-close ADR:  +35.24
Runner ADR:      +37.67
Runner BE exits:  66.5 weighted fills
Runner WC exits:  27.5 weighted fills
```

Useful comparison rows:

- Dealer/Commercial + `0.70` ADR pair SL + `20%` BE:
  `+67.48` ADR / `-6.83` DD / `9.88` R/DD / `+27.66` week-close ADR.
- Dealer/Commercial + `0.70` ADR pair SL + `20%` BE reset trail `1.0/0.4`:
  `+65.64` ADR / `-6.83` DD / `9.61` R/DD / `+3.25` week-close ADR.
- Dealer/Commercial + `0.70` ADR pair SL + `20%` pure reset trail `1.0/0.4`:
  `+70.69` ADR / `-8.77` DD / `8.06` R/DD / `+8.61` week-close ADR.

Read: Dealer/Commercial tolerates pure reset trailing better than COT, but it
still loses the risk-adjusted race because drawdown expands. The BE reset-trail
hybrid reduces week-close exposure, but also gives back too much of the runner
rescue. Pure BE remains the current-window leader, with `25%` ahead of `20%`.

Next read after this follow-up: the current-2026 shortlist is pure BE runners,
probably `20%` and `25%`. A backward-year slice should test only those two
sizes first, not the full trailing matrix, unless Freedom specifically wants
to stress reset-trailing behavior as a separate research branch.

## Purpose

This handoff started as a fresh-chat review prompt. It now also records the
first Gate 40 test result.

The current research path is not to maximize a choppy 2026 sample. The point is
to harden a source-selected ADR Grid engine so it has a chance to survive older,
more directional regimes. Gate 39 added stop-loss pistons. Gate 40 should only
start after the stop definitions, threshold reads, and opportunity-cost logic
are accepted or corrected.

## Required Recovery Reads

Read these first, in order:

1. `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_SESSION.md`
2. `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_CKB.md`
3. `AGENTS.md`
4. `docs/backlog/CURRENT_WORK.md`
5. `docs/BACKTEST_CANONICAL_PROTOCOL.md`
6. `docs/research/GATE38_DEALER_COMMERCIAL_GRID_AGREEMENT_2026-06-16.md`
7. `docs/research/GATE39_ADR_BASKET_STOP_LOSS_HARDENING_2026-06-16.md`
8. This handoff.

Also inspect the implementation surface before trusting the docs:

- `app/scripts/verification/audit-fx-hedged-adr-grid-side-selectors.ts`

## Review-First Rule

Do not start Gate 40 implementation until Gate 39 is reviewed.

The review should answer:

- Are the two graduated source rows correctly represented?
- Is open Strength correctly treated as go-with confirmation in this current
  source-gated test, rather than fade?
- Is Friday frozen Strength correctly treated as go-with confirmation?
- Are open and Friday Strength kept separate until a combined row is explicitly
  tested?
- Does the basket stop actually work as a selected-basket circuit breaker?
- Does the pair stop actually work from active average entry for each pair-side?
- Does the stop close active inventory and block only the intended future fills?
- Is the simple average entry valid under the current equal-fill research model?
- Are the reported drawdown and week-close improvements real, or artifacts of
  the current-2026 choppy sample?
- Is opportunity cost measured well enough to continue, or does Gate 39 need a
  better skipped-fill / recovery-after-stop receipt first?

If any answer is weak, pause Gate 40 and repair Gate 39 evidence.

## Gate 39 Evidence To Scrutinize

Gate 39 tested closed displayed 2026 weeks only:

- start: `2026-01-05`
- end: `2026-06-08`
- excluded partial/current week: `2026-06-15`
- no costs, margin, spread, slippage, or swap
- ADR Grid terms fixed: `0.20` ADR spacing, `0.20` ADR TP, `1.0` ADR reset,
  `0.20` ADR reset-entry buffer

Graduated source rows entering Gate 39:

- `cot_faces_v1_commercial_delta_contrarian_open_friday_strength_agree`
- `dealer_commercial_agreement_open_friday_strength_agree`

Gate 39 basket stop definition:

- Track selected-basket marked ADR path from week-open baseline.
- If the path reaches `-N` ADR, close all active selected fills at that mark.
- Block later selected fills for the rest of that displayed week.
- This is a whole-row/week circuit breaker, not a pair-local stop.

Gate 39b pair inventory stop definition:

- Track each selected pair-side separately.
- Compute active average entry price for that pair-side.
- Measure adverse distance from active average entry in that pair's ADR units.
- If distance reaches `N` ADR, close active fills for that pair-side.
- Block later fills only for that pair-side for the rest of the displayed week.
- Pair stop runs before basket stop when both are enabled.

## Current Gate 39 Read

COT commercial-delta + open + Friday Strength:

- No stop: `+113.61` ADR / `-18.91` DD / `6.01` R/DD /
  `-65.57` week-close ADR.
- Primary hardening candidate: `15` ADR basket SL.
- `15` ADR basket SL: `+98.48` ADR / `-16.57` DD / `5.94` R/DD /
  `-53.82` week-close ADR, one hit week, 33 skipped fills.
- Pair stops do not improve pure current-2026 R/DD.
- Optional secondary pair stop candidate: `1.10` ADR only if broader proof
  shows week-close drag matters more than current-2026 R/DD.

Dealer/Commercial + open + Friday Strength:

- No stop: `+58.88` ADR / `-12.46` DD / `4.73` R/DD /
  `-9.99` week-close ADR.
- Basket stops at `11` or `12` ADR hurt; `13+` does not trigger.
- Primary hardening candidate: `0.70` ADR pair inventory SL.
- `0.70` ADR pair inventory SL: `+52.28` ADR / `-6.31` DD /
  `8.29` R/DD / `-2.68` week-close ADR.
- The current read is that sacrificing `6.60` ADR of return is acceptable if
  the drawdown cut survives broader proof.

These are research candidates only. They are not live strategy logic.

## Receipts To Inspect

Gate 38 Strength combination:

- `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-121932.md`

Gate 39 basket SL:

- `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-124910.md`
- `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-125153.md`

Gate 39b pair inventory SL:

- `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-132732.md`
- `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-133045.md`
- `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-133329.md`

## Existing Runner Prior Art

There is older runner research:

- `docs/research/ADR_GRID_RUNNER_COST_RESEARCH_2026-06-02.md`

Do not treat that note as current Gate 40 proof. It is useful prior art, but it
predates the Gate 38/39 source-selected 28-pair side-selector engine.

Important old read:

- Runner/refill and trailing runner were mechanically plausible.
- In that earlier app-style Tandem test, current close/rearm beat runner/refill
  and trailing variants.
- The suspected reason was that runners kept exposure open longer and consumed
  pair-cap capacity, slowing the fast close/rearm churn that produced most of
  the return.

Gate 40 should reuse the lesson, not inherit the conclusion. The current
problem is different: the new source-selected engine may need a small runner or
basket-level TP to survive trend regimes without destroying the core grid churn.

## Gate 40 Candidate Scope

Only open Gate 40 after the Gate 39 review passes.

Proposed scope:

- take-profit architecture for the two Gate 38/39 graduated rows
- current-2026 closed weeks first, through `2026-06-08`
- no partial/current `2026-06-15`
- no live strategy promotion
- no backward 2019-current expansion until this gate is clear

Candidate mechanisms:

- Grid partial runner:
  - close most of each fill at normal `+0.20` ADR TP
  - leave a small runner fraction open
  - test small fractions first, such as `10%` and `20%`
- Runner break-even stop:
  - once the normal TP is hit, runner stop moves to entry or slightly positive
- Runner trailing stop:
  - arm only after favorable movement, such as `+0.60` or `+1.00` ADR
  - trail by a fixed ADR distance
- Basket TP bands:
  - close all active selected fills when selected-basket marked ADR reaches a
    positive threshold
- Basket TP with residual runner:
  - close most active basket exposure at a band
  - leave a small residual basket runner only if measurable giveback is
    controlled

Do not tune ADR Grid spacing or base `0.20` TP in this gate unless Freedom
explicitly opens that scope. The point is to test payoff shape, not rewrite the
engine.

## Runner Math To Keep Honest

Current full-close fill payoff is approximately:

```txt
0.20 ADR per TP fill
```

With a runner fraction `r`, normal TP fraction `(1 - r)`, and eventual runner
payoff `R`, expected fill payoff becomes:

```txt
(1 - r) * 0.20 + r * R
```

Increment versus current full-close:

```txt
r * (R - 0.20)
```

This means a runner only improves expectancy if the runner's realized average
exit exceeds `+0.20` ADR after accounting for giveback, extra active age, lost
rearm opportunities, and any cap/exposure blockage.

Small runners are the natural first test because they preserve most of the
current grid churn:

```txt
10% runner, R = +1.00 ADR:
0.90 * 0.20 + 0.10 * 1.00 = +0.28 ADR
gain over current = +0.08 ADR per fill

20% runner, R = +1.00 ADR:
0.80 * 0.20 + 0.20 * 1.00 = +0.36 ADR
gain over current = +0.16 ADR per fill
```

But if runners average only `0.00` after giveback:

```txt
10% runner:
0.90 * 0.20 + 0.10 * 0.00 = +0.18 ADR

20% runner:
0.80 * 0.20 + 0.20 * 0.00 = +0.16 ADR
```

The mechanism must prove it adds trend rescue without sacrificing too much of
the reversion harvest.

## Gate 40 Scoring

Keep the scorecard aligned with Gate 39:

- final ADR
- max path DD
- return/DD
- week-close loss
- selected pair-side count
- active exposure
- active age
- runner active age
- runner giveback
- skipped or delayed rearm opportunities
- worst pair concentration
- worst currency concentration
- weekly W/L
- hit-week behavior in directional weeks

For any runner or basket TP test, explicitly separate:

- normal grid TP profit
- runner profit/loss
- basket TP profit/loss
- stop-loss exits
- week-close exits

If the script cannot report these components, add reporting before drawing
conclusions.

## Frozen Areas

Do not do any of the following in this handoff or Gate 40 unless Freedom
explicitly changes scope:

- promote live strategy logic
- run broad 2019-current history before Gate 39 review
- add costs, margin, spread, slippage, or swap
- add pair clustering
- use sentiment
- tune ADR Grid spacing
- tune base `0.20` TP as a replacement for runner/TP research
- add martingale, scaling, or lot sizing logic
- modify release canon

## Recommended First Task For Next Chat

1. Recover context from the required reads.
2. Review Gate 39 implementation and receipts with skepticism.
3. Re-run a tiny Gate 39 confirmation if any stop behavior is ambiguous.
4. Decide whether Gate 39 passes as a research base.
5. Only then open Gate 40 as `Gate 40: take-profit-runner-hardening`.

If Gate 39 does not pass review, do not open Gate 40. Repair the stop evidence
first.
