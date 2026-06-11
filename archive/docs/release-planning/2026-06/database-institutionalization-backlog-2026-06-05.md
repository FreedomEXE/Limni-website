# Database Institutionalization Backlog - 2026-06-05

Status: deferred backlog. Do not start this track until the Jan/Feb sentiment
and Strength source-readiness blockers are finalized.

## Purpose

Limni is currently strong internal research infrastructure, but the database
governance is not yet institutional grade. This backlog records the upgrade
track for a future database-focused chat so the work is easy to find after
v2.0.3 source repair is complete.

## Current Rating

| Area | Rating | Notes |
|---|---:|---|
| App/research architecture | 7/10 | Canon, strategy artifacts, weekly shards, source gates, and release docs are materially stronger than a normal research notebook. |
| Database/source governance | 5.5/10 | Raw retention, lineage, backup proof, and schema contracts need institutional hardening. |
| Overall platform | 6.5/10 | Strong founder-built research platform; not yet institutional data infrastructure. |

## Why It Is Not Institutional Yet

- Raw sentiment snapshots were allowed to purge after 24 hours.
- Raw source, derived aggregate, canon, research, and execution tables exist but
  are not governed as separate trust layers strongly enough.
- Some critical payloads are JSONB without explicit versioned contracts.
- Backup/restore proof is not part of the release gate.
- Universe expansion is still too implicit and partly hard-coded.
- Retention policy is not documented per table.
- Source lineage is not carried with a durable lineage ID from raw provider row
  through aggregate, weekly lock, canon, and strategy output.
- Experimental/empty tables make the database feel organically grown instead of
  curated.

## Target State

The institutional version of Limni should make every released number traceable:

```text
provider fetch -> raw source archive -> normalized source row -> aggregate/lock
-> weekly canon input -> release canon artifact -> strategy output/trade row
```

Every step should have:

- source provider,
- source timestamp,
- ingest timestamp,
- code/app version,
- schema version,
- lineage ID or parent row references,
- retention rule,
- backup coverage,
- release-gate validation.

## Workstreams

### 1. Raw Source Archive

- Stop deleting irreplaceable raw provider data.
- Add or formalize archive tables for:
  - sentiment raw provider snapshots,
  - CFTC raw/normalized source records,
  - price provider bars,
  - crypto funding/OI/liquidation payloads,
  - news and overlay provider payloads.
- Keep archive retention long enough for release, audit, expansion, and
  backtest horizons.

### 2. Retention Matrix

Create a table-by-table retention policy:

| Layer | Example tables | Policy |
|---|---|---|
| Raw source | `sentiment_data`, provider OHLC, CFTC source payloads | Long-term archive; no short purge unless copied elsewhere first. |
| Normalized source | `cot_snapshots`, `canonical_price_bars` | Long-term, versioned by provider/source contract. |
| Derived source locks | `sentiment_aggregates`, `strength_weekly_snapshots`, `pair_period_returns` | Long-term enough to reproduce release history. |
| Release canon | `releases/v*/canon/*`, `strategy_week_shards` | Immutable per app/engine version. |
| Research cache | `strategy_artifacts`, `strategy_backtest_*` | Retain by research/version policy; can be regenerated if inputs are intact. |
| Execution/live ops | MT5, Bitget bot, trade ledger | Operational retention plus audit retention. |

### 3. Lineage IDs

Add durable lineage/provenance references from:

1. raw provider row,
2. aggregate/normalized row,
3. weekly lock,
4. canon source ledger row,
5. strategy artifact/week shard,
6. final trade/performance output.

### 4. Versioned JSONB Contracts

For JSONB-heavy tables, define payload schema/version fields and tests:

- `cot_snapshots.currencies/pairs`
- `market_snapshots.pairs`
- `performance_snapshots.returns/pair_details/stats`
- `strategy_artifacts.payload_json`
- `strategy_week_shards.week_result_json/path_summary_json/sim_json`
- crypto liquidation heatmap JSON columns

### 5. Backup And Restore Proof

- Document Render backup policy and actual restore procedure.
- Run periodic restore drills into a temporary database.
- Add a release checklist item proving that raw source backup coverage exists
  for the release window.
- Never test recovery by restoring over production.

### 6. Source Manifest For Universe Expansion

Before moving from 36 to 64 instruments, create a manifest with:

- Limni symbol,
- asset class,
- provider aliases,
- COT mapping,
- sentiment provider mapping,
- canonical price provider,
- supported timeframes,
- Strength support,
- first available raw source timestamp,
- readiness status.

### 7. Database Curation

- Separate experimental/empty tables from release-critical tables.
- Add table owner/purpose docs.
- Add indexes and constraints where audit queries depend on uniqueness.
- Make current source-readiness gates fail if required tables are missing,
  empty, stale, or silently downgraded.

## Recommended Sequence

Do this after sentiment and Strength are finalized:

1. Freeze raw sentiment retention/archive immediately.
2. Build the table retention matrix.
3. Add backup/restore proof.
4. Add lineage IDs for sentiment first, then price/Strength/COT.
5. Add versioned JSONB contracts.
6. Add the 64-instrument source manifest.
7. Curate experimental/empty tables and document table ownership.

## Not In Scope Until v2.0.3 Source Repair Is Closed

- Do not redesign the database while the 19-week source gate is still blocked.
- Do not use this backlog as a reason to accept a 12-week baseline.
- Do not mutate historical release canon as part of this backlog.

## Human Breakdown

What changed: this backlog captures the future database institutionalization
track in the v2 release docs.

Why it matters: once Jan/Feb Sentiment is fixed, the next team has a clear path
to harden raw retention, lineage, schema contracts, backup proof, and universe
expansion. Strength was repaired on 2026-06-05.

What passed/failed: no code or database behavior changed in this note.

Next gate: finish Jan/Feb Sentiment source repair first, then start this
database track as its own focused project.
