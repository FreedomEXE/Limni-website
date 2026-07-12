# Gate 34 COT Faces Fresh-Eyes Handoff

Generated: 2026-06-15

## Purpose

This is the fresh-chat handoff for reviewing the new COT Faces source
architecture before any full 28-pair expansion.

Post-handoff continuation: the fresh-eyes metadata correction and clean
2020/clean 2025 fast-pass have now been run. Use
`docs/research/GATE34_COT_FACES_V1_FAST_PASS_RESULT_2026-06-15.md` for current
results before treating this handoff as the latest state.

The next chat should treat this as a review and challenge pass, not as a
promotion or tuning pass. The question is whether the first COT Faces model has
an obvious logic flaw, return concentration problem, or simple adjustment that
should be made before running the same idea across all 28 FX pairs.

## Current Gate

Gate 34: `weekly-hold-engine-research`

Focused sub-scope:

`cot-faces-v1-fast-pass-review`

## Frozen Scope

Do not start:

- live source promotion;
- ADR Grid parity;
- Pair Fill Cap or risk-overlay redesign;
- Sentiment or Strength source work;
- release canon work;
- full 28-pair COT Faces sweep until Freedom confirms the review is complete.

Do not rerun old Dealer-only logic unless a concrete test flaw is found.

## Recovery Read List

Read in this order:

1. `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_SESSION.md`
2. `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_CKB.md`
3. `AGENTS.md`
4. `docs/backlog/CURRENT_WORK.md`
5. `docs/BACKTEST_CANONICAL_PROTOCOL.md`
6. `docs/research/GATE34_COT_FACES_V1_ARCHITECTURE_2026-06-15.md`
7. `docs/research/GATE34_COT_FACES_V1_FAST_PASS_RESULT_2026-06-15.md`
8. This handoff.

Useful prior context:

- `docs/research/GATE34_COT_SOURCE_REDESIGN_2019_2026_2026-06-15.md`
- `docs/research/GATE34_DEALER_BASELINE_REDESIGN_HANDOFF_2026-06-15.md`
- `docs/research/GATE34_DEALER_SYSTEM_DECISION_LOG_2026-06-15.md`

## What Changed

Freedom challenged the premise that Dealer and Commercial should stay separate
standalone systems. The new premise is that COT should be treated as one source
family with several participant faces:

- Dealer;
- Commercial;
- Non-commercial;
- Non-reportable;
- Asset manager;
- Leveraged money.

The current research rule is:

`cot_faces_v1_forced`

It is implemented in:

`app/scripts/verification/export-weekly-hold-fixed-band-sweep.ts`

The rule emits a forced direction plus source tier and source reason for every
selected pair row.

## Fast-Pass Basket

The first review basket is intentionally 10 pairs:

```txt
EURUSD
GBPUSD
USDJPY
USDCHF
AUDUSD
USDCAD
AUDCAD
EURJPY
GBPCHF
NZDJPY
```

This is a screening basket only. It is not final qualification.

## Source Logic

The first model uses current COT levels and current weekly COT changes,
normalized by open interest.

Directional inputs:

| Face | Level | Weekly Change |
|---|---|---|
| Dealer | `dealer_net / open_interest` | `dealer_delta_net / open_interest` |
| Commercial | `commercial_net / open_interest` | `commercial_delta_net / open_interest` |
| Non-commercial | `noncomm_net / open_interest` | `noncomm_delta_net / open_interest` |
| Non-reportable | `nonrept_net / open_interest` | `nonrept_delta_net / open_interest` |
| Asset manager | `asset_mgr_net / open_interest` | `asset_mgr_delta_net / open_interest` |
| Leveraged money | `lev_money_net / open_interest` | `lev_money_delta_net / open_interest` |

First-pass directional weights:

```txt
dealer_net_oi          1.50
dealer_delta_oi        1.00
commercial_net_oi      1.00
commercial_delta_oi    0.75
noncomm_net_oi         0.75
noncomm_delta_oi       0.50
nonrept_net_oi         0.50
nonrept_delta_oi       0.25
asset_mgr_net_oi       0.50
asset_mgr_delta_oi     0.35
lev_money_net_oi       0.50
lev_money_delta_oi     0.35
```

