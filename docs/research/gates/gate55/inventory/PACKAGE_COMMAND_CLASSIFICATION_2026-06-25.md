# Gate 55H Package Command Classification

Generated: 2026-06-25T10:15:46.957Z

Forward research scoring command:

```text
npm run verification:research-manifest:evaluate -- --manifest=<manifest.json>
```

Evaluator parity status: pending Gate 55G equivalent-manifest parity. Until that receipt exists, the evaluator is a candidate shared evaluator.

| Command | Classification | Proposed action | Replacement | Script |
|---|---|---|---|---|
| cot:backfill-deep-history | deprecated but temporarily retained | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/backfill-cot-deep-history.ts |
| research:bank | deprecated but temporarily retained | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/research-bank-participation.ts |
| research:katarakti-phase1 | deprecated but temporarily retained | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/katarakti-phase1-backtest.ts |
| research:manual-session-matrix | deprecated but temporarily retained | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/backtest-manual-session-matrix.ts |
| research:validate-rranjan | deprecated but temporarily retained | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/validate-rranjan-indicator.ts |
| source:freeze:seed-window | deprecated but temporarily retained | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/audit-friday-freeze-source-ledger.ts --release-window=v2.0.3-clean-14w |
| trade:backtest-session | deprecated but temporarily retained | leave temporarily with deprecation marker | verification:research-manifest:evaluate | npx tsx app/scripts/backtest-session-top-pick.ts |
| verification:audit-cot-source-opportunity | historical receipt command | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/verification/audit-cot-source-opportunity.ts |
| verification:audit-macro-boundary-proof | historical receipt command | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/verification/audit-macro-boundary-proof.ts |
| verification:audit-macro-deterministic-rebuild-proof | historical receipt command | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/verification/audit-macro-deterministic-rebuild-proof.ts |
| verification:audit-macro-historical-activation | historical receipt command | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/verification/audit-macro-historical-activation.ts |
| verification:audit-macro-lifecycle-uniqueness | historical receipt command | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/verification/audit-macro-lifecycle-uniqueness.ts |
| verification:audit-macro-parent-promotion-proof | historical receipt command | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/verification/audit-macro-parent-promotion-proof.ts |
| verification:audit-macro-rate-differential | historical receipt command | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/verification/audit-macro-rate-differential-reconstruction.ts |
| verification:audit-macro-raw-artifact-parser-replay | historical receipt command | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/verification/audit-macro-raw-artifact-parser-replay.ts |
| verification:audit-macro-regime-join-coverage | historical receipt command | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/verification/audit-macro-regime-join-coverage.ts |
| verification:audit-macro-revocation-supersession | historical receipt command | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/verification/audit-macro-revocation-supersession.ts |
| verification:audit-macro-zero-pnl-pinned-read | historical receipt command | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/verification/audit-macro-zero-pnl-pinned-read.ts |
| verification:audit-official-cpi-endpoints | historical receipt command | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/verification/audit-official-cpi-endpoint-feasibility.ts |
| verification:export-research-matrix-dataset-contract | reusable infrastructure | keep active | - | tsx app/scripts/verification/export-research-matrix-dataset-contract.ts |
| verification:export-strength-history-context | historical receipt command | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/verification/export-strength-history-context.ts |
| verification:export-weekly-hold-fixed-band-sweep | historical receipt command | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/verification/export-weekly-hold-fixed-band-sweep.ts |
| verification:export-weekly-hold-trailing-sweep | historical receipt command | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/verification/export-weekly-hold-trailing-sweep.ts |
| verification:fill-macro-regime-sources | historical receipt command | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/verification/fill-macro-regime-source-warehouse.ts |
| verification:gate51-cot-lifecycle-rrp | historical receipt command | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/verification/analyze-gate51-cot-lifecycle-rrp-interaction.ts |
| verification:gate51-rrp-decomposition | historical receipt command | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/verification/analyze-gate51-rrp-decomposition.ts |
| verification:gate51-rrp-regime-filter | historical receipt command | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/verification/analyze-gate51-rrp-regime-filter.ts |
| verification:gate51-selector-lockdown | historical receipt command | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/verification/decide-gate51-selector-lockdown.ts |
| verification:gate54f-standalone-signal-baselines | historical receipt command | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/verification/audit-gate54f-standalone-signal-baselines.ts |
| verification:gate54g-cot-warmup-carry-forward | historical receipt command | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/verification/audit-gate54g-cot-warmup-carry-forward.ts |
| verification:gate54h-clp-tie-break-comparison | historical receipt command | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/verification/audit-gate54h-clp-tie-break-comparison.ts |
| verification:gate55-friday-strength-baseline | historical receipt command | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/verification/audit-gate55-friday-strength-baseline.ts |
| verification:gate55f-strength-source-context | historical receipt command | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/verification/audit-gate55f-strength-source-context.ts |
| verification:gate55h-inventory | active cleanup inventory command | keep active | - | tsx app/scripts/verification/inventory-loose-research-artifacts.ts |
| verification:macro-regime-credential-preflight | historical receipt command | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/verification/fill-macro-regime-source-warehouse.ts --credential-preflight --skip-bpr --skip-valuation --skip-real-rate-pressure |
| verification:repair-macro-artifact-byte-archive | historical receipt command | leave temporarily with deprecation marker | verification:research-manifest:evaluate | tsx app/scripts/verification/repair-macro-artifact-byte-archive.ts |
| verification:research-manifest:evaluate | candidate shared evaluator pending Gate 55G parity | keep active | - | tsx app/scripts/verification/evaluate-research-decision-manifest.ts |

Machine-readable classification: `PACKAGE_COMMAND_CLASSIFICATION_2026-06-25.jsonl`.
