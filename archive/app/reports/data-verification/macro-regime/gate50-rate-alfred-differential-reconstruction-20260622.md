# Gate 50 Rate ALFRED Differential Reconstruction Receipt

Generated: 2026-06-22T20:05:06.159Z

## Result

- Macro dataset: 01a3b789-2928-4886-a627-eaf5ae689790
- Stale 3m-rate rows audited: 139
- Distinct sources: 8
- Selection rule: latest_eligible_vintage_as_of_weekly_freeze
- Staleness rule version: rate_3m_market_release_aware_carry_v1
- Rate family manifest status: BUILT_DIAGNOSTIC_REBUILD_REQUIRED
- Rate family manifest hash: c1befe5d6711265a3c2b55191eec19f9dec8b8e3e0316b48ea01a1e723eeb219
- Promotion eligible: false
- Outcome consumable: false
- Receipt hash: 8cbc4b565e6ccd8ea30942ec3dbacc9c5a72baa5abf6d23f44b90b2674092989

## Classification Counts

| Classification | Count |
|---|---:|
| legitimate_revision | 92 |
| wrong_vintage | 0 |
| reconstruction_defect | 0 |
| valid_carry_incorrectly_marked_stale | 47 |
| genuine_missing_observation | 0 |

## Repair History

| Anomaly id | Original anomaly | Root cause | Repair version | Post-repair classification |
|---|---|---|---|---|
| chf_2024_01_08_no_as_of_observation_query_window_v1 | no_as_of_observation | query-window defect: prior as-of request observation_start excluded the selected 2021-12-01 observation | rate_vintage_reconciliation_query_window_repair_v1 | legitimate_revision |

## Source Counts

| Source | Count |
|---|---:|
| AUD\|fred_IR3TIB01AUM156N | 3 |
| CAD\|fred_IR3TIB01CAM156N | 3 |
| CHF\|fred_IR3TIB01CHM156N | 95 |
| EUR\|fred_IR3TIB01EZM156N | 13 |
| GBP\|fred_IR3TIB01GBM156N | 9 |
| JPY\|fred_IR3TIB01JPM156N | 3 |
| NZD\|fred_IR3TIB01NZM156N | 10 |
| USD\|fred_IR3TIB01USM156N | 3 |

## Diagnostic Rate Manifests

- Family manifest: rate_3m_market_family_v1
- Family manifest hash: c1befe5d6711265a3c2b55191eec19f9dec8b8e3e0316b48ea01a1e723eeb219
- Manifest state: SEALED
- Diagnostic only: true
- Promotion eligible: false
- Outcome consumable: false

| Currency | Bundle id | Rows audited | Rebuild required | Bundle hash |
|---|---|---:|---|---|
| AUD | currency_macro_bundle_aud_rate_diagnostic_v1 | 3 | false | 0a42aa99a6e4b9d3ee77b7769ea29fd7bad781d901567f764063165b2f42390e |
| CAD | currency_macro_bundle_cad_rate_diagnostic_v1 | 3 | false | eaa0a45745eb540d10d282278d15e4f40cb4026544991beaad55032c0f68785b |
| CHF | currency_macro_bundle_chf_rate_diagnostic_v1 | 95 | true | d01fd7a501c5bf93fdbbca26661f4aa50b961e1ee8aa9c2b5292031d54181f21 |
| EUR | currency_macro_bundle_eur_rate_diagnostic_v1 | 13 | false | 57324012715809a9a5e8a5a1fa5c029420cb971e054c79a689d529eb8c9464b0 |
| GBP | currency_macro_bundle_gbp_rate_diagnostic_v1 | 9 | false | 69a3ec45384cfcf1d71b04e297ec3bf63ac1628f6877def7ac506c24280eceb6 |
| JPY | currency_macro_bundle_jpy_rate_diagnostic_v1 | 3 | false | 2cb77c964e722c1964c60bc0a99709db48103edc2458c5a480562819799df9f4 |
| NZD | currency_macro_bundle_nzd_rate_diagnostic_v1 | 10 | false | e8e11122a15030fad6fc1dfab629042b39241cfef53afc215e87607003593b1c |
| USD | currency_macro_bundle_usd_rate_diagnostic_v1 | 3 | false | 126e2fd7184a5011e376456cb2126f80fadd4c3eda9307d748a168f49d66240e |

## Files

- JSON: app\reports\data-verification\macro-regime\gate50-rate-alfred-differential-reconstruction-20260622.json
- Markdown: app\reports\data-verification\macro-regime\gate50-rate-alfred-differential-reconstruction-20260622.md

This receipt does not compute P&L, strategy filters, macro signals, or promotion activation.