Confidence/regime inputs:

- Dealer spread cleanliness;
- Non-commercial spread cleanliness;
- open-interest expansion or contraction;
- concentration.

These are confidence modifiers, not standalone directional votes.

Pair decision:

```txt
currency_score = weighted_face_score * confidence_multiplier
pair_score = base_currency_score - quote_currency_score
pair_score > 0 => LONG
pair_score < 0 => SHORT
```

Exact ties must be forced deterministically and recorded in the reason.

## First Test Run

Only two outer windows were tested:

- clean 2019;
- current 2026.

Only two exit styles matter in this first result:

- week close;
- market-week ADR band `TP 1.0x / SL 2.0x`.

Receipt paths:

```txt
app/reports/data-verification/weekly-hold-exit-sweep/fx-10pair-cot-faces-weekly-hold-fixed-band-sweep-43w-20260615-193918.md
app/reports/data-verification/weekly-hold-exit-sweep/fx-10pair-cot-faces-weekly-hold-fixed-band-sweep-23w-20260615-194024.md
app/reports/data-verification/weekly-hold-exit-sweep/fx-10pair-dealer-weekly-hold-fixed-band-sweep-43w-20260615-195530.md
app/reports/data-verification/weekly-hold-exit-sweep/fx-10pair-dealer-weekly-hold-fixed-band-sweep-23w-20260615-195642.md
```

## First Result Summary

### COT Faces v1

| Window | Exit | ADR | ADR DD | Return/DD | Weekly PF | Trade PF ADR | Weekly W/L |
|---|---|---:|---:|---:|---:|---:|---:|
| Clean 2019 | Week close | -16.30% | 42.35% | -0.38 | 0.89 | 0.94 | 19/24/0 |
| Clean 2019 | TP1.0 SL2.0 | +18.33% | 17.23% | 1.06 | 1.28 | 1.12 | 26/17/0 |
| Current 2026 | Week close | +15.00% | 17.42% | 0.86 | 1.58 | 1.13 | 16/7/0 |
| Current 2026 | TP1.0 SL2.0 | +15.54% | 14.80% | 1.05 | 1.76 | 1.23 | 15/8/0 |

### Same-Basket Current Dealer

| Window | Exit | ADR | ADR DD | Return/DD | Weekly PF | Trade PF ADR | Weekly W/L |
|---|---|---:|---:|---:|---:|---:|---:|
| Clean 2019 | Week close | -43.63% | 50.54% | -0.86 | 0.71 | 0.85 | 18/25/0 |
| Clean 2019 | TP1.0 SL2.0 | +8.92% | 18.87% | 0.47 | 1.13 | 1.06 | 23/20/0 |
| Current 2026 | Week close | -3.65% | 36.91% | -0.10 | 0.92 | 0.97 | 10/13/0 |
| Current 2026 | TP1.0 SL2.0 | +5.32% | 21.85% | 0.24 | 1.19 | 1.07 | 14/9/0 |

## What Stands Out

The improvement is risk-adjusted:

- clean 2019 return/DD improves from `0.47` to `1.06`;
- current 2026 return/DD improves from `0.24` to `1.05`.

The strongest original tier is:

`cot_faces_dealer_noncomm_confirmed`

That tier contributed:

- clean 2019: `+12.52%` ADR across `393` rows;
- current 2026: `+12.68%` ADR across `208` rows.

Fresh-eyes correction after review: in these receipts that bucket is
Commercial-conflict by construction, because Dealer+Commercial confirmation is
classified first. Future receipts should split it as
`cot_faces_dealer_noncomm_commercial_conflict`. The right read is not broad COT
agreement; it is Dealer+Non-commercial agreement over Commercial conflict.

## Review Questions For Fresh Eyes

Review these before any full 28-pair run:

1. Are the participant-face signs correct?
   - The model assumes the normalized face scores can be compared currency to
     currency and then base versus quote.
   - Challenge whether any face should be contrarian rather than direct.

