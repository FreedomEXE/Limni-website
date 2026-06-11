# Friday Freeze And Myfxbook Backfill Decision - 2026-06-05

Status: design memo and research checkpoint. No v33 canon regeneration. No
baseline shrink. No paid Myfxbook assumption.

## Executive Decision

Work that can continue without paid Myfxbook access:

- Keep the 19-week v2.0.3 source gate as the release gate.
- Keep Strength repaired and audited.
- Design the new frozen Friday close source versions.
- Continue raw Sentiment backup/backfill research.
- Use the longest consecutive all-source-trusted sample as the provisional app
  comparison baseline until the Sentiment direction is settled.

Work that must not proceed yet:

- Do not regenerate v33 canon.
- Do not mark Jan/Feb Sentiment trusted from aggregates alone.
- Do not buy or depend on the paid Myfxbook Sentiment Indicator until historical
  exportability and symbol coverage are proven.

## Current Source Gate

Fresh serial command:

```bash
npm run source:completion:release
```

Result:

- Release window: `v2.0.3`
- Baseline: `2026-01-19` through `2026-05-24`
- Universe: `36` pairs
- Rows: `76`
- Failed: `4` untrusted source rows

Source status:

| Source | Status | Notes |
|---|---|---|
| Dealer / COT | trusted | `36/36` for all 19 weeks. |
| Commercial / COT | trusted | `36/36` for all 19 weeks. |
| Strength | trusted | Warmup and Jan 19 index lock repair completed; `36/36` for all 19 weeks. |
| Sentiment | blocked | Fails `2026-01-19`, `2026-01-26`, `2026-02-02`, `2026-02-16`. |

Remaining Sentiment issue:

- `2026-01-19`: late/backfilled aggregate use across the full universe.
- `2026-01-26`: backfilled symbols `NDXUSD`, `NIKKEIUSD`, `SPXUSD`, `WTIUSD`.
- `2026-02-02`: late aggregate for `NDXUSD`, `NIKKEIUSD`, `SPXUSD`, `WTIUSD`.
- `2026-02-16`: late aggregate use across the full universe.

## Provisional Clean App Baseline

The legacy source-timing comparison baseline is:

```bash
npm run source:completion:clean14
```

This maps to release window `v2.0.3-clean-14w`:

- Start: `2026-02-23T00:00:00.000Z`
- End: `2026-05-24T23:00:00.000Z`
- Length: `14` consecutive closed weeks
- Source rows: `56`
- Source state: all Dealer, Commercial, Sentiment, and Strength rows trusted
  under the old/current source timing

Fresh verification on 2026-06-05:

- `npm run source:completion:clean14` passed.
- Rows audited: `56`.
- All rows were `36/36 | ready | trusted=true`.
- The command printed transient DB retry warnings after the pass; source audits
  should continue to run serially.

This legacy clean14 result is useful comparison evidence, but it is not enough
for a Friday-freeze v2.0.3 truth contract.

2026-06-06 update: the clean14 Friday-freeze comparison remains useful, but the
Sentiment portion is more fragile than the earlier pass/fail wording suggests.
The corrected Sentiment behavior audit found `0 / 504` Friday raw provider rows
inside the 120-minute cutoff window, `504 / 504` aggregate-derived Friday rows
without raw Friday evidence, and `1` actual app-resolver direction change
(`2026-02-23 EURCAD SHORT -> LONG`) after UTC-literal timestamp handling was
fixed. Treat Friday Sentiment as aggregate-derived until a formal provenance
policy is approved. A live DB schema check confirmed the Sentiment and
source-freeze UTC-named timestamp columns are currently `timestamp without time
zone`; the app now reads those fields as SQL text and parses them as UTC
literals, but a durable `timestamptz` migration remains future cleanup.

The Friday-freeze comparison baseline is:

```bash
npm run source:freeze:clean14
```

Fresh verification on 2026-06-05:

- `npm run source:freeze:clean14` passed.
- Rows audited: `56`.
- Freeze target: Friday 17:00 `America/New_York` before each weekly execution.
- Dealer and Commercial evidence: `cot_snapshot`.
- Strength evidence: `computed_price_strength`.
- Sentiment evidence: `aggregate_derived`.
- Every Sentiment row also reports `raw_provider_evidence_missing:0/36`.

Interpretation: the 14-week window is Friday-freeze clean for a derived
aggregate Sentiment baseline. It is not raw-Myfxbook-source clean.

Policy:

- This is the current clean app comparison sample only when labeled as
  Friday-freeze, aggregate-derived Sentiment.
- It is better than the 12-week March-only subset because it preserves the
  longest consecutive trusted source history.
- It is not full v2.0.3 release approval.
- It is not v33 canon authority.
- It can be used for provisional app-number comparisons and near-term
  optimization research while the Jan/Feb raw Sentiment backfill question
  remains open.
