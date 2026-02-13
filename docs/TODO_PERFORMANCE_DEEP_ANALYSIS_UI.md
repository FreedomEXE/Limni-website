# TODO: Performance UI Deep Analysis

## Goal
Surface weekly deep-analysis metrics (peak, low, intraweek drawdown, basket/model comparison) in the Performance UI for historical weeks and ongoing weeks.

## Scope Notes
- Risk context: current deep-analysis baseline is from high-risk runs.
- Low-risk interpretation for challenge planning: approximate scaling at `~0.1x` of high-risk percentages.
- Week baseline for current work starts at `2026-01-19`.

## Data Pipeline
- Add a scheduled/triggered job to run:
  - `scripts/refresh-performance.ts`
  - `scripts/universal-deep-analysis.ts`
- Maintain test registry artifacts for UI metadata:
  - `reports/test-catalog.json`
  - `reports/TEST_CATALOG.md`
- Persist stable artifacts:
  - `reports/universal-deep-analysis-latest.json`
  - `reports/universal-deep-analysis-latest.md`
- Keep date-stamped history artifacts:
  - `reports/universal-deep-analysis-YYYY-MM-DD.json`
  - `reports/universal-deep-analysis-YYYY-MM-DD.md`

## Backend API
- Add endpoint: `GET /api/performance/deep-analysis/latest`
  - Returns parsed JSON from `reports/universal-deep-analysis-latest.json`.
  - Includes metadata: generated_at, timeframe, start_week_utc.
- Add endpoint: `GET /api/performance/deep-analysis/history`
  - Returns available report files and generated timestamps.
- Add endpoint: `GET /api/performance/deep-analysis?date=YYYY-MM-DD`
  - Returns selected historical analysis file.

## UI: Performance Section
- Add new tab/card group: `Deep Analysis`.
- Weekly table (universal):
  - week label
  - close %
  - peak % + peak time
  - low % + low time
  - intraweek drawdown %
  - legs
  - priced symbols
- Basket comparison table:
  - basket/model
  - total close %
  - avg weekly %
  - win rate %
  - avg peak %
  - avg intraweek DD %
- Week drilldown:
  - per-week ranking of baskets/models by close %
  - per-week peak/low/DD by model

## UX + Controls
- Week filter:
  - default start week = `2026-01-19`
  - include/exclude current week toggle
- Risk view toggle:
  - `High Risk (raw)`
  - `Low Risk (scaled 0.1x preview)`
- Add explanatory tooltip:
  - deep-analysis values are simulation-based and separate from broker-realized PnL.

## Validation
- Add tests for:
  - week-key canonicalization/dedup behavior
  - placeholder-week exclusion handling
  - API response shape and empty-state behavior
- Add visual regression snapshot for new Performance deep-analysis tab.

## Implementation Order
1. API endpoints for latest + history.
2. Performance UI tab with universal weekly table.
3. Basket/model comparison table + week drilldown.
4. Risk-view scaling toggle and explanatory copy.
5. Tests + docs update.
