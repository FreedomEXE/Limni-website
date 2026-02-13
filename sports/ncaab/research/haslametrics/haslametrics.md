# Haslametrics Extraction Notes (NCAAB OVR v1)

## Source + Variant
- Base source page: `https://haslametrics.com/ratings.php`
- Data file used: `ratings.xml` (time-dependent model payload)
- Variant recorded in backtest: `TD_ratings.xml_wayback_snapshot_formula`

## Why This Variant
- `ratingsTI*.xml` was easy to parse but not reliably archived at useful historical density.
- `ratings.xml` had many Wayback snapshots, enabling pre-tip snapshot selection.
- The payload is Brotli-compressed (`Content-Encoding: br`) and must be decoded before XML parsing.

## Historical No-Lookahead Method
1. Pull Wayback CDX index for `haslametrics.com/ratings.xml*`.
2. Deduplicate to latest capture per day.
3. For each game, select the latest snapshot timestamp `<=` game tip timestamp.
4. Compute projected team scores from snapshot attributes using Haslametrics' own page formula (`refreshThisUpcomingGame` logic from the live page script).
5. `HM_total = HM_home_points + HM_away_points`.

## Fields Used From XML
- Team-level (`mr`): offensive/defensive possession and shot profile fields (including `ou`, `du`, `ftpct`, and `*b/*sc/*sd` shot-component fields).
- Global averages (`av`).
- Home/away adjustments (`ha`).

## Endpoints / Selectors
- Wayback CDX:
  - `https://web.archive.org/cdx/search/cdx?url=haslametrics.com/ratings.xml*&output=json&fl=timestamp,original,statuscode&filter=statuscode:200`
- Wayback raw capture:
  - `https://web.archive.org/web/{timestamp}id_/{original_url}`
- SBR totals proxy page:
  - `https://www.sportsbookreview.com/betting-odds/ncaa-basketball/totals/full-game/?date=YYYY-MM-DD`
  - Extracted via `script#__NEXT_DATA__` JSON payload:
    - `props.pageProps.oddsTables[0].oddsTableModel.gameRows[*]`

## Compliance / Rate-Limit
- `https://haslametrics.com/robots.txt` returned empty.
- Requests were cached locally under `backtests/ncaab_ovr_v1/cache/`.
- Lightweight request pacing was applied.

## Book Totals Source
- OLG historical totals were not programmatically available in this run.
- Backtest uses consensus proxy (`Book_total_source = CONSENSUS_PROXY`) from SBR market totals page:
  - Per-game `Book_total` = median current total across listed books.
  - `odds` = available OVER price near consensus total; fallback `-110`.

## Validation Plan for OLG vs Proxy
1. Export a sample of settled OLG totals bets (date, matchup, total, odds).
2. Join against SBR proxy rows by date + teams.
3. Compute:
   - mean absolute difference of totals,
   - % exact total match,
   - odds delta distribution.
4. If mismatch is material, rerun with an OLG-specific ingestion path.

## Blockers Encountered
- Sparse/uneven Wayback coverage for some seasons/dates limits pre-tip snapshot density.
- Team-name normalization between Haslametrics and SBR requires alias handling; unmatched games are dropped.

## Alternative Data Paths
1. Paid odds feed + daily Haslametrics archive job  
   - Cost: medium/high (ongoing subscription + storage)  
   - Complexity: medium  
   - Benefit: robust no-lookahead across full regular season + tournaments.
2. User-supplied OLG export + one-time Haslametrics snapshot archive from now onward  
   - Cost: low  
   - Complexity: low/medium  
   - Benefit: exact OLG settlement backtests going forward; historical depth still limited.
