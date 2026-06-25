# Gate 50 Official CPI Endpoint Feasibility Receipt

Generated: 2026-06-23T04:09:37.706Z

## Result

- Overall status: CPI_FAMILY_MANIFEST_BUILT_DIAGNOSTIC
- Overall promotion status: FAIL_CLOSED
- Blocking reason: RRP_COMPOSITION_PENDING_FOR_PROMOTION
- Promotion eligible: false
- Outcome consumable: false
- Receipt hash: 0f70d9412af1e458260e73f06586222c471c1458236a57c2b3d122a185f8eeed
- Live payload set hash: 1ee100e3f4ef9e6dc309fcc63aac7ffefa3dece8f8e0d177c3d89a3f54b7beef
- Atomic source validation status: PASS
- Family manifest status: BUILT_DIAGNOSTIC
- Currency bundle status: PARTIAL_SEALED_DIAGNOSTIC
- CPI family manifest hash: 1e078c3f1648b13e2bfceb1278ed154a77c4065458b0956ca30e4015de73418c
- Branches with observed required-window coverage: 8
- Promotion-unblocked full-window candidates: 0
- Continuity/pending branches: 8
- Release-calendar proof branches: 8
- Revision/rebasing proof branches: 8
- Continuity decisions locked: 8
- Parser contracts recorded: 8
- Normalized CPI schema branches: 8
- Source-family validation pass branches: 8
- Manifest-built branches: 8
- Residual promotion-blocked branches: 8

This receipt is endpoint/sample, source-contract, and diagnostic manifest proof only. It does not promote CPI, build ACTIVE manifests, compute real-rate pressure, or run macro outcomes.

## Branches

| Currency | Provider | Status | Parsed | First | Last | Latest value | Blockers |
|---|---|---|---:|---|---|---:|---|
| USD | Bureau of Labor Statistics | sample_pass_continuity_pending | 124 | 2016-01 | 2026-05 | 335.123 | Diagnostic CPI family and currency-bundle manifests are sealed, but they are CPI-only, non-ACTIVE, not outcome-consumable, and rate/RRP promotion contracts remain unresolved. |
| CAD | Statistics Canada | sample_pass_continuity_pending | 120 | 2016-06 | 2026-05 | 169.6 | Diagnostic CPI family and currency-bundle manifests are sealed, but they are CPI-only, non-ACTIVE, not outcome-consumable, and rate/RRP promotion contracts remain unresolved. |
| GBP | Office for National Statistics | sample_pass_continuity_pending | 461 | 1988-01 | 2026-05 | 142.4 | Diagnostic CPI family and currency-bundle manifests are sealed, but they are CPI-only, non-ACTIVE, not outcome-consumable, and rate/RRP promotion contracts remain unresolved. |
| EUR | Eurostat | sample_pass_continuity_pending | 365 | 1996-01 | 2026-05 | 103.13 | Diagnostic CPI family and currency-bundle manifests are sealed, but they are CPI-only, non-ACTIVE, not outcome-consumable, and rate/RRP promotion contracts remain unresolved. |
| JPY | Statistics Bureau of Japan / e-Stat | sample_pass_continuity_pending | 677 | 1970-01 | 2026-05 | 113.5 | Diagnostic CPI family and currency-bundle manifests are sealed, but they are CPI-only, non-ACTIVE, not outcome-consumable, and rate/RRP promotion contracts remain unresolved. |
| AUD | Australian Bureau of Statistics | sample_pass_continuity_pending | 29 | 2019-Q1 | 2026-Q1 | 101.81 | Diagnostic CPI family and currency-bundle manifests are sealed, but they are CPI-only, non-ACTIVE, not outcome-consumable, and rate/RRP promotion contracts remain unresolved. |
| NZD | Stats NZ | sample_pass_continuity_pending | 29 | 2019-Q1 | 2026-Q1 | 1339 | Diagnostic CPI family and currency-bundle manifests are sealed, but they are CPI-only, non-ACTIVE, not outcome-consumable, and rate/RRP promotion contracts remain unresolved. |
| CHF | Swiss Federal Statistical Office | sample_pass_continuity_pending | 522 | 1982-12 | 2026-05 | 101.2587 | Diagnostic CPI family and currency-bundle manifests are sealed, but they are CPI-only, non-ACTIVE, not outcome-consumable, and rate/RRP promotion contracts remain unresolved. |

## Normalized CPI Family Validation

