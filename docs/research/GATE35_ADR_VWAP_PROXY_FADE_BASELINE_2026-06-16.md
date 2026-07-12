# Gate 35 ADR VWAP-Proxy Fade Baseline

Generated: 2026-06-16

## Scope

Freedom proposed changing the ADR fade test from weekly high/low excursions to
a fair-value distance test:

- same execution window: Sunday 20:00 New York through Friday 11:00 New York;
- same original 10-pair basket from the COT Faces fast pass;
- clean 2019 and current 2026 only;
- no COT context and no live strategy logic;
- fade price when it reaches `0.75 ADR` or `1.0 ADR` away from a weekly
  anchored mean.

The repo's canonical FX bars do not include volume:

`app/src/lib/canonicalPriceBars.ts`

Therefore this first pass is not true exchange VWAP. It is a VWAP-compatible
proxy:

- anchor: weekly execution-window open;
- source: `HLC3 = (high + low + close) / 3`;
- weighting: equal-weighted 1H bars;
- signal uses only prior closed bars for the anchored mean;
- target: first touch back to the current anchored HLC3 mean;
- stop: same ADR distance beyond entry;
- same-bar target/stop ambiguity books the stop.

## Implementation

Research-only exporter:

`app/scripts/verification/export-adr-vwap-fade-baseline.ts`

Commands:

```powershell
npx tsx app/scripts/verification/export-adr-vwap-fade-baseline.ts --receipt app/reports/data-verification/weekly-hold-exit-sweep/fx-10pair-cot-faces-weekly-hold-fixed-band-sweep-43w-20260615-193918.json
npx tsx app/scripts/verification/export-adr-vwap-fade-baseline.ts --receipt app/reports/data-verification/weekly-hold-exit-sweep/fx-10pair-cot-faces-weekly-hold-fixed-band-sweep-23w-20260615-194024.json
```

Validation:

```powershell
npx tsc --noEmit --project app/tsconfig.json --pretty false
```

## Receipts

Clean 2019:

- `app/reports/data-verification/adr-vwap-fade-baseline/fx-10pair-adr-vwap-proxy-fade-baseline-43w-20260616-013722.md`
- `app/reports/data-verification/adr-vwap-fade-baseline/fx-10pair-adr-vwap-proxy-fade-baseline-43w-20260616-013722.json`

Current 2026:

- `app/reports/data-verification/adr-vwap-fade-baseline/fx-10pair-adr-vwap-proxy-fade-baseline-23w-20260616-013718.md`
- `app/reports/data-verification/adr-vwap-fade-baseline/fx-10pair-adr-vwap-proxy-fade-baseline-23w-20260616-013718.json`

## Result

| Window | Variant | Trades | ADR | Trade PF | Weekly PF | Max Weekly DD | WR |
|---|---|---:|---:|---:|---:|---:|---:|
| Clean 2019 | Above mean short 0.75 | 235 | -5.34% | 0.92 | 0.84 | -15.76% | 52.77% |
| Clean 2019 | Below mean long 0.75 | 260 | -17.55% | 0.79 | 0.57 | -20.80% | 51.92% |
| Clean 2019 | First touch 0.75 | 383 | -16.68% | 0.85 | 0.60 | -18.30% | 54.05% |
| Clean 2019 | Above mean short 1.0 | 172 | -3.03% | 0.95 | 0.92 | -19.59% | 52.33% |
| Clean 2019 | Below mean long 1.0 | 184 | -18.30% | 0.74 | 0.59 | -19.00% | 49.46% |
| Clean 2019 | First touch 1.0 | 311 | -18.34% | 0.83 | 0.65 | -19.67% | 50.16% |
| Current 2026 | Above mean short 0.75 | 133 | -6.91% | 0.83 | 0.61 | -8.41% | 54.89% |
| Current 2026 | Below mean long 0.75 | 117 | +8.27% | 1.29 | 1.68 | -5.11% | 58.12% |
| Current 2026 | First touch 0.75 | 198 | +3.70% | 1.07 | 1.15 | -12.34% | 59.60% |
| Current 2026 | Above mean short 1.0 | 86 | -4.29% | 0.86 | 0.74 | -7.69% | 53.49% |
| Current 2026 | Below mean long 1.0 | 76 | -1.69% | 0.93 | 0.88 | -7.73% | 55.26% |
| Current 2026 | First touch 1.0 | 147 | -7.39% | 0.86 | 0.75 | -18.09% | 53.74% |

## Read

This first VWAP-proxy pass does not qualify as a new baseline.

The 2019 window is negative across every tested variant. Current 2026 has one
interesting row, `below_mean_long_0.75`, but that row is still weaker than the
earlier source-free high/low `fade_down_0.75` and `fade_down_1.0` rows from the
ADR fade baseline. The first-touch combined rows also fail to produce stable
edge across both windows.

Important signal:

- The recurring positive behavior is still downside-fade / buy-selloff, not
  broad symmetric VWAP mean reversion.
- The VWAP-proxy target creates many winning trades but the payoff distribution
  is still not strong enough. Several rows have win rates above 50% while total
  ADR remains negative.
- True VWAP cannot be claimed from current canonical FX bars because volume is
  unavailable.

Decision:

- Do not promote.
- Do not add COT to this VWAP-proxy test yet.
- Treat this as evidence that fair-value distance alone is not enough in this
  first simple shape.

