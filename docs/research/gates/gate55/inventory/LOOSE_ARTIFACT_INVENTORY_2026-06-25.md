# Gate 55H Loose Research Artifact Inventory

Generated: 2026-06-25T10:15:46.945Z

Scope: tracked candidate loose research/test/strategy/backtest artifacts across `app/scripts/`, `app/src/`, `docs/`, `app/reports/`, `app/releases/`, `database/`, and root-level loose files.

This inventory was generated before the safe archive candidates were moved.
The completed `git mv` moves are recorded in
`archive/docs/research/gates/gate55/ARCHIVE_MANIFEST_2026-06-25.md`.

## Summary

- Candidate files: 893
- Safe archive candidates: 9
- active evidence receipt: 34
- deprecated and safe to archive: 9
- deprecated but referenced: 247
- historical receipt script: 31
- reusable infrastructure: 11
- unknown / needs review: 561

## Safe Archive Candidates

| Current path | SHA-256 | Archive destination | Replacement |
|---|---|---|---|
| app/scripts/adr-backtest-agreement.js | EE48A951BE41DC686C62D5A358877BBE00B3A4300A7331D4FA1095197FF22373 | archive/app/scripts/adr-backtest-agreement.js | app/scripts/verification/evaluate-research-decision-manifest.ts |
| app/scripts/adr-backtest-comparison.js | 56845413552C5A03D9C7C9A57A4AC40844092D29E9FCD2868B04852DAB1B225B | archive/app/scripts/adr-backtest-comparison.js | app/scripts/verification/evaluate-research-decision-manifest.ts |
| app/scripts/adr-backtest-dynamic-tp.js | 19C4009E7F185D46EE3744E340743833EFEA8622506C785ADF052BDD66CA9844 | archive/app/scripts/adr-backtest-dynamic-tp.js | app/scripts/verification/evaluate-research-decision-manifest.ts |
| app/scripts/adr-backtest-extended.js | 43619D74A40739CE422C7B86AF8B7958C48A750EC27CAC1D162CB41C66AF7086 | archive/app/scripts/adr-backtest-extended.js | app/scripts/verification/evaluate-research-decision-manifest.ts |
| app/scripts/adr-backtest-grid-final.js | 3A89E2445C59BF5CF2CA989B2BC3993FF0FF9A26AC6F179227C7AEC530ABA16A | archive/app/scripts/adr-backtest-grid-final.js | app/scripts/verification/evaluate-research-decision-manifest.ts |
| app/scripts/adr-backtest-neutral.js | 18B8EBC2FB317C961EAB61907BB2DC4942DB298A9F5DA8494D2F58C53D49AA2E | archive/app/scripts/adr-backtest-neutral.js | app/scripts/verification/evaluate-research-decision-manifest.ts |
| app/scripts/adr-backtest-sentiment.js | F38BC991CCC0A00680769260B8988458497AD5AB045885DDCA5BB4ED9E30FA96 | archive/app/scripts/adr-backtest-sentiment.js | app/scripts/verification/evaluate-research-decision-manifest.ts |
| app/scripts/adr-backtest-stoch.js | F2E6EE3D0185FAAEAD1634AEF3486DA74BED41F1010E870737C0579338073586 | archive/app/scripts/adr-backtest-stoch.js | app/scripts/verification/evaluate-research-decision-manifest.ts |
| app/scripts/adr-backtest-tandem.js | 2B847D6D1557F8C27545D658AD972D4A54E1DACD61D2C181270BB8139430EA4E | archive/app/scripts/adr-backtest-tandem.js | app/scripts/verification/evaluate-research-decision-manifest.ts |

## File-By-File Inventory

