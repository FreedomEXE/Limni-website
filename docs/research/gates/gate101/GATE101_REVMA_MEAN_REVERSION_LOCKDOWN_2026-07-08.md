# Gate 101 - Revma Mean-Reversion Lockdown

Date: 2026-07-08

Status: PASS - repo compile, terminal sync guard, and static source proof

Branch: `codex/gate88-mt5-lifecycle-protection-controls`

## Purpose

Revma is now locked to mean-reversion only.

```text
Revma = mean-reversion strategy only
future continuation strategy = separate strategy, not registered or exposed here
```

Gate 101 removes continuation from the executable Revma path instead of keeping
mixed Revma/future-strategy ownership behind sleeve controls.

## Implementation Summary

Operator inputs:

- Removed `RevmaSleeveMode`.
- Removed continuation and reversion override inputs:
  - `RevmaReversionGridSpacingQ`
  - `RevmaContinuationGridSpacingQ`
  - `RevmaReversionTakeProfit`
  - `RevmaReversionStopLoss`
  - `RevmaContinuationTakeProfit`
  - `RevmaContinuationStopLoss`
- Revma now exposes one grid spacing and one generic stop/take-profit control
  set:
  - `RevmaGridSpacingQ`
  - `TakeProfit`
  - `StopLoss`
  - `StopTakeProfitCloseCommissionPerLot`

Strategy contract:

- Removed `LP_VARIANT_REVMA_CONTINUATION`.
- Removed Revma continuation setup classification.
- `LP_RevmaClassifySleeve()` now accepts only:
  - LONG below anchor -> `MEAN_REVERSION`
  - SHORT above anchor -> `MEAN_REVERSION`
- With-trend states are rejected with `mean_reversion_setup_required` before
  strategy registry evaluation.
- Revma formula id is now `revma-mean-reversion-grid-v001`.
- Revma formula hash payload now includes `with_trend_states_rejected`.

Runtime path:

- `RevmaGridSleeve.mqh` no longer has continuation add policies.
- Removed `continuation_add_higher` and `continuation_add_lower`.
- Removed the continuation-only TP reachability guard.
- Frozen add logic only supports:
  - `reversion_add_lower`
  - `reversion_add_higher`
- Broker comments no longer emit `RevmaTrend`.

Receipts / manifest:

- Run manifest now reports `revma_setup=MEAN_REVERSION`.
- Removed continuation/reversion override values from run-start and summary
  receipts.
- Build metadata now reports:
  - `LP_EA_VERSION=0.1.17-gate101`
  - `LP_BUILD_GATE=Gate101`
  - `LP_BUILD_SCOPE=revma-mean-reversion-lockdown`

Documentation:

- `automation/mt5/README.md` now describes Revma as Pair Direction /
  Mean-Reversion Grid only.
- It states that future continuation work must return as a separate strategy
  with its own lifecycle, receipts, dashboard terms, and operator surface.

## Static Proof

No Kyma label remains in the active MT5 EA source or MT5 README:

```powershell
rg -n "Kyma|KYMA|kyma" automation\mt5\Experts automation\mt5\README.md
```

Result: no matches.

No Revma continuation or old sleeve-mode controls remain in the active EA source
or MT5 README:

```powershell
rg -n "Revma.*CONTINUATION|CONTINUATION.*Revma|RevmaContinuation|LP_VARIANT_REVMA_CONTINUATION|RevmaTrend|continuation_add|revma_continuation|RevmaSleeveMode|revma_sleeve_mode|revma_enable_continuation|RevmaReversion" automation\mt5\Experts automation\mt5\README.md
```

Result: no matches.

No continuation token remains in the active Revma strategy/core/execution/
receipt/EA paths:

```powershell
rg -n "CONTINUATION|continuation" automation\mt5\Experts\Include\Strategies automation\mt5\Experts\Include\Core automation\mt5\Experts\Include\Execution automation\mt5\Experts\Include\Receipts automation\mt5\Experts\Limni
```

Result: no matches.

Note: shared `Signals/LrmgState.mqh` still contains `LIMNI_KTR_CONTINUATION_*`
names for the broader Katarakti/LRMG signal grammar. Those are not Revma inputs,
Revma receipts, Revma variants, Revma strategy registry entries, or executable
Revma continuation paths.

## Compile Proof

Artifact folder:

`docs/research/gates/gate101/artifacts/gate101-revma-mean-reversion-lockdown-2026-07-08/`

Compile source:

`automation/mt5/Experts/Limni/LimniPortfolioEA.mq5`

Compile log:

`docs/research/gates/gate101/artifacts/gate101-revma-mean-reversion-lockdown-2026-07-08/repo-LimniPortfolioEA-compile-log.txt`

Compile result:

```text
Result: 0 errors, 0 warnings, 23187 msec elapsed, cpu='X64 Regular'
```

MetaEditor returned local process exit code `1`, matching this repo's known
clean-log MetaEditor behavior. The compile verdict is based on the result line.

## Terminal Sync Proof

Post-review correction: the first Gate 101 pass compiled the repo source but did
not sync the actual terminal source trees. Freedom still saw old inputs because
terminal `MQL5\Experts\Include\Core\Config.mqh` copies were stale.

