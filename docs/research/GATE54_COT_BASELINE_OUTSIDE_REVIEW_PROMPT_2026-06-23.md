# Gate 54 COT Baseline Outside Review Prompt

Use this prompt with ChatGPT Pro or another outside reviewer.

```text
Mode: OUTSIDER REVIEW

Review Gate 54 for Limni/Poseidon.

Repository context:
- Project is in source/data verification stage, not final system selection.
- Gate 54 objective was to harden the legacy baseline inputs enough to define one repeatable COT baseline.
- Do not evaluate this as a live, production, investor, MT5, or promoted system.
- Do not recommend optimization grids yet.
- Regime filters, Strength, execution, and risk overlays will be built separately after this baseline is reviewed.

Primary docs to review:
1. docs/research/GATE54F_STANDALONE_SIGNAL_BASELINES_AND_SOURCE_AVAILABILITY_2026-06-23.md
2. docs/research/GATE54G_COT_WARMUP_CARRY_FORWARD_PROOF_2026-06-23.md
3. docs/research/GATE54H_CLP_TIE_BREAK_COMPARISON_2026-06-23.md
4. docs/research/GATE54I_RAW_SIGNAL_REVIEW_PACKET_2026-06-23.md

Working COT baseline accepted by Freedom for review:

CLP carry-forward + carry-previous tie fill

Main numbers:
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

Important source mechanics:
- FX COT warmup history was extended to 2016.
- CLP uses a 156-report lookback.
- First lifecycle report date is 2018-12-24.
- Missing CLP metric windows: 0.
- Missing lifecycle pair rows: 0.
- COT report selection is live-style:
  - exact report date when available;
  - holiday-adjusted date when shifted;
  - otherwise latest prior available report;
  - 2025 lapse/catch-up reports are not injected before publication proof.
- Ties were source-complete, not missing-data rows.
- Tie policy chosen: carry_previous_clp_side.

Tie-break comparison:
- Tie rows: 71 across 60 weeks.
- Carry previous and raw COT spread both resolved all 71.
- They agreed on 34 rows and disagreed on 37.
- Tie-only weekly hold favored raw COT spread:
  raw +0.9810 ADR vs carry -7.6696 ADR.
- Tie-only ADR Grid favored carry previous:
  carry +38.5323 ADR vs raw +19.5902 ADR.
- Freedom chose carry previous because it is simpler and better under the legacy ADR Grid score.

Friday Strength note:
- Friday Strength standalone has positive ADR Grid score:
  +1223.2949 ADR, DD -519.9618, R/DD 2.3527.
- But simple weekly hold is negative:
  -144.3625 ADR, DD -286.0028, R/DD -0.5048.
- Therefore Strength should not be added as a plain confirm layer yet.
- Gate 55 should separately test Strength selected-vs-fade as its own baseline/fade diagnostic.

Review questions:
1. ACCEPT / ACCEPT WITH CAVEATS / REJECT the Gate 54 COT baseline as a repeatable research baseline.
2. Is CLP carry-forward + carry-previous tie fill a defensible baseline COT system for the next stage?
3. Are the live-style COT carry-forward rules conservative enough to avoid lookahead bias?
4. Does the 156-report warmup and 2016 backfill solve the prior CLP warmup blocker?
5. Does the mixed tie-break result create a material concern, or is carry_previous_clp_side acceptable because it is simpler and better under ADR Grid?
6. What caveats should be preserved before moving to Gate 55 Strength?
7. Should Gate 54 be closed after this review, with Gate 55 focused only on Strength baseline/fade?

Expected answer format:

Verdict:
Gate 54 COT baseline: ACCEPT / ACCEPT WITH CAVEATS / REJECT

Institutional read:
- one paragraph

Required caveats:
- bullets

Gate decision:
- Can Gate 54 close?
- Can Gate 55 start?
- What must Gate 55 prove?

Do not recommend final system selection, MT5, live trading, investor claims, BPR/RRP retests, PPP/NEER/REER work, or regime-filter overlays yet.
```
