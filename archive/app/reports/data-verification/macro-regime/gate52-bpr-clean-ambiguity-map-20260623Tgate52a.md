# Gate 52A BPR Clean/Ambiguity Map

Generated: 2026-06-23T21:18:13.350Z

## Status

```txt
PASS_SOURCE_AMBIGUITY_QUARANTINED_NO_WRITE
```

No BPR dataset was persisted. No `bpr_attribution_v1` audit was run.

## Full-Window Source Counts

- Evidence mode: `read_only_existing_diagnostic_warehouse_dataset`
- Warehouse dataset: `01a3b789-2928-4886-a627-eaf5ae689790`
- Warehouse dataset hash: `f5d836fbedec5ce0346d4fec4a6762eda9a960b19bd8205cbddad2c8d3502c11`
- Weeks: `372`
- BPR observations: `1656`
- BPR value observations: `1472`
- Timing-clean value observations: `1440`
- Promotion-eligible available value observations: `487`
- Source-ambiguous blocked value observations: `32`
- Source-ambiguous blocked available value observations: `13`
- Source-ambiguous blocked metadata observations: `4`
- BPR weekly snapshots: `5952`
- Selected source-ambiguous weekly snapshots: `0`
- Clean/ambiguity map hash: `db36f88629df493e80c72ada089811825c64e517365e126aa7c7aa99409afa1c`

## Lapse Quarantine Impact

- Narrow replay mode: `narrow_no_write_calendar_replay`
- Narrow replay candidate hash: `0193bdde339d5f8de18730ee0758966e16d7978ef5062b6d38bd29e61b497a19`
- Ambiguous report dates: `2025-10-07`, `2025-11-04`
- Quarantined macro weeks: `4`
- Quarantined BPR snapshot slots approximation: `64`
- Affected pair-weeks approximation: `112`

```json
[
  "2025-11-24T00:00:00.000Z",
  "2025-12-01T00:00:00.000Z",
  "2025-12-08T00:00:00.000Z",
  "2025-12-15T00:00:00.000Z"
]
```

## Policy

Source-ambiguous rows are unavailable/quarantined. They are not neutralized, imputed, promoted, or consumed.

A persisted BPR source layer remains unauthorized until Freedom explicitly approves a clean-window source layer with the lapse rows excluded/quarantined.