## Next Analysis

If Gate 35 continues, inspect these before running broad sweeps:

1. Compare mean-touch exit versus fixed `1:1` from entry for the same anchored
   HLC3 entries.
2. Test whether only the `below_mean_long_0.75` behavior is worth isolating.
3. Check whether the positive 2026 row is concentrated in USDJPY/AUDUSD/AUDCAD
   and whether those pairs explain most of the edge.
4. Decide whether a daily/session anchor is a better fit than weekly anchor.
5. If true volume becomes available, rerun as real VWAP rather than equal-weight
   HLC3 proxy.

## Continuation: Fixed 1:1 Exits

Generated: 2026-06-16

After the first mean-touch pass failed qualification, the exporter was extended
research-only to keep the same anchored HLC3 entries while changing only the
exit model:

- `mean_touch`: original first touch of the current anchored HLC3 mean;
- `entry_rr_1to1`: fixed target and stop at the same ADR distance from entry;
- same entry trigger, basket, windows, and same-bar stop-first ambiguity policy.

Commands:

```powershell
npx tsx app/scripts/verification/export-adr-vwap-fade-baseline.ts --receipt app/reports/data-verification/weekly-hold-exit-sweep/fx-10pair-cot-faces-weekly-hold-fixed-band-sweep-23w-20260615-194024.json --exit-models=entry_rr_1to1
npx tsx app/scripts/verification/export-adr-vwap-fade-baseline.ts --receipt app/reports/data-verification/weekly-hold-exit-sweep/fx-10pair-cot-faces-weekly-hold-fixed-band-sweep-43w-20260615-193918.json --exit-models=entry_rr_1to1
```

Validation:

```powershell
npx tsc --noEmit --project app/tsconfig.json --pretty false
```

Receipts:

- Current 2026:
  `app/reports/data-verification/adr-vwap-fade-baseline/fx-10pair-adr-vwap-proxy-fade-baseline-23w-20260616-020232.md`
- Clean 2019:
  `app/reports/data-verification/adr-vwap-fade-baseline/fx-10pair-adr-vwap-proxy-fade-baseline-43w-20260616-020250.md`

| Window | Variant | Trades | ADR | Trade PF | Weekly PF | Max Weekly DD | WR |
|---|---|---:|---:|---:|---:|---:|---:|
| Clean 2019 | Above mean short 0.75 | 235 | +2.79% | 1.04 | 1.08 | -15.17% | 48.94% |
| Clean 2019 | Below mean long 0.75 | 260 | -11.23% | 0.88 | 0.76 | -23.61% | 47.31% |
| Clean 2019 | First touch 0.75 | 383 | -2.97% | 0.98 | 0.94 | -13.74% | 49.09% |
| Clean 2019 | Above mean short 1.0 | 172 | -5.54% | 0.91 | 0.87 | -23.34% | 47.67% |
| Clean 2019 | Below mean long 1.0 | 184 | -13.91% | 0.81 | 0.70 | -20.32% | 46.74% |
| Clean 2019 | First touch 1.0 | 311 | -17.39% | 0.85 | 0.69 | -21.09% | 45.98% |
| Current 2026 | Above mean short 0.75 | 133 | -7.42% | 0.84 | 0.63 | -10.78% | 45.11% |
| Current 2026 | Below mean long 0.75 | 117 | +13.02% | 1.43 | 1.97 | -5.55% | 55.56% |
| Current 2026 | First touch 0.75 | 198 | +7.22% | 1.12 | 1.26 | -15.17% | 51.52% |
| Current 2026 | Above mean short 1.0 | 86 | -4.68% | 0.86 | 0.75 | -7.78% | 45.35% |
| Current 2026 | Below mean long 1.0 | 76 | -2.18% | 0.92 | 0.87 | -8.87% | 51.32% |
| Current 2026 | First touch 1.0 | 147 | -8.48% | 0.85 | 0.75 | -18.34% | 46.94% |

Read:

- Fixed 1:1 improves the current 2026 downside row versus mean-touch
  (`below_mean_long_0.75` improves from `+8.27%` to `+13.02%` ADR), but it is
  still weaker than the earlier high/low downside fade rows.
- Fixed 1:1 improves clean 2019 downside versus mean-touch, but not enough to
  pass; `below_mean_long_0.75` remains negative at `-11.23%` ADR and has a
  worse weekly drawdown than the mean-touch row.
- The directional preference flips by window: clean 2019 only has a weak
  positive `above_mean_short_0.75`, while current 2026 only has a meaningful
  positive `below_mean_long_0.75`.
- Pair concentration is not stable enough to rescue the model. Current 2026
  downside gains are led by `USDJPY`, `AUDUSD`, `AUDCAD`, `EURJPY`, and
  `USDCAD`; clean 2019 downside losses remain broad, led by `USDCHF`,
  `EURUSD`, `GBPUSD`, `AUDCAD`, and `USDJPY`.

Decision:

- Do not promote.
- The fixed 1:1 exit is better than mean-touch for the current downside clue,
  but the weekly anchored HLC3 entry still does not survive clean 2019.
- Treat this as evidence that the recurring clue is not broad VWAP-style fair
  value mean reversion. It remains narrower: buy-side reversion after downside
  displacement in the current 2026 regime.
- If Gate 35 continues, daily/session anchors are now the cleaner next fair-value
  question than more weekly-anchor exit tuning.