Synced terminal data roots:

```text
C:\Users\User\AppData\Roaming\MetaQuotes\Terminal\14275C4F9441C73E9E6547075C33FE6C\MQL5
C:\Users\User\AppData\Roaming\MetaQuotes\Terminal\94497F60A2BFEA1AFAB110FCF3E331BB\MQL5
```

Sync log:

`docs/research/gates/gate101/artifacts/gate101-revma-mean-reversion-lockdown-2026-07-08/terminal-sync-gate101.txt`

Hash proof:

`docs/research/gates/gate101/artifacts/gate101-revma-mean-reversion-lockdown-2026-07-08/terminal-hash-proof.txt`

Repo and both terminal `Config.mqh` files share the same SHA256:

```text
FFFE22BDAFC10773271839AD77E66820CDBB74B88DDC3D20118AFC04C8472E0A
```

Terminal-local compiles:

```text
14275... Result: 0 errors, 0 warnings, 24242 ms elapsed, cpu='X64 Regular'
94497... Result: 0 errors, 0 warnings, 23881 ms elapsed, cpu='X64 Regular'
```

Compile logs:

```text
docs/research/gates/gate101/artifacts/gate101-revma-mean-reversion-lockdown-2026-07-08/terminal-14275-LimniPortfolioEA-compile-log.txt
docs/research/gates/gate101/artifacts/gate101-revma-mean-reversion-lockdown-2026-07-08/terminal-94497-LimniPortfolioEA-compile-log.txt
```

Terminal `Experts` old-input search:

`docs/research/gates/gate101/artifacts/gate101-revma-mean-reversion-lockdown-2026-07-08/terminal-experts-post-sync-old-input-search.txt`

Result:

```text
14275... MQL5\Experts: NO MATCHES
94497... MQL5\Experts: NO MATCHES
```

Remaining stale old-input text is confined to saved tester profile/config files
under:

```text
C:\Users\User\AppData\Roaming\MetaQuotes\Terminal\94497F60A2BFEA1AFAB110FCF3E331BB\MQL5\Profiles\Tester
```

Artifact:

`docs/research/gates/gate101/artifacts/gate101-revma-mean-reversion-lockdown-2026-07-08/terminal-profiles-stale-old-input-search.txt`

Those profile files were not deleted or rewritten in this pass. They are saved
tester settings, not the active compiled EA source path.

## Reusable Terminal Drift Guard

Gate 101 now has a reusable terminal sync guard so this cannot silently regress
back into repo-only compile proof.

Manifest:

`automation/mt5/terminal-roots.json`

Script:

`automation/mt5/tools/Sync-LimniPortfolioEA-Terminals.ps1`

Command run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File automation\mt5\tools\Sync-LimniPortfolioEA-Terminals.ps1 -ArtifactDir docs\research\gates\gate101\artifacts\gate101-revma-mean-reversion-lockdown-2026-07-08\drift-guard-full-run
```

Guard behavior:

- compiles repo `LimniPortfolioEA.mq5`;
- mirrors repo `LimniPortfolioEA.mq5`, `LimniPortfolioEA.ex5`, and
  `Experts/Include/` into both configured terminal `MQL5` roots;
- compiles each terminal-local EA source;
- compares source/include SHA256 hashes between repo and terminal copies;
- fails on stale active `MQL5\Experts` input/source terms;
- warns by default on stale saved tester profile keys;
- records running `terminal64.exe` processes and whether they are known.

Run artifact folder:

`docs/research/gates/gate101/artifacts/gate101-revma-mean-reversion-lockdown-2026-07-08/drift-guard-full-run/`

Run summary:

```text
Source hash mismatches: 0
Compile failures: 0
Active Experts stale-input matches: 0
Tester profile stale-input matches: 19
Unknown running terminal64.exe count: 0
MT5 terminal sync gate PASS
```

Compile summary:

```text
repo|Result: 0 errors, 0 warnings, 34576 ms elapsed, cpu='X64 Regular'
terminal-14275|Result: 0 errors, 0 warnings, 24950 ms elapsed, cpu='X64 Regular'
terminal-94497|Result: 0 errors, 0 warnings, 33811 ms elapsed, cpu='X64 Regular'
```

Source hash parity:

```text
MATCH, 14275    48
MATCH, 94497    48
```

Active stale-input proof:

`docs/research/gates/gate101/artifacts/gate101-revma-mean-reversion-lockdown-2026-07-08/drift-guard-full-run/terminal-experts-stale-input-search.txt`

Result:

```text
NO MATCHES
```

Saved tester profiles still contain stale old keys. The guard reports them in:

`docs/research/gates/gate101/artifacts/gate101-revma-mean-reversion-lockdown-2026-07-08/drift-guard-full-run/terminal-profiles-stale-input-search.txt`

That warning is intentional until a gate explicitly approves tester profile
cleanup.

## Runtime Testing

No MT5 Strategy Tester smoke was run in this gate. Freedom did not authorize a
tester run.

## Limits

- No one-pair behavior smoke.
- No all-28.
- No optimization.
- No Kyma implementation.
- No Katarakti work.
- No Q-state/future-system resurrection.
- No promotion, profitability, or live-readiness claim.
