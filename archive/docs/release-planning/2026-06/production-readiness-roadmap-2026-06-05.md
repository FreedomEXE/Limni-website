# Production Readiness Roadmap - 2026-06-05

Status: living roadmap. Update this as gates close, blockers appear, or Freedom
changes the operating policy.

## Purpose

Limni's end goal is not endless research. The end goal is a verified system that
can trade accounts automatically with boring, observable, recoverable behavior.

This roadmap separates the work needed to reach that point from future research
ideas. Once a system passes the production gates, optimization should move to a
separate research track so production does not get buried by constant strategy
changes.

## Current Operating Principle

```text
Verify the machine before tuning the machine.
```

No automation with real money until source truth, execution semantics, metrics,
database/codebase risk, UI truthfulness, and broker reconciliation are proven.

## Phase 0 - Source Truth And Clean Baseline

Goal: the app only presents weeks whose source inputs are trusted.

- [x] Dealer/COT trusted across the 19-week source window.
- [x] Commercial/COT trusted across the 19-week source window.
- [x] Strength repaired and trusted across the 19-week source window.
- [x] Raw sentiment retention fixed for future snapshots.
- [ ] Identify the longest consecutive all-source trusted Myfxbook window.
- [ ] Mark the old 19-week full-composite baseline as deprecated/source-incomplete.
- [ ] Promote the longest consecutive clean window as the provisional app
      comparison baseline.
- [ ] Keep the 19-week COT/Strength truth separate from the full-composite truth.
- [ ] Do not regenerate official canon until Freedom approves the clean-window
      policy.

Key docs:

- `source-readiness-gap-investigation-2026-06-05.md`
- `source-data-inventory-2026-06-05.md`
- `friday-freeze-and-myfxbook-backfill-decision-2026-06-05.md`

## Phase 1 - Friday Freeze Semantics

Goal: live and backtest systems consume the same frozen weekly inputs.

- [ ] Define source versions for Friday locks, for example:
      `sentiment_friday_close_v1` and `strength_friday_close_v1`.
- [ ] Lock source timestamp semantics to Friday `17:00 America/New_York`, not
      fixed EST.
- [ ] Make Sunday execution read frozen Friday locks only.
- [ ] Prevent live Sunday recalculation from changing weekly basket generation.
- [ ] Document late/missing Friday lock behavior.
- [ ] Add audit output showing each source lock timestamp and provider/source
      timestamp.

## Phase 2 - Execution Truth Gate

Goal: prove the reported strategy behavior is real before optimizing further.

- [ ] Verify ADR Grid entry triggers.
- [ ] Verify fill sequencing.
- [ ] Verify pair fill cap behavior.
- [ ] Verify reset/re-arm behavior.
- [ ] Verify TP/SL and early-close behavior.
- [ ] Verify ADR-normalized return math against actual fill behavior.
- [ ] Verify drawdown/MAE from path data, not summary shortcuts.
- [ ] Reconcile visible UI rows, stored ledger rows, canonical engine output,
      and independent verifier output.
- [ ] Resolve or formally classify every TradingView/Pine mismatch.
- [ ] Include spread/cost/slippage assumptions in candidate metrics.

Automation is blocked until this gate passes.

## Phase 3 - Metric Truth And Candidate Freeze

Goal: decide whether an existing system is good enough to freeze for production.

Candidate thresholds:

- [ ] Weekly win rate is at least 80% on the approved clean window.
- [ ] Profit factor is at least 3.0 after realistic costs.
- [ ] Return-to-drawdown ratio is acceptable for target account sizing.
- [ ] No single week explains most of the profit.
- [ ] No single pair explains most of the profit.
- [ ] Trade count is sufficient for the stated confidence level.
- [ ] Weekly results are reproduced by canonical app and independent script.
- [ ] Freedom approves the system as a production candidate.

Once a candidate passes, split work into:

- Production track: bug fixes, reliability, monitoring, broker execution, risk.
- Research track: new sentiment, new universe, parameter experiments.

## Phase 4 - Database Institutionalization

Goal: make source/data storage durable enough for unattended trading.

- [ ] Complete raw source retention matrix.
- [ ] Prove backup/restore into a temporary database.
- [ ] Add lineage IDs or parent references from raw source through canon/trades.
- [ ] Version JSONB payload contracts.
- [ ] Separate raw source, normalized source, derived lock, canon, research, and
      execution tables in docs and gates.