- Any report using this sample must label it `v2.0.3-clean-14w`.
- Any report using the Friday-freeze version must also label Sentiment evidence
  as `aggregate_derived`, not raw Myfxbook.
- Do not claim Friday-vs-Sunday Sentiment is raw-source proven; the current
  comparison is aggregate-derived and shows one clean14 direction change.

## Friday Freeze Architecture

### Source Versions

New source versions:

| Source | Version | Lock target |
|---|---|---|
| Sentiment | `sentiment_friday_close_v1` | Friday 17:00 `America/New_York` before Sunday execution. |
| Strength | `strength_friday_close_v1` | Friday 17:00 `America/New_York` before Sunday execution. |

COT remains as-is unless a real defect is found. COT normally arrives Friday
afternoon before the Sunday switch, so the source freeze can reference the
selected `cot_snapshots` report without changing the COT model.

### Time Rule

Use `America/New_York`, never fixed EST.

For a Sunday weekly execution basket, derive the preceding Friday at 17:00 in
New York local time and convert that exact local timestamp to UTC. This handles
DST:

- During EDT, Friday 17:00 New York is `21:00 UTC`.
- During EST, Friday 17:00 New York is `22:00 UTC`.

Collection may run shortly after the target timestamp, but the source timestamp
recorded on the lock is the Friday close target. Collection timestamps should be
stored separately as operational metadata.

### Data Contract

Preferred additive design: add versioned weekly source lock tables instead of
overloading the current week-open lock behavior.

Minimum lock header:

```text
week_open_utc
source_family              -- sentiment | strength
source_version             -- sentiment_friday_close_v1 | strength_friday_close_v1
source_target_utc          -- Friday 17:00 NY converted to UTC
source_target_zone         -- America/New_York
collection_started_utc
collection_completed_utc
status                     -- complete | partial | failed
expected_symbols
resolved_symbols
trusted
incidents_json
source_hash
created_at_utc
updated_at_utc
```

Sentiment detail rows should include:

```text
week_open_utc
source_version
symbol
provider
long_pct
short_pct
net
ratio
raw_payload
provider_snapshot_utc
source_target_utc
confidence_score
crowding_state
flip_state
```

Strength detail rows should include:

```text
week_open_utc
source_version
source_type                -- currency | asset
window                     -- 1h | 4h | 24h
key                        -- currency or asset key
asset_class
raw_strength
normalized_strength
source_snapshot_utc
source_target_utc
```

### Sunday Basket Rule

Sunday execution must read only frozen Friday locks:

- Sentiment resolver reads `sentiment_friday_close_v1` rows for the target
  `week_open_utc`.
- Strength resolver reads `strength_friday_close_v1` rows for the target
  `week_open_utc`.
- If a Friday lock is missing or partial, the basket must show source-readiness
  incidents. It must not silently recompute from live Sunday data.
- Live Sunday recalculation can exist for diagnostics only, with a different
  source label. It cannot feed trusted weekly basket generation.

### Operational Schedule

Recommended cron:

- Friday 17:05 America/New_York: collect and lock Sentiment and Strength.
- Friday 17:20 America/New_York: retry incomplete symbols.
- Saturday 08:00 UTC: audit frozen locks and alert if partial.
- Sunday before execution: verify frozen lock presence only; do not recompute.

### Test Requirements

Add focused tests before implementation is trusted:

- DST conversion: a January Friday maps to `22:00 UTC`, a June Friday maps to
  `21:00 UTC`.
- Sunday resolver refuses to use live Sunday rows when a Friday lock is missing.
- Complete Friday lock produces `36/36` Sentiment and `36/36` Strength rows.
- Partial Friday lock is visible in source-readiness audit output.
- COT behavior is unchanged unless a COT-specific issue is discovered.

## Myfxbook Historical Backfill Research

### Evidence Found

Official Myfxbook Sentiment Indicator page:

- Paid monthly plan currently shows `$50/month`.
- It says all community sentiment symbols are available in MT4/MT5.
- It says the paid indicator can load available sentiment data up to `10,000`
  data points per timeframe, while the website is limited to `1,000`.
- It says live data updates every 15 seconds.
- It says weekly and monthly timeframes are included.
- It links a paid API tier for sentiment data with up to `2,880` requests per
  24 hours.

Source: https://www.myfxbook.com/outlook-indicator

Official Myfxbook API page:

- `get-community-outlook` exists.
- Free community outlook is limited to `100` requests per 24 hours.
- Paid community outlook is listed at roughly `2,800` to `2,880` requests per
  24 hours depending on page wording.
- The documented API method shown publicly returns current sentiment fields
  such as long/short percentages, volume, positions, and average long/short
  prices.
- The public API page does not show a historical timestamp/date parameter for
  `get-community-outlook`.

Source: https://www.myfxbook.com/api

Public Myfxbook community Outlook page:

- Public symbol list clearly includes many FX pairs plus metals, including
  `XAGUSD` and `XAUUSD`.
