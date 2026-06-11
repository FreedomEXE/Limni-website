# Clean14 Snapshot And Engine Comparison - 2026-06-06

Status: compliance note and decision record. No canon regeneration. No release
approval. No 19-week retirement.

## Executive Read

v2.0.2 is the usable app-shell baseline, not the truth baseline.

The current v2.0.3 candidate is expected to produce different and sometimes
worse performance numbers because it is correcting execution truth:

- ADR Grid levels are anchored to the canonical weekly market open while fills
  are delayed until the execution window.
- ADR Grid reset, active fill cap, ambiguity, and path drawdown behavior were
  changed toward the intended verifier contract.
- Non-crypto execution uses Sunday 20:00 New York open, Friday 09:00 New York
  new-entry cutoff, and Friday 11:00 New York force close.
- Crypto execution is intended to run Sunday 20:00 New York to Sunday 20:00
  New York with no Friday stop.

Therefore, this comparison must not be read as "v2.0.2 was better." It is a
distance check between the old usable app and the current truth-repair
candidate.

## Snapshot Regime Evidence

Source report:

- `reports/snapshot-regime-comparison/clean14-sunday-vs-friday-regime-report.md`
- `reports/snapshot-regime-comparison/clean14-sunday-vs-friday-regime-report.json`
- `reports/snapshot-regime-comparison/clean14-sentiment-regime-behavior-audit.md`
- `reports/snapshot-regime-comparison/clean14-sentiment-regime-behavior-audit.json`

Window:

- `2026-02-23T00:00:00.000Z` through `2026-05-24T23:00:00.000Z`
- 14 clean consecutive weeks

Findings:

- Friday 17:00 New York source lock materially changed Strength.
- Total changed pair/source signals: `181`.
- `180` signal changes were Strength.
- `1` signal change was Sentiment: `2026-02-23 EURCAD SHORT -> LONG`.
- Strength numeric/direction deltas: `435 / 504`.
- Standalone source-model performance delta using complete comparison anchor
  `execution_ny_fri9_entry_fri11_close_v1`:
  - Dealer: `0.0000%`
  - Commercial: `0.0000%`
  - Sentiment: `-0.6833%`
  - Strength: `+29.6619%`

Interpretation:

- Friday lock did not hurt Strength in the standalone clean14 source comparison.
- It improved Strength under this evidence basis.
- Friday lock slightly hurt standalone Sentiment in this comparison, but the
  larger Sentiment issue is still evidence provenance.
- This does not prove full ADR Grid / Pair Fill Cap strategy performance.

## Sentiment Red Flag

The corrected Sentiment delta is small, but it is still not release-proof.

The Sentiment behavior audit found:

- Actual app resolver direction changes: `1`.
- Manual DB-literal reconstruction direction changes: `1`.
- Friday raw provider evidence inside the 120-minute cutoff window: `0 / 504`.
- Friday aggregate-derived rows without raw Friday evidence: `504 / 504`.
- Friday used different aggregate rows than Sunday/Monday: `504 / 504`.
- Timestamp boundary shifts after the UTC-literal read fix:
  - legacy/week-open side: `0 / 504`
  - Friday cutoff side: `0 / 504`

Root cause confirmed and patched:

- Live DB columns named `*_utc` are stored as `timestamp without time zone`.
- The DB session is UTC, and `created_at`/`timestamp_utc` evidence showed these
  values should be treated as UTC literals.
- Node `pg` was returning JavaScript `Date` values that could reinterpret those
  UTC literals through the local machine timezone.
- The app now reads the affected Sentiment/source-freeze timestamp columns as
  SQL text and parses them as UTC literals before resolver use.

Live DB schema check on 2026-06-06 confirmed the relevant UTC-named fields are
stored as `timestamp without time zone`, including:

- `sentiment_data.timestamp_utc`
- `sentiment_aggregates.timestamp_utc`
- `sentiment_daily_snapshots.snapshot_time_utc`
- `source_freeze_ledger_weeks.week_open_utc`
- `source_freeze_ledger_weeks.freeze_target_utc`
- `source_freeze_ledger_signals.week_open_utc`
- `source_freeze_ledger_signals.freeze_target_utc`
- `source_freeze_ledger_signals.source_timestamp_utc`

Decision:

- Do not use current Sentiment Friday-vs-Sunday comparison as raw-source release
  proof.
- Do not regenerate canon from clean14 until Sentiment raw-provider evidence
  policy is formally resolved.

2026-06-06 Freedom provisional decision:

- The clean14 Sentiment Friday lock may use the closest complete
  aggregate-derived snapshot before 17:00 New York for provisional comparison.
- In practice this is usually around `16:10` New York, roughly 50 minutes before
  the target lock.
- This is acceptable for near-term clean14 app/strategy comparison because it is
  before the lock and close to the intended snapshot time.
- It must still be labeled `aggregate_derived`, not raw-source proven.
- This decision does not authorize canon regeneration by itself.

2026-06-06 UI receipt correction:

- The Data page snapshot header was still reading shifted persisted ledger and
  provenance timestamps after the Friday-lock migration.
- Live clean14 rebuild logic showed May 25 Sentiment at `16:10` New York and
  Strength at `17:00` New York, but the persisted source-freeze ledger still
  displayed Sentiment `20:10` and Strength `21:00`.
