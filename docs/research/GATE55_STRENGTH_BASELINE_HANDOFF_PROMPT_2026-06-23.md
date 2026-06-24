# Gate 55 Strength Baseline Handoff Prompt

Use this prompt to start the next Codex chat.

```text
Continue Limni/Poseidon from:
C:\Users\User\Documents\GitHub\limni-website

Read recovery first:
1. C:\Users\User\Documents\GitHub\freedom-ops\.codex\CODEX_SESSION.md
2. C:\Users\User\Documents\GitHub\freedom-ops\.codex\CODEX_CKB.md
3. AGENTS.md
4. docs/research/GATE54I_RAW_SIGNAL_REVIEW_PACKET_2026-06-23.md
5. docs/research/GATE54_COT_BASELINE_OUTSIDE_REVIEW_PROMPT_2026-06-23.md
6. docs/research/GATE55_STRENGTH_BASELINE_HANDOFF_PROMPT_2026-06-23.md

Active gate:
Gate 55: Friday Strength selected-vs-fade baseline diagnostic

Gate 54 status:
Gate 54 is accepted with caveats and may close as the COT baseline definition gate.

Accepted COT baseline:
CLP carry-forward + carry-previous tie fill

Gate 54 COT baseline numbers:
- Rows: 10,864
- Full weeks: 388/388
- Partial weeks: 0
- ADR Grid: +1176.4520 ADR
- ADR Grid max DD: -358.9404 ADR
- ADR Grid R/DD: 3.2776
- ADR Grid PF: 1.2604
- Simple weekly hold: +339.4126 ADR
- Weekly hold max DD: -151.9313 ADR
- Weekly hold R/DD: 2.2340
- Weekly hold PF: 1.1844

Institutional wording to preserve:
This is an always-on COT baseline under point-in-time available information.
It is not a claim that the fund must always trade during stale-source regimes.
During CFTC shutdown/lapse windows, the COT baseline does not use future catch-up data. It carries forward the latest COT state that would have been available at the time.

Gate 54 accepted caveats:
- Research baseline only, not final Signal Model selection.
- No live, production, MT5, investor, or promotion claim.
- 2025 shutdown/lapse behavior is no-lookahead but stale-source carry-forward.
- carry_previous_clp_side is accepted because it is deterministic, simple, and ADR Grid-favorable, not because it dominates every lens.
- Raw underlying COT spread remains a tie-policy caveat because it performed better on simple weekly hold.
- Future filters must report parent rows, retained rows, removed rows, retained performance, removed performance, and incremental lift versus the full COT parent universe.

Gate 55 objective:
Do the same baseline-hardening exercise for Friday Strength that Gate 54 did for COT.

First question:
Does Friday Strength contain broad repeatable directional information, and does it work better as selected direction, fade direction, or neither?

Known starting fact from Gate 54I:
Friday Strength standalone has positive ADR Grid performance but negative simple weekly hold performance:
- Friday Strength selected rows: 10,292
- Full weeks: 359
- Partial weeks: 12
- ADR Grid: +1223.2949 ADR
- ADR Grid max DD: -519.9618
- ADR Grid R/DD: 2.3527
- ADR Grid PF: 1.2683
- Simple weekly hold: -144.3625 ADR
- Weekly hold max DD: -286.0028
- Weekly hold R/DD: -0.5048
- Weekly hold PF: 0.9272

Gate 55 required scope:
1. Inspect existing Strength source contracts and Friday Strength selector output.
2. Confirm the frozen Friday Strength source definition and coverage.
3. Reconstruct/score Friday Strength selected direction.
4. Reconstruct/score Friday Strength fade direction.
5. Compare selected vs fade under both:
   - ADR Grid matrix scoring
   - simple weekly hold context
6. Report parent rows, retained rows, removed/unavailable rows, full weeks, partial weeks, missing price rows, and any source gaps.
7. Preserve separate selected/fade results without choosing a final combined system.

Gate 55 hard locks:
- No COT+Strength combination yet.
- No regime filters.
- No BPR/RRP retests.
- No PPP/NEER/REER work.
- No execution optimization.
- No risk overlay.
- No MT5/live/bot work.
- No final system selection.
- No outcome grid expansion.
- No source refetch/rebuild unless a narrowly scoped Strength source audit proves it is required.

Preferred first action:
Inspect the existing Strength scripts/tables/receipts and propose the smallest Gate 55 smoke command before running anything.

Gate 55 likely output doc:
docs/research/GATE55_FRIDAY_STRENGTH_SELECTED_VS_FADE_BASELINE_2026-06-24.md

Decision language:
- PASS if selected/fade Strength is reconstructed repeatably and one or both views are usable as a standalone Strength research baseline.
- PASS_WITH_CAVEATS if source coverage or weekly-hold/ADR Grid disagreement requires caveats.
- BLOCKED if Friday Strength source/output cannot be reconstructed or coverage gaps are unexplained.

Do not reopen Gate 54 unless Gate 55 finds a reproducibility defect that directly contradicts the accepted COT baseline.
```

## Human Summary

Gate 55 should treat Strength as its own baseline layer, not as an overlay on COT yet.

The expected comparison is:

```text
Friday Strength selected
vs
Friday Strength fade
```

under both:

```text
ADR Grid matrix scoring
simple weekly hold
```

The goal is to decide whether Strength is a standalone selected-direction baseline, a fade baseline, a context-only diagnostic, or not usable yet.
