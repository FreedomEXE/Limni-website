# Gate 52 BPR Publication-Date Proof Decision

Date: 2026-06-23

## Decision

```txt
Gate 52 BPR publication-date proof: ACCEPT
Result: PASS_SOURCE_AMBIGUITY_BLOCKED
BPR source timing for 2025-10-07 and 2025-11-04: NOT promotion-grade
Persisted BPR dataset: NOT AUTHORIZED for those observations
BPR attribution: NOT AUTHORIZED
```

## Preserved Evidence

Ignored receipt files:

- `app/reports/data-verification/macro-regime/gate52-bpr-2025-lapse-publication-date-proof-20260623.json`
- `app/reports/data-verification/macro-regime/gate52-bpr-2025-lapse-publication-date-proof-20260623.md`

Hashes:

```txt
JSON SHA-256: F419340BDD40F5B871853FA9315654F6F6C7F1609073A31795AD839B1A593FD5
MD SHA-256:   1A7542713C2DC1278549990BC7BF206AB8006344AB524C1D401FEB5132668E64
```

Both `2025-10-07` and `2025-11-04` were classified
`conservative_not_before_only / source_ambiguous_blocked`, with
`promotionEligible = false`.

## Institutional Read

BPR can mechanically fetch, parse, hash, and form weekly source snapshots.

The 2025 lapse/catch-up window cannot be promoted unless exact CFTC publication
timing is proven or those observations are explicitly quarantined/excluded under
a conservative promotion policy.

Source-ambiguous BPR rows are unavailable. They must not be neutralized,
imputed, silently carried as source-clean, or included in promoted source
consumption.

## Next Authorized Gate 52 Work

```txt
Gate 52A: BPR clean-window source reconstruction and ambiguity map
```

Required shape:

- full seven-year BPR dry-run coverage map
- clean observations count
- ambiguous/quarantined observations count
- blocked weeks and affected pair-weeks
- dataset hash candidate
- no-write or diagnostic-only receipt
- policy that source-ambiguous rows are unavailable, not neutralized or imputed

Still unauthorized:

- persisted BPR dataset
- `bpr_attribution_v1`
- BPR alpha claim
- strategy performance testing
- outcome grids
- combined macro regime
