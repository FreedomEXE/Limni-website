# DB

Database client, schema, and migration runner.

## Contents

| Path | Purpose |
|---|---|
| `client.ts` | Neutral PostgreSQL client shared by app server code and engine code. |
| `rootEnv.ts` | Neutral root `.env.local` / `.env` loader used by the DB client and app server compatibility exports. |
| `schema.sql` | Base schema used by the migration runner. |
| `migrate.ts` | Migration command used by `npm run db:migrate`. |

## Rules

- Treat as production-sensitive infrastructure.
- App code may keep compatibility imports through `app/src/lib/db.ts`, but the
  implementation owner is `database/db/client.ts`.
- Engine code must import DB helpers directly from `@database/db/client`.
- Do not mix DB migration safety review with broad repo cleanup.