2. Are we double-counting the same COT structure?
   - Dealer, Commercial, Non-commercial, Non-reportable, Asset Manager, and
     Leveraged Money are not independent economic actors in every contract.
   - The next chat should inspect whether the weights accidentally reward the
     same crowding pattern multiple times.

3. Is `cot_faces_dealer_noncomm_commercial_conflict` too broad?
   - It dominates row count.
   - Strong contribution is good, but a dominant tier can also hide weak
     sub-regimes.

4. Is the 2026 result too AUD-dependent?
   - `AUDCAD` contributed `+11.48%` ADR.
   - `AUDUSD` contributed `+6.33%` ADR.
   - That is a major share of the 2026 positive result.

5. Are the drags telling us anything immediate?
   - Clean 2019 main drag: `USDCHF` at `-8.38%` ADR.
   - Current 2026 main drag: `NZDJPY` at `-6.29%` ADR.
   - Inspect source reasons for these before changing weights.

6. Is TP1.0/SL2.0 helping because the source is good, or because the exit is
   masking weak week-close direction?
   - Clean 2019 week-close is still negative at `-16.30%` ADR.
   - The ADR band turns the same source positive, so exit behavior is doing
     real work.

7. Are the confidence multipliers behaving sensibly?
   - The multiplier is applied at currency-score level before pair comparison.
   - Review whether this makes sense when both base and quote have similar
     absolute scores but different confidence quality.

8. Should any change be made now before the 28-pair test?
   - Only change if the review finds a structural flaw.
   - Do not tune weights because one pair helped or hurt.
   - Do not widen exits before clean 2020/2025 is measured.

## Recommended Next Action

This handoff has been superseded by the full 28-pair target-band continuation
recorded in:

`docs/research/GATE34_COT_FACES_V1_FAST_PASS_RESULT_2026-06-15.md`

Post-handoff update: clean 2020 and clean 2025 are now measured and mixed.
Clean 2020 supports COT Faces on week-close but rejects TP1.0/SL2.0; clean 2025
rejects week-close but is only slightly positive with TP1.0/SL2.0. This update
is now secondary evidence, not the active next-step instruction.

Second post-handoff update after Freedom's correction: the clean 2020/2025
continuation was out of order. Week-close is not the primary FX diagnostic.
The corrected gate is full 28-pair target-band behavior: can COT Faces catch an
ADR target before unacceptable drawdown across all 28 pairs? Full 28 clean 2019
and current 2026 receipts now exist. They keep COT Faces alive at basket level,
but they are not a clean qualification because too many individual pairs remain
negative and the best target/stop shape flips between windows. Review that
pair-failure profile before running more years.

First, review the implementation and receipts:

1. Explain the model in plain English.
2. Inspect the tier logic and confidence multiplier logic in
   `export-weekly-hold-fixed-band-sweep.ts`.
3. Inspect the 2019/2026 return profile and pair/tier contribution.
4. Tell Freedom whether anything should change before the next test.

Do not use this handoff's older 10-pair 2020/2025 recommendation as the active
next step.

## Useful Rerun Commands

Use these only if a rerun is needed.

Clean 2019:

```powershell
npm run verification:export-weekly-hold-fixed-band-sweep -- --asset-class fx --from 2019-01-01 --to 2019-12-31 --source-rules cot_faces_v1_forced --pairs EURUSD,GBPUSD,USDJPY,USDCHF,AUDUSD,USDCAD,AUDCAD,EURJPY,GBPCHF,NZDJPY --tp-multiples 1 --sl-multiples 2 --anchor-modes market_week
```

Current 2026:

```powershell
npm run verification:export-weekly-hold-fixed-band-sweep -- --asset-class fx --from 2026-01-01 --to 2026-06-08 --source-rules cot_faces_v1_forced --pairs EURUSD,GBPUSD,USDJPY,USDCHF,AUDUSD,USDCAD,AUDCAD,EURJPY,GBPCHF,NZDJPY --tp-multiples 1 --sl-multiples 2 --anchor-modes market_week
```

