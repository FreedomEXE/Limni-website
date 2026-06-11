# Active Baseline Certification Evidence - 2026-06-09

Scope: generic active-baseline receipt certification after the receipt-backed lifecycle gate.

## Commands

- `npm run performance:refresh-canonical -- --skip-pair-returns --continue-on-error`
- `npm run app-truth:certify-active-baseline -- --json`
- `npx tsc --noEmit --pretty false`
- `npx eslint src/lib/appTruth/activeBaseline.ts src/lib/appTruth/statusProjection.ts scripts/app-truth-certify-active-baseline.ts`
- Playwright against `http://127.0.0.1:3001/status`

## Certification Result

- Baseline: `v2.0.3-clean14`
- Source-freeze ledger: `14/14`
- Canonical + execution weekly returns: `1008/1008`
- Visible strategy week shards: `168/168`
- Receipt-backed lifecycle: `14/14`

## Files

- `status-active-baseline-certification-full-page.png`
- `status-active-baseline-certification-card.png`
- `status-active-baseline-certification-details.png`
- `playwright-evidence.json`

## Notes

Extra Performance kernel weeks remain visible on Status as archive/stale context. They no longer block the active baseline when all required active weeks match.
