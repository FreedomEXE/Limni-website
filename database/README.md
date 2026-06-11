# Database

Target home for database-owned assets.

Current database roots remain in place until a dedicated database migration
gate:

- `db/`
- `migrations/`
- `contracts/`

These paths are referenced by package scripts, workflows, contract generation,
and documentation. Moving them requires updating those references and proving
the migration/contract commands still work.

Production-sensitive scripts, especially
`scripts/migrate-trades-to-unified-ledger.ts`, require their own safety review.
