# Gate 90C Full-Window Matrix Runtime Blocker

Generated: 2026-07-02

## Verdict

`BLOCKED_GATE90C_FULL_WINDOW_MATRIX_CURRENT_COMMAND_PATH_TOO_SLOW_NO_SCORECARD`

## Scope

This is a Gate 90C execution note only. It does not change runner code, MT5 EA
code, OOS evidence, Candidate B/COT design, promotion/live-readiness, or
app/live integration.

## Attempted Command Plan

- Command plan:
  `docs/research/gates/gate90/artifacts/gate90c-full-window-matrix-command-plan.csv`
- Validated command count before launch: `150`
- Expected summary rows if complete: `1,050`
- First attempted row:
  - ordinal: `1`
  - signal ADR brick: `0.025`
  - David MA period: `25`
  - grid spacing ADR: `0.10`
  - activation rules:
    `raw_both,david_contra,candidate_b,candidate_b_david_contra_confirm,candidate_b_david_contra_conflict_candidate,stoch_contra,david_stoch_confirm`

## Runtime Evidence

- Matrix loop started at `2026-07-02T13:12:56.1718144-04:00`.
- The first command remained active for about `30` minutes without producing
  end-of-command artifacts.
- Read-only process checks during the run showed the active Node worker
  consuming CPU and holding stable memory; this looked like compute saturation,
  not a crashed shell.
- No `activation-summary.rows.*`, `weekly-activation-truth.rows.*`, or
  `gate90-run-summary.json` files were written for the first cell before the
  attempt was stopped.
- Run log:
  `docs/research/gates/gate90/artifacts/gate90c-full-window-matrix-run-log.txt`

## Read

The Gate 90C design is coherent, but the current CSV execution path is not
practical as a foreground 150-command loop. The lowest-brick/tightest-spacing
cell alone did not reach completion in the observed window, so running all
`150` cells this way would risk consuming the session or machine without timely
aggregate evidence.

## Follow-Up

This blocker was followed by a targeted Gate 90C runner speed repair and a
bounded 26-week fast decision surface, not by rerunning the full 150-command
foreground matrix. See:

- `docs/research/gates/gate90/GATE90C_FAST_DECISION_26W_SCORECARD_2026-07-02.md`
- `docs/research/gates/gate90/artifacts/gate90c-fast-decision-26w-scorecard.csv`
- `docs/research/gates/gate90/artifacts/gate90c-fast-decision-26w-scorecard.json`

The original full 150-command / 1,050-row matrix remains incomplete.

## Not Done

- The 150-command matrix did not complete.
- The expected `1,050` summary rows do not exist.
- No full-window 1,050-row aggregate scorecard was built.
- No OOS rerun was started.
- No MT5 EA refactor, red-news blackout, broad COT/Candidate B redesign,
  promotion/live-readiness, or app/live integration work was opened.

## Next Gate Decision

Before rerunning Gate 90C full-window evidence, choose one of these bounded
paths:

1. Add progress/checkpoint support to the Gate 90 runner and rerun with
   resumable per-week or per-cell output.
2. Run a smaller predeclared full-history slice first, such as one activation
   family or one spacing/brick lane, to estimate full matrix cost.
3. Build a dedicated Gate 90C matrix driver that batches cells with explicit
   checkpoints and avoids losing all progress when one cell is interrupted.

The current Gate 90C evidence remains research-only and not promotion-ready.
