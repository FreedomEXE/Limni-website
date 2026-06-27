# Gate 63 Brain Architecture Debt Map

Discovery-only debt map. Gate 63 does not move code, rename runtime paths, or consolidate sources.

## Existing Brain Paths

- `engine/src/brain/risk/README.md`
- `engine/src/brain/README.md`
- `engine/src/brain/cells/strength/matrix/index.ts`
- `engine/src/brain/cells/strength/index.ts`
- `engine/src/brain/cells/strength/ledgers/index.ts`
- `engine/src/brain/architecture.ts`
- `engine/src/brain/cells/strength/contracts/index.ts`
- `engine/src/brain/cells/strength/atoms/index.ts`
- `engine/src/brain/body/ledgers/index.ts`
- `engine/src/brain/cells/regime/index.ts`
- `engine/src/brain/cells/regime/matrix/index.ts`
- `engine/src/brain/body/contracts/index.ts`
- `engine/src/brain/cells/regime/contracts/index.ts`
- `engine/src/brain/body/arbitration/index.ts`
- `engine/src/brain/cells/regime/atoms/index.ts`
- `engine/src/brain/cells/regime/atoms/inflation/index.ts`
- `engine/src/brain/cells/regime/atoms/bpr/index.ts`
- `engine/src/brain/cells/regime/ledgers/index.ts`
- `engine/src/brain/cells/regime/atoms/rates/index.ts`
- `engine/src/brain/cells/cot/index.ts`
- `engine/src/brain/cells/regime/atoms/rrp/index.ts`
- `engine/src/brain/cells/regime/atoms/valuation/index.ts`
- `engine/src/brain/cells/cot/contracts/index.ts`
- `engine/src/brain/cells/cot/matrix/index.ts`
- `engine/src/brain/cells/cot/atoms/index.ts`
- `engine/src/brain/cells/cot/ledgers/index.ts`

## Old Signal Paths Still Present

These paths still carry real historical signal/source/evaluator behavior or app-facing compatibility. They are not moved in Gate 63.

- `app/src/lib/research/backtestEngine.ts`
- `app/src/lib/research/bankComparison.ts`
- `app/src/lib/performance/dataIntegrityReport.ts`
- `app/src/lib/performance/canonicalPerformanceReport.ts`
- `app/src/lib/performance/canonicalFlagships.ts`
- `app/src/lib/performance/botStrategies.ts`
- `app/src/lib/performance/basketSource.ts`
- `app/src/lib/performance/basketPathEngine.ts`
- `app/src/lib/performance/allTime.ts`
- `app/src/lib/performance/adrLookup.ts`
- `app/src/lib/performance/gatedSetupsDefault.ts`
- `app/src/lib/performance/engineAdapter.ts`
- `app/src/lib/performance/kataraktiHistory.ts`
- `app/src/lib/performance/gateOverlayDefault.ts`
- `app/src/lib/performance/gateEvaluation.ts`
- `app/src/lib/performance/kataraktiMetrics.ts`
- `app/src/lib/performance/kataraktiSeed.ts`
- `app/src/lib/performance/drawdown.ts`
- `app/src/lib/performance/modelConfig.ts`
- `app/src/lib/performance/pageTotals.ts`
- `app/src/lib/performance/pageState.ts`
- `app/src/lib/performance/pathBarLoader.ts`
- `app/src/lib/research/bankParticipation.ts`
- `app/src/lib/performance/pathResolution.ts`
- `app/src/lib/research/common.ts`
- `app/src/lib/performance/performanceAssetScope.ts`
- `app/src/lib/research/types.ts`
- `app/src/lib/research/labConfigQuery.ts`
- `app/src/lib/performance/scopedPerformanceModel.ts`
- `app/src/lib/performance/resolvedPerformanceMetrics.ts`
- `app/src/lib/performance/positionLedger.ts`
- `app/src/lib/performance/performanceMetricBasis.ts`
- `app/src/lib/performance/simulationReturnModes.ts`
- `app/src/lib/performance/selectorEngine.ts`
- `app/src/lib/performance/snapshotProvenance.ts`
- `app/src/lib/performance/embedded/data-integrity-audit.json`
- `app/src/lib/performance/weeklyHoldEngine.ts`
- `app/src/lib/performance/tiered.ts`
- `app/src/lib/performance/strategyWeekShardCache.ts`
- `app/src/lib/performance/strategySessionStore.ts`
- `app/src/lib/performance/strategySelection.ts`
- `app/src/lib/performance/strategyRegistry.ts`
- `app/src/lib/performance/strategyPayloadCompleteness.ts`
- `app/src/lib/performance/strategyPageData.ts`
- `app/src/lib/performance/strategyConfig.ts`
- `app/src/lib/performance/strategyClientPayload.ts`
- `app/src/lib/performance/strategyClientCache.ts`
- `app/src/lib/performance/strategyBacktestStore.ts`
- `app/src/lib/performance/strategyBacktestHistory.ts`
- `app/src/lib/performance/strategyArtifactVersions.ts`
- `app/src/lib/performance/strategyArtifactReadiness.ts`
- `app/src/lib/performance/strategyArtifactCache.ts`
- `app/src/lib/performance/sourceFingerprint.ts`
- `engine/src/signals/strength/historicalStrength.ts`
- `engine/src/signals/strength/fridayStrengthManifest.ts`
- `engine/src/signals/strength/fridayRelativeStrength15wManifest.ts`
- `engine/src/signals/cot/gate54ClpManifest.ts`

## Current Code Ownership

- COT atom evidence lives in Gate 59 ledger rows and transitional Brain placeholders under `engine/src/brain/cells/cot`.
- Strength atom evidence lives in Gate 59 ledger rows and historical Strength source/evaluator paths under `engine/src/signals/strength`.
- Regime atom evidence lives in Gate 60C/60G/60H artifacts, with inventory contracts in `engine/src/brain/architecture.ts`.
- Body arbitration under `engine/src/brain/body/arbitration` is a reserved namespace only; no final Body algorithm exists here.

## Placeholder Versus Real Implementation

- Real implementation today: artifact builders and historical signal paths that generate locked ledgers.
- Real implementation today: `engine/src/brain/architecture.ts` inventory contract.
- Placeholder today: cell subfolders such as `cells/*/atoms`, `contracts`, and `ledgers` mostly expose namespace markers.
- Placeholder today: Body/Risk namespaces are reserved and must not reduce forced-28 signal rows.

## Future Move Suggestions

- Move reusable COT atom derivation into `engine/src/brain/cells/cot` only after Gate 63 review confirms which atoms matter.
- Move reusable Strength atom derivation into `engine/src/brain/cells/strength` only after preserving Gate 57E parity.
- Move reusable Regime atom transforms into `engine/src/brain/cells/regime` only after source contracts remain locked.
- Keep immutable `docs/research/gates/**` evidence in place; do not rewrite historical artifacts into source modules.
- Suggested next refactor gate if Freedom opens it: `Gate 64A: Brain source consolidation after universal atom matrix`.

## Gate 63 Stop Line

Stop after Gate 63. Do not proceed to Body design, Alpha v2, risk, exits, execution, MT5/live, app/runtime, source mutation, COT retuning, Strength retuning, or broad Brain source refactor.
