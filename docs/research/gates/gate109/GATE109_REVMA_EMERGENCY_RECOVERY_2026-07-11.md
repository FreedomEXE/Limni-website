# Gate 109 — Limni Revma Emergency Recovery

Date: 2026-07-11

Status: bounded execution/evidence repair compiled and synchronized; no MT5
Tester run was performed by Codex.

## Objective and boundary

The repair targets the observed single-pair birth → same-second sell failure
and the disabled runtime evidence surface. It does not redesign Revma, alter
q geometry, change the `0.10q` mesh, change the `0.01` atom, change the two-
atom R limit, optimize parameters, or make an economic or live-readiness claim.

## Pre-edit diagnosis

The retained terminal Tester log confirms the reported visual profile existed:
`EURUSD.i,M1`, `2025.01.01` through `2025.01.15`, 100% history quality. It does
not retain the EA lifecycle lines or the application event sequence. The run
printed `run_id=LPEA_RECEIPTS_OFF`, and no matching Common Files run folder
exists. The literal MT5 transaction type from that old run is therefore not
recoverable from retained evidence.

The first causal defect is nevertheless deterministic in the pre-edit source:

1. Single-pair `EvaluateRevmaSymbol` emits the legacy Revma birth intent with
   `plan.gate108=false`.
2. The opening order fills and returns a canonical deal set.
3. `LP_Engine::RememberGate108RoutedDealSet` rejected every non-Gate108 plan
   through its `!plan.gate108` condition.
4. `LP_Engine::Step` interpreted that false result as
   `gate108_routed_deal_set_capture_failed`.
5. `EnterGate108ExecutionQuarantine` latched the fatal invariant even though
   the run was single-pair.
6. The next fatal step issued the close-all plan with
   `close_reason=gate108_execution_quarantine`.

This explains the buy, immediate sell, zero holding time, and absence of later
births/adds without treating the result as an economic Revma result. The
root-cause references are [Engine.mqh:531](../../../automation/mt5/Experts/Include/Core/Engine.mqh:531)
and the caller at [Engine.mqh:2291](../../../automation/mt5/Experts/Include/Core/Engine.mqh:2291).

