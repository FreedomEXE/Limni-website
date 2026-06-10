# Scheduler Cron Register Evidence - 2026-06-08

Scope:

- Removed stale Vercel schedules for manual/local-import cron work.
- Defined scheduled and manual-only cron entries with current architecture reasons.
- Verified Status renders the cron register with Playwright.

Code/docs touched:

- `vercel.json`
- `src/lib/appTruth/scheduledCronRegister.ts`
- `src/lib/appTruth/types.ts`
- `src/lib/appTruth/statusProjection.ts`
- `src/app/status/page.tsx`
- `docs/architecture/APP_TRUTH_CRON_REGISTER_2026-06-08.md`

Removed from Vercel schedule:

- `/api/cron/menthorq-overlay-import`
  - Former schedule: `15 * * * *`
  - Reason: imports locally browser-captured MenthorQ CSV rows; Vercel does not produce that CSV.
- `/api/cron/adr-trade-backfill`
  - Former schedule: `0 0 1 1 *`
  - Reason: one-shot historical repair endpoint; should run only after an explicit repair decision.

Kept scheduled:

- 14 Vercel cron entries remain.
- 12 scheduled groups are shown in Status because the three COT schedules share one route/group.
- Crypto/custom-strategy data lanes were preserved: market snapshots, asset strength, canonical crypto price refresh, and feature-flagged Bitget automation.

Verification:

- `npx tsc --noEmit --pretty false`: passed.
- `vercel.json` parsed successfully and reported 14 cron entries.
- Playwright `/status` checks passed:
  - `Scheduled cron register (12 scheduled, 2 manual)` visible.
  - MenthorQ import visible as `MANUAL ONLY`.
  - ADR backfill visible as `MANUAL ONLY`.
  - Canonical refresh visible as scheduled.
  - Market snapshots visible as scheduled.
  - No console errors or page errors.

Screenshots:

- `status-cron-register-expanded-full-page.png`
- `status-cron-register-expanded-crop.png`
- `status-cron-register-manual-only-rows.png`

Remaining limitation:

- This is still a static register. Durable `SchedulerRunLedger` and `MaterializationRunLedger` are not implemented yet.
