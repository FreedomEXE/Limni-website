/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: PRODUCTION_POLISH_ISSUES_2026-03-23.md
 *
 * Description:
 * Production polish and stability issue list captured after the
 * canonical site refactor, prior to the next patch pass.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

# Production Polish Issues — 2026-03-23

Project:
`c:\Users\User\Documents\GitHub\limni-website`

Purpose:
- capture the currently observed production and polish issues
- tie each issue to the actual route/component/code path
- give Claude a clear review target before patching

Important constraint for the next pass:
- do not change core business logic or canonical methodology
- fix production safety, presentation consistency, readability, and graceful degradation

## Executive Summary

There are two categories of issues:

1. Shared production failures around canonical report access
- `/performance` fails with `/api/performance/report` returning `500`
- `/automation/research` can hard-crash server-side in production
- `/flagship/weekly-hold` and `/flagship/intraday` can hard-crash server-side in production
- `/status` reports canonical-data errors that appear to be false negatives caused by the same underlying issue

2. UI polish/consistency issues
- date/week labels are inconsistent across surfaces
- News/Status information architecture does not match the intended final UX
- News event value rendering is semantically wrong for non-numeric vs pending values
- some warning/accent text is unreadable in light mode

The strongest likely shared root cause is the canonical reconstruction report being read from a local filesystem path in runtime server code:
- [canonicalPerformanceReport.ts](/c:/Users/User/Documents/GitHub/limni-website/src/lib/performance/canonicalPerformanceReport.ts)

That path currently resolves to:
- `process.cwd()/reports/comprehensive-reconstruction.json`

In local dev/build this exists.
In deployed serverless/runtime contexts it appears to be missing or not reliably available.

## Issue 1: Canonical Report Path Is Not Production-Safe

### User-facing symptoms

- `/performance` shows:
  - `Failed to load '/api/performance/report'. Performance report request failed with status 500`
- `/automation/research` can render a full server-side application error page
- `/flagship/weekly-hold` and `/flagship/intraday` can render full server-side application error pages
- `/status` shows:
  - `Canonical data` = `ERROR`
  - `Weekly Reconstruction` = `MISSING`
  - `Swing Board` = `MISSING`
- Screenshot evidence shows runtime attempts to open:
  - `'/var/task/reports/comprehensive-reconstruction.json'`

### Affected code

- [canonicalPerformanceReport.ts](/c:/Users/User/Documents/GitHub/limni-website/src/lib/performance/canonicalPerformanceReport.ts)
- [route.ts](/c:/Users/User/Documents/GitHub/limni-website/src/app/api/performance/report/route.ts)
- [page.tsx](/c:/Users/User/Documents/GitHub/limni-website/src/app/performance/page.tsx)
- [canonicalFlagships.ts](/c:/Users/User/Documents/GitHub/limni-website/src/lib/performance/canonicalFlagships.ts)
- [page.tsx](/c:/Users/User/Documents/GitHub/limni-website/src/app/automation/research/page.tsx)
- [page.tsx](/c:/Users/User/Documents/GitHub/limni-website/src/app/flagship/weekly-hold/page.tsx)
- [page.tsx](/c:/Users/User/Documents/GitHub/limni-website/src/app/flagship/intraday/page.tsx)
- [page.tsx](/c:/Users/User/Documents/GitHub/limni-website/src/app/status/page.tsx)

### Why this is likely happening

The current canonical read layer uses:

- [canonicalPerformanceReport.ts](/c:/Users/User/Documents/GitHub/limni-website/src/lib/performance/canonicalPerformanceReport.ts):35
- [canonicalPerformanceReport.ts](/c:/Users/User/Documents/GitHub/limni-website/src/lib/performance/canonicalPerformanceReport.ts):365

It joins `process.cwd()` with `reports/comprehensive-reconstruction.json` and reads it via `fs/promises`.

That is acceptable locally, but not a safe assumption for deployed runtime execution unless the file is guaranteed to exist inside the deployed artifact and at the same path. The screenshot path `'/var/task/reports/comprehensive-reconstruction.json'` strongly suggests this assumption is failing in production.

### Review questions for Claude

- Is the report file actually bundled/deployed in the current hosting target?
- Should the canonical reader:
  - load from a more deployment-safe packaged location, or
  - fall back to a DB-backed summary/read model when the file is absent, or
  - degrade gracefully with a typed “unavailable” payload rather than throwing?
- Should page-level consumers stop throwing on missing canonical report data and instead render a safe provisional state?

