# Selected Ledger Metrics Evidence - 2026-06-09

Scope: final selected-ledger metrics parity gate before visual inspection.

Receipt:

- `selected-ledger-metric-receipt-adr-normalized.json`
- Selection: `tandem / adr_grid / pair_fill_cap`
- History window: `v2.0.3-clean14`
- View mode: execution + ADR-normalized
- Selected trade row ledger:
  `trade-row-ledger:strategy-runtime:tandem-adr_grid-pair_fill_cap:13111:aebc5c68`

Receipt results:

- Source rows: `13111`
- Metric rows: `1972`
- Leaf trade rows: `11139`
- Total return: `308.18256678789936%`
- Weekly return sum: `308.1825667879003%`
- Weekly count: `14`
- Receipt parity: passed

Surface parity checked by Playwright:

- Summary cards matched receipt model returns.
- Simulation return/trade count matched receipt summary.
- Basket selected ledger ids/count matched receipt.
- Basket made zero `/api/basket/closed-history` requests.
- `/dashboard`, `/performance`, and `/status` route-readiness checks passed.
- No console errors or blocking failed requests.

Main evidence:

- `selected-ledger-final-playwright-evidence.json`
- `selected-ledger-final-summary.png`
- `selected-ledger-final-simulation.png`
- `selected-ledger-final-basket.png`
- `selected-ledger-final-dashboard.png`
- `selected-ledger-final-performance.png`
- `selected-ledger-final-status.png`
