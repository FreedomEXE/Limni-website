# Src

Next.js application source.

## Contents

| Path | Purpose |
|---|---|
| `app/` | Next.js App Router pages and API routes. |
| `components/` | UI components. |
| `hooks/` | React hooks. |
| `lib/` | App data logic, engines, adapters, services, and unit tests. |
| `middleware.ts` | Next.js middleware. |

## Rules

- This is app behavior. Do not mix app code changes into broad repo cleanup.
- Clean and consolidate here while fixing concrete app issues.
- Future move target is `app/src/`, but only in an app build-system migration
  gate.
