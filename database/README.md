# Database

Home for database-owned assets.

## Contents

- `db/` - Neutral DB client, root env loader, SQL schema, and migration helper.
- `migrations/` - Durable migrations.
- `contracts/` - Data and integration contracts.

Production-sensitive migration scripts require their own review gate before
execution or commit.
