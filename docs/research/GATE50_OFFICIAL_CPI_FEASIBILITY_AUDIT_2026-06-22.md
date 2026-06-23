# Gate 50 Official CPI Feasibility Audit

Date: 2026-06-22

Gate: Gate 50: macro-source-promotion-proof

Status: preliminary source-access and contract-feasibility audit. This is not a
promotion receipt, not an ACTIVE manifest, and not a macro outcome test.

## Purpose

Evaluate whether the CPI family can move from the failed FRED/OECD mirror map
to direct official producer contracts for the full eight-currency/economic-area
set:

- AUD -> Australian Bureau of Statistics
- CAD -> Statistics Canada
- CHF -> Swiss Federal Statistical Office
- EUR -> Eurostat
- GBP -> Office for National Statistics
- JPY -> Statistics Bureau/e-Stat
- NZD -> Stats NZ
- USD -> Bureau of Labor Statistics

The target source rule is: if an official producer can supply complete history,
documented releases, revision/base behavior, and a sustainable live retrieval
path, use that official source for the whole CPI feature version. Do not splice
FRED history to a national-source tail.

## Access Finding

Do not create eight accounts up front. The first Gate 50 access conclusion is
that most official CPI paths appear public. Credentials are required only where
the selected promoted endpoint requires them.

| Currency | Candidate official source | Candidate CPI target | Native frequency | Account/key expectation | Preliminary disposition |
|---|---|---|---|---|---|
| USD | Bureau of Labor Statistics | CPI-U all items, not seasonally adjusted, current series | Monthly | No key required for basic public API; BLS registration key is optional for expanded API access | Feasible pending exact series contract, release calendar, and revision proof |
| CAD | Statistics Canada | Table 18-10-0004-01, all-items CPI, Canada, not seasonally adjusted | Monthly | Public WDS/API path expected | Feasible pending vector/dimension pin and revision/release proof |
| GBP | Office for National Statistics | D7BT, CPI INDEX 00: ALL ITEMS 2015=100 | Monthly | Public ONS dataset/time-series paths expected | Feasible pending version-history/release-artifact proof |
| EUR | Eurostat | HICP monthly data index, all-items, euro area | Monthly | Public Eurostat API expected | Feasible pending geo/version decision and release proof |
| JPY | Statistics Bureau/e-Stat | CPI 2020-base Table 1-1, Subgroup Index for Japan, all items | Monthly | e-Stat appId required and now configured as `ESTAT_APP_ID` locally | Feasible pending full history/base-continuity proof |
| AUD | Australian Bureau of Statistics | CPI all groups/headline series | Quarterly historically; monthly headline transition requires explicit continuity decision | ABS Data API appears public; ABS Indicator API requires key, so prefer Data API if sufficient | Feasible but needs explicit monthly/quarterly transition contract |
| NZD | Stats NZ | Consumers price index, all groups | Quarterly | Public CSV/official release path expected | Feasible pending stable CSV/API artifact path and release proof |
| CHF | Swiss Federal Statistical Office | Swiss CPI all items / national CPI index | Monthly | Public FSO/PxWeb/OpenData path expected | Feasible pending exact table/API discovery and release proof |

## Endpoint Receipt Result

Latest machine endpoint receipt:

- Script:
  `app/scripts/verification/audit-official-cpi-endpoint-feasibility.ts`
- Command:
  `npm run verification:audit-official-cpi-endpoints`
- Receipt:
  `app/reports/data-verification/macro-regime/gate50-official-cpi-endpoint-feasibility-20260622.{json,md}`
- Receipt hash:
  `f9b265bce3c8430c689b18ccd3a9553cbd5df4f824003c8336a7ef16070adc06`
- Overall status:
  `CPI_FAMILY_MANIFEST_BUILT_DIAGNOSTIC`
- Overall promotion status:
  `FAIL_CLOSED`
- Blocking reason:
  `RATE_FAMILY_CONTRACT_PENDING_FOR_RRP_PROMOTION`
- Promotion eligible:
  `false`
- Outcome consumable:
  `false`
