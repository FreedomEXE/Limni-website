# Gate 34 Dealer System Fresh-Eyes Handoff

Generated: 2026-06-14

## Intent

Freedom wants a fresh chat and fresh eyes on the Dealer Weekly Hold problem.

Do not assume the current Dealer interpretation is correct. It may be that the
project has been looking at Dealer data the wrong way all along.

The next agent should treat this as a research/design review, not a runtime
strategy patch. The goal is to decide what Dealer data actually means and what
simple, testable source-rule model should be tried next.

## Required First Reads

Read these in order:

1. `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_SESSION.md`
2. `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_CKB.md`
3. `AGENTS.md`
4. `docs/backlog/CURRENT_WORK.md`
5. `docs/BACKTEST_CANONICAL_PROTOCOL.md`
6. `docs/research/GATE34_DEALER_SYSTEM_RESEARCH_NOTES_2026-06-14.md`
7. `docs/research/GATE34_DEALER_SOURCE_RULE_FIXED_BAND_AUDIT_2026-06-14.md`
8. `docs/research/GATE34_DEALER_RULE_CANDIDATE_AUDIT_2026-06-14.md`
9. `docs/research/GATE34_DEALER_WEEKLY_HOLD_2024_2026_AUDIT_2026-06-14.md`
10. `docs/research/GATE34_DEALER_WEEKLY_HOLD_BASELINE_2025_2026_2026-06-14.md`
11. `docs/research/GATE34_DEALER_WEEKLY_HOLD_2024_RESULT_2026-06-14.md`
12. `docs/research/GATE34_DEALER_WEEKLY_HOLD_2025_WEEK_BY_WEEK_BREAKDOWN_2026-06-14.md`

## Frozen Scope

- Dealer source only unless Freedom explicitly opens another source.
- No Commercial, Sentiment, Strength, tandem, tiered, or composite source
  promotion yet.
- No ADR Grid parity.
- No Pair Fill Cap or risk-overlay redesign.
- No release canon work.
- No final TP/SL promotion.
- Do not rewrite runtime strategy logic until a source-rule hypothesis is
  receipt-backed across the required windows.

## Current Truth

Gate 33 Dealer Weekly Hold parity passed for representative six-symbol Pine/app
comparison:

- AUDCAD
- EURUSD
- GBPUSD
- NZDUSD
- USDCHF
- USDJPY

That means the current app/Pine Weekly Hold surface is trusted enough to do
research. It does not mean the Dealer source rule is good.

The CFTC shutdown question is answered for this gate:

- Exclude CFTC source report dates `2025-09-30` through `2025-12-23`
  inclusive.
- Clean 2025 is displayed weeks `2025-01-06` through `2025-09-29`.
- Current 2026 23-week sample is not contaminated by the 2025 shutdown.

## Important Current Interpretation

The app does not literally follow Dealer futures direction.

Current Dealer net is:

`dealer_net = dealer_short - dealer_long`

So if Dealers are net short, the app marks the currency bullish. That is a
sell-side/contrarian interpretation: Dealer books are assumed to represent
client accommodation or risk transfer, not a clean Dealer macro view.

Direct pair rule:

- base bullish + quote bearish => pair `LONG`
- base bearish + quote bullish => pair `SHORT`

Neutral/tiebreaker rule stack:

1. Dealer directional ratio: `abs(dealer_net) / (abs(dealer_net) + dealer_spread)`
2. Dealer delta persistence
3. Dealer delta confirmed by OI delta
4. Raw Dealer delta difference
5. Forced raw Dealer net difference

Key nuance: Dealer spread is not a directional inverse signal. It is the Dealer
category's own offsetting/matched exposure. It can be used as signal quality or
book-cleanliness evidence, not a bullish/bearish vote by itself.

## Hard Evidence

Corrected 2024-2026 audit found:

- 0 COT snapshot misses
- 0 live Dealer direction mismatches
- 0 price reconstruction mismatches
- full canonical ADR coverage after daily FX ADR bars were materialized from
  canonical 1H bars

Therefore the 2024 failure is not currently explained by source/path/price/ADR
coverage.

Corrected yearly week-close:

| Window | Raw | ADR | Weekly ADR PF | ADR DD |
| --- | ---: | ---: | ---: | ---: |
| 2024 | -123.59% | -169.48% | 0.49 | 181.46% |
| clean 2025 | -11.14% | +21.33% | 1.14 | 50.34% |
| current 2026 | +50.38% | +73.70% | 2.54 | 29.28% |
| clean 2025 + current 2026 | +39.23% | +95.03% | 1.46 | 50.34% |

2024 failure is concentrated in `direct_opposed_bias`:

- 2024 direct opposed-bias rows: `-173.48% ADR`
- 2024 neutral/tiebreaker-only rows: `+4.00% ADR`