### Patch direction

- harden canonical report loading for production
- ensure `/api/performance/report` does not 500 just because the file is absent
- ensure page consumers do not crash server-side on missing canonical report access
- ensure `/status` reports canonical availability truthfully after the fix

## Issue 2: Performance Page Depends On Self-Fetch Instead Of Direct Server Read

### User-facing symptom

- `/performance` fails entirely when `/api/performance/report` fails

### Affected code

- [page.tsx](/c:/Users/User/Documents/GitHub/limni-website/src/app/performance/page.tsx):193
- [page.tsx](/c:/Users/User/Documents/GitHub/limni-website/src/app/performance/page.tsx):198

### Why this matters

The page is server-rendered, but it fetches its own API route using host/protocol resolution from request headers.

That means there are two failure surfaces:
- canonical report reading itself
- host/protocol/self-fetch behavior

Even if the API route remains valid, the page is more fragile than it needs to be.

### Review questions for Claude

- Should the page read the canonical report layer directly server-side instead of self-fetching `/api/performance/report`?
- If the API route remains, should the page still degrade better on failure?

### Patch direction

- simplify the page’s server read path or make the self-fetch more robust
- improve the failure state text and contrast if any fallback remains

## Issue 3: Status Page Is Reporting False-Negative Errors

### User-facing symptoms

The current status page shows several concerning states:
- `Canonical data` = `ERROR`
- `Weekly Reconstruction` = `MISSING`
- `Swing Board` = `MISSING`
- `Intraday Board` = `STALE`

At least the first three appear to be downstream of the canonical report path problem, not actual absence of the underlying system design.

### Affected code

- [page.tsx](/c:/Users/User/Documents/GitHub/limni-website/src/app/status/page.tsx):279
- [page.tsx](/c:/Users/User/Documents/GitHub/limni-website/src/app/status/page.tsx):423
- [page.tsx](/c:/Users/User/Documents/GitHub/limni-website/src/app/status/page.tsx):482
- [page.tsx](/c:/Users/User/Documents/GitHub/limni-website/src/app/status/page.tsx):576
- [page.tsx](/c:/Users/User/Documents/GitHub/limni-website/src/app/status/page.tsx):585

### Why this matters

The status page should distinguish between:
- real outage / real missing dataset
- deployment path/config issue
- intentionally provisional surface

Right now those concepts are mixed together.

### Review questions for Claude

- Should `Intraday Board` be `Research`/`Provisional` instead of `STALE`?
- Should `Swing Board` depend on report availability only, or on a separate flagship metadata resolver?
- Should canonical report read failures be surfaced as config/runtime warnings instead of “system missing”?

### Patch direction

- keep status truthful
- reduce false alarms
- separate `missing`, `research`, `not promoted`, and `runtime misconfigured`

## Issue 4: Date/Week Labels Are Not Standardized Across The App

### User-facing symptom

The same canonical trading week is presented inconsistently:
- Antikythera shows `Mar 16`
- Bias and Sentiment show `Mar 16 2026`

Requested standard:
- `Mar 16 2026`

And this should be app-wide, not just in Data.

### Affected code seams

- [page.tsx](/c:/Users/User/Documents/GitHub/limni-website/src/app/antikythera/page.tsx)
- [page.tsx](/c:/Users/User/Documents/GitHub/limni-website/src/app/dashboard/page.tsx):572
- [page.tsx](/c:/Users/User/Documents/GitHub/limni-website/src/app/sentiment/page.tsx)
- related filter components receiving week option labels

### Likely root cause

Week labels are being formatted independently in different pages/components instead of flowing through one shared formatter policy.

### Patch direction

- introduce one shared canonical week label formatter
- apply it to:
  - Data section week selectors
  - any equivalent week chips/selectors elsewhere in the app

## Issue 5: News / Status Information Architecture Does Not Match Target UX

### User-facing symptoms

- Status still feels conceptually buried under the News grouping instead of being a clean sibling view
- News hierarchy is not the desired one

Requested target behavior:
- `News` and `Status` should sit in the same section style
- News should lead with `Calendar`
- then have switchers/cards for:
  - `Announcements`
  - `High Impact`
  - `Medium Impact`

### Affected code

- [DashboardLayout.tsx](/c:/Users/User/Documents/GitHub/limni-website/src/components/DashboardLayout.tsx)
- [page.tsx](/c:/Users/User/Documents/GitHub/limni-website/src/app/news/page.tsx)
- [NewsContentTabs.tsx](/c:/Users/User/Documents/GitHub/limni-website/src/components/news/NewsContentTabs.tsx)

