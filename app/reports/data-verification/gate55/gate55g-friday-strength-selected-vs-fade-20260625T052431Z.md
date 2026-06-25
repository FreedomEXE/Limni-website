# Gate 55G Canonical Friday Strength Selected Vs Fade Baseline

Generated: 2026-06-25T05:24:31.895Z

## Result

- Status: PASS_CANONICAL_FRIDAY_STRENGTH_SELECTED_VS_FADE_READY_FOR_BASELINE_LOCK_REVIEW
- Gate: Gate 55G: canonical-friday-strength-selected-vs-fade-baseline
- Price bundle ID: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Strength derivation: `fx_m1_currency_strength_v1`
- ADR/hold path resolution: `1m`
- Source mutation by this script: false
- Local SQLite staging source allowed: false
- COT+Strength combination: false
- Regime/risk/live/final-combined-system work: false

## Read

- Better ADR Grid side: selected
- Better simple weekly hold side: fade

## Source Coverage

- Weeks: 387
- Expected parent rows: 10836
- Retained selected rows: 10836
- Removed rows: 0
- Full source weeks: 387
- Partial source weeks: 0
- Long rows: 5612
- Short rows: 5224
- Composite vote-tie rows: 886
- Exact spread-tie rows: 0
- Snapshot times: 1935
- Snapshot rows: 77400
- Complete snapshot rows: 76720
- Incomplete snapshot rows: 680
- Source coverage range: 0% to 100%

## Metrics

| Signal | Rows | Long | Short | ADR full weeks | ADR partial weeks | ADR Grid ADR | ADR Grid DD | ADR Grid R/DD | ADR Grid PF | Grid fills | Missing grid price rows | Weekly Hold ADR | Weekly Hold DD | Weekly Hold R/DD | Weekly Hold PF | Missing hold price rows |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| selected | 10836 | 5612 | 5224 | 387 | 0 | 1311.8526 | -698.5889 | 1.8779 | 1.2674 | 119147 | 0 | -315.1911 | -377.0083 | -0.836 | 0.8666 | 0 |
| fade | 10836 | 5224 | 5612 | 387 | 0 | 988.7181 | -653.5674 | 1.5128 | 1.1794 | 118460 | 0 | 315.1911 | -230.8041 | 1.3656 | 1.154 | 0 |

## Non-Full Source Weeks

None.

## Commands

- C:\Users\User\AppData\Local\Volta\tools\image\node\24.8.0\node.exe C:\Users\User\Documents\GitHub\limni-website\app\scripts\verification\audit-gate55-friday-strength-baseline.ts --from-week=2019-01-07T00:00:00.000Z --to-week=2026-06-08T00:00:00.000Z --batch-weeks=16 --path-resolution=1m --out-dir=app/reports/data-verification/gate55

## Decision Boundary

This receipt chooses only the Friday Strength selected-vs-fade baseline direction candidate for Gate 55 review. It does not combine Strength with COT, add regimes, optimize execution, add risk overlays, select a final combined system, or promote live/MT5 work.

If both selected and fade fail on the accepted evidence standard, Strength should move to a redesign/enrichment gate rather than being scrapped.

## Files

- JSON: app\reports\data-verification\gate55\gate55g-friday-strength-selected-vs-fade-20260625T052431Z.json
- Markdown: app\reports\data-verification\gate55\gate55g-friday-strength-selected-vs-fade-20260625T052431Z.md
- Docs copy: docs/research/GATE55G_CANONICAL_FRIDAY_STRENGTH_SELECTED_VS_FADE_BASELINE_2026-06-25.md

Receipt hash: `144CE30D67D587D8682958BF55B97F204C6950504A60556C525DED8C7AD8188F`