| Path | Type | Classification | Action | Package refs | Doc refs | Code refs | Archive destination |
|---|---|---|---|---|---:|---:|---|
| app/releases/SCREENSHOT_CONVENTION.md | report | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/_legacy-dev-artifacts/legacy-flagship-crypto-sanity-dark.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/_legacy-dev-artifacts/legacy-flagship-crypto-webpack-sanity-dark.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/_legacy-dev-artifacts/legacy-flagship-sanity-dark.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/_legacy-dev-artifacts/legacy-flagship-webpack-sanity-dark.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/_legacy-dev-artifacts/legacy-login-webpack-sanity-dark.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/_legacy-dev-artifacts/legacy-performance-sanity-dark.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/_legacy-dev-artifacts/legacy-performance-webpack-sanity-dark.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/_legacy-dev-artifacts/README.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 13 | 1 | - |
| app/releases/v1/screenshots/accounts/accounts-connect-mt5-modal.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/accounts/accounts-mt5-tyrell-tsolakis-detail-feb03.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/accounts/accounts-oanda-freedom-trades-feb16-week.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/accounts/accounts-overview.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/antikythera/antikythera-annotated-data-tab-feb02.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/antikythera/antikythera-overview.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/automation/automation-bots-index-manual-dark.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/automation/automation-bots-index.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/automation/automation-manual-01.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/automation/automation-manual-02.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/automation/automation-manual-03.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/automation/automation-manual-04.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/automation/automation-manual-05.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/automation/automation-manual-06.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/automation/automation-manual-07.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/automation/automation-manual-08.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/automation/automation-manual-09.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/automation/automation-manual-10.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/automation/automation-manual-11.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/automation/automation-manual-12.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/automation/automation-manual-13.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/automation/automation-research-index.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/automation/automation-research-performance-detail.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/automation/ea-logs/ea-debug-symbol-normalization.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/automation/ea-logs/ea-log-symbol-not-in-allowed-list.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/data/data-heatmap-commercial-all-assets.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/data/data-heatmap-dealer-all-assets.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/data/data-list-dealer-all-assets.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/data/data-manual-01.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/data/data-manual-02.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/data/data-manual-03.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/data/data-manual-04.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/data/data-manual-05.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/data/data-manual-06.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/flagship/flagship-crypto.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/flagship/flagship-intraday.png | unknown | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/releases/v1/screenshots/flagship/flagship-overview.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/flagship/flagship-weekly-hold.png | unknown | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/releases/v1/screenshots/flagship/legacy-codex-review-intraday-dark-before.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/flagship/legacy-codex-review-intraday-light-before.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/flagship/legacy-codex-review-swing-dark-before.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/flagship/legacy-codex-review-swing-light-before.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/flagship/legacy-flagship-intraday-desktop-dark-after.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/flagship/legacy-flagship-intraday-desktop-light-after.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/flagship/legacy-flagship-intraday-mobile-dark-after.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/flagship/legacy-flagship-intraday-mobile-light-after.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/flagship/legacy-flagship-intraday-tablet-dark-after.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/flagship/legacy-flagship-intraday-tablet-light-after.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/flagship/legacy-flagship-weekly-hold-desktop-dark-after.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/flagship/legacy-flagship-weekly-hold-desktop-light-after.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/flagship/legacy-flagship-weekly-hold-mobile-dark-after.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/flagship/legacy-flagship-weekly-hold-mobile-light-after.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/flagship/legacy-flagship-weekly-hold-tablet-dark-after.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/flagship/legacy-flagship-weekly-hold-tablet-light-after.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/full-app-context/full-app-context-performance.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/indicator/legacy-audnzd_2026-03-25_00-33-04_49f4a.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/indicator/legacy-btcusdt.p_2026-03-25_04-34-33_09e20.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/indicator/legacy-btcusdt.p_2026-03-25_04-40-49_4d567.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/indicator/legacy-btcusdt.p_2026-03-28_12-11-17_55419.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/indicator/legacy-weekly-audnzd-adr-limni.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/matrix/legacy-codex-review-matrix-dark-before.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/matrix/legacy-codex-review-matrix-light-before-loaded.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/matrix/legacy-codex-review-matrix-light-before.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/matrix/matrix-manual-01.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/matrix/matrix-manual-02.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/matrix/matrix-manual-03.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/matrix/matrix-manual-04.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/matrix/matrix-manual-05.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/matrix/matrix-overview.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/news/news-manual-02.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/news/news-overview.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/performance/legacy-performance-desktop-dark-after.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/performance/legacy-performance-desktop-light-after.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/performance/legacy-performance-mobile-dark-after.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/performance/legacy-performance-mobile-light-after.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/performance/legacy-performance-tablet-dark-after.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/performance/legacy-performance-tablet-light-after.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/performance/performance-basket-tandem-adr-grid-pair-fill-cap-alltime.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/performance/performance-manual-01.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/performance/performance-manual-02.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/performance/performance-manual-03.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/performance/performance-manual-04.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/performance/performance-manual-05.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/performance/performance-manual-06.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/performance/performance-manual-07.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/performance/performance-manual-08.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/performance/performance-manual-09.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/performance/performance-manual-10.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/performance/performance-manual-11.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/performance/performance-manual-12.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/performance/performance-manual-13.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/performance/performance-manual-14.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/performance/performance-research-tandem-adr-grid-pair-fill-cap-alltime.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/performance/performance-simulation-tandem-adr-grid-pair-fill-cap-alltime.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/performance/performance-summary-tandem-adr-grid-pair-fill-cap-alltime.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/performance/performance-summary-waiting-week-open-feb23.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/README.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 13 | 1 | - |
| app/releases/v1/screenshots/sentiment/sentiment-overview.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/status/status-manual-01.jpeg | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/screenshots/status/status-overview.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v1/verification.md | report | deprecated but referenced | leave temporarily with deprecation marker | verification:audit-cot-source-opportunity, verification:audit-macro-boundary-proof, verification:audit-macro-deterministic-rebuild-proof, verification:audit-macro-historical-activation, verification:audit-macro-lifecycle-uniqueness, verification:audit-macro-parent-promotion-proof, verification:audit-macro-rate-differential, verification:audit-macro-raw-artifact-parser-replay, verification:audit-macro-regime-join-coverage, verification:audit-macro-revocation-supersession, verification:audit-macro-zero-pnl-pinned-read, verification:audit-official-cpi-endpoints, verification:export-research-matrix-dataset-contract, verification:export-strength-history-context, verification:export-weekly-hold-fixed-band-sweep, verification:export-weekly-hold-trailing-sweep, verification:fill-macro-regime-sources, verification:gate51-cot-lifecycle-rrp, verification:gate51-rrp-decomposition, verification:gate51-rrp-regime-filter, verification:gate51-selector-lockdown, verification:gate54f-standalone-signal-baselines, verification:gate54g-cot-warmup-carry-forward, verification:gate54h-clp-tie-break-comparison, verification:gate55-friday-strength-baseline, verification:gate55f-strength-source-context, verification:gate55h-inventory, verification:macro-regime-credential-preflight, verification:repair-macro-artifact-byte-archive, verification:research-manifest:evaluate | 20 | 20 | - |
| app/releases/v2/screenshots/active-baseline-certification-2026-06-09/playwright-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/active-baseline-certification-2026-06-09/README.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 13 | 1 | - |
| app/releases/v2/screenshots/active-baseline-certification-2026-06-09/status-active-baseline-certification-card.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/active-baseline-certification-2026-06-09/status-active-baseline-certification-details.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/active-baseline-certification-2026-06-09/status-active-baseline-certification-full-page.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/app-truth-active-baseline-2026-06-08/playwright-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/app-truth-active-baseline-2026-06-08/README.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 13 | 1 | - |
| app/releases/v2/screenshots/app-truth-active-baseline-2026-06-08/status-active-baseline-full-page.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/app-truth-active-baseline-2026-06-08/status-active-baseline-section.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/app-truth-phase1-2026-06-08/dashboard-after-route-aware-gate.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/app-truth-phase1-2026-06-08/performance-summary-no-app-version-wall.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/app-truth-phase1-2026-06-08/playwright-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/app-truth-phase1-2026-06-08/README.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 13 | 1 | - |
| app/releases/v2/screenshots/app-truth-phase1-2026-06-08/status-app-truth-section.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/app-truth-phase1-2026-06-08/status-full-page-app-truth.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/browser-proof-2026-06-05/measured-browser-proof-2026-06-05.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/containment-2026-06-06/browser-proof.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/containment-2026-06-06/data-click-switch-may25-strength.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/containment-2026-06-06/data-click-switch-proof.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/containment-2026-06-06/data-current-invalid-consolidated.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/containment-2026-06-06/data-current-invalid.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/containment-2026-06-06/data-may04-dealer.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/containment-2026-06-06/data-may25-dealer-consolidated.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/containment-2026-06-06/data-may25-dealer.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/containment-2026-06-06/data-may25-sentiment.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/containment-2026-06-06/data-may25-strength.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/containment-2026-06-06/performance-pair-fill-cap-blocked-consolidated.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/containment-2026-06-06/performance-pair-fill-cap-blocked.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/containment-2026-06-06/performance-stale-canon-warning.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/containment-2026-06-06/route-api-proof.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/containment-2026-06-06/status-open-proof.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/containment-2026-06-06/status-source-freeze-diagnostics-consolidated.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/containment-2026-06-06/status-source-freeze-diagnostics-open-attr.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/containment-2026-06-06/status-source-freeze-diagnostics-open-click.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/containment-2026-06-06/status-source-freeze-diagnostics-open-fixed.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/containment-2026-06-06/status-source-freeze-diagnostics-open.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/containment-2026-06-06/status-source-freeze-diagnostics.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/containment-2026-06-06/verification-evidence-2026-06-06.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/data-active-baseline-2026-06-08/after-playwright-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/data-active-baseline-2026-06-08/before-playwright-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/data-active-baseline-2026-06-08/dashboard-after-active-baseline-full-page.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/data-active-baseline-2026-06-08/dashboard-before-active-baseline-full-page.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/data-active-baseline-2026-06-08/README.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 13 | 1 | - |
| app/releases/v2/screenshots/data-active-baseline-2026-06-08/smoke-performance-after-data-baseline.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/data-active-baseline-2026-06-08/smoke-playwright-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/data/v2.0.3-data-default-loaded.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/data/v2.0.3-data-sentiment-loaded.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/data/v2.0.3-data-strength-loaded.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/data/v2.0.3-data-week-switch-stable-2026-06-05.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/data/v2.0.3-data-weekstrip-may04-freeze-may01.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/lifecycle-receipts-2026-06-09/playwright-evidence.json | receipt | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/lifecycle-receipts-2026-06-09/README.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 13 | 1 | - |
| app/releases/v2/screenshots/lifecycle-receipts-2026-06-09/status-lifecycle-receipt-card.png | receipt | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/lifecycle-receipts-2026-06-09/status-lifecycle-receipt-details.png | receipt | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/lifecycle-receipts-2026-06-09/status-lifecycle-receipts-full-page.png | receipt | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-clean14-2026-06-06/performance-clean14-page-final-direct-npm.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-clean14-2026-06-06/performance-clean14-page-final-focused-preload.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-clean14-2026-06-06/performance-clean14-page-final-focused-preload.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-clean14-2026-06-06/performance-clean14-page-final-preload-state.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-clean14-2026-06-06/performance-clean14-page-final-stable-server.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-clean14-2026-06-06/performance-clean14-page-final.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-clean14-2026-06-06/performance-clean14-page-fresh-server.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-clean14-2026-06-06/performance-clean14-page-no-current-week.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-clean14-2026-06-06/performance-clean14-page.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-data-correctness-2026-06-12/gate32-performance-speed-evidence.json | config | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/releases/v2/screenshots/performance-data-correctness-2026-06-12/README.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 13 | 1 | - |
| app/releases/v2/screenshots/performance-data-correctness-2026-06-12/theme-check.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-data-correctness-2026-06-12/v2.0.5-gate30-jun15-weekly-hold-current-basket.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-data-correctness-2026-06-12/v2.0.5-gate31-jun01-weekly-hold-flattened-basket.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-data-correctness-2026-06-12/v2.0.5-jun01-basket.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-data-correctness-2026-06-12/v2.0.5-jun01-simulation-dark.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-data-correctness-2026-06-12/v2.0.5-jun01-simulation-light.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-data-correctness-2026-06-12/v2.0.5-jun08-current-basket.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-data-correctness-2026-06-12/v2.0.5-jun08-current-summary.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-data-correctness-2026-06-12/v2.0.5-may25-basket.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-data-correctness-2026-06-12/verification-summary.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-selected-truth-2026-06-08/after-playwright-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-selected-truth-2026-06-08/current-playwright-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-selected-truth-2026-06-08/final-basket-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-selected-truth-2026-06-08/final-playwright-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-selected-truth-2026-06-08/final-weekly-hold-basket-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-selected-truth-2026-06-08/final-weekly-hold-switch-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-selected-truth-2026-06-08/inline-drilldown-audit-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-selected-truth-2026-06-08/inline-drilldown-audit-timeout-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-selected-truth-2026-06-08/performance-basket-after-selected-runtime-basket.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-selected-truth-2026-06-08/performance-basket-current-selected-truth.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-selected-truth-2026-06-08/performance-basket-expanded-after-selected-runtime-basket.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-selected-truth-2026-06-08/performance-basket-final-selected-runtime.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-selected-truth-2026-06-08/performance-basket-inline-drilldown-audit-timeout-state.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-selected-truth-2026-06-08/performance-basket-inline-drilldown-audit.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-selected-truth-2026-06-08/performance-summary-after-selected-runtime-basket.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-selected-truth-2026-06-08/performance-summary-current-selected-truth.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-selected-truth-2026-06-08/performance-weekly-hold-basket-final-selected-runtime.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-selected-truth-2026-06-08/performance-weekly-hold-switch-current-state.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-selected-truth-2026-06-08/performance-weekly-hold-switch-final-contained.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-selected-truth-2026-06-08/performance-weekly-hold-switch-final-state.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-selected-truth-2026-06-08/README.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 13 | 1 | - |
| app/releases/v2/screenshots/performance-selected-truth-2026-06-08/weekly-hold-switch-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance-selected-truth-2026-06-08/weekly-hold-switch-final-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance/v2.0.2-live-tandem-adr-grid-pair-fill-cap-simulation.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance/v2.0.2-live-tandem-adr-grid-pair-fill-cap-summary.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance/v2.0.3-local-tandem-adr-grid-pair-fill-cap-simulation.png | unknown | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/releases/v2/screenshots/performance/v2.0.3-local-tandem-adr-grid-pair-fill-cap-summary.png | unknown | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/releases/v2/screenshots/performance/v2.0.3-performance-after-data-navigation.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/performance/v2.0.3-performance-baseline-stale-canon-label.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/route-readiness-2026-06-09/dashboard.png | unknown | deprecated but referenced | leave temporarily with deprecation marker | - | 20 | 20 | - |
| app/releases/v2/screenshots/route-readiness-2026-06-09/performance.png | unknown | deprecated but referenced | leave temporarily with deprecation marker | - | 20 | 20 | - |
| app/releases/v2/screenshots/route-readiness-2026-06-09/playwright-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/route-readiness-2026-06-09/README.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 13 | 1 | - |
| app/releases/v2/screenshots/route-readiness-2026-06-09/status.png | unknown | deprecated but referenced | leave temporarily with deprecation marker | - | 20 | 20 | - |
| app/releases/v2/screenshots/scheduler-cron-register-2026-06-08/README.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 13 | 1 | - |
| app/releases/v2/screenshots/scheduler-cron-register-2026-06-08/status-cron-register-expanded-crop.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/scheduler-cron-register-2026-06-08/status-cron-register-expanded-full-page.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/scheduler-cron-register-2026-06-08/status-cron-register-manual-only-rows.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/scheduler-run-ledger-2026-06-09/playwright-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/scheduler-run-ledger-2026-06-09/README.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 13 | 1 | - |
| app/releases/v2/screenshots/scheduler-run-ledger-2026-06-09/status-run-ledger-full-page.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/scheduler-run-ledger-2026-06-09/status-run-ledger-section.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/README.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 13 | 1 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/regression-basket.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/regression-dashboard.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/regression-performance.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/regression-playwright-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/regression-status.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/selected-ledger-final-basket.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/selected-ledger-final-dashboard.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/selected-ledger-final-performance.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/selected-ledger-final-playwright-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/selected-ledger-final-simulation.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/selected-ledger-final-status.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/selected-ledger-final-summary.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/selected-ledger-metric-receipt-adr-normalized.json | receipt | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/selected-ledger-playwright-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/selected-ledger-regression-basket.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/selected-ledger-regression-dashboard.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/selected-ledger-regression-performance.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/selected-ledger-regression-status.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/selected-ledger-simulation-tandem-adr-grid-pair-fill-cap.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/selected-ledger-summary-tandem-adr-grid-pair-fill-cap.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/visual-inspection-clean14-promotion-2026-06-09.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/visual-inspection-dashboard-2026-06-09.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/visual-inspection-performance-basket-2026-06-09.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/visual-inspection-performance-settled-2026-06-09.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/visual-inspection-performance-simulation-2026-06-09.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/visual-inspection-performance-simulation-settled-2026-06-09.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/visual-inspection-performance-summary-2026-06-09.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/visual-inspection-performance-summary-settled-2026-06-09.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-ledger-metrics-2026-06-09/visual-inspection-status-2026-06-09.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-trade-row-ledger-2026-06-09/performance-basket-selected-ledger.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-trade-row-ledger-2026-06-09/playwright-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/selected-trade-row-ledger-2026-06-09/README.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 13 | 1 | - |
| app/releases/v2/screenshots/status/v2.0.3-status-source-freeze-diagnostics.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-lifecycle-2026-06-08/after-playwright-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-lifecycle-2026-06-08/before-playwright-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-lifecycle-2026-06-08/README.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 13 | 1 | - |
| app/releases/v2/screenshots/weekly-lifecycle-2026-06-08/smoke-dashboard-after-lifecycle.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-lifecycle-2026-06-08/smoke-performance-after-lifecycle.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-lifecycle-2026-06-08/smoke-playwright-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-lifecycle-2026-06-08/status-weekly-lifecycle-after-full-page.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-lifecycle-2026-06-08/status-weekly-lifecycle-after-section.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-lifecycle-2026-06-08/status-weekly-lifecycle-before-full-page.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-lifecycle-2026-06-08/status-weekly-lifecycle-before-section.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/browser-cron-lifecycle-final-summary.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/cron-active-baseline-certification-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/cron-active-baseline-certification-final-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/cron-source-freeze-current-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/cron-source-freeze-current-final-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/current-week-api-loss-count-aligned-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/dashboard-cron-lifecycle-final-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/dashboard-cron-lifecycle-final.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/dashboard-june8-freeze-ledger-ready-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/dashboard-june8-freeze-ledger-ready.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/dashboard-june8-live-source-week-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/dashboard-june8-live-source-week.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/dashboard-release-triage-final.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/dashboard-route-gate.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/performance-15-week-certified-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/performance-15-week-certified.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/performance-active-history-request-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/performance-cron-lifecycle-final-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/performance-cron-lifecycle-final.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/performance-cron-lifecycle-june8-selected-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/performance-cron-lifecycle-june8-selected.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/performance-june8-auto-live-overlay-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/performance-june8-auto-live-overlay.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/performance-june8-freeze-ledger-live-overlay-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/performance-june8-freeze-ledger-live-overlay.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/performance-june8-live-overlay-after-data-fix-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/performance-june8-live-overlay-after-data-fix.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/performance-june8-live-overlay-current-metrics-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/performance-june8-live-overlay-current-metrics.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/performance-june8-live-overlay-current-response-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/performance-june8-live-overlay-current-response.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/performance-june8-live-overlay-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/performance-june8-live-overlay-fixed-metrics-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/performance-june8-live-overlay-fixed-metrics.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/performance-june8-live-overlay-sane-metrics-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/performance-june8-live-overlay-sane-metrics.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/performance-june8-live-overlay.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/performance-release-triage-final.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/performance-route-gate-after-active-history.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/performance-route-gate.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/release-triage-final-browser-gate-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/status-15-week-certified-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/status-15-week-certified-ready-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/status-15-week-certified-ready.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/status-15-week-certified.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/status-cron-lifecycle-final-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/status-cron-lifecycle-final.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/status-institutional-seed-runtime-name-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/status-institutional-seed-runtime-name.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/status-release-triage-final.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/status-weekly-lifecycle.png | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/weekly-rollover-active-baseline-evidence.json | config | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/releases/v2/strategy-execution-spec.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| app/releases/v2/verification.md | report | deprecated but referenced | leave temporarily with deprecation marker | verification:audit-cot-source-opportunity, verification:audit-macro-boundary-proof, verification:audit-macro-deterministic-rebuild-proof, verification:audit-macro-historical-activation, verification:audit-macro-lifecycle-uniqueness, verification:audit-macro-parent-promotion-proof, verification:audit-macro-rate-differential, verification:audit-macro-raw-artifact-parser-replay, verification:audit-macro-regime-join-coverage, verification:audit-macro-revocation-supersession, verification:audit-macro-zero-pnl-pinned-read, verification:audit-official-cpi-endpoints, verification:export-research-matrix-dataset-contract, verification:export-strength-history-context, verification:export-weekly-hold-fixed-band-sweep, verification:export-weekly-hold-trailing-sweep, verification:fill-macro-regime-sources, verification:gate51-cot-lifecycle-rrp, verification:gate51-rrp-decomposition, verification:gate51-rrp-regime-filter, verification:gate51-selector-lockdown, verification:gate54f-standalone-signal-baselines, verification:gate54g-cot-warmup-carry-forward, verification:gate54h-clp-tie-break-comparison, verification:gate55-friday-strength-baseline, verification:gate55f-strength-source-context, verification:gate55h-inventory, verification:macro-regime-credential-preflight, verification:repair-macro-artifact-byte-archive, verification:research-manifest:evaluate | 20 | 20 | - |
| app/reports/adr-dip-entry-research.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/archive/data-verification/2026-06-10/app/containment-2026-06-06/may17-eurusd/tiered-execution-app-trades.csv | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/archive/data-verification/2026-06-10/app/containment-2026-06-06/may17-eurusd/tiered-execution-indicator-template.csv | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/archive/data-verification/2026-06-10/app/containment-2026-06-06/may24-eurusd/tiered-execution-app-trades.csv | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/archive/data-verification/2026-06-10/app/containment-2026-06-06/may24-eurusd/tiered-execution-indicator-template.csv | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/archive/data-verification/2026-06-10/app/tiered-execution-app-trades.csv | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/archive/data-verification/2026-06-10/app/tiered-execution-indicator-template.csv | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/archive/data-verification/2026-06-10/app/visible-engine-stats-2026-06-04.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 1 | - |
| app/reports/archive/data-verification/2026-06-10/runtime/tiered-adr_grid-none-2026-05-17-all-symbols-indicator-template.csv | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/archive/data-verification/2026-06-10/runtime/tiered-adr_grid-none-2026-05-17-all-symbols-runtime-app-trades.csv | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/archive/data-verification/2026-06-10/runtime/tiered-adr_grid-none-2026-05-17-eurusd-indicator-template.csv | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/archive/data-verification/2026-06-10/runtime/tiered-adr_grid-none-2026-05-17-eurusd-runtime-app-trades.csv | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/archive/data-verification/2026-06-10/runtime/tiered-adr_grid-pair_fill_cap-2026-05-17-eurusd-indicator-template.csv | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/archive/data-verification/2026-06-10/runtime/tiered-adr_grid-pair_fill_cap-2026-05-17-eurusd-runtime-app-trades.csv | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/archive/data-verification/2026-06-10/runtime/tiered-adr_grid-pair_fill_cap-2026-05-24-eurusd-indicator-template.csv | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/archive/data-verification/2026-06-10/runtime/tiered-adr_grid-pair_fill_cap-2026-05-24-eurusd-runtime-app-trades.csv | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/archive/data-verification/2026-06-10/tmp-eurjpy-week/tiered-canonical-app-trades.csv | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/archive/data-verification/2026-06-10/tmp-eurjpy-week/tiered-execution-app-trades.csv | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/archive/root-artifacts/2026-06-10/risk-matrix-output.txt | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/archive/snapshot-regime-comparison/2026-06/clean14-sentiment-regime-behavior-audit.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| app/reports/archive/snapshot-regime-comparison/2026-06/clean14-sunday-vs-friday-regime-report.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| app/reports/counter-trend-weekly-backtest-2026-02-28-155508.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/counter-trend-weekly-backtest-2026-02-28-164114.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/counter-trend-weekly-backtest-2026-02-28-171452.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/counter-trend-weekly-backtest-2026-02-28-175946.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/counter-trend-weekly-backtest-2026-02-28-181514.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/counter-trend-weekly-backtest-2026-02-28-182215.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/counter-trend-weekly-backtest-2026-02-28-184421.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/counter-trend-weekly-backtest-2026-02-28-193213.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-372w-20260619-134630.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 4 | 0 | - |
| app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-source-coverage-372w-20260619-122837.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-source-model-matrix-read-372w-20260619-134630.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 5 | 0 | - |
| app/reports/data-verification/fx-hedged-adr-grid-side-selectors/gate46-cot-lifecycle-source-score-audit-372w-20260619T170102.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 3 | 0 | - |
| app/reports/data-verification/gate55/gate55e-canonical-fx-m1-bundle-20260624T232148Z.json | generated_result | active evidence receipt | keep active | - | 3 | 0 | - |
| app/reports/data-verification/gate55/gate55e-canonical-fx-m1-bundle-20260624T232148Z.md | generated_result | active evidence receipt | keep active | - | 3 | 0 | - |
| app/reports/data-verification/gate55/gate55f-strength-source-context-20260625T024725Z.json | generated_result | active evidence receipt | keep active | - | 2 | 0 | - |
| app/reports/data-verification/gate55/gate55f-strength-source-context-20260625T024725Z.md | generated_result | active evidence receipt | keep active | - | 2 | 0 | - |
| app/reports/data-verification/gate55/gate55g-friday-strength-selected-vs-fade-20260625T052431Z.json | generated_result | active evidence receipt | keep active | - | 2 | 0 | - |
| app/reports/data-verification/gate55/gate55g-friday-strength-selected-vs-fade-20260625T052431Z.md | generated_result | active evidence receipt | keep active | - | 2 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-artifact-byte-archive-repair-20260623.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-artifact-byte-archive-repair-20260623.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-boundary-proof-20260623.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-boundary-proof-20260623.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-boundary-proof-boundary-repaired-20260623.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 1 | - |
| app/reports/data-verification/macro-regime/gate50-boundary-proof-boundary-repaired-20260623.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 1 | - |
| app/reports/data-verification/macro-regime/gate50-bpr-exception-calendar-2019-dry-run-20260620.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-bpr-exception-calendar-2025-dry-run-20260620.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-credential-preflight-20260622.json | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-credentialed-rrp-one-week-dry-run-20260622.json | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-credentialed-source-fill-full-dry-run-20260622.json | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-credentialed-source-fill-full-write-20260622.json | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-credentialed-source-fill-matrix-weeks-dry-run-20260622.json | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-credentialed-source-fill-matrix-weeks-write-20260622.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 1 | - |
| app/reports/data-verification/macro-regime/gate50-deterministic-rebuild-proof-20260623.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-deterministic-rebuild-proof-20260623.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-historical-activation-20260623.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-historical-activation-20260623.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-historical-activation-control-amended-20260623.json | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-historical-activation-control-amended-20260623.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-historical-activation-control-repaired-20260623.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| app/reports/data-verification/macro-regime/gate50-historical-activation-control-repaired-20260623.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| app/reports/data-verification/macro-regime/gate50-lifecycle-uniqueness-20260623.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-lifecycle-uniqueness-20260623.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-lifecycle-uniqueness-control-repaired-20260623.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 2 | - |
| app/reports/data-verification/macro-regime/gate50-lifecycle-uniqueness-control-repaired-20260623.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 2 | - |
| app/reports/data-verification/macro-regime/gate50-macro-join-coverage-current-20260620.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-macro-join-coverage-current-20260620.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-macro-join-coverage-fail-closed-20260620.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-macro-join-coverage-fail-closed-20260620.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-macro-join-coverage-feature-bundle-fail-closed-20260620.json | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-macro-join-coverage-feature-bundle-fail-closed-20260620.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-macro-join-coverage-feature-bundle-rrp-20260620.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-macro-join-coverage-feature-bundle-rrp-20260620.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-macro-join-coverage-package-script-20260620.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-macro-join-coverage-package-script-20260620.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-macro-join-coverage-pinned-full-exploratory-20260620.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-macro-join-coverage-pinned-full-exploratory-20260620.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-macro-join-coverage-rrp-matrix-active-failclosed-20260622.json | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-macro-join-coverage-rrp-matrix-active-failclosed-20260622.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-macro-join-coverage-rrp-matrix-sealed-diagnostic-20260622.json | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-macro-join-coverage-rrp-matrix-sealed-diagnostic-20260622.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-macro-join-coverage-rrp-sealed-diagnostic-20260622.json | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-macro-join-coverage-rrp-sealed-diagnostic-20260622.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-no-source-dry-run-20260620.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-official-cpi-aud-monthly-transition-join-coverage-20260623.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| app/reports/data-verification/macro-regime/gate50-official-cpi-aud-monthly-transition-join-coverage-20260623.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| app/reports/data-verification/macro-regime/gate50-official-cpi-aud-monthly-transition-write-20260623.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| app/reports/data-verification/macro-regime/gate50-official-cpi-endpoint-feasibility-20260622.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 3 | 2 | - |
| app/reports/data-verification/macro-regime/gate50-official-cpi-endpoint-feasibility-20260622.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 3 | 2 | - |
| app/reports/data-verification/macro-regime/gate50-official-cpi-endpoint-feasibility-det1-20260622.json | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-official-cpi-endpoint-feasibility-det1-20260622.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-official-cpi-endpoint-feasibility-det2-20260622.json | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-official-cpi-endpoint-feasibility-det2-20260622.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-official-cpi-materialization-dryrun-20260622.json | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-official-cpi-materialization-join-coverage-20260622.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-official-cpi-materialization-join-coverage-20260622.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-official-cpi-materialization-write-20260622.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-parent-promotion-proof-20260623.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-parent-promotion-proof-20260623.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-parent-promotion-proof-boundary-repaired-20260623.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 1 | - |
| app/reports/data-verification/macro-regime/gate50-parent-promotion-proof-boundary-repaired-20260623.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 1 | - |
| app/reports/data-verification/macro-regime/gate50-rate-alfred-differential-reconstruction-20260622.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 2 | - |
| app/reports/data-verification/macro-regime/gate50-rate-alfred-differential-reconstruction-20260622.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 2 | - |
| app/reports/data-verification/macro-regime/gate50-rate-audit-smoke-temp.json | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-rate-audit-smoke-temp.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-rate-date-only-strict-join-coverage-20260623.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| app/reports/data-verification/macro-regime/gate50-rate-date-only-strict-join-coverage-20260623.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| app/reports/data-verification/macro-regime/gate50-rate-date-only-strict-write-20260623.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| app/reports/data-verification/macro-regime/gate50-rate-latest-eligible-boundary-proof-20260622.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-rate-latest-eligible-boundary-proof-20260622.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-rate-latest-eligible-dry-run-20260622.json | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-rate-latest-eligible-join-coverage-20260622.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-rate-latest-eligible-join-coverage-20260622.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-rate-latest-eligible-write-20260622.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-raw-artifact-parser-replay-20260623.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-raw-artifact-parser-replay-20260623.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-raw-artifact-parser-replay-after-byte-archive-20260623.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-raw-artifact-parser-replay-after-byte-archive-20260623.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-raw-artifact-parser-replay-full-20260623.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 1 | - |
| app/reports/data-verification/macro-regime/gate50-raw-artifact-parser-replay-full-20260623.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 1 | - |
| app/reports/data-verification/macro-regime/gate50-revocation-supersession-20260623.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-revocation-supersession-20260623.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-revocation-supersession-control-amended-20260623.json | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-revocation-supersession-control-amended-20260623.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-revocation-supersession-control-repaired-20260623.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| app/reports/data-verification/macro-regime/gate50-revocation-supersession-control-repaired-20260623.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| app/reports/data-verification/macro-regime/gate50-rrp-active-join-20260623.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-rrp-active-join-20260623.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-rrp-active-join-control-amended-20260623.json | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-rrp-active-join-control-amended-20260623.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-rrp-active-join-control-repaired-20260623.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 3 | - |
| app/reports/data-verification/macro-regime/gate50-rrp-active-join-control-repaired-20260623.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 3 | - |
| app/reports/data-verification/macro-regime/gate50-rrp-boundary-repaired-sealed-join-20260623.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 2 | - |
| app/reports/data-verification/macro-regime/gate50-rrp-boundary-repaired-sealed-join-20260623.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 2 | - |
| app/reports/data-verification/macro-regime/gate50-rrp-boundary-repaired-write-20260623.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| app/reports/data-verification/macro-regime/gate50-rrp-composition-dryrun-20260623.json | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-rrp-composition-join-coverage-20260623.json | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-rrp-composition-join-coverage-20260623.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-rrp-composition-lineage-dryrun-20260623.json | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-rrp-composition-lineage-join-coverage-20260623.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-rrp-composition-lineage-join-coverage-20260623.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-rrp-composition-lineage-write-20260623.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-rrp-composition-write-20260623.json | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-warehouse-canonical-rebuild-proof-boundary-repaired-20260623.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 1 | - |
| app/reports/data-verification/macro-regime/gate50-warehouse-canonical-rebuild-proof-boundary-repaired-20260623.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 1 | - |
| app/reports/data-verification/macro-regime/gate50-zero-pnl-pinned-read-20260623.json | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-zero-pnl-pinned-read-20260623.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-zero-pnl-pinned-read-control-amended-20260623.json | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-zero-pnl-pinned-read-control-amended-20260623.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-zero-pnl-pinned-read-control-repaired-20260623.json | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/data-verification/macro-regime/gate50-zero-pnl-pinned-read-control-repaired-20260623.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/eightcap-100k-1year-cot-only-universal-vs-tiered-2026-02-22.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/eightcap-100k-1year-cot-only-universal-vs-tiered-latest.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| app/reports/eightcap-100k-1year-cot-triplet-proxy-2026-02-23.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/eightcap-100k-1year-cot-triplet-proxy-latest.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| app/reports/extract-backtest-data.ps1 | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-2026-02-27-ab_parity_nohard_atr.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-2026-02-27-entrycmp5_hold.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-2026-02-27-entrycmp5_sweep_block_thu_fri.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-2026-02-27-entrycmp5_sweep_noblock.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-2026-02-27-entrycmp5_sweep.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-2026-02-27-full_sweep_block_thu_fri_m1.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-2026-02-27-full_sweep_block_thu_fri_m3.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-2026-02-27-full_sweep_noblock_m1.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-2026-02-27-full_sweep_noblock_m3.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-2026-02-27-full_sweep_nohard_atr_base_m3.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-2026-02-27-full_sweep_nohard_atr_m3.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-2026-02-27-full_sweep_nohard_atr_tight_m3.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-2026-02-27-full_sweep_nohard_atr_wide_m3.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-2026-02-27-full_sweep_nohard_fixed_m3.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-2026-02-27-hard_sl_m3.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-2026-02-27-no_hard_sl_m3.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-2026-02-27-phase1_regression_smoke.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-2026-02-27-phase2_full_atr_nohard.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-2026-02-27-phase2_smoke.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-2026-02-27.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-2026-03-03.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-2026-03-20.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-2026-03-22-phase2_full_atr_nohard.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-latest-ab_parity_nohard_atr.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/katarakti-phase1-backtest-latest-entrycmp5_hold.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/katarakti-phase1-backtest-latest-entrycmp5_sweep_block_thu_fri.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-latest-entrycmp5_sweep_noblock.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-latest-entrycmp5_sweep.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/reports/katarakti-phase1-backtest-latest-full_sweep_block_thu_fri_m1.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-latest-full_sweep_block_thu_fri_m3.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-latest-full_sweep_noblock_m1.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-latest-full_sweep_noblock_m3.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-latest-full_sweep_nohard_atr_base_m3.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-latest-full_sweep_nohard_atr_m3.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-latest-full_sweep_nohard_atr_tight_m3.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-latest-full_sweep_nohard_atr_wide_m3.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-latest-full_sweep_nohard_fixed_m3.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-latest-hard_sl_m3.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-latest-no_hard_sl_m3.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-latest-phase1_regression_smoke.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-latest-phase2_full_atr_nohard.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 4 | 2 | - |
| app/reports/katarakti-phase1-backtest-latest-phase2_smoke.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/katarakti-phase1-backtest-latest.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 5 | 9 | - |
| app/reports/range-filter-5y-backtest-2026-02-13.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/range-filter-5y-backtest-short-and-long-2026-02-13.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/range-filter-5y-backtest-short-only-2026-02-13.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/research-universe-compare-2026-02-08.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/universal-v3-agreement-backtest-2026-02-21.md | generated_result | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/reports/universal-v3-agreement-backtest-latest.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| app/reports/weekly-adr-engulfing-matrix-study.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| app/reports/weekly-adr-threshold-matrix-study.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| app/reports/weekly-dip-threshold-matrix-study.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| app/scripts/adr-backtest-agreement.js | script | deprecated and safe to archive | move to root archive | - | 0 | 0 | archive/app/scripts/adr-backtest-agreement.js |
| app/scripts/adr-backtest-comparison.js | script | deprecated and safe to archive | move to root archive | - | 0 | 0 | archive/app/scripts/adr-backtest-comparison.js |
| app/scripts/adr-backtest-corrected.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/adr-backtest-cs-weekopen.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/adr-backtest-dynamic-tp.js | script | deprecated and safe to archive | move to root archive | - | 0 | 0 | archive/app/scripts/adr-backtest-dynamic-tp.js |
| app/scripts/adr-backtest-extended.js | script | deprecated and safe to archive | move to root archive | - | 0 | 0 | archive/app/scripts/adr-backtest-extended.js |
| app/scripts/adr-backtest-first-trade-filter.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/adr-backtest-grid-final.js | script | deprecated and safe to archive | move to root archive | - | 0 | 0 | archive/app/scripts/adr-backtest-grid-final.js |
| app/scripts/adr-backtest-grid.js | script | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| app/scripts/adr-backtest-neutral.js | script | deprecated and safe to archive | move to root archive | - | 0 | 0 | archive/app/scripts/adr-backtest-neutral.js |
| app/scripts/adr-backtest-sentiment.js | script | deprecated and safe to archive | move to root archive | - | 0 | 0 | archive/app/scripts/adr-backtest-sentiment.js |
| app/scripts/adr-backtest-stoch.js | script | deprecated and safe to archive | move to root archive | - | 0 | 0 | archive/app/scripts/adr-backtest-stoch.js |
| app/scripts/adr-backtest-strength-buckets-all-systems.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/adr-backtest-tandem.js | script | deprecated and safe to archive | move to root archive | - | 0 | 0 | archive/app/scripts/adr-backtest-tandem.js |
| app/scripts/adr-backtest-trailing-system-sweep.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/adr-backtest-weekstart-hybrid-sweep.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/analyze-bitget-liq-sweep-backtest.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/analyze-bitget-liq-sweep-simple-backtest.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/analyze-bitget-lite-entry-backtest.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/scripts/analyze-bitget-v2-double-session-window.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/scripts/analyze-bitget-v2-overshoot-by-bias.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/scripts/analyze-bitget-v2-overshoot.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 1 | - |
| app/scripts/analyze-bitget-v2-short-sweep-followthrough.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/scripts/analyze-bitget-v2-short-sweep-scaling-exit.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/scripts/analyze-bitget-v2-short-sweep-sensitivity-grid.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/scripts/analyze-bitget-v3-alt-universe-correlation-backtest.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/scripts/analyze-bitget-v3-sustained-reentry-backtest.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 2 | - |
| app/scripts/analyze-eightcap-week.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/analyze-katarakti-lite-ablation.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/scripts/analyze-katarakti-lite-parameter-sweep.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/scripts/analyze-katarakti-rangewidth-backtest.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/scripts/analyze-katarakti-v3-atr-exit-backtest.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/scripts/analyze-katarakti-v3-sustained-reentry-atr-backtest.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/scripts/audit-data-integrity.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| app/scripts/audit-friday-freeze-source-ledger.ts | script | deprecated but referenced | leave temporarily with deprecation marker | source:freeze:seed-window | 0 | 0 | - |
| app/scripts/audit-performance-accuracy.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/audit-performance-data-architecture.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/audit-strength-canonical-readiness.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backfill-cot-deep-history.ts | script | deprecated but referenced | leave temporarily with deprecation marker | cot:backfill-deep-history | 0 | 0 | - |
| app/scripts/backfill-cot-enrichment.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backfill-missing-asset-strength.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backfill-strength.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-2of3-agreement-breakdown.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-2of3-fx-dealer-oppose-filter.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-additive-layering.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-adr-normalization.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-basket-adr-tp-all-strategies.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-basket-adr-tp.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| app/scripts/backtest-basket-exit-grid.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-basket-tp-final.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-basket-trailing-stop.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-btc-bias-gate.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-cfd-bb-reclaim-swing-stop.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-cfd-handshake-sweep.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-cfd-intraday-handshake-sweep.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-cfd-ma-bb-sweep.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-cfd-ma-bb-trigger.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-cfd-phase2-sweep.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-cfd-portfolio-exit-research.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-cfd-realtime-handshake-sweep.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-cfd-rranjan-5m-trigger.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-cfd-sweep-exit-research.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/scripts/backtest-cfd-unified-katarakti-sweep.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 1 | - |
| app/scripts/backtest-commercial-forced-canonical.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-commercial-veto.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-composite-standardization-sweep.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-cot-combined.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-cot-deep-dive.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-daily-top-pick.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/scripts/backtest-dca-layering.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-dealer-commercial-quality.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-drawdown-trigger-layering.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-liquidation-path.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-manual-session-matrix.ts | script | deprecated but referenced | leave temporarily with deprecation marker | research:manual-session-matrix | 1 | 0 | - |
| app/scripts/backtest-per-trade-sl.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-risk-management-matrix.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-scaled-prop-consistency.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-session-top-pick.ts | script | deprecated but referenced | leave temporarily with deprecation marker | trade:backtest-session | 5 | 0 | - |
| app/scripts/backtest-source-canonicalization.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-stoch-entry-modes.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-strategy-gate-comparison.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| app/scripts/backtest-strength-standalone.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-strength-tiered-agreement-matrix.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-tandem-sleeve-portfolios.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-tiebreaker-veto.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-tiebreaker.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| app/scripts/backtest-tiered-v3-session-intraday-phase1.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-top-composite-live-layering.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-universal-v3-report.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-veto-2of4.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-veto-composite-sweep.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| app/scripts/backtest-veto-sleeves.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-weekly-bias-context-selector.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 3 | 1 | - |
| app/scripts/backtest-weekly-bias-pair.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/backtest-weekly-buy-low-gate.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/bitget-v2-backtest.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 5 | 3 | - |
| app/scripts/bitget-v2-liquidation-backtest-stub.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| app/scripts/build-research-universe.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/check-cot-data.js | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/check-cot-db.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/counter-trend-weekly-backtest.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/scripts/eightcap-100k-1year-cot-only-universal-vs-tiered-compare.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/eightcap-100k-1year-cot-triplet-proxy.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/eightcap-100k-5week-system-compare.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/eightcap-100k-5week-universal-vs-tiered-compare.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/eightcap-100k-week-system-compare.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/eightcap-100k-week-tiered-v3-test.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/eightcap-3k-5week-floor-clamped-compare.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 2 | - |
| app/scripts/eightcap-3k-hedged-fx-weekly-sweep.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 1 | - |
| app/scripts/eightcap-3k-instrument-deep-dive.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/fiveers-5week-universal-swap-vs-noswap.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/ingest-katarakti-core-backtests.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/scripts/ingest-tiered-flagship-backtest.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/katarakti-phase1-backtest.ts | script | deprecated but referenced | leave temporarily with deprecation marker | research:katarakti-phase1 | 7 | 8 | - |
| app/scripts/print-eightcap-week-trades.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/refresh-cot-now.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research-4source-agreement-optimization.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research-4source-agreement.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| app/scripts/research-4source-tiered.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research-bank-participation.ts | script | deprecated but referenced | leave temporarily with deprecation marker | research:bank | 1 | 0 | - |
| app/scripts/research-blended-agreement-backtest.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research-blended-agreement-historical.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research-commercial-context.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research-compare-performance-logic.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research-compare-universes.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research-cot-commercial-direction.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research-cot-cross-source.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research-cot-deep-history.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research-cot-enrichment-quality.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research-cot-full-book.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research-cot-gate-variants.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research-cot-non-fx-direction.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research-cot-optimized-stack.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research-neutral-resolvers.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research-range-filter-5y.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research-refresh-snapshots.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research-selector-commercial-gates.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research-selector-commercial.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| app/scripts/research-selector-fragility.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research-selector-weighted-tiebreak.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research-sentiment-full-resolver.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research-sentiment-persistence.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research-sentiment-strength.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research-strength-nonfx-fix.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research-strength-windows.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research-veto-base-source.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research/analyze-exit-research.js | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research/audit-clean14-sentiment-regime.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/research/backtest-adr-grid-runner-refill.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/scripts/research/backtest-weekly-hold-adr-exits.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/scripts/research/compare-snapshot-regimes.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/sweep-tiered-v3-gated-fx-dip-fallback.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/sweep-weekly-adr-engulfing-ema-fx.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/sweep-weekly-adr-engulfing-matrix.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/sweep-weekly-adr-threshold-matrix.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/sweep-weekly-dip-threshold-matrix.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/universal-breakout-overlay-phase1.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/scripts/universal-deep-analysis.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/universal-hourly-scaleout-analysis.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/universal-hybrid-policy-analysis.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/universal-scaleout-analysis.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/universal-truth-sweep.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/universal-v1-adaptive-trail-sweep.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/universal-v1-funded-policy-sim.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/universal-v1-policy-analysis.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/universal-v1-trigger-basis-comparison.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/universal-v1-weekly-adds-comparison.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/universal-winners-hold-flips-analysis.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/v1-universal-adaptive-quality-filter.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/v1-universal-hitrate-1pct.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/v1-universal-tp1-friday-carry-aligned.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| app/scripts/verification/analyze-gate51-cot-lifecycle-rrp-interaction.ts | script | historical receipt script | leave temporarily with deprecation marker | verification:gate51-cot-lifecycle-rrp | 0 | 0 | - |
| app/scripts/verification/analyze-gate51-rrp-decomposition.ts | script | historical receipt script | leave temporarily with deprecation marker | verification:gate51-rrp-decomposition | 0 | 0 | - |
| app/scripts/verification/analyze-gate51-rrp-regime-filter.ts | script | historical receipt script | leave temporarily with deprecation marker | verification:gate51-rrp-regime-filter | 0 | 0 | - |
| app/scripts/verification/audit-cot-source-opportunity.ts | script | historical receipt script | leave temporarily with deprecation marker | verification:audit-cot-source-opportunity | 1 | 0 | - |
| app/scripts/verification/audit-dealer-rule-candidates.ts | script | historical receipt script | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/scripts/verification/audit-dealer-weekly-hold-years.ts | script | historical receipt script | leave temporarily with deprecation marker | - | 0 | 0 | - |
| app/scripts/verification/audit-fx-hedged-adr-grid-inventory.ts | script | historical receipt script | leave temporarily with deprecation marker | - | 1 | 0 | - |
| app/scripts/verification/audit-fx-hedged-adr-grid-side-selectors.ts | script | historical receipt script | leave temporarily with deprecation marker | - | 10 | 0 | - |
| app/scripts/verification/audit-gate52-bpr-clean-ambiguity-map.ts | script | historical receipt script | leave temporarily with deprecation marker | - | 0 | 0 | - |
| app/scripts/verification/audit-gate54f-standalone-signal-baselines.ts | script | historical receipt script | leave temporarily with deprecation marker | verification:gate54f-standalone-signal-baselines | 1 | 0 | - |
| app/scripts/verification/audit-gate54g-cot-warmup-carry-forward.ts | script | historical receipt script | leave temporarily with deprecation marker | verification:gate54g-cot-warmup-carry-forward | 1 | 0 | - |
| app/scripts/verification/audit-gate54h-clp-tie-break-comparison.ts | script | historical receipt script | leave temporarily with deprecation marker | verification:gate54h-clp-tie-break-comparison | 1 | 0 | - |
| app/scripts/verification/audit-gate55-friday-strength-baseline.ts | script | historical receipt script | leave temporarily with deprecation marker | verification:gate55-friday-strength-baseline | 5 | 0 | - |
| app/scripts/verification/audit-gate55e-canonical-fx-m1-bundle.ts | script | historical receipt script | leave temporarily with deprecation marker | - | 2 | 0 | - |
| app/scripts/verification/audit-gate55f-strength-source-context.ts | script | historical receipt script | leave temporarily with deprecation marker | verification:gate55f-strength-source-context | 1 | 0 | - |
| app/scripts/verification/audit-macro-boundary-proof.ts | script | historical receipt script | leave temporarily with deprecation marker | verification:audit-macro-boundary-proof | 1 | 0 | - |
| app/scripts/verification/audit-macro-deterministic-rebuild-proof.ts | script | historical receipt script | leave temporarily with deprecation marker | verification:audit-macro-deterministic-rebuild-proof | 1 | 0 | - |
| app/scripts/verification/audit-macro-historical-activation.ts | script | historical receipt script | leave temporarily with deprecation marker | verification:audit-macro-historical-activation | 0 | 0 | - |
| app/scripts/verification/audit-macro-lifecycle-uniqueness.ts | script | historical receipt script | leave temporarily with deprecation marker | verification:audit-macro-lifecycle-uniqueness | 0 | 0 | - |
| app/scripts/verification/audit-macro-parent-promotion-proof.ts | script | historical receipt script | leave temporarily with deprecation marker | verification:audit-macro-parent-promotion-proof | 0 | 0 | - |
| app/scripts/verification/audit-macro-rate-differential-reconstruction.ts | script | historical receipt script | leave temporarily with deprecation marker | verification:audit-macro-rate-differential | 2 | 0 | - |
| app/scripts/verification/audit-macro-raw-artifact-parser-replay.ts | script | historical receipt script | leave temporarily with deprecation marker | verification:audit-macro-raw-artifact-parser-replay | 0 | 0 | - |
| app/scripts/verification/audit-macro-regime-join-coverage.ts | script | historical receipt script | leave temporarily with deprecation marker | verification:audit-macro-regime-join-coverage | 3 | 0 | - |
| app/scripts/verification/audit-macro-revocation-supersession.ts | script | historical receipt script | leave temporarily with deprecation marker | verification:audit-macro-revocation-supersession | 0 | 0 | - |
| app/scripts/verification/audit-macro-zero-pnl-pinned-read.ts | script | historical receipt script | leave temporarily with deprecation marker | verification:audit-macro-zero-pnl-pinned-read | 0 | 0 | - |
| app/scripts/verification/audit-official-cpi-endpoint-feasibility.ts | script | historical receipt script | leave temporarily with deprecation marker | verification:audit-official-cpi-endpoints | 3 | 0 | - |
| app/scripts/verification/decide-gate51-selector-lockdown.ts | script | historical receipt script | leave temporarily with deprecation marker | verification:gate51-selector-lockdown | 0 | 0 | - |
| app/scripts/verification/evaluate-research-decision-manifest.ts | script | reusable infrastructure | keep active | verification:research-manifest:evaluate | 3 | 0 | - |
| app/scripts/verification/export-research-matrix-dataset-contract.ts | script | historical receipt script | leave temporarily with deprecation marker | verification:export-research-matrix-dataset-contract | 6 | 0 | - |
| app/scripts/verification/export-strength-history-context.ts | script | historical receipt script | leave temporarily with deprecation marker | verification:export-strength-history-context | 8 | 0 | - |
| app/scripts/verification/export-weekly-hold-fixed-band-sweep.ts | script | historical receipt script | leave temporarily with deprecation marker | verification:export-weekly-hold-fixed-band-sweep | 4 | 3 | - |
| app/scripts/verification/export-weekly-hold-trailing-sweep.ts | script | historical receipt script | leave temporarily with deprecation marker | verification:export-weekly-hold-trailing-sweep | 0 | 0 | - |
| app/scripts/verification/fill-macro-regime-source-warehouse.ts | script | deprecated but referenced | leave temporarily with deprecation marker | verification:fill-macro-regime-sources, verification:macro-regime-credential-preflight | 2 | 2 | - |
| app/scripts/verify-selector-commercial-audit.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/verify-selector-commercial-caution-skip.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/verify-selector-commercial-strength-disagree-skip.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/verify-selector-fix.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/verify-selector-parity.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/verify-selector-strength-confirmation.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/verify-selector-strength-tiebreak.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/verify-selector-strength-veto.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/scripts/verify-strength-b4.ts | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/src/app/api/research/candidates/route.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 20 | 20 | - |
| app/src/app/api/research/runs/[id]/route.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 20 | 20 | - |
| app/src/app/api/research/runs/route.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 20 | 20 | - |
| app/src/app/api/research/strategies/route.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 20 | 20 | - |
| app/src/app/automation/research/bank/page.tsx | script | deprecated but referenced | leave temporarily with deprecation marker | - | 20 | 20 | - |
| app/src/app/automation/research/baskets/page.tsx | script | deprecated but referenced | leave temporarily with deprecation marker | - | 20 | 20 | - |
| app/src/app/automation/research/lab/page.tsx | script | deprecated but referenced | leave temporarily with deprecation marker | - | 20 | 20 | - |
| app/src/app/automation/research/loading.tsx | script | deprecated but referenced | leave temporarily with deprecation marker | - | 17 | 20 | - |
| app/src/app/automation/research/page.tsx | script | deprecated but referenced | leave temporarily with deprecation marker | - | 20 | 20 | - |
| app/src/app/automation/research/strategies/page.tsx | script | deprecated but referenced | leave temporarily with deprecation marker | - | 20 | 20 | - |
| app/src/app/automation/research/symbols/page.tsx | script | deprecated but referenced | leave temporarily with deprecation marker | - | 20 | 20 | - |
| app/src/app/automation/research/universal/page.tsx | script | deprecated but referenced | leave temporarily with deprecation marker | - | 20 | 20 | - |
| app/src/app/research/page.tsx | script | deprecated but referenced | leave temporarily with deprecation marker | - | 20 | 20 | - |
| app/src/components/research/EquityCurveChart.tsx | script | deprecated but referenced | leave temporarily with deprecation marker | - | 3 | 6 | - |
| app/src/components/research/ResearchLabClient.tsx | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/src/components/research/ResearchSectionNav.tsx | script | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| app/src/components/research/StrategiesExplorerClient.tsx | script | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 1 | - |
| app/src/lib/__tests__/weeklyHoldEngineAdrGrid.test.ts | script | reusable infrastructure | keep active | - | 1 | 0 | - |
| app/src/lib/performance/pathBarLoader.ts | script | reusable infrastructure | keep active | - | 9 | 20 | - |
| app/src/lib/performance/weeklyHoldEngine.ts | script | reusable infrastructure | keep active | - | 11 | 20 | - |
| app/src/lib/research/backtestEngine.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 2 | - |
| app/src/lib/research/bankComparison.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 2 | - |
| app/src/lib/research/bankParticipation.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 2 | - |
| app/src/lib/research/common.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 6 | 20 | - |
| app/src/lib/research/decisionManifest.ts | script | reusable infrastructure | keep active | - | 5 | 2 | - |
| app/src/lib/research/decisionManifestEvaluator.ts | script | reusable infrastructure | keep active | - | 4 | 1 | - |
| app/src/lib/research/hash.ts | script | reusable infrastructure | keep active | - | 20 | 20 | - |
| app/src/lib/research/labConfigQuery.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 2 | - |
| app/src/lib/research/localM1Warehouse.ts | script | reusable infrastructure | keep active | - | 6 | 5 | - |
| app/src/lib/research/macroRegimeDataset.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 8 | - |
| app/src/lib/research/matrixDataset.ts | script | reusable infrastructure | keep active | - | 10 | 10 | - |
| app/src/lib/research/researchRunRegistry.ts | script | reusable infrastructure | keep active | - | 4 | 1 | - |
| app/src/lib/research/types.ts | script | deprecated but referenced | leave temporarily with deprecation marker | - | 19 | 20 | - |
| app/src/lib/strength/historicalStrength.ts | script | reusable infrastructure | keep active | - | 10 | 5 | - |
| database/migrations/016_strategy_backtest_store.sql | unknown | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| database/migrations/017_currency_strength_snapshots.sql | unknown | deprecated but referenced | leave temporarily with deprecation marker | - | 3 | 0 | - |
| database/migrations/020_asset_strength_snapshots.sql | unknown | deprecated but referenced | leave temporarily with deprecation marker | - | 3 | 0 | - |
| database/migrations/027_strength_history_snapshots.sql | unknown | deprecated but referenced | leave temporarily with deprecation marker | - | 3 | 0 | - |
| database/migrations/028_research_matrix_warehouse.sql | source_loader | deprecated but referenced | leave temporarily with deprecation marker | - | 4 | 0 | - |
| database/migrations/029_macro_regime_source_warehouse.sql | source_loader | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| docs/BACKTEST_CANONICAL_PROTOCOL.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 13 | 1 | - |
| docs/bots/bitget-bot-strategy.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 1 | - |
| docs/bots/bitget-v2-backtest-results.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 3 | 2 | - |
| docs/bots/bitget-v2-strategy-decisions.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 1 | - |
| docs/bots/bitget-v3-research-session-2026-03-01.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| docs/bots/codex-prompt-asset-strength-pipeline.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| docs/bots/codex-prompt-currency-strength-pipeline.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| docs/bots/codex-prompt-session-backtest-v2.md | report | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| docs/bots/codex-prompt-session-backtest.md | report | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| docs/bots/COUNTER_TREND_BACKTEST_SPEC.md | report | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| docs/bots/CRYPTO_MATRIX_BOARD_DESIGN.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| docs/bots/CRYPTO_MATRIX_PHASE1_SPEC.md | report | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| docs/bots/FLAGSHIP_SIMPLE_MATRIX_SPEC.md | report | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| docs/bots/SWEEP_EXIT_RESEARCH_RESULTS_2026-03-22.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| docs/bots/UNIFIED_KATARAKTI_GATED_SWEEP_RESULTS_2026-03-22.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| docs/data-verification/APP_TRADINGVIEW_EXECUTION_MATRIX.md | generated_result | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| docs/research/ADR_GRID_RUNNER_COST_RESEARCH_2026-06-02.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| docs/research/ADR_GRID_WEEKLY_ANCHOR_AB_2026-06-02.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| docs/research/corrected-path-metrics-2026-06-03.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 0 | 1 | - |
| docs/research/GATE33_WEEKLY_HOLD_PARITY_HANDOFF_2026-06-13.md | receipt | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| docs/research/GATE34_COT_FACES_FRESH_EYES_HANDOFF_2026-06-15.md | receipt | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| docs/research/GATE34_COT_FACES_V1_ARCHITECTURE_2026-06-15.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| docs/research/GATE34_COT_FACES_V1_FAST_PASS_RESULT_2026-06-15.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| docs/research/GATE34_COT_SOURCE_OPPORTUNITY_AUDIT_2026-06-15.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| docs/research/GATE34_COT_SOURCE_REDESIGN_2019_2026_2026-06-15.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| docs/research/GATE34_DEALER_BASELINE_REDESIGN_HANDOFF_2026-06-15.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| docs/research/GATE34_DEALER_RATIO_RULE_WEEKLY_AUDIT_2026-06-14.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 1 | - |
| docs/research/GATE34_DEALER_RULE_CANDIDATE_AUDIT_2026-06-14.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 4 | 1 | - |
| docs/research/GATE34_DEALER_SOURCE_RULE_FIXED_BAND_AUDIT_2026-06-14.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| docs/research/GATE34_DEALER_SYSTEM_DECISION_LOG_2026-06-15.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| docs/research/GATE34_DEALER_SYSTEM_FRESH_EYES_HANDOFF_2026-06-14.md | receipt | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| docs/research/GATE34_DEALER_SYSTEM_RESEARCH_NOTES_2026-06-14.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| docs/research/GATE34_DEALER_WEEKLY_HOLD_2024_2026_AUDIT_2026-06-14.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 5 | 1 | - |
| docs/research/GATE34_DEALER_WEEKLY_HOLD_2024_RESULT_2026-06-14.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 3 | 0 | - |
| docs/research/GATE34_DEALER_WEEKLY_HOLD_2025_WEEK_BY_WEEK_BREAKDOWN_2026-06-14.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| docs/research/GATE34_DEALER_WEEKLY_HOLD_BASELINE_2025_2026_2026-06-14.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| docs/research/GATE34_WEEKLY_HOLD_ENGINE_RESEARCH_HANDOFF_2026-06-13.md | receipt | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| docs/research/GATE35_ADR_VWAP_PROXY_FADE_BASELINE_2026-06-16.md | receipt | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| docs/research/GATE36_FX_BASKET_PRESSURE_PROBE_2026-06-16.md | receipt | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| docs/research/GATE37_FX_GRID_SOURCE_ALIGNMENT_2026-06-16.md | receipt | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| docs/research/GATE38_DEALER_COMMERCIAL_GRID_AGREEMENT_2026-06-16.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| docs/research/GATE39_ADR_BASKET_STOP_LOSS_HARDENING_2026-06-16.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 3 | 0 | - |
| docs/research/GATE40_TAKE_PROFIT_RUNNER_REVIEW_HANDOFF_2026-06-16.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| docs/research/GATE41_BACKWARD_REGIME_VALIDATION_HANDOFF_2026-06-16.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| docs/research/GATE42_RESEARCH_STATE_CLEANUP_AND_BACKTEST_ENGINE_REARCHITECTURE_2026-06-16.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| docs/research/GATE43_STRENGTH_HISTORY_AND_CONTINUOUS_CONTEXT_2026-06-18.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| docs/research/GATE44_REUSABLE_SEVEN_YEAR_MATRIX_DATASET_2026-06-18.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 3 | 0 | - |
| docs/research/GATE45_SEVEN_YEAR_MATRIX_REVIEW_AND_ACCURACY_AUDIT_HANDOFF_2026-06-19.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 3 | 0 | - |
| docs/research/GATE46_COT_LIFECYCLE_SOURCE_SCORE_AUDIT_2026-06-19.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 1 | - |
| docs/research/GATE47_REAL_VALUE_REGIME_RESEARCH_HANDOFF_2026-06-19.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| docs/research/GATE48_MACRO_SOURCE_CONTRACT_REVIEW_HANDOFF_2026-06-19.md | receipt | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| docs/research/GATE50_CODEX_PRO_DIAGNOSTIC_MANIFEST_REVIEW_RESPONSE_2026-06-22.md | receipt | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| docs/research/GATE50_CODEX_PRO_REVIEW_PACKET_2026-06-20.md | receipt | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| docs/research/GATE50_CODEX_PRO_REVIEW_RESPONSE_2026-06-20.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| docs/research/GATE50_OFFICIAL_CPI_FEASIBILITY_AUDIT_2026-06-22.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| docs/research/GATE50_RATE_VINTAGE_RECONCILIATION_REVIEW_PACKET_2026-06-22.md | receipt | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| docs/research/GATE51_RRP_SEQUENCE_CLOSEOUT_GATE52_HANDOFF_2026-06-23.md | receipt | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| docs/research/GATE51D_RRP_DECOMPOSITION_DIAGNOSTIC_LOCK_2026-06-23.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 3 | 0 | - |
| docs/research/GATE51D_RRP_DECOMPOSITION_FULL_REVIEW_ARTIFACT_20260623T190718.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| docs/research/GATE51E_RRP_SYNTHESIS_CANDIDATE_RULE_LANGUAGE_2026-06-23.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| docs/research/GATE51F_RRP_CONTEXT_ANNOTATION_SPEC_2026-06-23.md | receipt | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| docs/research/GATE52_BPR_PUBLICATION_DATE_PROOF_DECISION_2026-06-23.md | receipt | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| docs/research/GATE52A_BPR_CLEAN_AMBIGUITY_MAP_DECISION_2026-06-23.md | receipt | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| docs/research/GATE53_FINAL_SYSTEM_ARCHITECTURE_SKELETON_2026-06-23.md | receipt | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| docs/research/GATE54_COT_BASELINE_OUTSIDE_REVIEW_PROMPT_2026-06-23.md | receipt | active evidence receipt | keep active | - | 1 | 0 | - |
| docs/research/GATE54_LEGACY_SOURCE_INVENTORY_2026-06-23.md | receipt | active evidence receipt | keep active | - | 0 | 0 | - |
| docs/research/GATE54_MATRIX_SOURCE_COVERAGE_SMOKE_2026-06-23.md | receipt | active evidence receipt | keep active | - | 0 | 0 | - |
| docs/research/GATE54B_ADR_GRID_RECEIPT_LINEAGE_AUDIT_2026-06-23.md | receipt | active evidence receipt | keep active | - | 0 | 0 | - |
| docs/research/GATE54C_CONTROLLED_NO_WRITE_MATRIX_IDENTITY_RECONSTRUCTION_PROOF_2026-06-23.md | receipt | active evidence receipt | keep active | - | 0 | 0 | - |
| docs/research/GATE54D_LEGACY_SIGNAL_SOURCE_CONTRACT_PROOF_2026-06-23.md | receipt | active evidence receipt | keep active | - | 0 | 0 | - |
| docs/research/GATE54E_LEGACY_SIGNAL_EVALUATION_READINESS_BOUNDARY_2026-06-23.md | receipt | active evidence receipt | keep active | - | 0 | 0 | - |
| docs/research/GATE54F_STANDALONE_SIGNAL_BASELINES_AND_SOURCE_AVAILABILITY_2026-06-23.md | receipt | active evidence receipt | keep active | - | 3 | 1 | - |
| docs/research/GATE54G_COT_WARMUP_CARRY_FORWARD_PROOF_2026-06-23.md | receipt | active evidence receipt | keep active | - | 3 | 1 | - |
| docs/research/GATE54H_CLP_TIE_BREAK_COMPARISON_2026-06-23.md | receipt | active evidence receipt | keep active | - | 3 | 1 | - |
| docs/research/GATE54I_RAW_SIGNAL_REVIEW_PACKET_2026-06-23.md | receipt | active evidence receipt | keep active | - | 2 | 0 | - |
| docs/research/GATE55_STRENGTH_BASELINE_HANDOFF_PROMPT_2026-06-23.md | receipt | active evidence receipt | keep active | - | 0 | 0 | - |
| docs/research/GATE55A_LEGACY_FRIDAY_STRENGTH_DIAGNOSTIC_RECEIPT_2026-06-24.md | receipt | active evidence receipt | keep active | - | 1 | 0 | - |
| docs/research/GATE55B_LOCAL_M1_WARMUP_REPAIR_RECEIPT_2026-06-24.md | receipt | active evidence receipt | keep active | - | 1 | 0 | - |
| docs/research/GATE55B_M1_WARMUP_REPAIR_PLAN_2026-06-24.md | receipt | active evidence receipt | keep active | - | 1 | 0 | - |
| docs/research/GATE55B_STRENGTH_BACKFILL_FEASIBILITY_RECEIPT_2026-06-24.md | receipt | active evidence receipt | keep active | - | 1 | 0 | - |
| docs/research/GATE55B_STRENGTH_SOURCE_FEATURE_CONTRACT_REBUILD_PLAN_2026-06-24.md | receipt | active evidence receipt | keep active | - | 1 | 0 | - |
| docs/research/GATE55B_STRENGTH_SOURCE_OWNER_INVENTORY_2026-06-24.md | receipt | active evidence receipt | keep active | - | 1 | 0 | - |
| docs/research/GATE55C_HOLIDAY_SESSION_STRENGTH_COVERAGE_RULE_2026-06-24.md | receipt | active evidence receipt | keep active | - | 1 | 0 | - |
| docs/research/GATE55D_INSTITUTIONAL_PRICE_TRUTH_BOUNDARY_GAP_2026-06-24.md | receipt | active evidence receipt | keep active | - | 1 | 0 | - |
| docs/research/GATE55E_FROZEN_CANONICAL_PRICE_BUNDLE_V1_RECEIPT_2026-06-24.md | receipt | active evidence receipt | keep active | - | 4 | 2 | - |
| docs/research/GATE55F_CANONICAL_STRENGTH_SOURCE_CONTEXT_PROOF_2026-06-25.md | receipt | active evidence receipt | keep active | - | 1 | 1 | - |
| docs/research/GATE55G_CANONICAL_FRIDAY_STRENGTH_SELECTED_VS_FADE_BASELINE_2026-06-25.md | receipt | active evidence receipt | keep active | - | 1 | 1 | - |
| docs/research/gates/gate55/configs/GATE55H_BLESSED_RESEARCH_COMMANDS_2026-06-25.md | receipt | active evidence receipt | keep active | - | 1 | 0 | - |
| docs/research/gates/gate55/inventory/STRATEGY_TESTER_INVENTORY_2026-06-25.md | report | active evidence receipt | keep active | - | 1 | 0 | - |
| docs/research/gates/gate55/manifests/README.md | report | active evidence receipt | keep active | - | 13 | 1 | - |
| docs/research/gates/gate55/README.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 13 | 1 | - |
| docs/research/gates/gate55/receipts/GATE55H_RESEARCH_WORKFLOW_ARCHITECTURE_CLEANUP_2026-06-25.md | receipt | active evidence receipt | keep active | - | 1 | 0 | - |
| docs/research/gates/gate55/registry/README.md | report | active evidence receipt | keep active | - | 13 | 1 | - |
| docs/research/KATARAKTI_HANDSHAKE_SPEC.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| docs/research/PERFORMANCE_CONSISTENCY_SWEEP_2026-05-30.md | report | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| docs/research/stop-loss-integration-to-limni-system.md | report | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| docs/research/SWEEP_ENTRY_INDIVIDUAL_SPEC.md | report | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| docs/research/SWEEP_VS_HOLD_PARITY_NOTES.md | report | unknown / needs review | needs Freedom review | - | 0 | 0 | - |
| docs/research/WEEKLY_HOLD_ADR_EXIT_RESEARCH_2026-06-02.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 2 | 0 | - |
| docs/research/WEEKLY_HOLD_ENGINE_PARITY_AUDCAD_2026-06-13.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| docs/research/WEEKLY_HOLD_ENGINE_PARITY_EURUSD_2026-06-13.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| docs/research/WEEKLY_HOLD_ENGINE_PARITY_GBPUSD_2026-06-13.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| docs/research/WEEKLY_HOLD_ENGINE_PARITY_NZDUSD_2026-06-13.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| docs/research/WEEKLY_HOLD_ENGINE_PARITY_USDCHF_2026-06-13.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| docs/research/WEEKLY_HOLD_ENGINE_PARITY_USDJPY_2026-06-13.md | report | deprecated but referenced | leave temporarily with deprecation marker | - | 1 | 0 | - |
| docs/testing/BACKTEST_TESTING_STRUCTURE_INVENTORY_2026-06-10.md | report | unknown / needs review | needs Freedom review | - | 0 | 0 | - |

Machine-readable inventory: `LOOSE_ARTIFACT_INVENTORY_2026-06-25.jsonl`.
