# Cleanup Ledger

No file moves or deletions happen in this document. This ledger only classifies
paths for later approval.

Last inventory: 2026-06-09.

Inventory command: `git status --short --untracked-files=all`.

Observed dirty tree:

- 59 modified tracked paths
- 219 untracked paths
- 278 dirty paths total
- largest buckets: `releases/` 178, `scripts/` 53, `reports/` 21,
  `docs/` 20

Gate 2 decision: classify only. Do not stage, move, delete, regenerate release
canon, or change app behavior from this ledger.

## Freeze

| Path | Reason |
|---|---|
| `releases/v2/canon/*.json` | Release canon is frozen until an explicit canon-regeneration gate is approved. |
| `release-manifest.json` | Not dirty in this inventory; keep frozen until the versioning/live-dev gate. |
| `src/**` | Not dirty in this inventory; app code is outside Gate 2. |

## Keep

| Path | Reason |
|---|---|
| `AGENTS.md` | Repo manifest now points to process docs, chat recovery, Gate discipline, and Limni/Poseidon profile. |
| `docs/process/*.md` | New operating rulebook, project profile, release template, and this cleanup ledger. |
| `docs/testing/APP_PARITY_TESTING.md` | Durable app-parity testing protocol; should remain linked from README/test catalog. |
| `docs/trading/ADR_GRID_CANONICAL_WEEKLY_ANCHOR.md` | Durable trading source-of-truth note, not a temporary handoff. |
| `docs/data-verification/*.md` | Durable verification workflow/spec material for App vs TradingView parity. |
| `README.md` | Adds pointer to app-parity testing and focused Performance regression command. |
| `reports/TEST_CATALOG.md` | Adds pointer that test catalog is not current dashboard truth. |
| `check-schema.js`, `query-market-state.js`, `scripts/adr-debug.js`, `scripts/asset-class-breakdown.js`, `scripts/check-diagnostics.mjs`, `scripts/check-sentiment*.js`, `scripts/day-analysis.js`, `scripts/losers-by-day.js`, `scripts/m5-parity-test*.js` | Security cleanup: hardcoded database URL replaced with `process.env.DATABASE_URL`; keep, but commit separately from release docs. |
| `scripts/analyze-katarakti*.ts`, `scripts/backfill-v3-performance.ts`, `scripts/backtest-universal-v3-report.ts`, `scripts/basket-drawdown-from-snapshots.ts`, `scripts/compare-*.ts`, `scripts/eightcap-*.ts`, `scripts/fiveers-*.ts`, `scripts/individual-basket-performance.ts`, `scripts/katarakti-phase1-backtest.ts`, `scripts/refresh-v2-snapshots.ts`, `scripts/verify-v2-fix.ts` | Security cleanup on tracked research/backtest scripts; keep the credential removal, then decide later whether these scripts belong in `scripts/`, `research/`, or archive. |
| `scripts/notify-complete-modern.ps1`, `scripts/notify-response.ps1` | Voice reliability and Codex/Ryan default updates; keep as tooling if voice scripts remain supported. |
| `scripts/pinescript/limni-adr-verifier.pine` | TradingView verifier tool; keep as verification tooling unless a later verification-tooling gate replaces it. |
| `scripts/verification/*.ts` | App/indicator verification exporters and inspectors; keep as verification tooling pending script organization. |

## Move

| Current Path | Target Path | Reason |
|---|---|---|
| `docs/TODO.md` research/backlog additions | `docs/research/` or a future `docs/backlog/` target | `docs/TODO.md` is becoming a junk drawer; keep durable items, but move them into named docs. |
| `docs/handoffs/*.md` stale handoffs | `docs/archive/handoffs/2026-06/` | v2.0.3 has shipped; handoffs should not remain active truth unless specifically re-opened. |
| `docs/handoffs/V2_0_2_TO_DATA_VERIFICATION_HANDOFF.md` new appended verification state | Extract durable content to `docs/data-verification/` or archive with the handoff | Active decisions belong in durable verification docs or session, not old v2.0.2 handoff appendices. |
| `releases/v2/screenshots/data/*`, `releases/v2/screenshots/performance/*`, `releases/v2/screenshots/status/*` | Future normalized release package screenshot folders | Loose page folders should be grouped under the release-template structure when release docs are normalized. |
| `scripts/adr-grid-weekly-anchor-ab.ts`, `scripts/backtest-adr-grid-runner-refill.ts`, `scripts/backtest-weekly-hold-adr-exits.ts`, `scripts/audit-clean14-sentiment-regime.ts`, `scripts/compare-snapshot-regimes.ts`, `scripts/report-corrected-path-metrics.ts` | `research/scripts/` or `scripts/research/` | Research-only scripts should not read like production tooling. Target folder should be approved before moving. |
| `reports/snapshot-regime-comparison/*.md` | `docs/research/` if decision-grade; otherwise archive | These are research reports, not active runtime truth. |

## Archive

| Path | Target Archive | Reason |
|---|---|---|
| `.claude/AGENTS.md`, `.claude/CLAUDE.md` after migrating any useful rules | `docs/archive/agent-notes/` or keep as legacy agent-local docs | These are legacy Claude/Nyx agent files and should not become Limni's active operating rulebook. |
| `releases/v2/*.md` that are backlog/roadmap/research rather than release evidence | Future `docs/archive/release-planning/2026-06/` or `docs/research/` | `releases/` should hold release history/evidence, not a mixed planning notebook. |
| `reports/data-verification/**/*.csv` after promotion decision | `docs/archive/reports/2026-06/` or external evidence storage | Generated CSV exports are evidence only if tied to a named release/gate. |