### Likely current mismatch

The current `NewsContentTabs` implementation is a unified layout, but the emphasis is:
- top announcements
- high impact focus
- economic calendar below

That is opposite the requested hierarchy.

### Patch direction

- keep the unified approach
- reorder the page around Calendar first
- convert the cards below the week strip into switchers for the requested views

## Issue 6: News Event Value Semantics Are Wrong

### User-facing symptom

For events without numeric `actual/forecast/previous` fields:
- the UI shows `-`

Requested behavior:
- blank if those values are not structurally applicable
- small `Pending` badge if the values are expected but not yet released

### Affected code

- [NewsContentTabs.tsx](/c:/Users/User/Documents/GitHub/limni-website/src/components/news/NewsContentTabs.tsx)

### Patch direction

- separate:
  - not applicable
  - pending
  - available value

## Issue 7: App-Wide Contrast / Readability Needs A Targeted Audit

### User-facing symptom

Yellow text in light mode is too low-contrast and hard to read.

### Affected surfaces

Known examples:
- Performance error banner in light mode
- warning/accent badges and warning text generally

### Likely root cause

Some warning/amber text styles were tuned primarily for dark mode and are not strong enough against light backgrounds.

### Patch direction

- audit warning/error/accent tones across both themes
- ensure all light-mode warning text has sufficient contrast
- treat this as app-wide, not page-specific

## Issue 8: Swing And Intraday Pages Need Graceful Production Fallback

### User-facing symptom

Both can server-crash in production.

### Affected code

- [page.tsx](/c:/Users/User/Documents/GitHub/limni-website/src/app/flagship/weekly-hold/page.tsx)
- [page.tsx](/c:/Users/User/Documents/GitHub/limni-website/src/app/flagship/intraday/page.tsx)
- [canonicalFlagships.ts](/c:/Users/User/Documents/GitHub/limni-website/src/lib/performance/canonicalFlagships.ts)

### Why this matters

These are placeholder/provisional surfaces. They should never crash the app because canonical report metadata cannot be read.

### Patch direction

- fallback safely if canonical flagship resolution is unavailable
- keep the page accessible with provisional copy

## Issue 9: Automation Research Page Needs Production-Safe Canonical Access

### User-facing symptom

`/automation/research` can hard-crash server-side on deployment.

### Affected code

- [page.tsx](/c:/Users/User/Documents/GitHub/limni-website/src/app/automation/research/page.tsx)
- [canonicalFlagships.ts](/c:/Users/User/Documents/GitHub/limni-website/src/lib/performance/canonicalFlagships.ts)
- [canonicalPerformanceReport.ts](/c:/Users/User/Documents/GitHub/limni-website/src/lib/performance/canonicalPerformanceReport.ts)

### Likely root cause

Same canonical report dependency as the Performance and Swing/Intraday surfaces, but directly in server page execution.

### Patch direction

- make canonical report reads safe in production
- degrade gracefully rather than hard-crashing the route

## Issue 10: Theme Toggle Hydration Was Fixed Locally, But Should Be Mentioned In Review

### Context

During the final local visual pass, dark mode triggered a hydration mismatch because the button label differed server vs client.

This was already fixed in:
- [ThemeToggle.tsx](/c:/Users/User/Documents/GitHub/limni-website/src/components/ThemeToggle.tsx)

### Why include it here

Claude should know:
- this issue was real
- it has already been addressed
- remaining runtime/production failures are not from the theme toggle

## Recommended Patch Order

1. Harden canonical report access
- make report loading production-safe
- prevent server crashes

2. Fix the surfaces that depend on it
- `/api/performance/report`
- `/performance`
- `/automation/research`
- `/flagship/weekly-hold`
- `/flagship/intraday`
- `/status`

3. Standardize week/date labeling app-wide

4. Rework News / Status UX details
- Calendar-first News
- switchers for Announcements / High Impact / Medium Impact
- value semantics for blank vs pending

5. Run app-wide contrast/readability pass

## Requested Claude Review Focus

Please review:

1. Whether the canonical report reader is the correct root cause for the production failures
2. The safest production pattern for canonical report access
3. Whether `/performance` should stop self-fetching `/api/performance/report`
4. How `/status` should distinguish real system failure vs research/provisional state vs runtime misconfiguration
5. Whether any additional affected routes/components are missing from this issue list
