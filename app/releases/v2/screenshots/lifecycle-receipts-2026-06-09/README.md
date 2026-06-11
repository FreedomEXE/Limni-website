# Lifecycle Receipts Evidence - 2026-06-09

Route verified: `/status` on `http://127.0.0.1:3001`.

Purpose:

- Verify Status separates legacy evidence readiness from receipt-backed closed readiness.
- Verify closed active weeks show required receipt classes:
  - source freeze
  - Data materialization
  - Performance materialization
- Verify weeks with legacy source/kernel evidence but missing receipts are not shown as fully `closed_ready`.

Result:

- Playwright passed.
- No page errors.
- No failed requests.
- No bad HTTP responses.
- No console warnings/errors.
- Current state shown by Status:
  - legacy evidence: `14/14`
  - receipt-backed: `0/14`
  - closed ready: `0/14`
- This is expected until source-freeze and materialization jobs are rerun under the new receipt contract.

Screenshots:

- `status-lifecycle-receipt-card.png`
- `status-lifecycle-receipt-details.png`
- `status-lifecycle-receipts-full-page.png`

Machine evidence:

- `playwright-evidence.json`
