# Gate 50 Official CPI Endpoint Feasibility Receipt

Generated: 2026-06-22T18:28:15.587Z

## Result

- Overall status: FAIL_CPI_FAMILY_ENDPOINT_CONTRACT_INCOMPLETE
- Promotion eligible: false
- Receipt hash: de503488926f8b6e38102e92c829d7da4640e0d456ca7ee57db38f3da1f6e9aa
- Live payload set hash: efd3bb31e3e1b181ca8949c32e8cce65d48956f265d7a210f39a27ad8dcb27b6
- Branches with observed required-window coverage: 8
- Promotion-unblocked full-window candidates: 0
- Continuity/pending branches: 8

This receipt is endpoint/sample proof only. It does not promote CPI, build ACTIVE manifests, compute real-rate pressure, or run macro outcomes.

## Branches

| Currency | Provider | Status | Parsed | First | Last | Latest value | Blockers |
|---|---|---|---:|---|---|---:|---|
| USD | Bureau of Labor Statistics | sample_pass_continuity_pending | 88 | 2019-01 | 2026-05 | 335.123 | Release-calendar and revision-policy proof still required before CPI family promotion. |
| CAD | Statistics Canada | sample_pass_continuity_pending | 120 | 2016-06 | 2026-05 | 169.6 | Vector 41690973 must be pinned to the final source contract with table-dimension evidence.<br>Release-calendar and revision-policy proof still required before CPI family promotion. |
| GBP | Office for National Statistics | sample_pass_continuity_pending | 461 | 1988-01 | 2026-05 | 142.4 | ONS version-history/release-artifact proof still required before CPI family promotion. |
| EUR | Eurostat | sample_pass_continuity_pending | 365 | 1996-01 | 2026-05 | 103.13 | Eurostat archived prc_hicp_midx must be formally superseded by prc_hicp_minr ECOICOP v2 in the final continuity contract.<br>Dynamic euro-area aggregate geo=EA must be explicitly accepted or replaced with a fixed-composition area in the source contract.<br>Release-calendar and revision-policy proof still required before CPI family promotion. |
| JPY | Statistics Bureau of Japan / e-Stat | sample_pass_continuity_pending | 677 | 1970-01 | 2026-05 | 113.5 | Japan 2015/2020/2025 base-continuity decision and release-calendar proof still required before CPI family promotion. |
| AUD | Australian Bureau of Statistics | sample_pass_continuity_pending | 29 | 2019-Q1 | 2026-Q1 | 101.81 | ABS quarterly-to-monthly headline transition needs an explicit continuity/version decision before promotion.<br>Release-calendar and revision-policy proof still required before CPI family promotion. |
| NZD | Stats NZ | sample_pass_continuity_pending | 29 | 2019-Q1 | 2026-Q1 | 1339 | Infoshare Export Direct .sch-file contract must be formalized in the final source contract.<br>Release-calendar and revision-policy proof still required before CPI family promotion. |
| CHF | Swiss Federal Statistical Office | sample_pass_continuity_pending | 522 | 1982-12 | 2026-05 | 101.2587 | Swiss FSO XLSX parser must be locked to LIK25B25 INDEX_m row 5 and monitored for workbook layout drift.<br>Release-calendar and revision-policy proof still required before CPI family promotion. |

## Files

- JSON: app/reports/data-verification/macro-regime/gate50-official-cpi-endpoint-feasibility-det2-20260622.json
- Markdown: app/reports/data-verification/macro-regime/gate50-official-cpi-endpoint-feasibility-det2-20260622.md
