# Gate 34 Dealer Baseline Redesign Handoff

Generated: 2026-06-15

## Current State

Gate 34 is still `weekly-hold-engine-research`.

Dealer-only Weekly Hold has no baseline good enough for promotion yet.

The latest tested forced-28 idea, `dealer_normalized_score_forced28`, failed the
2020 follow-up. It was the least-bad 2019 row, but that was not enough evidence
and the 2020 result rejects it as the next baseline.

## Frozen Scope

- Dealer source only.
- No Commercial, Sentiment, Strength source, tandem/tiered/composite system,
  ADR Grid parity, Pair Fill Cap redesign, release canon, or live promotion.
- ADR Grid may be layered later, but do not use that as a reason to accept a
  weak baseline.
- Future source models must emit all 28 FX pair rows every selected week with a
  source reason. No silent row dropping.

## What Failed

Rejected or insufficient:

- Current app Dealer logic.
- Current app Dealer with fixed ADR TP/SL bands.
- `direct_ratio_override`.
- `ratio_direction_all` as-is because it can drop tied/neutral rows.
- `ratio_direction_all` with current fallback because fallback is not a real
  model.
- Full direct inversion.
- Direct delta/spread variants tested so far.
- `dealer_normalized_score_forced28`.
- Market-week `TP 1.6x / SL 2.45x` as a universal rescue rule.

## Latest Results

2019 clean sample, 43 weeks:

| Variant | ADR | ADR DD | Return/DD | Weekly PF | W/L |
|---|---:|---:|---:|---:|---:|
| Normalized Score / Week Close | -65.57% | 113.91% | -0.58 | 0.77 | 20/23 |
| Normalized Score / TP1.6 SL2.45 | -42.03% | 67.92% | -0.62 | 0.76 | 23/20 |

2020 clean sample, 52 weeks:

| Variant | ADR | ADR DD | Return/DD | Weekly PF | W/L |
|---|---:|---:|---:|---:|---:|
| Current Dealer / Week Close | +118.30% | 55.05% | 2.15 | 1.45 | 29/23 |
| Current Dealer / TP1.6 SL2.45 | +23.76% | 62.77% | 0.38 | 1.09 | 27/25 |
| Ratio Direction All / Week Close | +112.27% | 32.97% | 3.41 | 1.61 | 26/26 |
| Ratio Direction All / TP1.6 SL2.45 | -32.46% | 81.86% | - | 0.85 | 24/28 |
| Normalized Score / Week Close | -16.06% | 72.38% | - | 0.95 | 24/28 |
| Normalized Score / TP1.6 SL2.45 | -80.58% | 97.62% | - | 0.72 | 27/25 |

Interpretation:

- Normalized score is not good enough.
- The better 2020 ratio result is not acceptable as final baseline because it
  did not force all 28 pair rows.
- `TP 1.6x / SL 2.45x` hurt every tested 2020 source rule versus week-close.
- The exit model needs a rethink; do not assume fixed ADR bands rescue a bad
  source model.

## Receipts

- Decision log:
  `docs/research/GATE34_DEALER_SYSTEM_DECISION_LOG_2026-06-15.md`
- 2019 normalized-score receipt:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-43w-20260615-153747.md`
- 2020 normalized-score receipt:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-52w-20260615-162927.md`
- Historical ratio audit:
  `docs/research/GATE34_DEALER_RATIO_RULE_WEEKLY_AUDIT_2026-06-14.md`
- Source-rule candidate audit:
  `docs/research/GATE34_DEALER_RULE_CANDIDATE_AUDIT_2026-06-14.md`

## Next Chat Prompt

```txt
Continue Limni / Poseidon in C:\Users\User\Documents\GitHub\limni-website.

Read recovery first:
1. C:\Users\User\Documents\GitHub\freedom-ops\.codex\CODEX_SESSION.md
2. C:\Users\User\Documents\GitHub\freedom-ops\.codex\CODEX_CKB.md
3. AGENTS.md
4. docs/backlog/CURRENT_WORK.md
5. docs/BACKTEST_CANONICAL_PROTOCOL.md
6. docs/research/GATE34_DEALER_SYSTEM_DECISION_LOG_2026-06-15.md
7. docs/research/GATE34_DEALER_BASELINE_REDESIGN_HANDOFF_2026-06-15.md

Current gate:
Gate 34: weekly-hold-engine-research.

Fresh task:
We still have no Dealer-only baseline good enough for promotion. Do not rerun old
logic unless a test flaw is found. First explain the latest findings in plain
English, then help redesign the next forced-28 Dealer baseline and rethink exits.

Important findings:
- `dealer_normalized_score_forced28` failed. It was the least-bad forced-28 row
  in 2019 but failed 2020.
- `ratio_direction_all` week-close was strong in 2020, but it does not force all
  28 rows and is not acceptable as-is.
- `TP 1.6x / SL 2.45x` is not a stable rescue rule; it hurt every tested 2020
  variant versus week-close.
- We need a smarter source model that always emits 28 pair rows with reasons,
  not a fallback that hides ties.
- We also need to rethink exits before assuming ADR Grid will fix a weak
  baseline.

Frozen scope:
Dealer source only. No Commercial, Sentiment, Strength source,
tandem/tiered/composite system, ADR Grid parity, Pair Fill Cap redesign, release
canon, or live promotion.

Expected dirty tree:
Gate 33 Pine verifier changes/receipts, Gate 34 verification scripts, generated
weekly-hold baseline and exit-sweep receipts, research docs, CURRENT_WORK.md,
and CODEX_SESSION.md updates may be dirty.
```

