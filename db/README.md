# DB

Database schema and migration runner.

## Contents

| Path | Purpose |
|---|---|
| `schema.sql` | Base schema used by the migration runner. |
| `migrate.ts` | Migration command used by `npm run db:migrate`. |

## Rules

- Treat as production-sensitive infrastructure.
- Future move target is `database/db/`, but move only with package script,
  API route, Vercel ignore, and documentation updates.
- Do not mix DB migration safety review with broad repo cleanup.