The source also contained a second independent false-trigger surface:
`DEAL_UPDATE` and `DEAL_DELETE` were both unconditionally classified as
Gate108 account mutation in `OnTradeTransaction`. The MQL5 reference defines
`DEAL_UPDATE` as a change to a deal already in history and `DEAL_DELETE` as a
deal removed from history; it does not make either event part of the ordinary
market-order chain. See the [MQL5 transaction-type reference](https://www.mql5.com/en/docs/constants/tradingconstants/enum_trade_transaction_type)
and [OnTradeTransaction reference](https://www.mql5.com/en/docs/event_handlers/ontradetransaction).
Because the old application log is gone, the patch records `DEAL_UPDATE` as a
history refresh and reserves automatic quarantine for a canonical deal delete;
final identity/deal-set audits remain the FX28 authority for later mutation
review.

## Changes

- Added [MandatoryDiagnostics.mqh](../../../automation/mt5/Experts/Include/Receipts/MandatoryDiagnostics.mqh), independent of optional research receipts. Every run creates `run_manifest.csv`, `events.csv`, `first_blocker.txt`, and `completion.csv` under `FILE_COMMON/LimniPortfolioEA/<run_id>/`.
- Opened mandatory diagnostics before optional receipt validation, including
  initialization failures; the first blocker is immutable and flushed before
  any Gate108 defensive close.
- Fixed non-Gate108 routed-deal capture to be a no-op.
- Guarded Gate108 deal lists, mutation quarantine, discovery reconciliation,
  R pre-route authority, and real-close continuation behind
  `m_gate108_research_active`.
- Changed `DEAL_UPDATE` to a transition-only history-refresh event and kept
  canonical deal deletion as the mutation quarantine trigger.
- Allowed a single-pair executed fill with a valid broker deal ticket to commit
  while history linkage is completed asynchronously; Gate108 R retains its
  stricter canonical deal-set requirement. See [TradeRouter.mqh:290](../../../automation/mt5/Experts/Include/Execution/TradeRouter.mqh:290).
- Added explicit route/order/commit/close-owner evidence and a fallback
  `unspecified_close_owner` for any close plan that arrives without a reason.
- Replaced the Gate108 atom proof’s two-decimal volume comparison with broker
  volume-step integer units.
- Changed initial missing-history handling to bounded waiting with
  `WAITING_FOR_FX28_HISTORY` / single-pair history states before timeout.
- Added complete single-pair and FX28 `.ini` tester invocation presets.
- Added [Test-LimniPortfolioEA-EmergencyRecovery.ps1](../../../automation/mt5/tools/Test-LimniPortfolioEA-EmergencyRecovery.ps1)
  and [Compile-Sync-LimniPortfolioEA-Canonical.ps1](../../../automation/mt5/tools/Compile-Sync-LimniPortfolioEA-Canonical.ps1).

## Plain-English active call graph

### Single-pair mechanics currently in this repair

```text
OnTick / OnTimer
  -> Step
  -> one active M1 clock
  -> EvaluateRevmaSymbol
  -> Revma signal + session/news gate
  -> RevmaGridSleeve legacy birth/add lifecycle
  -> IntentBus
  -> RiskArbiter
  -> TradeRouter
  -> OnTradeTransaction evidence and inventory dirty mark
  -> RecordExecutionOutcome
  -> TakePendingLifecycle exactly once
  -> RememberBirth
  -> optional persistence (disabled mode is non-fatal)
  -> inventory reconciliation
```

### FX28 research currently in this repair

```text
OnTick / OnTimer
  -> completed-M1 all-28 cohort
  -> shared Revma snapshots
  -> R real portfolio + U/C shadow batch
  -> allocation / route authorization
  -> TradeRouter for R only
  -> OnTradeTransaction / final deal audit
  -> branch reconciliation / telemetry finalization
```

The two paths now share signal construction, calendar, routing, inventory, and
transaction evidence, but they do not yet share one execution-authority
implementation. The Gate108 R engine is explicitly FX28-only (`requires_fx28`
and `snapshot_count == LP_SYMBOL_COUNT`). Full single-pair R scoping remains a
separate blocker, not something this emergency patch pretends to solve.

## Mandatory output contract

`run_manifest.csv` records run/build/source/config/account/universe/timeframe/
formula identity and startup fields. `events.csv` is bounded at 4096 event rows
plus one overflow marker and records lifecycle transitions, transactions,
routes, order results, commits, reconciliation, quarantine, flat confirmation,
deinitialization, and completion. `first_blocker.txt` contains exactly one
immutable ten-field causal record. `completion.csv` records status, blocker,
signal/birth/add/close/route/broker counts, quarantine state, final positions/
orders, balance/equity, and reconciliation status.

Optional `ReceiptMode=Off` no longer disables these files.

## Static proof

Passed before compilation:

- emergency recovery assertions: PASS;
- Gate108 source bundle: PASS, 58 files, one external include;
- controlled profile: PASS;
- PowerShell syntax: PASS;
- `git diff --check`: PASS.

Source bundle:

```text
sha256:cd8583306c2aa65b29e4eb4b407fafa9527b1e644d31d2a3ee54d0a73539fc7b
```

## One canonical compile receipt

Artifact folder:
`docs/research/gates/gate109/artifacts/canonical-compile-20260711-204251/`

- canonical terminal: `94497`;
- compile invocations: `1`;
- result: `0 errors, 0 warnings`;
- elapsed: `55605 ms`;
- compiler exit code: `1` (known local MetaEditor clean-log behavior);
- EX5: `1,026,720` bytes;
- EX5 SHA-256: `9EE1B772A0234C7DA64404D2CE5F873B88C882778B3907F2898AAC2608BB5964`;
- repository and terminal EX5: byte-identical;
- source/profile synchronization mismatches: `0`;
- Strategy Tester, optimization, benchmark, and backtest: not run by Codex.

## Preset identities

| File | Bytes | SHA-256 |
|---|---:|---|
| `LimniPortfolioEA-Revma-SinglePair-Mechanics.ini` | 748 | `458A7477A131FBCB197154C084F72986F49AA83A00DEE20557290ABBF3839D69` |
| `LimniPortfolioEA-Revma-FX28-Research.ini` | 746 | `FC341EDB2706AF70A32EF57934B522B956B25053C27C8F9F928FD32FB6A77D72` |
| `limni-portfolio-revma-single-pair-mechanics.set` | 157 | `B84DECD18D3D5E6940D71416DFEA0FD29A584798FB52282FEF6BFF715C344FB2` |
| `limni-portfolio-revma-gate108a-controlled.set` | 158 | `051DA44F9FA14AA9904DA1B2454413FD224A725D74CD639E2679A6D0C0ED3AB2` |

The `.set` files are input presets. The `.ini` files are the complete tester
invocation profiles. Freedom loads an `.ini` through MT5 Strategy Tester’s
Open configuration flow or invokes it through the canonical terminal launcher;
the referenced `ExpertParameters` input preset, when used by a launcher, must
be the matching `.set` file.

## Freedom’s next single-pair mechanics settings

Use `LimniPortfolioEA-Revma-SinglePair-Mechanics.ini`:

```text
Expert=Limni\LimniPortfolioEA.ex5
Symbol=EURUSD.i
Period=M1
Model=Open prices only
From=2025.01.01
To=2025.01.15
Deposit=1000 USD
Leverage=1:100
Optimization=disabled
Forward=disabled
Visual=enabled
EnableRevma=true
EnableKyma=false
EnableKatarakti=false
UniverseMode=Single Pair
ExecutionMode=Tester
AllowLiveTrading=false
ShowSystemDashboard=true
```

Expected mandatory evidence begins with `initialization`, inventory
reconciliation, `signal_created`, `birth_gate_decision`, `route_attempt`,
`order_result`, transaction events, `birth_committed`, and an explicit close
owner/reason if any close occurs. A successful birth must not emit
`gate108_routed_deal_set_capture_failed` or `gate108_execution_quarantine` in
single-pair mode.

## Remaining blockers

1. The literal old runtime transaction type and application fatal line cannot
   be recovered because the prior run was compiled with receipts off. The new
   mandatory writer closes that evidence gap for Freedom’s next run.
2. Single-pair still uses `EvaluateRevmaSymbol` rather than the FX28 R engine.
   Gate108 R is structurally FX28-only today. Do not call this single-pair run
   representative of FX28 R until a separately opened consolidation gate
   adapts the active-symbol cohort safely.
3. No runtime proof has been produced. Freedom owns the next Strategy Tester
   run and must review `first_blocker.txt`, `events.csv`, and
   `completion.csv` before any further code or strategy decision.

## Gate handoff

The emergency code/compile boundary is complete and pushed in repair commit
`e783713995e39f93013e52394dd0d7f5cb4b3fc2`, separately from any runtime
conclusion. Next gate: Freedom-owned single-pair mechanics run and receipt
review only. No optimization, benchmark, long run, promotion, or live
readiness claim is open.
