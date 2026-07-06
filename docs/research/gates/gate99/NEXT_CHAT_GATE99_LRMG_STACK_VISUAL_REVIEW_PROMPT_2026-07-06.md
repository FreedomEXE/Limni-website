# Next Chat Prompt - Gate 99 LRMG Stack Visual Review

Continue as Codex/Poseidon in:

`C:/Users/User/Documents/GitHub/limni-website`

Recover state first:

1. Read `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_SESSION.md`
2. Read `C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_CKB.md`
3. Read `AGENTS.md`
4. Read `docs/BACKTEST_CANONICAL_PROTOCOL.md`
5. Read `docs/research/gates/gate99/GATE99C_LRMG_V2_Q_SCALE_CHALLENGER_2026-07-06.md`

Current lane:

- Gate 99C visual LRMG completed-day q stack.
- This is indicator/visual architecture work only, not EA work.
- `LimniTrendFollow.mq5` is a separate EA lane owned by another chat. Do not
  touch it unless Freedom explicitly switches lanes.

Accepted so far:

- `LimniLRMGPriceLine` is visually accepted.
- `LimniLRMGStoch` is acceptable in principle.
- Both are desirable because they are no longer pinned to ordinary chart price
  or timeframe behavior.

Unresolved:

- `LimniLRMGMA` changes color more often than the original David MA, which may
  make it worse visually or semantically.
- `LimniLRMGTrigger` arrows are currently prototype Stoch re-entry + MA-state
  arrows. They are not clearly Katarakti sweep/reclaim logic.
- Freedom is conflicted and wants an outside opinion plus Codex's architectural
  recommendation before more code.

Current active files:

- `automation/mt5/Indicators/LimniLRMGPriceLine.mq5`
- `automation/mt5/Indicators/LimniLRMGStoch.mq5`
- `automation/mt5/Indicators/LimniLRMGMA.mq5`
- `automation/mt5/Indicators/LimniLRMGTrigger.mq5`
- `automation/mt5/Indicators/Include/LimniLRMGStackCore.mqh`
- `automation/mt5/Scripts/LimniLRMGStabilityCheck.mq5`

Compile proof:

- `docs/research/gates/gate99/artifacts/lrmg-stack-single-speed-2026-07-06/`
- Repo and active-terminal compiles for price line, Stoch, MA, and Trigger all
  report `Result: 0 errors, 0 warnings`.

Important implementation state:

- There is one active version of each indicator.
- The temporary G99V0 duplicate idea was removed.
- The leftover `LimniLRMGPriceLineV2` files were removed.
- `Stoch`, `MA`, and `Trigger` use the cached shared LRMG stack loader to avoid
  rebuilding full M1 LRMG history on every tick.
- `PriceLine` already has its own cache.

Stop lines:

- No `LimniTrendFollow.mq5` changes.
- No `LimniHedge_V1` changes.
- No `LimniKataraktiEA` mutation.
- No live/app integration.
- No EA execution logic.
- No backtest/PnL/promotion claims.
- No more coding until Freedom provides outside review or explicitly asks for a
  specific next indicator change.

Recommended next action:

1. Ask Freedom for the ChatGPT Pro response if he has it.
2. Review only the MA/arrow architecture question.
3. Decide whether:
   - MA should remain separate,
   - MA state should color the LRMG price line,
   - MA should become more David-like/smoother,
   - arrows should become Katarakti-like sweep/reclaim on LRMG event bars, or
   - arrows should be removed until the signal grammar is clearer.
