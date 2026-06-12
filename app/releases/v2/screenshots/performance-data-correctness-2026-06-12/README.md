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
- `verification-summary.json` - Playwright DOM assertions for Basket and
  Simulation parity.
- `theme-check.json` - Playwright colour assertions for light and dark mode.

The evidence confirms the UI/data path fixes only. ADR Grid indicator parity
and missing current-week pair gain behaviour remain the next data gate.