Clean 2020 next test:

```powershell
npm run verification:export-weekly-hold-fixed-band-sweep -- --asset-class fx --from 2020-01-01 --to 2020-12-31 --source-rules cot_faces_v1_forced --pairs EURUSD,GBPUSD,USDJPY,USDCHF,AUDUSD,USDCAD,AUDCAD,EURJPY,GBPCHF,NZDJPY --tp-multiples 1 --sl-multiples 2 --anchor-modes market_week
```

Clean 2025 next test:

```powershell
npm run verification:export-weekly-hold-fixed-band-sweep -- --asset-class fx --from 2025-01-01 --to 2025-09-29 --source-rules cot_faces_v1_forced --pairs EURUSD,GBPUSD,USDJPY,USDCHF,AUDUSD,USDCAD,AUDCAD,EURJPY,GBPCHF,NZDJPY --tp-multiples 1 --sl-multiples 2 --anchor-modes market_week
```

## Verification Already Run

Passed after adding the rule and docs:

```powershell
npx tsc --noEmit --project app/tsconfig.json --pretty false
git diff --check -- docs/backlog/CURRENT_WORK.md docs/research/GATE34_COT_FACES_V1_ARCHITECTURE_2026-06-15.md docs/research/GATE34_COT_FACES_V1_FAST_PASS_RESULT_2026-06-15.md
```

## Repo State Notes

At handoff time, this is research work in a dirty tree.

Important touched/untracked paths:

- `app/scripts/verification/export-weekly-hold-fixed-band-sweep.ts`
- `docs/research/GATE34_COT_FACES_V1_ARCHITECTURE_2026-06-15.md`
- `docs/research/GATE34_COT_FACES_V1_FAST_PASS_RESULT_2026-06-15.md`
- this handoff
- generated receipts under
  `app/reports/data-verification/weekly-hold-exit-sweep/`

There are other pre-existing dirty/untracked Gate 33 and Gate 34 files. Do not
delete, restore, or clean them without explicit Freedom approval.

## Paste Prompt For New Chat

```txt
Continue Limni / Poseidon in C:\Users\User\Documents\GitHub\limni-website.

Read recovery first:
1. C:\Users\User\Documents\GitHub\freedom-ops\.codex\CODEX_SESSION.md
2. C:\Users\User\Documents\GitHub\freedom-ops\.codex\CODEX_CKB.md
3. AGENTS.md
4. docs/backlog/CURRENT_WORK.md
5. docs/BACKTEST_CANONICAL_PROTOCOL.md
6. docs/research/GATE34_COT_FACES_V1_ARCHITECTURE_2026-06-15.md
7. docs/research/GATE34_COT_FACES_V1_FAST_PASS_RESULT_2026-06-15.md
8. docs/research/GATE34_COT_FACES_FRESH_EYES_HANDOFF_2026-06-15.md

Current gate:
Gate 34: cot-faces-v1-fast-pass-review.

Fresh task:
I need fresh eyes on the new COT Faces system before we run the full 28-pair
test. Review the architecture and implementation logic, then review the first
2019/2026 fast-pass returns. Tell me in plain English what the model is doing,
what stands out in the returns, and whether anything should change now before
the full 28-pair test.

Important:
- This is review first, not coding first.
- Do not promote anything.
- Do not start ADR Grid, Pair Fill Cap, Sentiment, Strength, release canon, or
  live strategy work.
- Do not rerun old Dealer-only logic unless you find a concrete test flaw.
- Do not run full 28 pairs until the logic/return review is complete.

Specific review questions:
- Are the participant-face signs and weights sensible?
- Are we double-counting COT structure?
- Is `cot_faces_dealer_noncomm_confirmed` too broad?
- Is 2026 too dependent on AUD pairs?
- What do `USDCHF` 2019 and `NZDJPY` 2026 tell us?
- Is TP1.0/SL2.0 masking weak week-close direction?
- Should anything change before testing clean 2020 and clean 2025?
```