2026 works because both families worked:

- 2026 direct opposed-bias rows: `+29.99% ADR`
- 2026 neutral/tiebreaker-only rows: `+43.71% ADR`

## Source-Rule Candidate Findings

Week-close source-rule audit:

- Full direct inversion fixes 2024 but destroys the 2025+2026 stitched result.
  Do not promote full inversion.
- Spread as a signed input does not fix anything; it mostly agrees with current
  direct raw direction because spread shrinks magnitude but does not supply a
  side.
- Strict spread/leg-ratio quality helps risk quality in 2026, but does not
  rescue 2024.
- Dealer delta is the strongest source-rule lead so far.

Clean 2025 + current 2026 week-close:

| Source Rule | ADR | Weekly PF | DD |
| --- | ---: | ---: | ---: |
| current | +95.03% | 1.46 | 50.34% |
| neutral-only | +49.34% | 1.40 | 43.00% |
| direct delta confirmed | +132.33% | 1.86 | 31.87% |
| direct delta override | +169.63% | 2.15 | 37.32% |
| raw+delta+leg ratio 0.75 | +129.74% | 1.90 | 33.23% |

But 2024 still fails under these ideas.

## Fixed-Band Candidate Findings

The fixed-band source-rule audit tested market-week `TP 1.2x ADR / SL 2.45x ADR`.

Canonical clean 2025 + current 2026 62-week result:

| Source Rule / Exit | ADR | Weekly W/L/F | ADR DD |
| --- | ---: | ---: | ---: |
| Current / week close | +95.03% | 33/29/0 | 50.34% |
| Current / TP1.2 SL2.45 | +113.48% | 37/25/0 | 34.02% |
| Direct delta confirmed / week close | +132.33% | 33/29/0 | 31.87% |
| Direct delta confirmed / TP1.2 SL2.45 | +102.93% | 40/22/0 | 32.95% |
| Direct delta override / week close | +169.63% | 35/27/0 | 37.32% |
| Direct delta override / TP1.2 SL2.45 | +125.79% | 41/21/0 | 27.54% |

2024 under the same fixed-band test:

| Source Rule / Exit | ADR | Weekly W/L/F | ADR DD |
| --- | ---: | ---: | ---: |
| Current / week close | -169.48% | 22/30/0 | 181.46% |
| Current / TP1.2 SL2.45 | -130.81% | 22/30/0 | 137.78% |
| Direct delta override / week close | -32.83% | 23/29/0 | 75.19% |
| Direct delta override / TP1.2 SL2.45 | -90.16% | 23/29/0 | 110.11% |

Current read:

- Fixed TP/SL helps current Dealer in 2025+2026.
- Fixed TP/SL does not solve the 2024 source failure.
- Delta override is still the strongest 2025+2026 source-rule idea.
- Do not keep tuning exits to hide a source-rule problem.

## Composite-System Constraint From Freedom

For future tandem/tiered/composite systems, neutral cannot mean "no data."

A source must produce pair-level evidence even when it abstains. The patched
fixed-band exporter now preserves:

- `sourceRuleId`
- `sourceRuleLabel`
- `sourceRuleTier`
- `sourceRuleReason`

This matters later because composite systems need to know whether a source was
bullish, bearish, neutral by design, abstained for quality, or missing.

## Changed / New Research Surfaces

Scripts:

- `app/scripts/verification/audit-dealer-rule-candidates.ts`
- `app/scripts/verification/export-weekly-hold-fixed-band-sweep.ts`
  - now supports `--source-rules`
  - default remains current Dealer only

Research docs:

- `docs/research/GATE34_DEALER_SYSTEM_RESEARCH_NOTES_2026-06-14.md`
- `docs/research/GATE34_DEALER_RULE_CANDIDATE_AUDIT_2026-06-14.md`
- `docs/research/GATE34_DEALER_SOURCE_RULE_FIXED_BAND_AUDIT_2026-06-14.md`

Receipts:

- `app/reports/data-verification/weekly-hold-audit/dealer-rule-candidate-audit-20260614.json`
- `app/reports/data-verification/weekly-hold-source-rule-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-23w-20260614-211242.*`
- `app/reports/data-verification/weekly-hold-source-rule-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-39w-20260614-212530.*`
- `app/reports/data-verification/weekly-hold-source-rule-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-52w-20260614-212000.*`
- `app/reports/data-verification/weekly-hold-source-rule-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-62w-20260614-213803.*`

Receipt caveats:

- `fx-28pair-dealer-weekly-hold-fixed-band-sweep-61w-20260614-213145.*`
  was generated from generic source-date exclusion and is not the canonical
  stitched result. Use the explicit 62-week receipt instead.
