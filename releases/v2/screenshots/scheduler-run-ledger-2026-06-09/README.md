# Scheduler Run Ledger Evidence - 2026-06-09

Route verified: `/status` on `http://127.0.0.1:3001`.

Purpose:

- Verify the App Truth Control Plane renders after adding durable scheduler/materialization receipt contracts.
- Verify Status exposes the `SchedulerRunLedger` and `MaterializationRunLedger` section.
- Verify the scheduled cron register remains visible beside durable receipt evidence.

Result:

- Playwright passed.
- No page errors.
- No failed requests.
- No bad HTTP responses.
- No console warnings/errors.
- Current receipt count was `0 scheduler, 0 materialization`; this is expected until the next instrumented materialization job runs.

Screenshots:

- `status-run-ledger-full-page.png`
- `status-run-ledger-section.png`

Machine evidence:

- `playwright-evidence.json`