- Source-contract proof branches:
  `8/8`
- Release-calendar proof branches:
  `8/8`
- Revision/rebasing proof branches:
  `8/8`
- Continuity decisions locked:
  `8/8`
- Parser contracts recorded:
  `8/8`
- Normalized CPI schema branches:
  `8/8`
- Source-family validation pass branches:
  `8/8`
- Manifest-built branches:
  `8/8`
- CPI family manifest hash:
  `644415dfa52147892cd9cb080494026102e93c4f894dbf7d1caac1add5bea4aa`

The receipt is endpoint/sample, normalized source-family, and diagnostic
manifest proof only. It does not promote CPI, build ACTIVE manifests, compute
real-rate pressure, or run macro outcomes. The headline receipt hash now
includes the recorded source-contract proof, normalized schema metadata, and
diagnostic manifest identities. The prior stable
parsed-proof hash
`de503488926f8b6e38102e92c829d7da4640e0d456ca7ee57db38f3da1f6e9aa` is
superseded by the contract-proof schema. Live endpoint payload hashes remain in
each branch response, and the receipt also emits a separate
`livePayloadSetHash` because BLS/e-Stat response bytes can vary while parsed
observations remain identical.

Observed required-window endpoint samples now exist for all eight branches:

| Currency | Provider | Parsed sample window | Current sample |
|---|---|---:|---:|
| USD | BLS | 2019-01 to 2026-05 | 335.123 |
| CAD | Statistics Canada | 2016-06 to 2026-05 | 169.6 |
| GBP | ONS | 1988-01 to 2026-05 | 142.4 |
| EUR | Eurostat | 1996-01 to 2026-05 | 103.13 |
| JPY | Statistics Bureau/e-Stat | 1970-01 to 2026-05 | 113.5 |
| AUD | ABS | 2019-Q1 to 2026-Q1 | 101.81 |
| NZD | Stats NZ | 2019-Q1 to 2026-Q1 | 1339 |
| CHF | Swiss FSO | 1982-12 to 2026-05 | 101.2587 |

The CPI family is still not promotion-ready. Endpoint access, source contract
proof, normalized observation schema, source-family validation, and diagnostic
non-ACTIVE CPI manifests are now recorded for all eight branches, but the
receipt correctly remains fail-closed because the emitted currency bundles are
CPI-only `PARTIAL_SEALED` diagnostics and the rate/RRP contracts remain
unresolved.

Locked continuity decisions:

- `USD`: BLS direct `CUUR0000SA0`, CPI-U U.S. city average all-items, not
  seasonally adjusted, `1982-84=100`.
- `CAD`: Statistics Canada table `18-10-0004-01`, vector `41690973`, Canada
  all-items monthly CPI, not seasonally adjusted.
- `GBP`: ONS MM23 time series `D7BT`, CPI index all-items, `2015=100`.
- `EUR`: Eurostat `prc_hicp_minr` ECOICOP v2 `TOTAL` / `I25` / `geo=EA`;
  evolving euro-area composition is versioned as `EA20` through `2025-12` and
  `EA21` from `2026-01`, and archived `prc_hicp_midx` is superseded for this
  branch.
- `JPY`: e-Stat Table `1-1` monthly Subgroup Index for Japan all-items,
  `2020-base`; `2025-base` becomes a future supersession audit with linked
  index validation.
- `AUD`: native quarterly CPI all-groups history through September quarter
  2025, then official complete monthly CPI headline from October 2025 with
  first monthly eligibility after `2025-11-26 11:30 Australia/Sydney`; no
  interpolation.
- `NZD`: Stats NZ Infoshare Export Direct `.sch` contract for
  `CPIQ.SE9NS1160`, all-groups quarterly CPI.
- `CHF`: Swiss FSO `LIK25B25` detailed workbook, `INDEX_m` all-items total row,
  December `2025=100`, with workbook layout drift fail-closed.

## Official Source Evidence Pointers

