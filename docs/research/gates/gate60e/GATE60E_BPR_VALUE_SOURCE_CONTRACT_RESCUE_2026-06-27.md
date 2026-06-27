# Gate 60E BPR Value Source-Contract Rescue

Generated: `2026-06-27T14:48:30.098Z`

Verdict: `FAIL_CLOSED_BPR_VALUE_SOURCE_CONTRACT_UNRESOLVED_ROWS_REMAIN__NO_REGIME_SIDE`

Gate 60E is BPR-only and source-contract-only. It investigates missing `netShareOfGross` values against raw CFTC BPR artifacts and the frozen Gate 59 Alpha v1 denominator. It emits no Regime transform, no broad matrix, no Regime LONG/SHORT side, no support/oppose/fade labels, no P&L, no attribution, no Alpha v2, and no risk/execution/MT5/live/app work.

## Boundary

- No COT, Strength, Alpha v1, Gate 59, or macro source row mutation.
- No neutral fill, forward fill, imputation, or row skipping.
- Late-2025 BPR publication timing rows remain separate from value-missing rows.
- Any rescue candidate requires a separately versioned source contract before rows may be changed.

## Denominator

- Gate 59 rows: `10444`
- Gate 59 weeks: `373`
- Symbols per week histogram: `{"28":373}`
- Duplicate Gate 59 row keys: `0`
- BPR value matrix rows: `5968`
- Duplicate BPR value matrix row keys: `0`

## Classification

- Matrix value present rows: `2027`
- Matrix value missing rows: `3941`
- Matrix fail-closed rows: `3969`
- Matrix publication-timing fail-closed rows: `64`
- Matrix value/timing overlap rows: `36`
- Separate late-2025 publication timing source rows: `32`

Matrix missing reason counts:

```json
{
  "currency_mapping_error": 5,
  "futures_options_contract_limitation": 2786,
  "truly_absent_from_cftc_bpr_report": 1150
}
```

Source-observation missing reason counts:

```json
{
  "currency_mapping_error": 1,
  "futures_options_contract_limitation": 686,
  "truly_absent_from_cftc_bpr_report": 285
}
```

Matrix missing reason counts by source/currency:

```json
{
  "cftc_bpr_futures|AUD": {
    "truly_absent_from_cftc_bpr_report": 149
  },
  "cftc_bpr_futures|CAD": {
    "truly_absent_from_cftc_bpr_report": 38
  },
  "cftc_bpr_futures|CHF": {
    "truly_absent_from_cftc_bpr_report": 274
  },
  "cftc_bpr_futures|GBP": {
    "truly_absent_from_cftc_bpr_report": 16
  },
  "cftc_bpr_futures|JPY": {
    "truly_absent_from_cftc_bpr_report": 66
  },
  "cftc_bpr_futures|NZD": {
    "currency_mapping_error": 5,
    "truly_absent_from_cftc_bpr_report": 234
  },
  "cftc_bpr_futures|USD": {
    "truly_absent_from_cftc_bpr_report": 373
  },
  "cftc_bpr_options|AUD": {
    "futures_options_contract_limitation": 368
  },
  "cftc_bpr_options|CAD": {
    "futures_options_contract_limitation": 373
  },
  "cftc_bpr_options|CHF": {
    "futures_options_contract_limitation": 373
  },
  "cftc_bpr_options|EUR": {
    "futures_options_contract_limitation": 189
  },
  "cftc_bpr_options|GBP": {
    "futures_options_contract_limitation": 373
  },
  "cftc_bpr_options|JPY": {
    "futures_options_contract_limitation": 364
  },
  "cftc_bpr_options|NZD": {
    "futures_options_contract_limitation": 373
  },
  "cftc_bpr_options|USD": {
    "futures_options_contract_limitation": 373
  }
}
```

## Result

BPR remains fail-closed. The only source-contract rescue candidate is a currency-label contract issue: March 2020 NZD futures uses `CME NEW ZEALAND DOLLAR`, while the current contracted FX label set only includes `NZ DOLLAR`. Gate 60E records this but does not mutate the source rows. The dominant missing rows remain CFTC report absence or futures/options contract limitation.

## Hashes

- BPR value source contract hash: `82B166D4595207AB4C5ED48CF515DDF71E86672F9CCFF6A1EDD569AE0C159208`
- BPR raw artifact value index hash: `B1425CBC78EDCAF6EF76F18DEA9BB4134343DE04D78BB4DD7609520A389684F8`
- BPR source observation value diagnostic hash: `B23D562619715F54B511D0EB0EA57CDF9A4B4EFE53014B805B2C70578A901273`
- BPR value availability matrix hash: `435B2962B59C73C5F17B9D03065796B87920F1FFB008C3F9354BD1740E93C9CB`
- BPR fail-closed receipt hash: `6BF23B7D5A3BE508575992F5CA58CEC6C2B87A5A76A409E693612AEBB6E7DEA7`
- BPR source content invariant hash: `713C0FB26DFB0DDB51268BED0F11F99CBFAB02ED18241E50CADA6FA5499C605B`

## Stop

Stop here. Do not proceed to BPR promotion, Regime atom transforms, broad matrix, Regime side construction, Alpha v2, risk, execution, MT5/live, app work, or source mutation.