Family candidate: cpi_all_items_family_v1

| Currency | Validation status | Failed checks | Blockers |
|---|---|---|---|
| USD | PASS_SOURCE_CONTRACT_SCHEMA_DIAGNOSTIC_MANIFEST_SEALED | none | Diagnostic CPI family and currency-bundle manifests are sealed, but they are CPI-only, non-ACTIVE, not outcome-consumable, and rate/RRP promotion contracts remain unresolved. |
| CAD | PASS_SOURCE_CONTRACT_SCHEMA_DIAGNOSTIC_MANIFEST_SEALED | none | Diagnostic CPI family and currency-bundle manifests are sealed, but they are CPI-only, non-ACTIVE, not outcome-consumable, and rate/RRP promotion contracts remain unresolved. |
| GBP | PASS_SOURCE_CONTRACT_SCHEMA_DIAGNOSTIC_MANIFEST_SEALED | none | Diagnostic CPI family and currency-bundle manifests are sealed, but they are CPI-only, non-ACTIVE, not outcome-consumable, and rate/RRP promotion contracts remain unresolved. |
| EUR | PASS_SOURCE_CONTRACT_SCHEMA_DIAGNOSTIC_MANIFEST_SEALED | none | Diagnostic CPI family and currency-bundle manifests are sealed, but they are CPI-only, non-ACTIVE, not outcome-consumable, and rate/RRP promotion contracts remain unresolved. |
| JPY | PASS_SOURCE_CONTRACT_SCHEMA_DIAGNOSTIC_MANIFEST_SEALED | none | Diagnostic CPI family and currency-bundle manifests are sealed, but they are CPI-only, non-ACTIVE, not outcome-consumable, and rate/RRP promotion contracts remain unresolved. |
| AUD | PASS_SOURCE_CONTRACT_SCHEMA_DIAGNOSTIC_MANIFEST_SEALED | none | Diagnostic CPI family and currency-bundle manifests are sealed, but they are CPI-only, non-ACTIVE, not outcome-consumable, and rate/RRP promotion contracts remain unresolved. |
| NZD | PASS_SOURCE_CONTRACT_SCHEMA_DIAGNOSTIC_MANIFEST_SEALED | none | Diagnostic CPI family and currency-bundle manifests are sealed, but they are CPI-only, non-ACTIVE, not outcome-consumable, and rate/RRP promotion contracts remain unresolved. |
| CHF | PASS_SOURCE_CONTRACT_SCHEMA_DIAGNOSTIC_MANIFEST_SEALED | none | Diagnostic CPI family and currency-bundle manifests are sealed, but they are CPI-only, non-ACTIVE, not outcome-consumable, and rate/RRP promotion contracts remain unresolved. |

## Diagnostic CPI Manifests

Family manifest: cpi_all_items_family_v1

- Family manifest hash: 1e078c3f1648b13e2bfceb1278ed154a77c4065458b0956ca30e4015de73418c
- Manifest state: SEALED
- Diagnostic only: true
- Promotion eligible: false
- Outcome consumable: false
- Required currency set hash: ab33d1a362068c31e5a32e56f710a4572b45c334cf0d15020abc2dbf10e8a0c5

