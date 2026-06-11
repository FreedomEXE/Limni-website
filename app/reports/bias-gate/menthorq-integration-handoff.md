# MenthorQ Integration Handoff (Paused)

Date: 2026-03-16
Status: Paused browser-capture approach; resume later with API-based ingestion.

## What Was Completed

- Added browser capture script:
  - `scripts/capture-menthorq-gamma-browser.ts`
- Added probe script:
  - `scripts/probe-menthorq-gex.ts`
- Added week-open gamma gate support in strategy comparison backtest:
  - `scripts/backtest-strategy-gate-comparison.ts`
  - Supports `--gamma-mode=off|additive|only`, `--gamma-week-open-csv`, `--gamma-pair-map-csv`
- Added MenthorQ URL map:
  - `reports/bias-gate/menthorq-symbol-url-map.json`
- Updated gamma pair map for trial constraints (NZD disabled):
  - `reports/bias-gate/menthorq-gamma-symbol-map-template.csv`
- Cleaned daily capture CSV to header-only to avoid polluted rows:
  - `reports/bias-gate/menthorq-gamma-daily.csv`

## Why Paused

- Browser capture was inconsistent due to auth/session behavior and landing/unauthorized redirects.
- Free-trial access does not expose all desired symbols/data products.
- Reliable historical backtesting needs stable, programmatic data access.

## Recommended Next Implementation Path

1. Obtain MenthorQ API access (or approved data export source) with historical lookback.
2. Build a deterministic importer that writes daily snapshots into a normalized table/CSV.
3. Re-run 8-week tests only:
   - Skip-only mode (`--reduce-as-skip=true`)
   - Universal v1-v3 and Tiered v1-v3 comparisons
4. Revisit intraday re-entry only after week-open results are stable.

## Known Working Inputs

- URL map currently set for:
  - `6E`, `6B`, `6J`, `6A`, `6S`, `6C` (`6C` mapped to `6cz2026`)