- BLS Public Data API: public access without registration for normal use;
  registration key expands API access. Candidate CPI source family should prefer
  BLS direct series, not FRED mirror.
  <https://www.bls.gov/bls/api_features.htm>
  <https://www.bls.gov/developers/api_signature_v2.htm>
- Statistics Canada CPI table 18-10-0004-01 and WDS/API documentation:
  <https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810000401>
  <https://www.statcan.gc.ca/en/developers/wds>
  <https://www.statcan.gc.ca/en/developers/wds/user-guide>
- ONS CPI all-items time series D7BT and CPI dataset MM23:
  <https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7bt/mm23>
  <https://www.ons.gov.uk/economy/inflationandpriceindices/datasets/consumerpriceindices>
- Eurostat HICP monthly index dataset and 2026 HICP base/version material:
  <https://ec.europa.eu/eurostat/databrowser/product/view/prc_hicp_midx>
  <https://ec.europa.eu/eurostat/databrowser/product/view/prc_hicp_minr>
  <https://ec.europa.eu/eurostat/cache/metadata/en/prc_hicp_esms.htm>
  <https://ec.europa.eu/eurostat/web/hicp/database>
- Japan CPI official Statistics Bureau/e-Stat path:
  <https://www.stat.go.jp/english/data/cpi/1581-z.html>
  <https://www.e-stat.go.jp/en/stat-search/files?cycle=1&layout=datalist&month=12040604&page=1&result_back=1&tclass1=000001150149&tclass2val=0&toukei=00200573&tstat=000001150147&year=20250>
- ABS Data API and CPI transition material:
  <https://www.abs.gov.au/statistics/application-programming-interfaces-apis/data-api-user-guide>
  <https://www.abs.gov.au/about/key-priorities/big-data-timely-insights-phase-2/complete-monthly-measure-cpi/monthly-and-quarterly-data-series>
  <https://www.abs.gov.au/statistics/application-programming-interfaces-apis/indicator-api>
- Stats NZ CPI official pages, Infoshare, and Export Direct contract path:
  <https://www.stats.govt.nz/indicators/consumers-price-index-cpi/>
  <https://www.stats.govt.nz/topics/price-indexes/>
  <https://www.stats.govt.nz/tools/stats-infoshare/>
  <https://infoshare.stats.govt.nz/Help/export-direct.asp>
  <https://datainfoplus.stats.govt.nz/Item/nz.govt.stats/8b0860b8-cf63-4f12-a578-8eed8ba69ac3>
- Swiss FSO CPI and public API/open-data pointers:
  <https://www.bfs.admin.ch/bfs/en/home/statistics/prices/consumer-price-index.html>
  <https://www.bfs.admin.ch/asset/en/su-e-05.02.66>
  <https://opendata.swiss/en/dataset/lik-dezember-2025100-detailresultate-seit-1982-warenkorbstruktur-2025-inkl-sondergliederungen-l>

## Required Next Proof

The next Gate 50 CPI task is not account creation and not macro outcome work.
The remaining source-only path is:

1. The shared CPI observation schema is now normalized in the receipt with
   native monthly/quarterly/mixed frequency preserved.
2. Source-family validation now verifies each contract's release calendar,
   revision/rebasing rule, continuity decision, parser version, artifact hash,
   unit/base, and all-items/headline semantics.
3. Diagnostic `cpi_all_items_family_v1` and CPI-only currency bundles are now
   emitted as `SEALED` / `PARTIAL_SEALED` / non-ACTIVE / not
   outcome-consumable manifest identities.
4. Keep FRED/ALFRED CPI as shadow validation only unless an official CPI source
   contract later fails.
5. Next Gate 50 blocker is the rate vintage-selection and release-aware
   staleness contract before full RRP currency bundles and weekly snapshot
   promotion can be built.

## Current Decision

Do not ask Freedom to create more accounts yet. The only confirmed configured
credential requirement in the current CPI direction is e-Stat `ESTAT_APP_ID`.
BLS registration may become useful for expanded API access, but it is not a
current blocker. ABS Indicator API requires a key, but the Data API should be
audited first because it may avoid an additional credential.
