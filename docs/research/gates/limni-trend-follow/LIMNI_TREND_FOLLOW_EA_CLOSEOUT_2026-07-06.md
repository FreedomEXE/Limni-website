# LimniTrendFollow EA Closeout - 2026-07-06

## Scope

This lane created a new isolated EA:

- `automation/mt5/Experts/LimniTrendFollow.mq5`

It is separate from `LimniKataraktiEA`, Gate 99 visual sidecar work, and the
LRMG visual stack.

## Current Design

- Primary lane: LRMG state-follow basket.
- Direction rule: above internal point-in-time LRMG line = buy state; below =
  sell state.
- Default flip handling: hold existing primary basket rather than close/reverse.
- Account exits: `ExitScope=EXIT_ACCOUNT` by default.
- Hedge lane: optional independent opposing hedge basket/grid under magic
  `960098`.
- Hedge mode:
  - `HEDGE_LOOSE`: any 1 of 3 events.
  - `HEDGE_BALANCED`: any 2 of 3 events.
  - `HEDGE_STRICT`: all 3 events.
- Hedge events:
  - Katarakti loose signal in hedge direction.
  - Stochastic exhaustion in hedge direction.
  - David MA AGAINST hedge direction.

## Speed Defaults

The installed EA defaults to `FastResearchMode=true`.

Fast mode preserves aggregate receipts while suppressing the slowest research
surfaces:

- detailed per-symbol event CSVs
- detailed per-symbol basket CSVs
- per-bar entry-candidate rows
- account-exit print spam
- forced account-exit file flushes during the run

It also skips Stoch/David reads on bars where the values are not used.

## Observed Smoke Evidence

Stopped strict hedge smoke:

- Run: `TESTER_279`
- Strict hedge behavior was too sparse during the March 2020 heat window.
- Overall hedge events existed, but March 13-16 only had 3 hedge entries and 9
  hedge grid adds.

Loose hedge smoke:

- Run: `TESTER_186`
- `HEDGE_LOOSE_1_OF_3`
- Hedge entries: 1669
- Hedge grid adds: 4811
- Hedge closed-plus-marked ADR: -1052.644026
- Account open pct low: -63.097275
- Read: loose hedge became a second uncontrolled grid book and is rejected for
  now.

## Compile And Install Proof

Artifacts:

- `docs/research/gates/limni-trend-follow/artifacts/compile-2026-07-06/limni-trend-follow-repo-compile-log-speed-mode.txt`
- `docs/research/gates/limni-trend-follow/artifacts/compile-2026-07-06/limni-trend-follow-active-terminal-compile-log-speed-mode.txt`

Both logs report:

- `Result: 0 errors, 0 warnings`

Repo and active terminal source hash:

- `0803EAE37CE2206B1494331A79090D11866063977DFCDBF2AFB35F5A199BD909`

Active terminal install path:

- `C:\Users\User\AppData\Roaming\MetaQuotes\Terminal\94497F60A2BFEA1AFAB110FCF3E331BB\MQL5\Experts\LimniTrendFollow.mq5`

## Next Independent Tests

Use fast mode unless detailed event receipts are specifically needed.

Suggested next setting if continuing this exact lane:

- `FastResearchMode=true`
- `OpposingHedgeLane=true`
- `OpposingHedgeMode=HEDGE_BALANCED`
- `ExitScope=EXIT_ACCOUNT`
- `GridAddsRequireTrendAgreement=false` if intentionally using GridCap as the
  primary grid boundary

No promotion or live-readiness claim is made.