- [ ] Define table ownership and mutation paths.
- [ ] Add source manifest for 36-symbol and future 64-symbol universes.
- [ ] Make release gates fail on missing/stale/empty critical source tables.

Key doc:

- `database-institutionalization-backlog-2026-06-05.md`

## Phase 5 - Codebase Architecture Audit

Goal: turn discovery code into production-reviewed infrastructure.

- [ ] Map active production-critical modules.
- [ ] Map derived/research-only modules.
- [ ] Map legacy/dead/quarantined modules.
- [ ] Identify duplicate calculation paths.
- [ ] Identify all scripts/routes that mutate DB, canon, artifacts, or trades.
- [ ] Identify source-of-truth modules for source data, weekly returns, baskets,
      path engine, ledger, and strategy artifacts.
- [ ] Rank code risks by "could this create wrong trades or wrong money
      numbers?"
- [ ] Create a hardening backlog from the audit before large refactors.
- [ ] Refactor only where reliability, verification, or automation requires it.

## Phase 6 - UI And Frontend Truthfulness

Goal: the frontend should display verified truth, not derive or hide it.

- [ ] Audit active UI surfaces with source-reference search and Playwright.
- [ ] Remove or quarantine legacy duplicate controls.
- [ ] Confirm Performance, Basket, Simulation, Sidebar, Status, Documents, and
      Accounts all read the approved data contracts.
- [ ] Ensure UI components do not recompute canonical metrics independently.
- [ ] Ensure current-week, clean-window, deprecated-window, stale-canon, and
      closing-pending states are visually distinct.
- [ ] Add UI diagnostics for source window, freeze timestamp, canon version,
      artifact status, and active strategy identity.
- [ ] Verify mobile/desktop layouts for production-critical pages.
- [ ] Keep research UI separate from production candidate/execution UI.

## Phase 7 - Automation Readiness

Goal: prove the broker/execution machine can reproduce the frozen candidate.

- [ ] Define MT5/broker execution contract from the approved strategy.
- [ ] Implement order sizing from account/risk rules.
- [ ] Add hard risk limits outside strategy logic.
- [ ] Add manual kill switch.
- [ ] Add automated kill conditions.
- [ ] Add broker reconciliation: expected app positions vs actual broker
      positions.
- [ ] Add immutable execution logs with event IDs.
- [ ] Add dry-run mode that produces the same intended orders without placing
      them.
- [ ] Add paper/shadow execution.
- [ ] Add tiny live execution before scale.
- [ ] Define escalation and recovery procedure for failed broker/API/DB events.

## Phase 8 - Operations And Deployment

Goal: production can be monitored, rolled back, and recovered.

- [ ] Define deployment checklist.
- [ ] Define rollback path.
- [ ] Add monitoring and alerts for source collection, release gates, broker
      state, DB writes, and automation status.
- [ ] Add weekly runbook: Friday freeze, weekend review, Sunday execution, week
      close reconciliation.
- [ ] Add incident runbook.
- [ ] Add post-week review template.
- [ ] Keep production version changes explicit and auditable.

## Phase 9 - Future Research Track

Goal: improve without contaminating production.

- [ ] Prototype COT-derived sentiment.
- [ ] Test Myfxbook-only, COT-only, and Myfxbook+COT sentiment.
- [ ] Test OANDA/EODHD sentiment coverage when verified.
- [ ] Test dropping sentiment entirely and using three-source systems.
- [ ] Re-evaluate Commercial: include, exclude, invert, reweight, or use as
      regime context.
- [ ] Expand source manifest toward the 64-instrument universe.
- [ ] Compare new systems only against approved clean baselines.

Key doc:

- `cot-sentiment-proxy-research-2026-06-05.md`

## Do Not Do

- Do not automate real accounts from an unverified UI number.
- Do not regenerate official canon from source-incomplete windows.
- Do not let research changes mutate the frozen production candidate.
- Do not accept a non-consecutive clean baseline when a longer consecutive clean
  baseline can be proven.
- Do not let a profitable strategy hide database, codebase, UI, or broker
  execution fragility.

## Human Breakdown

What changed: this roadmap captures the path from current source cleanup to
verified automation, including database, codebase, and UI hardening.

Why it matters: Limni now has a checklist for when to stop researching, freeze a
candidate, harden the machine, and move toward account automation.

What passed/failed: this is a planning document only; no code, database rows, or
canon artifacts changed.

Next gate: finish the clean consecutive baseline/source-truth decision, then
work execution truth before any automation push.
