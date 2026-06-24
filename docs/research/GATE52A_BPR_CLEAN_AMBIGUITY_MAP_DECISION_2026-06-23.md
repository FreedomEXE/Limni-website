# Gate 52A BPR Clean/Ambiguity Map Decision

Date: 2026-06-23

## Decision

```txt
Gate 52A BPR clean/ambiguity map: ACCEPT
Result: PASS_SOURCE_AMBIGUITY_QUARANTINED_NO_WRITE
BPR full-window promotion-grade coverage: NO
Clean-window BPR source-layer candidate: YES, only if ambiguous lapse rows stay excluded/quarantined
Persisted BPR dataset: NOT AUTHORIZED
BPR attribution: NOT AUTHORIZED
```

## Preserved Evidence

Ignored receipt files:

- `app/reports/data-verification/macro-regime/gate52-bpr-clean-ambiguity-map-20260623Tgate52a.json`
- `app/reports/data-verification/macro-regime/gate52-bpr-clean-ambiguity-map-20260623Tgate52a.md`

Hashes:

```txt
JSON SHA-256: AD18257E1D41CF1D51399FF0AA0E4BB566562426C05E700F38F4CABB54492674
MD SHA-256:   459A06ED04BE76D66CDE671E2E9BEFB0F7D1EE89E8D235A77C2C51394370ED28
Map SHA-256:  db36f88629df493e80c72ada089811825c64e517365e126aa7c7aa99409afa1c
```

Full-window counts came from read-only inspection of the existing diagnostic
warehouse dataset:

```txt
regimeDatasetId: 01a3b789-2928-4886-a627-eaf5ae689790
datasetHash:     f5d836fbedec5ce0346d4fec4a6762eda9a960b19bd8205cbddad2c8d3502c11
receipt:         app/reports/data-verification/macro-regime/gate50-credentialed-source-fill-matrix-weeks-write-20260622.json
```

This Gate 52A audit did not persist a BPR dataset. It read existing diagnostic
warehouse rows for counts, then ran a narrow no-write BPR calendar replay for
the 2025 lapse impact window.

## Source Counts

```txt
BPR observations:                                      1656
BPR value observations:                                1472
Timing-clean value observations:                       1440
Promotion-eligible available value observations:        487
Source-ambiguous blocked value observations:             32
Source-ambiguous blocked available value observations:   13
Source-ambiguous blocked metadata observations:           4
```

Ambiguous report dates:

- `2025-10-07`
- `2025-11-04`

## Weekly Impact

```txt
BPR weekly snapshots:                    5952
Snapshot weeks:                           372
Selected source-ambiguous snapshots:        0
Quarantined macro weeks:                    4
Approx quarantined BPR snapshot slots:     64
Approx affected pair-weeks:               112
```

Quarantined macro weeks:

- `2025-11-24T00:00:00.000Z`
- `2025-12-01T00:00:00.000Z`
- `2025-12-08T00:00:00.000Z`
- `2025-12-15T00:00:00.000Z`

The affected pair-week count is a source-only approximation: `28` locked FX
pair contexts per quarantined macro week. It is not an attribution result.

## Policy

Source-ambiguous rows are unavailable. They must not be neutralized, imputed,
promoted, silently carried as source-clean, or consumed by BPR attribution.

A future BPR source layer may only proceed as an explicit clean-window source
layer with `2025-10-07` and `2025-11-04` quarantined/excluded, or after exact
CFTC publication timing is proven.

## Still Unauthorized

- persisted BPR dataset
- `bpr_attribution_v1`
- BPR alpha claim
- strategy performance testing
- outcome grids
- combined macro regime
