# Gate 55H Strategy / Tester Inventory

Generated during Gate 55H architecture cleanup on 2026-06-25.

Inventory commands:

```powershell
rg --files app/scripts | rg "(^|[\\/])(adr-backtest|backtest|research|sweep|verify-selector|bitget-v2|counter-trend|eightcap|universal|katarakti|analyze-.*backtest|analyze-.*sweep).*\\.(ts|js)$"
rg -n '"(research|trade|verification|cot):|backtest|gate55|gate54|research-manifest' package.json
rg -n "backtest|research|adr-backtest|verify-selector|Gate 42|Gate 44|Gate 55G|Gate 55H|evaluate-research-decision-manifest" docs app/scripts package.json
```

Broad tracked script count matching legacy strategy/tester patterns: `156`.

## Classification

| Class | Paths / Families | Decision |
|---|---|---|
| Active blessed workflow | `app/scripts/verification/evaluate-research-decision-manifest.ts`; `app/src/lib/research/decisionManifest.ts`; `app/src/lib/research/decisionManifestEvaluator.ts`; `app/src/lib/research/researchRunRegistry.ts` | Keep. This is the Gate 55H path for future manifest scoring. |
| Reusable infrastructure | `app/src/lib/performance/pathBarLoader.ts`; `app/src/lib/performance/weeklyHoldEngine.ts`; `app/src/lib/research/matrixDataset.ts`; `app/src/lib/research/hash.ts`; `app/src/lib/research/localM1Warehouse.ts`; `app/src/lib/strength/historicalStrength.ts` | Keep. Reuse first. |
| Historical receipt scripts | `app/scripts/verification/audit-gate55-friday-strength-baseline.ts`; `audit-gate55f-strength-source-context.ts`; `audit-gate55e-canonical-fx-m1-bundle.ts`; `audit-gate54f-standalone-signal-baselines.ts`; `audit-gate54g-cot-warmup-carry-forward.ts`; `audit-gate54h-clp-tie-break-comparison.ts`; Gate 51/52 macro and RRP receipt scripts | Keep in place. They anchor receipts and historical hashes. Do not move without a receipt-link migration plan. |
| Deprecated but referenced | Package scripts reference `research-bank-participation.ts`, `katarakti-phase1-backtest.ts`, `backtest-manual-session-matrix.ts`, `validate-rranjan-indicator.ts`, `backtest-session-top-pick.ts`, Gate 54/55 scripts, and matrix/source verification commands | Do not archive in Gate 55H. Package references must be retired intentionally first. |
| Unknown / needs review | Older root `app/scripts/backtest-*`, `app/scripts/adr-backtest-*`, `app/scripts/research-*`, `app/scripts/verify-selector-*`, `app/scripts/sweep-*`, `app/scripts/analyze-*backtest*`, and Bitget/Eightcap/Katarakti one-offs | Do not move in Gate 55H. Many are unreferenced by package scripts but referenced by docs, receipts, or historical handoffs. |
| Deprecated and safe to archive | None identified in this pass | No `git mv` performed. |

## Archive Candidates

No safe archive candidates were moved in Gate 55H.

Reason: the scan found a large legacy script surface with package references and
many doc/receipt references. Moving files now would break historical evidence
paths or package commands without a dedicated migration receipt.

## Replacement Path

For new research, use:

```powershell
npm run verification:research-manifest:evaluate -- --manifest=<manifest.json>
```

Legacy scripts remain historical or source-derivation owners until a separate
archive gate proves a file is unreferenced or updates every reference.
