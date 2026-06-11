# Migrations

SQL migrations for database evolution.

## Rules

- Treat as production-sensitive.
- Do not reorder or rewrite historical migrations casually.
- Numeric gaps can be historical; verify database state before assuming a file
  is missing.
- Future move target is `database/migrations/`, but move only with DB command,
  workflow, deploy, and documentation updates.
