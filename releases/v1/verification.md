# Verification

This file records the v1 baseline verification evidence.

## AUDCAD 2026-05-11 Matrix

Reference: `AUDCAD`, Agreement / Weekly Hold / None, week of 2026-05-11.

| Anchor | Raw return | ADR-normalized return |
|---|---:|---:|
| Canonical | `-0.5836%` | `-0.7756%` |
| Execution | `-0.7082%` | `-0.9411%` |

Current V2 ledger UUIDs for the reference rows:

- Canonical Weekly Hold: `e473ebea-16ee-57a8-a028-42c23adb5336`
- Execution Weekly Hold: `7c3ca6bf-f5a7-5915-a48a-40a2368c5f82`

Trace command:

```bash
npm run performance:explain -- --date 2026-05-11 --symbol AUDCAD --strategy agreement
```

Most recent observed trace preserved:

- Canonical raw `-0.5836%`
- Canonical ADR-normalized `-0.7756%`
- Execution raw `-0.7082%`
- Execution ADR-normalized `-0.9411%`

## Pair Fill Cap

Pair Fill Cap concurrency verification remains a v1 baseline gate. Latest accepted state:

- Total ledger rows: `122,422`
- ADR Grid rows with `fill_seq IS NOT NULL OR parent_trade_id IS NOT NULL`: `105,550` rows (parents + fills combined)
- Cap-tracked rows with `active_fills_at_entry IS NOT NULL`: `43,284` fills
- `cap_violated = TRUE`: `0`

## Latest Green Checks

Most recent verification runs during the pre-v2 baseline work:

- `npx eslint` scoped to changed TradeList/disclosure files: passed.
- `npx tsc --noEmit`: passed.
- `npm test`: `62` files passed, `225` tests passed.
- `npm run build`: passed.
- AUDCAD trace command above: preserved expected matrix.

## Notes

The v1 baseline docs themselves do not modify source code, schema, or data. They should not change verification outcomes.