- The public symbol list inspected does not clearly include `BTCUSD`, `ETHUSD`,
  `SPXUSD`, `NDXUSD`, `NIKKEIUSD`, or `WTIUSD`.

Source: https://www.myfxbook.com/community/outlook

Live Limni DB check:

- Current `sentiment_data` rows from provider `MYFXBOOK` cover all current 36
  Limni symbols, including `BTCUSD`, `ETHUSD`, `SPXUSD`, `NDXUSD`,
  `NIKKEIUSD`, `WTIUSD`, `XAUUSD`, and `XAGUSD`.
- This proves current live collection can see all 36 through the configured app
  path.
- It does not prove the paid indicator exposes historical Jan/Feb values for
  all 36.

Community / technical evidence:

- A Myfxbook forum user asked about downloading historical SSI data for
  backtesting and said the API did not appear to provide it; they were trying to
  scrape values from the MT4 indicator buffer.
- A separate MQL5 forum post reports difficulty using `iCustom()` against a
  Myfxbook sentiment indicator, with not all values returned.
- MQL itself supports indicator-buffer access in principle: MT4 custom
  indicators expose buffers via `SetIndexBuffer`, MT4 can call custom
  indicators with `iCustom`, and MT5 can copy indicator-buffer data with
  `CopyBuffer`.

Sources:

- https://www.myfxbook.com/community/programming/getting-historical-sentiment-data/3108384,1
- https://www.mql5.com/en/forum/429056
- https://docs.mql4.com/customind/setindexbuffer
- https://docs.mql4.com/indicators/icustom
- https://www.mql5.com/en/docs/series/copybuffer

### What Is Not Proven

The paid indicator is not yet proven to satisfy Limni's release repair need.

Unproven items:

- Whether `10,000 data points per timeframe` are available to automation, not
  only to chart rendering.
- Whether MT4/MT5 buffers expose all required values, with stable buffer indexes.
- Whether weekly/monthly historical values can be exported to CSV or read by an
  EA/script.
- Whether Jan/Feb 2026 data is included for every current Limni symbol.
- Whether `BTCUSD`, `ETHUSD`, `SPXUSD`, `NDXUSD`, `NIKKEIUSD`, and `WTIUSD`
  are covered historically in the paid indicator, despite current live app
  coverage.
- Whether paid API access includes historical Outlook data or only higher-rate
  current Outlook calls.

## Recommendation

Do not spend the $50 yet.

Best next action:

1. Ask Myfxbook support for explicit confirmation:
   - Can paid Sentiment Indicator historical weekly data be exported
     programmatically?
   - Are values accessible through MT4 `iCustom()` or MT5 `CopyBuffer()`?
   - What are the buffer indexes and value meanings?
   - Does the paid product cover all 36 Limni symbols historically?
   - Can it export Jan/Feb 2026 timestamps specifically?
2. Search for a public MQL export script or a user who has successfully exported
   the paid Outlook indicator history.
3. If support confirms exportability, buy one month and run a controlled proof:
   - export one FX pair,
   - export one metal,
   - export one crypto,
   - export one index,
   - verify Jan/Feb weekly timestamps,
   - only then build the full importer.

## Decision Memo

What can be finished now without paid Myfxbook access:

- Strength source readiness is already finished.
- COT readiness remains clean.
- Future raw Sentiment retention is fixed.
- Friday-close freeze architecture can be implemented and tested for future
  weeks.

Is Strength 100% ready:

- Yes for the current 19-week source-readiness gate. The serial release gate now
  reports Strength `ready | trusted=true` for all 19 weeks.

Is COT still 100% ready:

- Yes for Dealer and Commercial in the current 19-week source-readiness gate.

What evidence exists for Myfxbook historical backfill:

- Official paid page strongly suggests historical sentiment data exists in the
  paid indicator.
- Official API page proves a paid higher-rate current Outlook endpoint exists.
- MQL platform docs prove indicator buffers can be read in principle.
- Community posts show other users tried this exact historical/backtesting
  problem, but they do not prove success.

What remains uncertain before Freedom spends $50:

- Historical exportability.
- Buffer names/indexes.
- Jan/Feb 2026 timestamp availability.
- Full 36-symbol historical coverage, especially crypto, indices, and WTI.

Recommended next action:

- Get hard confirmation from Myfxbook support or a working MQL export example
  before buying. Keep v33 blocked until raw Jan/Feb Sentiment evidence is found
  and the serial `npm run source:completion:release` gate reports all 76 rows
  trusted.

## Human Breakdown

What changed: this memo separates finished independent work from the paid
Myfxbook uncertainty and defines the Friday-close frozen source architecture.

Why it matters: the team can build future-safe source locks without pretending
the paid indicator solves the historical Jan/Feb blocker.

What passed/failed: Strength, Dealer, and Commercial pass the 19-week release
gate. Sentiment still fails 4 Jan/Feb rows.

Next gate: prove Myfxbook historical exportability and 36-symbol coverage before
spending money or building an importer.
