# v2.0.5 Performance Data Correctness Evidence

Gate 29 screenshots and receipts for the v2.0.5 release package.

Captured 2026-06-12 from local Playwright verification against the Performance
route.

## Contents

- `v2.0.5-jun08-current-summary.png` - current-week Summary card tone parity.
- `v2.0.5-jun08-current-basket.png` - current-week Basket shared hierarchy.
- `v2.0.5-jun01-basket.png` - stored-week Basket shared hierarchy.
- `v2.0.5-may25-basket.png` - stored-week planned grid count parity.
- `v2.0.5-jun01-simulation-light.png` - light-mode Equity/Balance chart check.
- `v2.0.5-jun01-simulation-dark.png` - dark-mode Equity/Balance chart check.
- `v2.0.5-gate30-jun15-weekly-hold-current-basket.png` - current Jun 15 Weekly Hold directions visible before fills.
- `v2.0.5-gate31-jun01-weekly-hold-flattened-basket.png` - stored Weekly Hold drilldown flattened to `Commercial > AUDCAD`.
- `verification-summary.json` - Playwright DOM assertions for Basket and
  Simulation parity.
- `theme-check.json` - Playwright colour assertions for light and dark mode.
- `gate32-performance-speed-evidence.json` - browser timing and network receipt
  for repeat Performance visits and warmed tab switches.

The evidence confirms the UI/data path, rollover display, Basket expansion, and
Performance speed/cache fixes only. ADR Grid indicator parity and missing
current-week pair gain behaviour remain the next data gate.
