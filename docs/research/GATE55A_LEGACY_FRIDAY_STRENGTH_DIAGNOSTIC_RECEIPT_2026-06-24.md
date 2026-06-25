# Gate 55A Legacy Friday Strength Diagnostic Receipt

Date: 2026-06-24

## Verdict

Status: `BLOCKED_BY_STRENGTH_SOURCE_OR_COVERAGE`

Secondary classification: `EXECUTION_SENSITIVE_LEGACY_DIAGNOSTIC`

Gate 55 does not fail Strength as a concept. It fails the current Friday
Strength artifact as an institutional-grade feature contract.

The current artifact is preserved as diagnostic evidence only. It is not
approved as a plain confirm layer, not approved for COT combination, and not
ready for Signal Model promotion.

## Scope

This receipt closes the current Gate 55A legacy selected-vs-fade diagnostic.
It does not close Gate 55 overall. Gate 55 remains open as Gate 55B:
Strength Source / Feature Contract Rebuild Plan.

Hard locks preserved:

- No COT+Strength combination.
- No regime filters.
- No BPR/RRP retests.
- No PPP/NEER/REER work.
- No execution optimization.
- No risk overlay.
- No MT5/live/bot work.
- No final system selection.
- No outcome grid expansion.

## Evidence Inputs

Primary smoke receipt:

- Temp markdown:
  `temp/gate55-strength-baseline-final-smoke/gate55-friday-strength-baseline-20260624T041941Z.md`
- Temp JSON:
  `temp/gate55-strength-baseline-final-smoke/gate55-friday-strength-baseline-20260624T041941Z.json`
- Receipt hash:
  `8F2804C7593E9AF14D406BB27C4C46A63B51BEA5870ECEFBFD2E3E791421B6AE`
- Script:
  `app/scripts/verification/audit-gate55-friday-strength-baseline.ts`

Smoke status:

`PASS_WITH_CAVEATS_STRENGTH_CARRY_BASELINE_READY_FOR_REVIEW`

The review result supersedes the smoke status for research classification:
the smoke proves repeatable scoring and the coverage defect; it does not prove
that the artifact is promotion-grade.

## Frozen Friday Strength Definition

Frozen source: `strength_friday_snapshot`

Definition: latest 1h/4h/24h FX Strength state at or before Friday 17:00 New
York, as preserved in the Gate 44 matrix source contexts.

Native selected side: stored Friday Strength direction when it is `LONG` or
`SHORT`.

Native fade side: opposite of the stored Friday Strength direction.

Missing rows are unavailable in the native view; they are not treated as
neutral.

## Coverage Findings

- Expected weeks: `388`
- Matrix weeks: `372`
- Expected parent rows: `10,864`
- Matrix parent rows: `10,416`
- Native directional rows: `10,292`
- Native missing/non-directional rows: `124`
- Native neutral/tie rows: `0`
- Source score payload rows: `0`

Stored non-directional Friday rows were all `MISSING`, not `NEUTRAL`. There is
no hidden score-level tie to break from the frozen matrix alone because raw
score payloads were not persisted.

## Carry-Fill Diagnostic

Policy tested: `carry_previous_friday_strength_side`

Rule: when the frozen Friday Strength side is missing for a pair-week, carry
forward the latest prior stored Friday Strength side for the same pair. Do not
use future rows. Do not seed the first unresolved week without approved warmup
or fallback evidence.

Result:

- Selected rows after carry: `10,836`
- Native rows after carry: `10,292`
- Carry-filled rows: `544`
- Unresolved rows: `28`
- Full weeks after carry: `387`
- Partial weeks after carry: `0`
- Unavailable weeks after carry: `1`
- Carry age days: min `7`, max `91`, average `36.6342`

The remaining unresolved block is the initial `2019-01-07` week. Filling it
requires approved pre-window Strength warmup/backfill or an explicit fallback.

## Source Observability Findings

The frozen matrix contains historical Friday Strength sides, but the deeper
Strength source tables do not go back far enough to audit or rebuild the
historical calculation back to the start of the matrix.

Observed table spans:

| Table | Rows | Min time | Max time | Distinct times/weeks |
|---|---:|---|---|---:|
| `currency_strength_snapshots` | 70,488 | 2026-01-19T00:00:00.000Z | 2026-06-24T04:00:00.000Z | 2,937 |
| `strength_history_snapshots` | 1,022,400 | 2024-12-30T00:15:00.000Z | 2026-06-12T21:00:00.000Z | 42,600 |
| `strength_weekly_snapshots` | 912 | 2026-01-19T00:00:00.000Z | 2026-05-24T20:00:00.000Z | 19 |

This creates evidence asymmetry versus COT. COT now has an accepted research
baseline with full-universe coverage, warmup logic, carry-forward policy,
tie policy, no-lookahead source rules, and positive ADR Grid plus weekly hold
performance. Strength does not yet have the same source-contract boundary.

## Performance Findings

| Signal | Rows | Native rows | Carry rows | Unresolved rows | ADR full weeks | ADR partial weeks | ADR Grid ADR | ADR Grid DD | ADR Grid R/DD | ADR Grid PF | Missing grid rows | Weekly Hold ADR | Weekly Hold DD | Weekly Hold R/DD | Weekly Hold PF | Missing hold rows |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `strength_friday_snapshot_selected` | 10,292 | 10,292 | 0 | 124 | 359 | 12 | 1223.2949 | -519.9618 | 2.3527 | 1.2683 | 12 | -144.3625 | -286.0028 | -0.5048 | 0.9272 | 0 |
| `strength_friday_snapshot_fade_native` | 10,292 | 10,292 | 0 | 124 | 359 | 12 | 605.8648 | -662.1855 | 0.9149 | 1.1193 | 15 | 144.3625 | -263.7106 | 0.5474 | 1.0785 | 0 |
| `strength_friday_snapshot_selected_carry_previous` | 10,836 | 10,292 | 544 | 28 | 387 | 0 | 1223.1925 | -508.3005 | 2.4064 | 1.2677 | 460 | -143.4070 | -289.6114 | -0.4952 | 0.9283 | 308 |
| `strength_friday_snapshot_fade_carry_previous` | 10,836 | 10,292 | 544 | 28 | 387 | 0 | 573.7539 | -676.3137 | 0.8484 | 1.1115 | 463 | 143.4070 | -263.7106 | 0.5438 | 1.0772 | 308 |

Interpretation:

- Selected direction has broad ADR Grid positivity.
- Selected direction fails simple weekly hold.
- Fade direction weakens ADR Grid materially.
- Fade direction improves simple weekly hold.
- The disagreement classifies the legacy artifact as execution-sensitive.
- Because the source contract is incomplete, the result is not sufficient for
  institutional selected-vs-fade promotion.

## Review Conclusion

Gate 55A should not be read as:

`Strength is bad.`

It should be read as:

`The current Friday Strength artifact is not yet a promotion-grade source/feature contract.`

Strength remains alive only as a rebuild candidate. The next action is Gate
55B, a design-only Strength Source / Feature Contract Rebuild Plan.
