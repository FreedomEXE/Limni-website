# Gate 50 Rate ALFRED Differential Reconstruction Receipt

Generated: 2026-06-22T19:38:02.110Z

## Result

- Macro dataset: 01a3b789-2928-4886-a627-eaf5ae689790
- Stale 3m-rate rows audited: 1
- Distinct sources: 1
- Selection rule: latest_eligible_vintage_as_of_weekly_freeze
- Staleness rule version: rate_3m_market_release_aware_carry_v1
- Rate family manifest status: BUILT_DIAGNOSTIC_REBUILD_REQUIRED
- Rate family manifest hash: 7c1af320b94c8f6b74b7a73c36c0adee15b5345149b1ef1baf5a2250b789258e
- Promotion eligible: false
- Outcome consumable: false
- Receipt hash: 6edfae404cda83490bd8657c09e84cedf03fbab269e2c3d65f7319336dcd14e6

## Classification Counts

| Classification | Count |
|---|---:|
| legitimate_revision | 0 |
| wrong_vintage | 0 |
| reconstruction_defect | 0 |
| valid_carry_incorrectly_marked_stale | 1 |
| genuine_missing_observation | 0 |

## Source Counts

| Source | Count |
|---|---:|
| AUD|fred_IR3TIB01AUM156N | 1 |

## Diagnostic Rate Manifests

- Family manifest: rate_3m_market_family_v1
- Family manifest hash: 7c1af320b94c8f6b74b7a73c36c0adee15b5345149b1ef1baf5a2250b789258e
- Manifest state: SEALED
- Diagnostic only: true
- Promotion eligible: false
- Outcome consumable: false

| Currency | Bundle id | Rows audited | Rebuild required | Bundle hash |
|---|---|---:|---|---|
| AUD | currency_macro_bundle_aud_rate_diagnostic_v1 | 1 | false | 9c20ac05ccf36e85177ef227c633e04c14f624f2cf0b302b2a76f9da4882810b |
| CAD | currency_macro_bundle_cad_rate_diagnostic_v1 | 0 | false | 62d937dddb4bdaf60546293215a951a5ed8ee6363feb68c04c3cc14aca844087 |
| CHF | currency_macro_bundle_chf_rate_diagnostic_v1 | 0 | false | 8a0a511c9f68abae25538686021aacac3eb007a53b90b4013d60b45c4cb6d74f |
| EUR | currency_macro_bundle_eur_rate_diagnostic_v1 | 0 | false | 58ab4df5b4dee4a54fd50db3ccc67cf9f1bd51eabc5d4de5fd0ec878d671d388 |
| GBP | currency_macro_bundle_gbp_rate_diagnostic_v1 | 0 | false | 9af2069fba70a640d1258876a32d011f7d7ac948815b8b6801f8b9584da8e969 |
| JPY | currency_macro_bundle_jpy_rate_diagnostic_v1 | 0 | false | 0d45c5db95a6d14c9ced5c7ac0ce8bd5a46e545fb35dd09b1662fc5993ecddeb |
| NZD | currency_macro_bundle_nzd_rate_diagnostic_v1 | 0 | false | c7da3365acc49f8a59a8ec02594d3142b868e0e53d27d0e41d588aaa2e060b6c |
| USD | currency_macro_bundle_usd_rate_diagnostic_v1 | 0 | false | 2ac6f2afc5820f7668445e56c31775d29cffd8aa9ec500a068b43a49aa6c7805 |

## Files

- JSON: app/reports/data-verification/macro-regime/gate50-rate-audit-smoke-temp.json
- Markdown: app/reports/data-verification/macro-regime/gate50-rate-audit-smoke-temp.md

This receipt does not compute P&L, strategy filters, macro signals, or promotion activation.
