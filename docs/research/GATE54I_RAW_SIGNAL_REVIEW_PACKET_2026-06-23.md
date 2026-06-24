# Gate 54I Raw Signal Review Packet

Generated: 2026-06-24

## Result

- Status: READY_FOR_OUTSIDE_RAW_NUMBER_REVIEW
- Gate: Gate 54I: raw-signal-review-packet
- Purpose: consolidate Gate 54F/G/H raw signal numbers after COT warmup, live-style COT carry-forward, and accepted CLP tie-break policy.
- Source mutation by this packet: false
- No final system selection: true
- No optimization: true

## Freedom Decision

Freedom accepts `CLP carry-forward + carry-previous tie fill` as the working baseline COT system for now.

This means Gate 54 can proceed to outside/raw-number review with a single COT baseline instead of continuing COT source repair. The regime filter, Strength model, execution model, and portfolio/risk overlay will be built and tested separately, then overlaid later if they prove themselves.

This is not final live-system selection. Repeatability still has to be proven later through API endpoints, an MT5 bot, and live/backtest parity checks.

## Working Policy

For CLP ties, use `carry_previous_clp_side`.

Reason: it is the simpler deterministic policy and outperformed raw underlying COT spread on the legacy ADR Grid matrix score. Raw spread performed better on simple weekly hold and remains a review caveat.

This policy fills `71` tied pair rows across `60` weeks and gives CLP a full `28/28` pair decision set across `388` expected weeks.

## Source State

- FX COT warmup history now covers `546` report dates from `2016-01-05` to `2026-06-16`.
- CLP lifecycle uses `156` COT reports.
- First CLP lifecycle report date: `2018-12-24`.
- Missing CLP metric windows: `0`.
- Gate 54G no-lookahead policy:
  - use exact COT report date when available;
  - use holiday-adjusted report date when shifted;
  - otherwise carry forward the latest prior report;
  - do not inject 2025 lapse/catch-up rows before their availability is proven.

## Main Numbers

| Signal / policy | Rows | Full weeks | Partial weeks | ADR Grid ADR | ADR Grid DD | ADR Grid R/DD | ADR Grid PF | Weekly Hold ADR | Weekly Hold DD | Weekly Hold R/DD | Weekly Hold PF |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| CLP exact/matrix-gated, ties skipped | 10,262 | 310 | 59 | 1246.4123 | -372.4695 | 3.3463 | 1.2859 | 350.0062 | -149.0153 | 2.3488 | 1.1922 |
| CLP carry-forward, ties skipped | 10,793 | 328 | 60 | 1137.9197 | -372.4695 | 3.0551 | 1.2523 | 347.0824 | -149.0153 | 2.3292 | 1.1887 |
| CLP carry-forward, carry-previous tie fill | 10,864 | 388 | 0 | 1176.4520 | -358.9404 | 3.2776 | 1.2604 | 339.4126 | -151.9313 | 2.2340 | 1.1844 |
| Friday Strength standalone | 10,292 | 359 | 12 | 1223.2949 | -519.9618 | 2.3527 | 1.2683 | -144.3625 | -286.0028 | -0.5048 | 0.9272 |

## Tie-Break Decision

| Tie policy | Tie rows | Tie weeks | Weekly Hold ADR | ADR Grid ADR | ADR Grid R/DD | ADR Grid PF |
|---|---:|---:|---:|---:|---:|---:|
| Carry previous CLP side | 71 | 60 | -7.6696 | 38.5323 | 2.9242 | 2.2055 |
| Raw underlying COT spread | 71 | 60 | 0.9810 | 19.5902 | 1.4867 | 1.3882 |

Accepted working policy: `carry_previous_clp_side`.

## Plain-English Read

CLP is now mechanically usable across the seven-year review window with live-style COT carry-forward and a deterministic tie-breaker.

The strongest current COT baseline for review is:

```text
CLP carry-forward + carry-previous tie fill
```

It gives `28` pair directions per expected week, uses no lookahead COT fill, and has positive ADR Grid and weekly-hold context.

Friday Strength is not ready to be added as a straightforward confirm signal. Its ADR Grid score is positive, but its simple weekly hold is negative. That means Strength may be execution-sensitive, may need to be faded, or may only work inside the ADR Grid path. It should be reviewed separately before being combined with CLP.

## Review Questions

1. Is `CLP carry-forward + carry-previous tie fill` acceptable as the raw COT baseline for continued evaluation?
2. Does the gap between ADR Grid and weekly-hold Strength imply that Friday Strength should be tested as a fade before being used as a confirm layer?
3. Should the next diagnostic be a narrow Friday Strength selected-versus-fade review, with no new optimization grid?
4. Are the `308` missing price rows in Gate 54G/H weekly-hold context acceptable as a price-context caveat, given that ADR Grid scoring remains the legacy matrix path?

## Decision Boundary

This packet does not select the final system and does not authorize live, MT5, production, promotion, BPR/RRP retests, PPP/NEER/REER work, execution tuning, risk overlay work, or outcome-grid expansion.

Next authorized move:

```text
Outside/raw-number review of CLP carry-forward + carry-previous tie fill, then a narrow Friday Strength fade diagnostic if accepted.
```

## Evidence

- Gate 54F receipt: `docs/research/GATE54F_STANDALONE_SIGNAL_BASELINES_AND_SOURCE_AVAILABILITY_2026-06-23.md`
- Gate 54F hash: `4D79E80013628EA7CB95FC9AA8E3409DCE195ED57480C0E9C04134AA11953FDE`
- Gate 54G receipt: `docs/research/GATE54G_COT_WARMUP_CARRY_FORWARD_PROOF_2026-06-23.md`
- Gate 54G hash: `559855706524CE23EB6B55814FE24015857CC00DFBDB689CF286C9402C276058`
- Gate 54H receipt: `docs/research/GATE54H_CLP_TIE_BREAK_COMPARISON_2026-06-23.md`
- Gate 54H hash: `8E2FCBB05C62948FECD6F518446518611574C5B54C76EC766CDD37366B63DE37`
