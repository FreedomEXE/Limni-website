# Next Chat Handoff - Gate 105 HWM Review

Copy/paste prompt for the next Codex or ChatGPT review chat:

```text
You are reviewing Limni/Poseidon MT5 EA Gate 105.

Repo:
C:/Users/User/Documents/GitHub/limni-website

Branch:
codex/gate88-mt5-lifecycle-protection-controls

Current gate:
Gate 105 - Revma account HWM trailing profit lock after fees.

Recovery/read order:
1. Read C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_SESSION.md
2. Read C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_CKB.md
3. Read AGENTS.md
4. Read automation/mt5/README.md
5. Read docs/research/gates/gate105/GATE105_REVMA_ACCOUNT_HWM_TRAIL_IMPLEMENTATION_2026-07-08.md
6. Inspect the Gate 105 code diff before making claims.
7. Verify live git status/HEAD.

Review objective:
Code-review the Gate 105 HWM implementation and discuss high-level strategy
questions before any HWM test run is attempted.

Implemented scope:
- Added account-level Revma HWM trail mode:
  LP_SLTP_MULTI_CURRENCY_HWM_TRAIL_AFTER_FEES /
  MultiCurrencyHwmTrailAfterFees.
- Added HWM inputs:
  HwmTrailArmPct, HwmTrailMinLockPct, HwmTrailGivebackPct,
  HwmTrailBlockNewEntriesWhenArmed, HwmTrailHardStopLossPct.
- Preserved existing fixed TP/SL modes.
- No Revma q/state/signal formula changes.
- No grid birth/add direction changes.
- No Kyma/Katarakti work.
- No optimization.
- Split stop/TP behavior into block_new_entries vs close_required.
- Added HWM lifecycle receipts and summary fields.
- Added disk-safe receipt defaults:
  ReceiptMode=Off and OutputFolder=OFF.
- If OutputFolder=AUTO is selected, AUTO intentionally saves review evidence
  and forces ReceiptMode=CompactLongRun.
- Receipt open failure is non-fatal; it disables receipt output instead of
  failing OnInit.
- Added raw-receipt retention controls to the runner for Freedom use.

MT5 execution boundary:
Codex may compile/sync MT5 code so Freedom can run tests.
Codex must not run Strategy Tester, shard runners, FX28 smoke runners,
benchmarks, optimization, or any automation that executes a backtest/test run.
Freedom owns MT5 test execution. Codex may review outputs Freedom produced.

Compile proof:
Latest compile/sync artifact:
docs/research/gates/gate101/artifacts/mt5-terminal-sync-20260708-224524/

Result:
- repo: 0 errors, 0 warnings
- terminal-14275: 0 errors, 0 warnings
- terminal-94497: 0 errors, 0 warnings
- source hash mismatches: 0
- tester profile hash mismatches: 0
- compile failures: 0

Runtime status:
HWM mechanics are NOT accepted/proven yet. Earlier command-line smoke attempts
are non-evidence and occurred before the final receipt-open fix. Do not request
or run MT5 tests in this review chat. Freedom will discuss high-level strategy
first and may later run MT5 manually.

Hard boundaries:
- Review only unless Freedom explicitly asks for code.
- No MT5 test execution by Codex.
- No promotion/live-readiness claim.
- No TP optimization.
- No Revma formula change.
- No risk-guard expansion beyond reviewing the HWM code.
- No Kyma/trend-following/Katarakti work.

Primary review questions:
1. Is the HWM lifecycle correct: cycle start -> arm -> block new risk ->
   floor raise -> close only after floor breach?
2. Is separating block_new_entries from close_required sufficient and correctly
   wired through Engine.mqh?
3. Is PortfolioStopTakeProfitGuard.mqh the right ownership boundary?
4. Are receipt/summary fields enough for later review without generating giant
   raw receipts?
5. Are the disk-safe defaults and non-fatal receipt-open behavior safe?
```