| Currency | Bundle id | Bundle state | Bundle hash | Outcome consumable | Missing for RRP promotion |
|---|---|---|---|---|---|
| AUD | currency_macro_bundle_aud_cpi_diagnostic_v1 | PARTIAL_SEALED | 3d1f4a70e60627d3f83ba2a86018232ce243baa58d82dbbcc8258de4c6f2b7a5 | false | rate_3m_market_family_v1<br>real_rate_pressure_attribution_v1 |
| CAD | currency_macro_bundle_cad_cpi_diagnostic_v1 | PARTIAL_SEALED | 8af4fe86cc5e59611bd5a9e17246a82759e7940ebca3a0c455c289f10a6c8f78 | false | rate_3m_market_family_v1<br>real_rate_pressure_attribution_v1 |
| CHF | currency_macro_bundle_chf_cpi_diagnostic_v1 | PARTIAL_SEALED | de89634d4f1a8b3d41a7cdc204d91ad88c6d49935bb213ba02ae0e69e0607cb3 | false | rate_3m_market_family_v1<br>real_rate_pressure_attribution_v1 |
| EUR | currency_macro_bundle_eur_cpi_diagnostic_v1 | PARTIAL_SEALED | dd650eb032159680066cf30cb975592346355ae83dbf9d23ff66ea834761dc72 | false | rate_3m_market_family_v1<br>real_rate_pressure_attribution_v1 |
| GBP | currency_macro_bundle_gbp_cpi_diagnostic_v1 | PARTIAL_SEALED | 6c215798f38f23a4597b64c89e9a1ff4519473685fec70996d536028818a8145 | false | rate_3m_market_family_v1<br>real_rate_pressure_attribution_v1 |
| JPY | currency_macro_bundle_jpy_cpi_diagnostic_v1 | PARTIAL_SEALED | a9597a5f8e4adfd8a1df052510742d7c07fa697e9177f84d7f6ecae35f70f68c | false | rate_3m_market_family_v1<br>real_rate_pressure_attribution_v1 |
| NZD | currency_macro_bundle_nzd_cpi_diagnostic_v1 | PARTIAL_SEALED | 210c56316bba8ff1ab9b63b4519db760669ee0e55eddaec07d1cc4f26bb4f231 | false | rate_3m_market_family_v1<br>real_rate_pressure_attribution_v1 |
| USD | currency_macro_bundle_usd_cpi_diagnostic_v1 | PARTIAL_SEALED | 661178ff4b15ea9888efef1f93634598cedc4cdb422c06feb79a95f2497715d9 | false | rate_3m_market_family_v1<br>real_rate_pressure_attribution_v1 |

## Source Contract Proof