- `fx-28pair-dealer-weekly-hold-fixed-band-sweep-23w-20260614-205928.*`
  was generated by an accidental `--help` probe. It is harmless current-rule
  research noise, not a canonical source-rule comparison receipt.

## Verification Already Run

Latest pass:

```txt
npx tsc --noEmit --project app/tsconfig.json --pretty false
git diff --check -- app/scripts/verification/export-weekly-hold-fixed-band-sweep.ts app/scripts/verification/audit-dealer-rule-candidates.ts docs/research/GATE34_DEALER_RULE_CANDIDATE_AUDIT_2026-06-14.md docs/research/GATE34_DEALER_SYSTEM_RESEARCH_NOTES_2026-06-14.md docs/research/GATE34_DEALER_SOURCE_RULE_FIXED_BAND_AUDIT_2026-06-14.md app/reports/data-verification/weekly-hold-audit/dealer-rule-candidate-audit-20260614.json
```

Both passed.

## Recommended Fresh-Eyes Questions

Start with these, not more TP/SL tuning:

1. Is Limni's current contrarian Dealer interpretation valid at all for FX?
2. Should Dealer direct net be treated as inventory/risk-transfer, hedging
   pressure, or something regime-dependent?
3. What did 2024 have in common across the worst weeks/pairs that made direct
   opposed-bias fail?
4. Is the useful Dealer information actually delta/change, not static net?
5. Should the Dealer model output a confidence score instead of a hard
   direction?
6. Should direct Dealer rows require trend/regime confirmation before they are
   allowed to vote in a basket?
7. Does the basket get too one-sided in 2024, and should breadth/crowding cap
   direct rows before exits are considered?
8. If Dealer alone cannot pass 2024, should Dealer become only one source in a
   future composite rather than a standalone baseline?

## Prompt For The Next Agent

```txt
Continue Limni / Poseidon in C:\Users\User\Documents\GitHub\limni-website.

Read recovery first:
1. C:\Users\User\Documents\GitHub\freedom-ops\.codex\CODEX_SESSION.md
2. C:\Users\User\Documents\GitHub\freedom-ops\.codex\CODEX_CKB.md
3. AGENTS.md
4. docs/backlog/CURRENT_WORK.md
5. docs/BACKTEST_CANONICAL_PROTOCOL.md
6. docs/research/GATE34_DEALER_SYSTEM_FRESH_EYES_HANDOFF_2026-06-14.md
7. docs/research/GATE34_DEALER_SYSTEM_RESEARCH_NOTES_2026-06-14.md
8. docs/research/GATE34_DEALER_SOURCE_RULE_FIXED_BAND_AUDIT_2026-06-14.md
9. docs/research/GATE34_DEALER_RULE_CANDIDATE_AUDIT_2026-06-14.md
10. docs/research/GATE34_DEALER_WEEKLY_HOLD_2024_2026_AUDIT_2026-06-14.md

Current gate:
Gate 34: weekly-hold-engine-research.

Current state:
- Gate 33 Dealer Weekly Hold parity passed for six representative FX pairs.
- Gate 34 Dealer-only research is now blocked by 2024.
- Clean 2025 and current 2026 are profitable, but 2024 is a serious failure.
- The 2024 failure is not explained by missing COT snapshots, wrong source weeks,
  price reconstruction mismatch, or missing ADR coverage after the corrected audit.
- The failure is concentrated in direct opposed-bias Dealer rows.
- Neutral/tiebreaker rows are comparatively stable.
- Dealer delta is the strongest source-rule lead so far, but it still does not
  make 2024 pass.
- Spread should be treated as signal quality/cleanliness, not as a standalone
  bullish/bearish vote.
- Fixed TP/SL does not solve 2024; do not continue by curve-fitting exits.

Fresh-eyes task:
Re-evaluate whether Limni is interpreting Dealer data correctly at all. Study
Dealer/Intermediary CFTC meaning, spread, net positioning, and weekly changes.
Look for a simple, defensible Dealer source model that can be tested across 2024,
clean 2025, current 2026, and then backward only where source/path coverage is
receipt-backed.

Important constraint:
For future tandem/tiered/composite systems, neutral/abstain must still produce
pair-level data with a reason. Do not design a source model that simply drops
rows without evidence.

Frozen scope:
- Dealer source only unless Freedom explicitly opens other sources.
- No Commercial, Sentiment, Strength, tandem, tiered, ADR Grid parity, Pair Fill
  Cap redesign, release canon work, or final TP/SL promotion.

Expected dirty tree:
- Gate 33 Pine verifier changes and parity receipts/screenshots.
- Gate 34 verification scripts and generated receipts.
- package.json verification scripts.
- docs/backlog/CURRENT_WORK.md and CODEX_SESSION.md updated for Gate 34.
- New Gate 34 Dealer source-rule docs and receipts.
```