- The remaining UTC paths were patched in:
  - `src/lib/performance/snapshotProvenance.ts`
  - `src/lib/strength/weeklyStrength.ts`
  - `src/lib/sourceFreeze/sourceLedger.ts`
  - `scripts/audit-friday-freeze-source-ledger.ts`
- The clean14 source-freeze ledger was rebuilt only for
  `v2.0.3-clean-14w`. This was not performance canon regeneration and did not
  retire the 19-week baseline.
- Playwright runtime proof on the active dev server for May 25 now shows:
  - Dealer: `Snapshot May 22, 2026, 3:40 PM ET`
  - Sentiment: `Snapshot May 22, 2026, 4:10 PM ET`
  - Strength: `Snapshot May 22, 2026, 5:00 PM ET`
  - no visible `Checking for updates`, no `No tradable pairs yet`, and no
    `No data yet` for those audited Data views.

## Engine Comparison

Scope:

- v2.0.2 baseline: committed `HEAD` `6f3b162`.
- Current candidate: dirty working-tree v2.0.3 evidence state.
- Same clean14 week list.
- Same local database.
- Visible Performance configurations only.

Important comparability failure:

- Current Weekly Hold returned `0` trades for all visible systems because the
  active app execution anchor `execution_ny_crypto_sun20_v2` has `0/14`
  clean14 stored return coverage.
- Weekly Hold must be fixed or pointed at a complete anchor before comparison.

ADR Grid comparison:

| System | Execution | v2.0.2 ADR norm | Current ADR norm | Delta | v2.0.2 raw | Current raw | v2.0.2 Path DD | Current Path DD | Trades v2.0.2 -> Current |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Tandem | ADR Grid | `+496.17%` | `+655.87%` | `+159.70` | `+488.58%` | `+620.27%` | `34.86%` | `172.26%` | `29,533 -> 18,898` |
| Tandem | ADR Grid + Pair Fill Cap | `+437.64%` | `+306.92%` | `-130.72` | `+432.28%` | `+150.16%` | `12.08%` | `78.25%` | `20,159 -> 11,141` |
| Tiered | ADR Grid | `+91.57%` | `+146.94%` | `+55.37` | `+74.76%` | `+105.97%` | `7.45%` | `42.32%` | `3,973 -> 2,387` |
| Tiered | ADR Grid + Pair Fill Cap | `+70.57%` | `+65.21%` | `-5.36` | `+51.61%` | `+14.33%` | `3.12%` | `26.50%` | `2,768 -> 1,428` |
| Agreement | ADR Grid | `+93.53%` | `+130.23%` | `+36.69` | `+69.24%` | `+49.17%` | `9.23%` | `36.76%` | `5,902 -> 3,622` |
| Agreement | ADR Grid + Pair Fill Cap | `+83.47%` | `+49.12%` | `-34.35` | `+65.75%` | `-53.06%` | `4.24%` | `33.29%` | `3,990 -> 2,145` |
| Selector | ADR Grid | `+143.87%` | `+242.09%` | `+98.22` | `+113.86%` | `+125.34%` | `12.73%` | `72.41%` | `9,907 -> 6,586` |
| Selector | ADR Grid + Pair Fill Cap | `+123.21%` | `+52.64%` | `-70.57` | `+85.42%` | `-102.27%` | `5.80%` | `57.59%` | `6,567 -> 3,750` |

Interpretation:

- Current no-cap ADR Grid can show higher returns, but the current path
  drawdown is much worse.
- Current Pair Fill Cap is materially different from v2.0.2 and must be treated
  as untrusted until runtime, stored ledger, UI, and Pine/TradingView reconcile.
- This is consistent with a truth-repair candidate, not proof that v2.0.2 should
  be restored as the data truth.

## Required Next Gate

1. Decide Sentiment evidence policy:
   - Are aggregate-derived Friday rows acceptable without raw provider payload?
   - If yes, under what label and trust level?
   - If no, Friday lock must require raw provider rows inside a cutoff window.
2. Plan the durable timestamp migration:
   - Current compatibility fix reads UTC-named `TIMESTAMP` columns as SQL text
     and parses them as UTC literals.
   - Institutional DB cleanup should migrate these columns to `timestamptz`
     with backup and parity proof, not as an ad hoc live mutation.
3. Confirm execution close wording:
   - current code/docs say Friday 11:00 New York force close for non-crypto,
     i.e. `11 AM` in the existing tests and Pine labels.
   - if the intended policy is Friday 11 PM, code, tests, Pine, and docs are
     currently wrong and must be changed together.
4. Fix current clean14 Weekly Hold anchor coverage before comparing Weekly Hold
   performance.
5. Reconcile ADR Grid + Pair Fill Cap across:
   - `computeWeeklyHold()` runtime,
   - stored execution ledger/shards,
   - visible Performance/Basket UI,
   - Pine/TradingView exported rows.

## Decision

Do not regenerate v33 canon yet.

Use `v2.0.2` as the UX/app-shell reference and `v2.0.3-clean-14w` as a
quarantined evidence lane only. The next trusted baseline must be generated
after Sentiment semantics and Pair Fill Cap reconciliation are resolved.