| Currency | Release proof | Latest/next publication | Revision/rebasing proof | Continuity decision | Parser/drift guard |
|---|---|---|---|---|---|
| USD | documented; monthly CPI release; BLS publishes the scheduled release timestamp.; precision=exact_timestamp; tz=America/New_York | 2026-05 released 2026-06-10 08:30; next 2026-07-14 | documented; Selected contract is CPI-U all items not seasonally adjusted; seasonally adjusted BLS CPI series are revised for annual seasonal-factor recalculation, while this contract avoids the seasonally adjusted path.; CPI-U all items stays on 1982-84=100; future methodology or series-definition changes require a new source contract version. | standard_contract_pinned; usd_bls_cpi_u_all_items_nsa_1982_84_v1; Use BLS series CUUR0000SA0, CPI-U U.S. city average all-items, not seasonally adjusted, 1982-84=100. | bls_public_timeseries_html_table_parser_v1; Fail closed if the BLS table lacks parseable year rows/month cells or latest parsed period does not reach the required current sample. |
| CAD | documented; monthly CPI table and The Daily release.; precision=date; tz=America/Toronto | 2026-05 released 2026-06-22; next 2026-07-20 | documented; Selected table is not seasonally adjusted; Statistics Canada documents annual CPI basket updates and separate revision behaviour for seasonally adjusted/core series.; All-items CPI remains 2002=100 while basket weights are updated; basket-link changes require source-contract metadata but not a FRED splice. | locked; cad_statcan_1810000401_vector_41690973_all_items_canada_nsa_v1; Pin table 18-10-0004-01 vector 41690973 for Canada all-items monthly CPI, not seasonally adjusted. | statcan_wds_vector_41690973_latest_periods_json_v1; Fail closed if vectorDataPoint is absent, refPer stops being an ISO date, or table/vector metadata no longer maps to Canada all-items CPI. |
| GBP | documented; monthly ONS consumer price inflation dataset release.; precision=date; tz=Europe/London | 2026-05 released 2026-06-17; next 2026-07-22 | documented; ONS exposes previous versions for the time series; any back data/version change must be captured as a new artifact and compared before promotion.; D7BT is CPI all-items 2015=100; a future CPI rebasing requires a new contract version. | standard_contract_pinned; gbp_ons_d7bt_cpi_all_items_2015_100_v1; Use ONS MM23 time series D7BT for CPI index 00: all items, 2015=100. | ons_timeseries_d7bt_mm23_json_v1; Fail closed if the months array is absent, labels no longer parse to months, or latest period is behind the required current sample. |
| EUR | documented; monthly Eurostat HICP full-data release; flash estimate is not the selected contract.; precision=date; tz=Europe/Luxembourg | 2026-05 released 2026-06-17; next pending/current-calendar | documented; HICP is published as final but can be revised for errors, provisional finalisation, or major methodological changes; first-published HICP data exists as a vintage evidence path.; ECOICOP v2 dataset uses 2025=100; prc_hicp_midx/ECOICOP1 is archived and frozen, so prc_hicp_minr supersedes it for this contract. | locked; eur_eurostat_prc_hicp_minr_dynamic_ea_total_i25_v1; Use Eurostat prc_hicp_minr ECOICOP v2 TOTAL, unit I25, geo=EA dynamic euro-area aggregate. | eurostat_prc_hicp_minr_json_total_i25_ea_v1; Fail closed if the time dimension or values map is absent, if coicop18/unit/geo parameters change, or if the endpoint returns the archived ECOICOP1 dataset. |
| JPY | documented; monthly Statistics Bureau/e-Stat Japan CPI release schedule.; precision=date; tz=Asia/Tokyo | 2026-05 released 2026-06-19; next 2026-07-24 | documented; Statistics Bureau/e-Stat publishes update dates for monthly tables; later updates must be captured as new artifacts before point-in-time promotion.; 2020-base Table 1-1 is the current selected contract through July 2026; 2025-base historical data and linked index become a new candidate source version when released. | locked; jpy_estat_table_1_1_2020_base_until_2025_base_v2_audit_v1; Use e-Stat Table 1-1 monthly Subgroup Index for Japan all-items, 2020-base, and treat 2025-base as a future supersession gate with linked-index validation. | estat_get_stats_data_table_1_1_japan_all_items_2020_base_v1; Fail closed if e-Stat status is non-zero, time class metadata is missing, or the all-items category/table parameters stop returning monthly Japan rows. |
| AUD | documented; monthly CPI from October 2025 onward; quarterly CPI remains available for indexation and history.; precision=exact_timestamp; tz=Australia/Sydney | 2026-04 released 2026-05-27 11:30; next 2026-06-24 | documented; ABS publishes current and previous CPI releases; any revised/re-referenced historical row must be captured by artifact hash before promotion.; September 2025 is the current monthly/quarterly CPI reference period; re-referencing changes index levels but preserves underlying quarterly movements. | locked; aud_abs_quarterly_to_complete_monthly_headline_native_frequency_v1; Use native quarterly CPI all-groups weighted-average history through September quarter 2025 and official complete monthly CPI headline from October 2025 forward. | abs_sdmx_cpi_all_groups_csv_v1; Fail closed if TIME_PERIOD/OBS_VALUE fields are absent, series key changes, or monthly/quarterly rows are mixed without the continuity segment marker. |
| NZD | documented; quarterly CPI information release; Stats NZ has announced future monthly CPI from 2027.; precision=date; tz=Pacific/Auckland | 2026-Q1 released 2026-04-20; next pending/current-calendar | documented; Stats NZ CPI review material documents basket/weight reviews; later revised Infoshare exports must be captured as new artifacts for point-in-time promotion.; Infoshare CPIQ.SE9NS1160 all-groups quarterly index remains the selected v1 branch; CPI reviews and future monthly CPI require explicit source-version changes. | locked; nzd_statsnz_infoshare_cpiq_se9ns1160_quarterly_all_groups_v1; Use Stats NZ Infoshare Export Direct .sch contract for CPIQ.SE9NS1160 all-groups quarterly CPI. | statsnz_infoshare_export_direct_sch_cpiq_se9ns1160_v1; Fail closed if hidden form controls are absent, the export returns HTML instead of CSV, or the CPIQ.SE9NS1160 row is missing. |
| CHF | documented; monthly Swiss CPI publication at the beginning of the following month.; precision=exact_timestamp; tz=Europe/Zurich | 2026-05 released 2026-06-04 08:30; next pending/current-calendar | documented; FSO publishes monthly CPI press releases and detailed result workbooks; revised or replacement workbooks must be captured by artifact hash.; The selected workbook is LIK25B25 on December 2025=100; FSO 2025 revision and annual basket reweighting are explicit contract metadata. | locked; chf_fso_lik25b25_index_m_total_row_dec2025_100_v1; Use Swiss FSO LIK25B25 detailed results workbook, INDEX_m all-items total row, December 2025=100. | swiss_fso_lik25b25_index_m_sheet1_row5_v1; Fail closed if sheet1.xml, row 4, row 5, numeric date serials, or numeric all-items values are absent. |

## Files

- JSON: app\reports\data-verification\macro-regime\gate50-official-cpi-endpoint-feasibility-20260622.json
- Markdown: app\reports\data-verification\macro-regime\gate50-official-cpi-endpoint-feasibility-20260622.md
