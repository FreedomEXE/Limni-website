# Selected Trade-Row Ledger Gate Evidence - 2026-06-09

Gate: Performance Basket consumes the selected runtime trade-row bundle instead of silently falling back to closed-history canon/API state.

## Verification

- `npx tsc --noEmit --pretty false`: passed.
- Targeted ESLint on basket/app-truth files: passed.
- Playwright on `http://127.0.0.1:3001`: passed.
  - Route: `/performance?view=basket&strategy=tandem&f1=adr_grid&f2=pair_fill_cap`
  - Performance route gate ready: `true`.
  - Basket source: `selected-trade-rows`.
  - Selected execution ledger id: `execution-ledger:strategy-runtime:tandem-adr_grid-pair_fill_cap:13111:aebc5c68`.
  - Selected trade-row ledger id: `trade-row-ledger:strategy-runtime:tandem-adr_grid-pair_fill_cap:13111:aebc5c68`.
  - Selected row count: `13111`.
  - `/api/basket/closed-history` requests: `0`.
  - Console errors: `0`.
  - Failed requests: `0`.

## Screenshots

- `performance-basket-selected-ledger.png`

## Notes

This gate does not finish Summary/export/drilldown/parity unification. It removes the active Basket fallback path and exposes selected ledger identity so the remaining surfaces can be aligned and tested against the same selected rows.