## Ignore

| Path or Pattern | Reason |
|---|---|
| `*.log` under generated evidence folders | Runtime logs should normally stay out unless an evidence README explicitly references them. |
| ad hoc report CSVs under `reports/` | Generated outputs should be reproducible or promoted deliberately, not committed by default. |

## Delete Candidates

| Path | Reason | Approval |
|---|---|---|
| `releases/v2/screenshots/selected-ledger-metrics-2026-06-09/devserver-3011.*.log` | Dev-server logs are usually transient noise; keep only if referenced as evidence. | Pending Freedom approval after evidence README check. |
| `releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/next-dev-*.log`, `releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/next-start-*.log` | Dev/start logs are usually transient noise; keep only if needed for weekly rollover evidence. | Pending Freedom approval after evidence README check. |
| `reports/data-verification/tmp-eurjpy-week/*` | Path name marks it temporary; likely delete after confirming no durable evidence dependency. | Pending Freedom approval. |
| Duplicate unscoped CSVs in `reports/data-verification/app/*` if dated containment exports supersede them | Unscoped generated files are harder to trust than dated evidence folders. | Pending Freedom approval after comparison. |

## Needs Review

| Path | Question |
|---|---|
| `scripts/migrate-trades-to-unified-ledger.ts` | Production-sensitive DB migration change adds deletion/replacement logic and filters; requires a dedicated DB migration review gate before commit. |
| `scripts/notify-complete.ps1` | Git reports it dirty but no substantive diff appeared in the sampled diff; likely line-ending or metadata noise. Confirm before commit. |
| `releases/v2/clean14-snapshot-and-engine-comparison-2026-06-06.md` | Is this official release evidence, research support, or backlog context? |
| `releases/v2/cot-sentiment-proxy-research-2026-06-05.md` | Research doc; decide whether it belongs under `docs/research/` instead of `releases/`. |
| `releases/v2/database-institutionalization-backlog-2026-06-05.md` | Backlog doc; decide durable target before commit. |
| `releases/v2/friday-freeze-and-myfxbook-backfill-decision-2026-06-05.md` | Could be release decision evidence; decide whether to keep in release package or move to architecture/research. |
| `releases/v2/production-readiness-roadmap-2026-06-05.md` | Roadmap doc; likely not release evidence. |
| `releases/v2/source-data-inventory-2026-06-05.md` | Could be release evidence or durable source inventory; choose one owner. |
| `releases/v2/source-readiness-gap-investigation-2026-06-05.md` | Could be release evidence or research; choose one owner. |
| `releases/v2/strategy-execution-audit-2026-06-05.md` | Could be release evidence or durable audit; choose one owner. |
| `releases/v2/screenshots/**` | Keep evidence, but decide whether to normalize into `releases/v2/v2.0.3/screenshots/...` before the next release docs commit. |
| `scripts/db-probe.ts` | Probe utility; decide whether to keep under `scripts/verification/`, archive, or delete. |
| tracked research/backtest scripts under `scripts/` | Decide which are durable tooling versus research archive after security cleanup is committed. |
| `.claude/*` tracked files | Decide whether this repo should keep legacy Claude/Nyx files or rely on top-level `freedom-ops` memory plus `AGENTS.md`. |

## Recommended Commit Groups

1. Repo workflow control:
   `AGENTS.md`, `docs/process/*.md`.
2. App parity and verification docs:
   `README.md`, `docs/testing/APP_PARITY_TESTING.md`,
   `docs/trading/ADR_GRID_CANONICAL_WEEKLY_ANCHOR.md`,
   `docs/data-verification/*.md`, `reports/TEST_CATALOG.md`.
3. Security scrub:
   tracked root DB probes and tracked `scripts/*` files that only remove
   hardcoded database URLs or switch to `process.env.DATABASE_URL`.
4. Voice/tooling reliability:
   `scripts/notify-complete-modern.ps1`, `scripts/notify-response.ps1`, and any
   approved `.claude/*` legacy voice notes.
5. Release evidence:
   approved `releases/v2/screenshots/**` evidence folders and release evidence
   docs only after deciding the normalized release package target.
6. Research/backlog archive:
   research scripts, `docs/TODO.md` extracted items, stale handoffs, and generated
   reports after move/archive targets are approved.
7. DB migration review:
   `scripts/migrate-trades-to-unified-ledger.ts` only after a dedicated DB safety
   gate.

## Final Gate Commands Before Any Commit Or Push

Run the smallest command set that matches the commit group:

```powershell
git status --short --untracked-files=all
git diff --check -- . ':!releases/v2/canon/*.json'
rg -l "limni_db_user|dpg-" . -g '!node_modules' -g '!docs/process/CLEANUP_LEDGER.md' -g '!*.png' -g '!*.jpg' -g '!*.jpeg' -g '!*.mp3' -g '!*.zip'
```

For docs-only commits:

```powershell
git diff --name-only --cached
```

For script/security commits:

```powershell
npm run lint
npm test
```

For app/UI/versioning commits later:

```powershell
npm run lint
npm test
npm run build
```

Use Playwright evidence for browser behavior changes. Do not use these cleanup
classifications as proof that app behavior is correct.
