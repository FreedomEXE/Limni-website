# Next Chat Dual Handoff - LimniTrendFollow + Gate 99D LRMG Visual Stack

Date: 2026-07-06

## Continue As

Continue as Codex/Poseidon in:

`C:/Users/User/Documents/GitHub/limni-website`

## Recovery First

1. Read `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_SESSION.md`.
2. Read `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_CKB.md`.
3. Read `AGENTS.md`.
4. Read `docs/BACKTEST_CANONICAL_PROTOCOL.md`.
5. Read `docs/research/gates/limni-trend-follow/LIMNI_TREND_FOLLOW_EA_CLOSEOUT_2026-07-06.md`.
6. Read `docs/research/gates/gate99/GATE99D_LRMG_VISUAL_STATE_GRAMMAR_FREEZE_2026-07-06.md`.

Always verify live git before making branch, dirty-tree, upstream, or pushed-head
claims.

## Why This Handoff Is Dual

Two chats touched separate lanes on the same branch:

- `LimniTrendFollow` is an isolated EA research lane.
- Gate 99D is an LRMG visual indicator architecture lane.

Keep them separate unless Freedom explicitly asks to merge final EA design.

## Lane A - LimniTrendFollow EA

Current lane:

- Isolated EA: `automation/mt5/Experts/LimniTrendFollow.mq5`
- Pushed lane commit before Gate 99D closeout:
  `540db705 Add LimniTrendFollow EA research lane`
- Active terminal source:
  `C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB/MQL5/Experts/LimniTrendFollow.mq5`
- Repo and active-terminal source hash:
  `0803EAE37CE2206B1494331A79090D11866063977DFCDBF2AFB35F5A199BD909`

Important defaults:

- `FastResearchMode=true`
- `OpposingHedgeLane=true`
- `OpposingHedgeMode=HEDGE_BALANCED`
- `ExitScope=EXIT_ACCOUNT`

Current evidence:

- Strict hedge was too sparse during the March 2020 stress window.
- Loose hedge became a second uncontrolled grid book and is rejected for now.
- Fast mode preserves aggregate receipts while suppressing detailed CSV/event
  spam for faster independent MT5 tests.

First TrendFollow task:

- Review any new MT5 result Freedom provides.
- Start with aggregate summary, account exits, aggregate pair contribution, and
  aggregate opposing hedge receipt.
- Decide whether the failure mode is hedge mode, primary grid exposure, or the
  need for a basket heat circuit breaker.

Do not make promotion or live-readiness claims.

## Lane B - Gate 99D LRMG Visual Stack

Current lane:

- Indicator/visual architecture only.
- Receipt:
  `docs/research/gates/gate99/GATE99D_LRMG_VISUAL_STATE_GRAMMAR_FREEZE_2026-07-06.md`
- Compile artifacts:
  `docs/research/gates/gate99/artifacts/gate99d-lrmg-visual-state-grammar-2026-07-06/`

Accepted layers:

- `LimniLRMGPriceLine`: unchanged source; canonical cyan LRMG reference line.
- `LimniLRMGStoch`: unchanged source; LRMG exhaustion panel.

Reshaped layers:

- `LimniLRMGMA`: now displays a separate-window `LRMG David State` ribbon.
- `LimniLRMGTrigger`: now displays `LRMG Katarakti Events` structural markers.

Changed visual stack sources:

- `automation/mt5/Indicators/Include/LimniLRMGStackCore.mqh`
- `automation/mt5/Indicators/LimniLRMGMA.mq5`
- `automation/mt5/Indicators/LimniLRMGTrigger.mq5`

Recompiled visual stack binaries:

- `automation/mt5/Indicators/LimniLRMGPriceLine.ex5`
- `automation/mt5/Indicators/LimniLRMGStoch.ex5`
- `automation/mt5/Indicators/LimniLRMGMA.ex5`
- `automation/mt5/Indicators/LimniLRMGTrigger.ex5`

Compile proof:

- All eight repo and active-terminal compile logs report
  `Result: 0 errors, 0 warnings`.
- Active-terminal MetaEditor returned exit code `1` on compiles, but logs were
  clean. This matches known MT5 behavior for this lane.

Source hash parity after install:

- `LimniLRMGPriceLine.mq5`:
  `C9427B0DFAFAF4FFC5956E9FE786C325AA5B84206E76B1DD88DF8925B061A709`
- `LimniLRMGStoch.mq5`:
  `0092B3C566077566B81178562874F09B594298A25F41C55B22587361D6E7CA2A`
- `LimniLRMGMA.mq5`:
  `731186BA77335C4BA6536470DC2E3014C8AA74BD0AD526C4BC502E166D9CB59E`
- `LimniLRMGTrigger.mq5`:
  `2E9B2F3089634FC8EA238B010A154DFD7797E146D0D14BD79D072D993BB8F2FD`
- `LimniLRMGStackCore.mqh`:
  `B1448F8FF8AEB7C4ECB1CCC0CE96C7BED36B2EABFB7F478DDB79026D5011C919`

First Gate 99D task:

- Visually inspect all four indicators together in MT5.
- Use matching `ScaleLookbackDays` on all four indicators, starting with `20`.
- Decide whether the `LRMG David State` ribbon and `LRMG Katarakti Events`
  markers are readable enough before any EA design work.

## Shared Final EA Architecture Thought

The likely final design is two-lane, not one blended entry signal.

Trend-following lane:

- `LRMG David State` is the directional regime.
- `LRMG PriceLine` is the structural reference.
- `LRMG Stoch` is pullback/exhaustion context.
- `LRMG Katarakti Events` are reclaim/displacement triggers in the trend
  direction.

Anti-trend lane:

- Requires distance from the `LRMG PriceLine`.
- Requires Stoch exhaustion.
- Requires a Katarakti-style sweep/reclaim/displacement event.
- Requires enough reversion room back to center.
- David state is a filter, not the boss.

Do not let Stoch alone, David state alone, or median side alone open trades.

## Stop Lines

- No `LimniKataraktiEA.mq5` mutation unless Freedom explicitly asks.
- No `LimniHedge_V1.mq5` changes.
- Do not mix TrendFollow EA changes with Gate 99D visual files.
- No live/app integration.
- No final EA execution logic from the Gate 99D visual lane.
- No backtest, PnL, promotion, or live-readiness claim from Gate 99D visuals.

## Recommended Next Action

If Freedom brings new MT5 results, review the `LimniTrendFollow` receipts first.

If Freedom asks for visual review, inspect Gate 99D indicator behavior first.

If Freedom asks for final EA architecture, start from the two-lane split above
and keep the TrendFollow evidence and Gate 99D visuals as separate inputs.
