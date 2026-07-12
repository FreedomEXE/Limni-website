# Gate 55H Strategy / Tester Inventory Supersession

Generated during Gate 55H architecture cleanup on 2026-06-25.

This file is retained only as a supersession marker. The original count-only
inventory was rejected during review because it found legacy scripts but moved
zero files.

The replacement file-by-file inventory is:

- Human-readable:
  `docs/research/gates/gate55/inventory/LOOSE_ARTIFACT_INVENTORY_2026-06-25.md`
- Machine-readable:
  `docs/research/gates/gate55/inventory/LOOSE_ARTIFACT_INVENTORY_2026-06-25.jsonl`
- Package command classification:
  `docs/research/gates/gate55/inventory/PACKAGE_COMMAND_CLASSIFICATION_2026-06-25.md`
- Root archive manifest:
  `archive/docs/research/gates/gate55/ARCHIVE_MANIFEST_2026-06-25.md`

Replacement inventory result:

- Candidate files: `893`
- Deprecated and safe to archive: `9`
- Archived with `git mv`: `9`
- Active evidence receipts kept in place: `29`
- Historical receipt scripts kept in place: `31`
- Deprecated but referenced files kept with deprecation classification: `247`
- Unknown files left for Freedom review: `561`

Safe archive moves used the root archive mirror rule only:

```text
app/scripts/adr-backtest-*.js
-> archive/app/scripts/adr-backtest-*.js
```

No COT restatement, Strength buckets, regime filters, COT+Strength combination,
risk overlays, execution optimization, source reconstruction, or MT5/live work
was run during this cleanup revision.
