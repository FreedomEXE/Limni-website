# Source Readiness Gap Investigation - 2026-06-05

Status: original blocker investigation plus 2026-06-05 repair update.

Companion inventory: `source-data-inventory-2026-06-05.md` records the live
database stores, local salvage files, sentiment retention root cause, and
recommended next repair gates.

## Scope

Read-only investigation of the remaining `npm run source:completion:release`
blocker after command-layer hardening. The release gate remains the active
19-week baseline: `2026-01-19` through `2026-05-24`.

Do not regenerate v33 canon until the serial release gate reports all `76` rows
trusted.

## Current Release Gate Result

Original finding: `npm run source:completion:release` failed strict mode with
`8` untrusted rows:

- Sentiment: `2026-01-19`, `2026-01-26`, `2026-02-02`, `2026-02-16`
- Strength: `2026-01-19`, `2026-01-26`, `2026-02-02`, `2026-02-09`

2026-06-05 repair update: Strength has been repaired and now passes the full
19-week release gate. The serial release gate still fails with `4` untrusted
Sentiment rows for `2026-01-19`, `2026-01-26`, `2026-02-02`, and
`2026-02-16`.

## Sentiment Findings

The bad sentiment weeks are not repairable from the current stored raw
sentiment source tables.

Read-only probe of `sentiment_data` before the bad week opens:

| Week | Raw symbols before week open | Result |
|---|---:|---|
| `2026-01-19` | `0/36` | no raw provider rows |
| `2026-01-26` | `0/36` | no raw provider rows |
| `2026-02-02` | `0/36` | no raw provider rows |
| `2026-02-16` | `0/36` | no raw provider rows |

Read-only probe of `sentiment_aggregates` showed:

- `2026-01-19`: `0/36` proper aggregates before week open; first late aggregate appeared `2026-01-24`.
- `2026-01-26`: `32/36` proper aggregates; missing `NDXUSD`, `NIKKEIUSD`, `SPXUSD`, `WTIUSD`.
- `2026-02-02`: `32/36` proper aggregates; missing `NDXUSD`, `NIKKEIUSD`, `SPXUSD`, `WTIUSD`.
- `2026-02-16`: `0/36` proper aggregates before week open; first late aggregate appeared `2026-02-18`.

Do not copy late aggregates backward to make the audit pass. That would create
trusted-looking rows without trusted source history.

Allowed repair path:

- Import or reconstruct historical raw sentiment provider rows from an external
  archival source with timestamps at or before the relevant week opens.
- Rebuild `sentiment_aggregates` from those raw rows.
- Rerun `npm run source:completion:release` serially.

## Strength Findings And Repair

The bad Strength weeks originally failed because the active baseline started
before the four-week Strength lookback was fully warm.

Read-only probe of stored canonical weekly returns:

| Week | Prior canonical weekly return rows | Prior weeks present |
|---|---:|---:|
| `2026-01-19` | `0/144` | `0/4` |
| `2026-01-26` | `36/144` | `1/4` |
| `2026-02-02` | `72/144` | `2/4` |
| `2026-02-09` | `108/144` | `3/4` |
| `2026-02-16` | `144/144` | `4/4` |

Read-only probe of `canonical_price_bars` for the required pre-baseline warmup
weeks showed:

| Warmup window | Stored canonical 1h symbols |
|---|---:|
| `2025-12-22` -> `2025-12-29` | `0/36` |
| `2025-12-29` -> `2026-01-05` | `0/36` |
| `2026-01-05` -> `2026-01-12` | `0/36` |
| `2026-01-12` -> `2026-01-19` | `36/36` |

Do not satisfy Strength readiness by accepting provider fallback rows as trusted
release data. The release gate requires stored canonical prior returns.

Completed repair:

- Added explicit warmup-week support to the canonical hourly backfill path.
- Backfilled OANDA/Bitget canonical hourly bars for `2025-12-22`,
  `2025-12-29`, `2026-01-05`, and `2026-01-12`.
- Rebuilt stored weekly `pair_period_returns` for those weeks:
  `144` canonical and `144` execution rows, `missing=[]`.
- Computed and locked the missing Jan 19 index Strength rows:
  SPX, NDX, and NIKKEI across 1h/4h/24h.
- Reran `npm run source:completion:release` serially; all Strength rows are now
  `ready | trusted=true`.

## Process Guardrail

Run source-readiness audits serially. Parallel DB-heavy audit runs can produce
false Strength failures.

## Verdict

The remaining blocker is real raw Sentiment source-data absence, not
command-layer wording. Jan/Feb Sentiment cannot be honestly marked
source-trusted from the current DB state.
