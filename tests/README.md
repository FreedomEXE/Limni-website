# Tests

End-to-end test workspace.

## Contents

| Path | Purpose |
|---|---|
| `e2e/` | Playwright tests. |

## Rules

- Unit tests currently live under `src/lib/__tests__` and run through Vitest.
- Playwright output belongs in ignored `test-results/` or `playwright-report/`.
- Future move target is `app/tests/`, but only in an app build-system migration
  gate.
