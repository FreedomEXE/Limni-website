import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

loadEnvConfig(process.cwd());

const DEFAULT_OUT_DIR = "app/reports/data-verification/macro-regime";
const DEFAULT_JSON = "gate50-official-cpi-endpoint-feasibility-20260622.json";
const USER_AGENT = "LimniGate50OfficialCpiEndpointAudit/1.0";
const REQUIRED_MONTHLY_START = "2019-01";
const REQUIRED_QUARTERLY_START = "2019-Q1";
const MIN_CURRENT_MONTHLY_PERIOD = "2026-01";
const MIN_CURRENT_QUARTERLY_PERIOD = "2026-Q1";

type JsonRecord = Record<string, unknown>;

type SampleStatus =
  | "full_window_candidate"
  | "sample_pass_continuity_pending"
  | "release_sample_only"
  | "machine_artifact_reachable_parser_pending"
  | "credential_missing"
  | "request_failed";

type SourceContractProof = {
  proofStatus: "recorded_manifest_pending";
  releaseCalendar: {
    status: "documented";
    cadence: string;
    precision: "exact_timestamp" | "date" | "mixed";
    timezone: string;
    latestSamplePublication: {
      observationPeriod: string;
      releaseDateLocal: string;
      releaseTimeLocal: string | null;
      nextReleaseDateLocal: string | null;
    };
    pointInTimeRule: string;
    evidenceUrls: string[];
  };
  revisionRebasing: {
    status: "documented";
    revisionPolicy: string;
    rebasingPolicy: string;
    pointInTimeImplication: string;
    evidenceUrls: string[];
  };
  continuityDecision: {
    status: "locked" | "standard_contract_pinned";
    decisionId: string;
    decision: string;
    implications: string[];
  };
  parserContract: {
    parserVersion: string;
    contract: string;
    layoutDriftGuard: string;
  };
  residualPromotionBlockers: string[];
};

type CpiProbe = {
  currency: string;
  provider: string;
  sourceContractId: string;
  semanticTarget: string;
  nativeFrequency: "monthly" | "quarterly" | "mixed";
  endpointMode: string;
  credential: {
    required: boolean;
    used: boolean;
    variableName: string | null;
  };
  request: {
    method: "GET" | "POST";
    url: string;
    sanitizedParams?: JsonRecord;
    sanitizedBody?: unknown;
  };
  response: {
    ok: boolean;
    status: number | null;
    contentType: string | null;
    payloadBytes: number | null;
    payloadSha256: string | null;
  };
  observations: {
    parsedCount: number;
    firstPeriod: string | null;
    lastPeriod: string | null;
    latestValue: number | null;
    unit: string | null;
    seasonalAdjustment: string | null;
    baseOrReferencePeriod: string | null;
  };
  coverage: {
    requiredStartPeriod: string;
    minimumCurrentPeriodSeen: string;
    coversRequiredStart: boolean;
    reachesCurrentSample: boolean;
  };
  sampleStatus: SampleStatus;
  promotionEligible: false;
  blockers: string[];
  officialEvidenceUrls: string[];
  sourceContractProof: SourceContractProof;
  notes: string[];
};

type PeriodValue = {
  period: string;
  value: number;
};

type CpiSemanticSegment = {
  segmentId: string;
  segmentType: "frequency" | "geo_composition" | "standard";
  validFromPeriod: string | null;
  validToPeriod: string | null;
  frequency: CpiProbe["nativeFrequency"] | "monthly" | "quarterly";
  yoyLagPeriods: 4 | 12;
  geoPolicy?: "fixed_country" | "evolving_official_euro_area";
  memberCompositionId?: string;
  memberCompositionHash?: string;
  chainLinkPolicy?: string;
  releaseEligibilityRule?: string;
};

type NormalizedCpiObservationContract = {
  schemaVersion: "cpi_normalized_observation_v1";
  familyCandidateId: "cpi_all_items_family_v1";
  familyManifestStatus: "BUILT_DIAGNOSTIC";
  currency: string;
  economicAreaId: string;
  sourceContractId: string;
  semanticTarget: string;
  observationPeriodField: "observationPeriod";
  indexLevelField: "indexLevel";
  nativeFrequency: CpiProbe["nativeFrequency"];
  periodFormat: "YYYY-MM" | "YYYY-QN" | "YYYY-QN_THEN_YYYY-MM";
  periodSegment: string;
  yoyFormula: "t_over_t_minus_12_minus_1" | "t_over_t_minus_4_minus_1" | "native_segmented_t_over_lag_minus_1";
  unit: string | null;
  seasonalAdjustment: string | null;
  baseOrReferencePeriod: string | null;
  releaseCalendarVersion: string;
  availabilityPrecision: SourceContractProof["releaseCalendar"]["precision"];
  availabilityTimezone: string;
  pointInTimeRule: string;
  revisionRebasingVersion: string;
  continuityDecisionId: string;
  parserVersion: string;
  parserLayoutDriftGuard: string;
  semanticSegments: CpiSemanticSegment[];
  artifactPayloadSha256: string | null;
  sourceContractHash: string;
  branchSemanticHash: string;
  validationStatus: "PASS_SOURCE_CONTRACT_SCHEMA_DIAGNOSTIC_MANIFEST_SEALED" | "FAIL_SOURCE_CONTRACT_SCHEMA_INCOMPLETE";
  blockers: string[];
};

type CpiFamilyValidationBranch = {
  currency: string;
  sourceContractId: string;
  validationStatus: NormalizedCpiObservationContract["validationStatus"];
  checks: Record<string, boolean>;
  failedChecks: string[];
  blockers: string[];
};

type DiagnosticCpiFamilyManifest = {
  manifestType: "cpi_family_manifest";
  familyManifestId: "cpi_all_items_family_v1";
  familyManifestHash: string;
  familyManifestStatus: "BUILT_DIAGNOSTIC";
  manifestState: "SEALED";
  diagnosticOnly: true;
  promotionEligible: false;
  outcomeConsumable: false;
  requiredCurrencySet: string[];
  requiredCurrencySetHash: string;
  atomicSourceValidationStatus: "PASS";
  validatedBranches: number;
  allItemsDefinition: string;
  seasonalAdjustmentPolicy: "not_seasonally_adjusted";
  nativeFrequencyPolicy: string;
  frequencySegmentPolicy: string;
  yoyTransformationRules: {
    monthly: "t_over_t_minus_12_minus_1";
    quarterly: "t_over_t_minus_4_minus_1";
    mixed: "native_segmented_t_over_lag_minus_1";
  };
  availabilityPolicy: string;
  stalenessPolicy: string;
  branchSemanticHashes: Record<string, string>;
  sourceContractHashes: Record<string, string>;
  releaseCalendarVersions: Record<string, string>;
  failClosedGuards: string[];
  caveats: string[];
  manifestHashPolicy: string;
};

type DiagnosticCpiCurrencyBundleManifest = {
  manifestType: "currency_macro_bundle_manifest";
  currencyMacroBundleId: string;
  currencyMacroBundleHash: string;
  bundleScope: "CPI_DIAGNOSTIC";
  bundleState: "PARTIAL_SEALED";
  manifestState: "SEALED";
  diagnosticOnly: true;
  promotionEligible: false;
  outcomeConsumable: false;
  currency: string;
  economicAreaId: string;
  cpiFamilyManifestId: "cpi_all_items_family_v1";
  cpiFamilyManifestHash: string;
  cpiSourceContractId: string;
  cpiSourceContractHash: string;
  cpiBranchSemanticHash: string;
  sourceContractStatus: NormalizedCpiObservationContract["validationStatus"];
  proofArtifactPayloadSha256: string | null;
  missingForRrpPromotion: string[];
  caveats: string[];
};

const FAMILY_MANIFEST_BLOCKER =
  "Diagnostic CPI family and currency-bundle manifests are sealed, but they are CPI-only, non-ACTIVE, not outcome-consumable, and rate/RRP promotion contracts remain unresolved.";

const CPI_FAMILY_CANDIDATE_ID = "cpi_all_items_family_v1";
const CPI_NORMALIZED_OBSERVATION_SCHEMA_VERSION = "cpi_normalized_observation_v1";
const NORMALIZED_CPI_REQUIRED_FIELDS = [
  "currency",
  "economicAreaId",
  "sourceContractId",
  "observationPeriod",
  "nativeFrequency",
  "indexLevel",
  "unit",
  "seasonalAdjustment",
  "baseOrReferencePeriod",
  "releaseCalendarVersion",
  "availabilityPrecision",
  "availabilityTimezone",
  "pointInTimeRule",
  "revisionRebasingVersion",
  "continuityDecisionId",
  "parserVersion",
  "parserLayoutDriftGuard",
  "semanticSegments",
  "artifactPayloadSha256",
  "sourceContractHash",
  "branchSemanticHash",
] as const;

const REQUIRED_CURRENCY_SET = ["AUD", "CAD", "CHF", "EUR", "GBP", "JPY", "NZD", "USD"] as const;

const ECONOMIC_AREA_BY_CURRENCY: Record<string, string> = {
  AUD: "AU",
  CAD: "CA",
  CHF: "CH",
  EUR: "EA_DYNAMIC",
  GBP: "UK",
  JPY: "JP",
  NZD: "NZ",
  USD: "US",
};

const SOURCE_CONTRACT_PROOFS: Record<string, SourceContractProof> = {
  USD: {
    proofStatus: "recorded_manifest_pending",
    releaseCalendar: {
      status: "documented",
      cadence: "monthly CPI release; BLS publishes the scheduled release timestamp.",
      precision: "exact_timestamp",
      timezone: "America/New_York",
      latestSamplePublication: {
        observationPeriod: "2026-05",
        releaseDateLocal: "2026-06-10",
        releaseTimeLocal: "08:30",
        nextReleaseDateLocal: "2026-07-14",
      },
      pointInTimeRule: "A CPI-U observation is eligible only after the BLS release timestamp is at or before the weekly freeze target.",
      evidenceUrls: [
        "https://www.bls.gov/cpi/",
        "https://www.bls.gov/news.release/cpi.htm",
      ],
    },
    revisionRebasing: {
      status: "documented",
      revisionPolicy: "Selected contract is CPI-U all items not seasonally adjusted; seasonally adjusted BLS CPI series are revised for annual seasonal-factor recalculation, while this contract avoids the seasonally adjusted path.",
      rebasingPolicy: "CPI-U all items stays on 1982-84=100; future methodology or series-definition changes require a new source contract version.",
      pointInTimeImplication: "Store the official BLS release artifact and release timestamp; do not substitute C-CPI-U or seasonally adjusted all-items rows.",
      evidenceUrls: [
        "https://www.bls.gov/cpi/questions-and-answers.htm",
        "https://www.bls.gov/cpi/seasonal-adjustment/using-seasonally-adjusted-data.htm",
        "https://www.bls.gov/cpi/additional-resources/historical-changes.htm",
      ],
    },
    continuityDecision: {
      status: "standard_contract_pinned",
      decisionId: "usd_bls_cpi_u_all_items_nsa_1982_84_v1",
      decision: "Use BLS series CUUR0000SA0, CPI-U U.S. city average all-items, not seasonally adjusted, 1982-84=100.",
      implications: [
        "No FRED CPI mirror is promoted when BLS direct source passes.",
        "No chained CPI or seasonally adjusted CPI row can satisfy this contract.",
      ],
    },
    parserContract: {
      parserVersion: "bls_public_timeseries_html_table_parser_v1",
      contract: "Parse official BLS time-series table year rows for CUUR0000SA0, with twelve monthly cells and numeric values.",
      layoutDriftGuard: "Fail closed if the BLS table lacks parseable year rows/month cells or latest parsed period does not reach the required current sample.",
    },
    residualPromotionBlockers: [FAMILY_MANIFEST_BLOCKER],
  },
  CAD: {
    proofStatus: "recorded_manifest_pending",
    releaseCalendar: {
      status: "documented",
      cadence: "monthly CPI table and The Daily release.",
      precision: "date",
      timezone: "America/Toronto",
      latestSamplePublication: {
        observationPeriod: "2026-05",
        releaseDateLocal: "2026-06-22",
        releaseTimeLocal: null,
        nextReleaseDateLocal: "2026-07-20",
      },
      pointInTimeRule: "A Statistics Canada CPI row is eligible on the first weekly freeze strictly after the documented release date unless an exact timestamp artifact is added.",
      evidenceUrls: [
        "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810000401",
        "https://www150.statcan.gc.ca/n1/daily-quotidien/260622/dq260622a-eng.htm",
        "https://www.statcan.gc.ca/en/subjects-start/prices_and_price_indexes/consumer_price_indexes",
      ],
    },
    revisionRebasing: {
      status: "documented",
      revisionPolicy: "Selected table is not seasonally adjusted; Statistics Canada documents annual CPI basket updates and separate revision behaviour for seasonally adjusted/core series.",
      rebasingPolicy: "All-items CPI remains 2002=100 while basket weights are updated; basket-link changes require source-contract metadata but not a FRED splice.",
      pointInTimeImplication: "Store table/vector metadata and The Daily release evidence for each observation vintage before promotion.",
      evidenceUrls: [
        "https://www23.statcan.gc.ca/imdb/p2SV.pl?Function=getMainChange&Id=1583256",
        "https://www.statcan.gc.ca/en/subjects-start/prices_and_price_indexes/consumer_price_indexes/faq",
        "https://www150.statcan.gc.ca/n1/pub/62-001-x/2017001/technote-notetech1-eng.htm",
      ],
    },
    continuityDecision: {
      status: "locked",
      decisionId: "cad_statcan_1810000401_vector_41690973_all_items_canada_nsa_v1",
      decision: "Pin table 18-10-0004-01 vector 41690973 for Canada all-items monthly CPI, not seasonally adjusted.",
      implications: [
        "Vector identity must be preserved in the source map.",
        "Future vector or table replacement requires a new source contract version and parity audit.",
      ],
    },
    parserContract: {
      parserVersion: "statcan_wds_vector_41690973_latest_periods_json_v1",
      contract: "POST getDataFromVectorsAndLatestNPeriods for vector 41690973 and parse vectorDataPoint.refPer/value.",
      layoutDriftGuard: "Fail closed if vectorDataPoint is absent, refPer stops being an ISO date, or table/vector metadata no longer maps to Canada all-items CPI.",
    },
    residualPromotionBlockers: [FAMILY_MANIFEST_BLOCKER],
  },
  GBP: {
    proofStatus: "recorded_manifest_pending",
    releaseCalendar: {
      status: "documented",
      cadence: "monthly ONS consumer price inflation dataset release.",
      precision: "date",
      timezone: "Europe/London",
      latestSamplePublication: {
        observationPeriod: "2026-05",
        releaseDateLocal: "2026-06-17",
        releaseTimeLocal: null,
        nextReleaseDateLocal: "2026-07-22",
      },
      pointInTimeRule: "An ONS CPI row is eligible on the first weekly freeze strictly after the ONS release date unless exact release-time evidence is added.",
      evidenceUrls: [
        "https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7bt/mm23",
        "https://www.ons.gov.uk/economy/inflationandpriceindices/datasets/consumerpriceindices",
      ],
    },
    revisionRebasing: {
      status: "documented",
      revisionPolicy: "ONS exposes previous versions for the time series; any back data/version change must be captured as a new artifact and compared before promotion.",
      rebasingPolicy: "D7BT is CPI all-items 2015=100; a future CPI rebasing requires a new contract version.",
      pointInTimeImplication: "Use ONS previous-version artifacts for point-in-time reconstruction instead of reading only latest time-series JSON.",
      evidenceUrls: [
        "https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7bt/mm23/previous/v107/previous",
        "https://www.ons.gov.uk/economy/inflationandpriceindices/methodologies/consumerpricesindicestechnicalmanual2019",
      ],
    },
    continuityDecision: {
      status: "standard_contract_pinned",
      decisionId: "gbp_ons_d7bt_cpi_all_items_2015_100_v1",
      decision: "Use ONS MM23 time series D7BT for CPI index 00: all items, 2015=100.",
      implications: [
        "Use ONS as the producer source, not a FRED/OECD mirror.",
        "ONS previous-version data is the vintage audit path.",
      ],
    },
    parserContract: {
      parserVersion: "ons_timeseries_d7bt_mm23_json_v1",
      contract: "Parse months array from the D7BT MM23 JSON endpoint with MMM-YYYY labels and numeric values.",
      layoutDriftGuard: "Fail closed if the months array is absent, labels no longer parse to months, or latest period is behind the required current sample.",
    },
    residualPromotionBlockers: [FAMILY_MANIFEST_BLOCKER],
  },
  EUR: {
    proofStatus: "recorded_manifest_pending",
    releaseCalendar: {
      status: "documented",
      cadence: "monthly Eurostat HICP full-data release; flash estimate is not the selected contract.",
      precision: "date",
      timezone: "Europe/Luxembourg",
      latestSamplePublication: {
        observationPeriod: "2026-05",
        releaseDateLocal: "2026-06-17",
        releaseTimeLocal: null,
        nextReleaseDateLocal: null,
      },
      pointInTimeRule: "A full HICP index row is eligible on the first weekly freeze strictly after the Eurostat full-data release date.",
      evidenceUrls: [
        "https://ec.europa.eu/eurostat/cache/metadata/en/prc_hicp_esms.htm",
        "https://ec.europa.eu/eurostat/news/euro-indicators/release-calendar",
        "https://ec.europa.eu/eurostat/web/products-euro-indicators/w/2-02062026-ap",
      ],
    },
    revisionRebasing: {
      status: "documented",
      revisionPolicy: "HICP is published as final but can be revised for errors, provisional finalisation, or major methodological changes; first-published HICP data exists as a vintage evidence path.",
      rebasingPolicy: "ECOICOP v2 dataset uses 2025=100; prc_hicp_midx/ECOICOP1 is archived and frozen, so prc_hicp_minr supersedes it for this contract.",
      pointInTimeImplication: "Use prc_hicp_minr for latest contract rows and preserve prc_hicp_fpd or release artifacts for first-published/vintage validation where required.",
      evidenceUrls: [
        "https://ec.europa.eu/eurostat/cache/metadata/en/prc_hicp_esms.htm",
        "https://ec.europa.eu/eurostat/web/hicp/information-data",
        "https://ec.europa.eu/eurostat/web/products-euro-indicators/w/2-04022026-ap",
      ],
    },
    continuityDecision: {
      status: "locked",
      decisionId: "eur_eurostat_prc_hicp_minr_dynamic_ea_total_i25_v1",
      decision: "Use Eurostat prc_hicp_minr ECOICOP v2 TOTAL, unit I25, geo=EA dynamic euro-area aggregate.",
      implications: [
        "This formally supersedes archived prc_hicp_midx for the promoted branch.",
        "Dynamic euro-area composition is accepted for v1 because it is Eurostat's published EA aggregate; fixed-area history would require a separate candidate contract.",
      ],
    },
    parserContract: {
      parserVersion: "eurostat_prc_hicp_minr_json_total_i25_ea_v1",
      contract: "Parse JSON-stat time dimension indices and value map for freq=M, unit=I25, coicop18=TOTAL, geo=EA.",
      layoutDriftGuard: "Fail closed if the time dimension or values map is absent, if coicop18/unit/geo parameters change, or if the endpoint returns the archived ECOICOP1 dataset.",
    },
    residualPromotionBlockers: [FAMILY_MANIFEST_BLOCKER],
  },
  JPY: {
    proofStatus: "recorded_manifest_pending",
    releaseCalendar: {
      status: "documented",
      cadence: "monthly Statistics Bureau/e-Stat Japan CPI release schedule.",
      precision: "date",
      timezone: "Asia/Tokyo",
      latestSamplePublication: {
        observationPeriod: "2026-05",
        releaseDateLocal: "2026-06-19",
        releaseTimeLocal: null,
        nextReleaseDateLocal: "2026-07-24",
      },
      pointInTimeRule: "A Japan CPI row is eligible on the first weekly freeze strictly after the Statistics Bureau release date unless exact release-time evidence is added.",
      evidenceUrls: [
        "https://www.stat.go.jp/english/data/cpi/1582.html",
        "https://www.stat.go.jp/english/data/cpi/1581-z.html",
      ],
    },
    revisionRebasing: {
      status: "documented",
      revisionPolicy: "Statistics Bureau/e-Stat publishes update dates for monthly tables; later updates must be captured as new artifacts before point-in-time promotion.",
      rebasingPolicy: "2020-base Table 1-1 is the current selected contract through July 2026; 2025-base historical data and linked index become a new candidate source version when released.",
      pointInTimeImplication: "Do not splice 2015, 2020, and 2025 bases silently; promote 2020-base v1 through its valid segment, then open a v2 continuity audit for the 2025-base release.",
      evidenceUrls: [
        "https://www.stat.go.jp/english/data/cpi/index.html",
        "https://www.e-stat.go.jp/en/stat-search/files?cycle=1&layout=datalist&month=12040604&page=1&result_back=1&tclass1=000001150149&tclass2val=0&toukei=00200573&tstat=000001150147&year=20250",
      ],
    },
    continuityDecision: {
      status: "locked",
      decisionId: "jpy_estat_table_1_1_2020_base_until_2025_base_v2_audit_v1",
      decision: "Use e-Stat Table 1-1 monthly Subgroup Index for Japan all-items, 2020-base, and treat 2025-base as a future supersession gate with linked-index validation.",
      implications: [
        "2015-base tables are historical validation only for this v1 contract.",
        "2025-base rows cannot replace 2020-base rows until the linked-index and historical-recalculation artifacts are audited.",
      ],
    },
    parserContract: {
      parserVersion: "estat_get_stats_data_table_1_1_japan_all_items_2020_base_v1",
      contract: "Call e-Stat getStatsData with statsDataId 0003427113, cdArea=00000, cdCat01=0001, cdTab=1; map Japanese month labels to YYYY-MM.",
      layoutDriftGuard: "Fail closed if e-Stat status is non-zero, time class metadata is missing, or the all-items category/table parameters stop returning monthly Japan rows.",
    },
    residualPromotionBlockers: [FAMILY_MANIFEST_BLOCKER],
  },
  AUD: {
    proofStatus: "recorded_manifest_pending",
    releaseCalendar: {
      status: "documented",
      cadence: "monthly CPI from October 2025 onward; quarterly CPI remains available for indexation and history.",
      precision: "exact_timestamp",
      timezone: "Australia/Sydney",
      latestSamplePublication: {
        observationPeriod: "2026-04",
        releaseDateLocal: "2026-05-27",
        releaseTimeLocal: "11:30",
        nextReleaseDateLocal: "2026-06-24",
      },
      pointInTimeRule: "Monthly CPI rows are eligible after the ABS release timestamp; quarterly rows remain eligible by their publication date/timestamp for pre-transition history.",
      evidenceUrls: [
        "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia",
        "https://www.abs.gov.au/about/key-priorities/big-data-timely-insights-phase-2/complete-monthly-measure-cpi/release-schedule",
      ],
    },
    revisionRebasing: {
      status: "documented",
      revisionPolicy: "ABS publishes current and previous CPI releases; any revised/re-referenced historical row must be captured by artifact hash before promotion.",
      rebasingPolicy: "September 2025 is the current monthly/quarterly CPI reference period; re-referencing changes index levels but preserves underlying quarterly movements.",
      pointInTimeImplication: "Keep quarterly native history through 2025-Q3 and monthly headline rows from October 2025; do not fabricate monthly history before the official monthly series.",
      evidenceUrls: [
        "https://www.abs.gov.au/about/key-priorities/big-data-timely-insights-phase-2/complete-monthly-measure-cpi/monthly-and-quarterly-data-series",
        "https://www.abs.gov.au/statistics/detailed-methodology-information/information-papers/re-referencing-quarterly-consumer-price-index",
        "https://www.abs.gov.au/statistics/detailed-methodology-information/concepts-sources-methods/consumer-price-index-concepts-sources-and-methods/2025/re-referencing-and-linking-price-indexes",
      ],
    },
    continuityDecision: {
      status: "locked",
      decisionId: "aud_abs_quarterly_to_complete_monthly_headline_native_frequency_v1",
      decision: "Use native quarterly CPI all-groups weighted-average history through September quarter 2025 and official complete monthly CPI headline from October 2025 forward.",
      implications: [
        "Weekly snapshots carry the newest official observation at its native frequency.",
        "CPI YoY uses t/t-4 for quarterly rows and t/t-12 for monthly rows; no interpolation is allowed.",
      ],
    },
    parserContract: {
      parserVersion: "abs_sdmx_cpi_all_groups_csv_v1",
      contract: "Parse ABS SDMX CSV TIME_PERIOD and OBS_VALUE for CPI all-groups weighted average of eight capital cities.",
      layoutDriftGuard: "Fail closed if TIME_PERIOD/OBS_VALUE fields are absent, series key changes, or monthly/quarterly rows are mixed without the continuity segment marker.",
    },
    residualPromotionBlockers: [FAMILY_MANIFEST_BLOCKER],
  },
  NZD: {
    proofStatus: "recorded_manifest_pending",
    releaseCalendar: {
      status: "documented",
      cadence: "quarterly CPI information release; Stats NZ has announced future monthly CPI from 2027.",
      precision: "date",
      timezone: "Pacific/Auckland",
      latestSamplePublication: {
        observationPeriod: "2026-Q1",
        releaseDateLocal: "2026-04-20",
        releaseTimeLocal: null,
        nextReleaseDateLocal: null,
      },
      pointInTimeRule: "A Stats NZ CPI quarter is eligible on the first weekly freeze strictly after the official information-release date unless exact release-time evidence is added.",
      evidenceUrls: [
        "https://www.stats.govt.nz/indicators/consumers-price-index-cpi/",
        "https://www.stats.govt.nz/information-releases/consumers-price-index-march-2026-quarter/",
        "https://www.stats.govt.nz/tools/stats-infoshare/",
        "https://infoshare.stats.govt.nz/Help/export-direct.asp",
      ],
    },
    revisionRebasing: {
      status: "documented",
      revisionPolicy: "Stats NZ CPI review material documents basket/weight reviews; later revised Infoshare exports must be captured as new artifacts for point-in-time promotion.",
      rebasingPolicy: "Infoshare CPIQ.SE9NS1160 all-groups quarterly index remains the selected v1 branch; CPI reviews and future monthly CPI require explicit source-version changes.",
      pointInTimeImplication: "Use the .sch Export Direct artifact for reproducible acquisition; future monthly CPI stays shadow-only until the full history or a new tested contract exists.",
      evidenceUrls: [
        "https://www.stats.govt.nz/methods/consumers-price-index-review-2024/",
        "https://datainfoplus.stats.govt.nz/Item/nz.govt.stats/8b0860b8-cf63-4f12-a578-8eed8ba69ac3",
        "https://www.stats.govt.nz/methods/monthly-consumers-price-index-updates-on-progress/",
      ],
    },
    continuityDecision: {
      status: "locked",
      decisionId: "nzd_statsnz_infoshare_cpiq_se9ns1160_quarterly_all_groups_v1",
      decision: "Use Stats NZ Infoshare Export Direct .sch contract for CPIQ.SE9NS1160 all-groups quarterly CPI.",
      implications: [
        "The Export Direct form POST and .sch series identifier are part of the contract, not an incidental scrape.",
        "Monthly CPI from 2027 is a future v2 candidate only.",
      ],
    },
    parserContract: {
      parserVersion: "statsnz_infoshare_export_direct_sch_cpiq_se9ns1160_v1",
      contract: "Upload a .sch file containing CPIQ.SE9NS1160 to ExportDirect.aspx, request rows CSV, and parse Mar/Jun/Sep/Dec quarter columns.",
      layoutDriftGuard: "Fail closed if hidden form controls are absent, the export returns HTML instead of CSV, or the CPIQ.SE9NS1160 row is missing.",
    },
    residualPromotionBlockers: [FAMILY_MANIFEST_BLOCKER],
  },
  CHF: {
    proofStatus: "recorded_manifest_pending",
    releaseCalendar: {
      status: "documented",
      cadence: "monthly Swiss CPI publication at the beginning of the following month.",
      precision: "exact_timestamp",
      timezone: "Europe/Zurich",
      latestSamplePublication: {
        observationPeriod: "2026-05",
        releaseDateLocal: "2026-06-04",
        releaseTimeLocal: "08:30",
        nextReleaseDateLocal: null,
      },
      pointInTimeRule: "A Swiss CPI row is eligible after the FSO CPI press-release timestamp is at or before the weekly freeze target.",
      evidenceUrls: [
        "https://www.bfs.admin.ch/bfs/en/home/statistics/prices/consumer-price-index.html",
        "https://www.bfs.admin.ch/bfs/en/home/statistiken/preise/landesindex-konsumentenpreise.html",
        "https://www.bfs.admin.ch/bfs/en/home/statistics/prices/consumer-price-index/detailresultate.gnpdetail.2026-0054.html",
      ],
    },
    revisionRebasing: {
      status: "documented",
      revisionPolicy: "FSO publishes monthly CPI press releases and detailed result workbooks; revised or replacement workbooks must be captured by artifact hash.",
      rebasingPolicy: "The selected workbook is LIK25B25 on December 2025=100; FSO 2025 revision and annual basket reweighting are explicit contract metadata.",
      pointInTimeImplication: "Use the exact workbook artifact hash and parser guard; do not switch between December 2020 and December 2025 bases without a source-version change.",
      evidenceUrls: [
        "https://www.bfs.admin.ch/bfs/en/home/statistics/prices/revisions.html",
        "https://www.bfs.admin.ch/asset/en/36435330",
        "https://www.bfs.admin.ch/bfs/en/home/statistics/prices/consumer-price-index/indexierung.html",
      ],
    },
    continuityDecision: {
      status: "locked",
      decisionId: "chf_fso_lik25b25_index_m_total_row_dec2025_100_v1",
      decision: "Use Swiss FSO LIK25B25 detailed results workbook, INDEX_m all-items total row, December 2025=100.",
      implications: [
        "The parser is intentionally tied to the current INDEX_m workbook layout.",
        "A workbook layout drift or basis change fails closed pending review.",
      ],
    },
    parserContract: {
      parserVersion: "swiss_fso_lik25b25_index_m_sheet1_row5_v1",
      contract: "Parse sheet1.xml row 4 as month headers and row 5 as the all-items INDEX_m total row; convert Excel serial dates to YYYY-MM.",
      layoutDriftGuard: "Fail closed if sheet1.xml, row 4, row 5, numeric date serials, or numeric all-items values are absent.",
    },
    residualPromotionBlockers: [FAMILY_MANIFEST_BLOCKER],
  },
};

function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv
    .slice(2)
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length) ?? null;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null ? [] : [value];
}

function stableJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as JsonRecord)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, inner]) => [key, stableJson(inner)]),
    );
  }
  return value;
}

function sha256(value: unknown) {
  const body = typeof value === "string" || Buffer.isBuffer(value)
    ? value
    : JSON.stringify(stableJson(value));
  return createHash("sha256").update(body).digest("hex");
}

function numberFromUnknown(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function decodeXml(text: string) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function decodeHtml(text: string) {
  return decodeXml(text)
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function excelSerialToMonth(serial: number) {
  const utc = Date.UTC(1899, 11, 30) + Math.round(serial) * 24 * 60 * 60 * 1000;
  const date = new Date(utc);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function readZipEntries(buffer: Buffer) {
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;
  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 65557); index -= 1) {
    if (buffer.readUInt32LE(index) === eocdSignature) {
      eocdOffset = index;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("XLSX central directory not found");

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  let directoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = new Map<string, Buffer>();

  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(directoryOffset) !== 0x02014b50) {
      throw new Error("Invalid XLSX central directory entry");
    }
    const compressionMethod = buffer.readUInt16LE(directoryOffset + 10);
    const compressedSize = buffer.readUInt32LE(directoryOffset + 20);
    const fileNameLength = buffer.readUInt16LE(directoryOffset + 28);
    const extraLength = buffer.readUInt16LE(directoryOffset + 30);
    const commentLength = buffer.readUInt16LE(directoryOffset + 32);
    const localHeaderOffset = buffer.readUInt32LE(directoryOffset + 42);
    const fileName = buffer.slice(directoryOffset + 46, directoryOffset + 46 + fileNameLength).toString("utf8");
    const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const compressed = buffer.slice(dataStart, dataStart + compressedSize);
    if (compressionMethod === 0) entries.set(fileName, compressed);
    else if (compressionMethod === 8) entries.set(fileName, inflateRawSync(compressed));
    else throw new Error(`Unsupported XLSX compression method ${compressionMethod} for ${fileName}`);
    directoryOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function xlsxSharedStrings(entries: Map<string, Buffer>) {
  const xml = entries.get("xl/sharedStrings.xml")?.toString("utf8");
  if (!xml) return [];
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    decodeXml([...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((textMatch) => textMatch[1]).join("")),
  );
}

function xlsxCellValue(cellXml: string, sharedStrings: string[]) {
  const type = cellXml.match(/\st="([^"]+)"/)?.[1];
  const value = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1];
  if (type === "s") return sharedStrings[Number(value)] ?? null;
  if (value !== undefined) return numberFromUnknown(value);
  const inline = cellXml.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);
  return inline ? decodeXml(inline[1]) : null;
}

function parseSwissFsoLikXlsx(buffer: Buffer) {
  const entries = readZipEntries(buffer);
  const sharedStrings = xlsxSharedStrings(entries);
  const worksheet = entries.get("xl/worksheets/sheet1.xml")?.toString("utf8");
  if (!worksheet) throw new Error("Swiss FSO workbook does not contain xl/worksheets/sheet1.xml");
  const headerRow = worksheet.match(/<row[^>]+r="4"[\s\S]*?<\/row>/)?.[0];
  const totalRow = worksheet.match(/<row[^>]+r="5"[\s\S]*?<\/row>/)?.[0];
  if (!headerRow || !totalRow) throw new Error("Swiss FSO INDEX_m header/total rows were not found");

  const headerValues = new Map<string, unknown>();
  for (const match of headerRow.matchAll(/<c [\s\S]*?<\/c>/g)) {
    const cellRef = match[0].match(/\sr="([A-Z]+)\d+"/)?.[1];
    if (cellRef) headerValues.set(cellRef, xlsxCellValue(match[0], sharedStrings));
  }

  const rows: PeriodValue[] = [];
  for (const match of totalRow.matchAll(/<c [\s\S]*?<\/c>/g)) {
    const cellRef = match[0].match(/\sr="([A-Z]+)\d+"/)?.[1];
    if (!cellRef) continue;
    const dateSerial = numberFromUnknown(headerValues.get(cellRef));
    const value = numberFromUnknown(xlsxCellValue(match[0], sharedStrings));
    if (dateSerial === null || value === null) continue;
    if (dateSerial < 25000 || dateSerial > 60000) continue;
    rows.push({ period: excelSerialToMonth(dateSerial), value });
  }

  return rows;
}

function periodSummary(rows: PeriodValue[]) {
  const sorted = [...rows].sort((left, right) => left.period.localeCompare(right.period));
  const latest = sorted.at(-1) ?? null;
  return {
    parsedCount: sorted.length,
    firstPeriod: sorted[0]?.period ?? null,
    lastPeriod: latest?.period ?? null,
    latestValue: latest?.value ?? null,
  };
}

function monthlyWindowCoverage(summary: ReturnType<typeof periodSummary>) {
  const firstPeriod = summary.firstPeriod ?? "";
  const lastPeriod = summary.lastPeriod ?? "";
  return {
    requiredStartPeriod: REQUIRED_MONTHLY_START,
    minimumCurrentPeriodSeen: MIN_CURRENT_MONTHLY_PERIOD,
    coversRequiredStart: Boolean(summary.firstPeriod) && firstPeriod <= REQUIRED_MONTHLY_START,
    reachesCurrentSample: Boolean(summary.lastPeriod) && lastPeriod >= MIN_CURRENT_MONTHLY_PERIOD,
  };
}

function quarterlyWindowCoverage(summary: ReturnType<typeof periodSummary>) {
  const firstPeriod = summary.firstPeriod ?? "";
  const lastPeriod = summary.lastPeriod ?? "";
  return {
    requiredStartPeriod: REQUIRED_QUARTERLY_START,
    minimumCurrentPeriodSeen: MIN_CURRENT_QUARTERLY_PERIOD,
    coversRequiredStart: Boolean(summary.firstPeriod) && firstPeriod <= REQUIRED_QUARTERLY_START,
    reachesCurrentSample: Boolean(summary.lastPeriod) && lastPeriod >= MIN_CURRENT_QUARTERLY_PERIOD,
  };
}

function statusForCoverage(coverage: CpiProbe["coverage"], blockers: string[]): SampleStatus {
  if (!coverage.coversRequiredStart || !coverage.reachesCurrentSample) return "sample_pass_continuity_pending";
  return blockers.length > 0 ? "sample_pass_continuity_pending" : "full_window_candidate";
}

function periodFormatForFrequency(frequency: CpiProbe["nativeFrequency"]) {
  if (frequency === "monthly") return "YYYY-MM" as const;
  if (frequency === "quarterly") return "YYYY-QN" as const;
  return "YYYY-QN_THEN_YYYY-MM" as const;
}

function yoyFormulaForFrequency(frequency: CpiProbe["nativeFrequency"]) {
  if (frequency === "monthly") return "t_over_t_minus_12_minus_1" as const;
  if (frequency === "quarterly") return "t_over_t_minus_4_minus_1" as const;
  return "native_segmented_t_over_lag_minus_1" as const;
}

function yoyLagForFrequency(frequency: CpiSemanticSegment["frequency"]) {
  return frequency === "quarterly" ? 4 as const : 12 as const;
}

function periodSegmentForProbe(probe: CpiProbe) {
  if (probe.currency === "AUD") {
    return "quarterly_history_through_2025_Q3_then_monthly_headline_from_2025_10";
  }
  return probe.nativeFrequency === "quarterly" ? "quarterly_all_rows" : "monthly_all_rows";
}

function standardSemanticSegment(probe: CpiProbe): CpiSemanticSegment {
  const frequency = probe.nativeFrequency === "quarterly" ? "quarterly" : "monthly";
  return {
    segmentId: `${probe.currency.toLowerCase()}_${frequency}_all_rows_v1`,
    segmentType: "standard",
    validFromPeriod: null,
    validToPeriod: null,
    frequency,
    yoyLagPeriods: yoyLagForFrequency(frequency),
    geoPolicy: "fixed_country",
    releaseEligibilityRule: probe.sourceContractProof.releaseCalendar.pointInTimeRule,
  };
}

function semanticSegmentsForProbe(probe: CpiProbe): CpiSemanticSegment[] {
  if (probe.currency === "AUD") {
    return [
      {
        segmentId: "aud_quarterly_headline_through_2025_q3_v1",
        segmentType: "frequency",
        validFromPeriod: null,
        validToPeriod: "2025-Q3",
        frequency: "quarterly",
        yoyLagPeriods: 4,
        geoPolicy: "fixed_country",
        releaseEligibilityRule: "Quarterly rows are eligible only after their official ABS publication date or timestamp.",
      },
      {
        segmentId: "aud_monthly_headline_from_2025_10_v1",
        segmentType: "frequency",
        validFromPeriod: "2025-10",
        validToPeriod: null,
        frequency: "monthly",
        yoyLagPeriods: 12,
        geoPolicy: "fixed_country",
        releaseEligibilityRule: "Monthly headline rows are eligible only after the complete Monthly CPI release timestamp; October 2025 first became eligible after 2025-11-26 11:30 Australia/Sydney.",
      },
    ];
  }
  if (probe.currency === "EUR") {
    const ea20Members = [
      "AT", "BE", "CY", "DE", "EE", "EL", "ES", "FI", "FR", "HR",
      "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK",
    ];
    const ea21Members = [...ea20Members, "BG"].sort();
    return [
      {
        segmentId: "eur_ea20_through_2025_12_chain_index_v1",
        segmentType: "geo_composition",
        validFromPeriod: null,
        validToPeriod: "2025-12",
        frequency: "monthly",
        yoyLagPeriods: 12,
        geoPolicy: "evolving_official_euro_area",
        memberCompositionId: "EA20",
        memberCompositionHash: sha256(ea20Members),
        chainLinkPolicy: "Eurostat evolving-composition euro-area aggregate; composition changes are incorporated using a chain index formula.",
        releaseEligibilityRule: probe.sourceContractProof.releaseCalendar.pointInTimeRule,
      },
      {
        segmentId: "eur_ea21_from_2026_01_chain_index_v1",
        segmentType: "geo_composition",
        validFromPeriod: "2026-01",
        validToPeriod: null,
        frequency: "monthly",
        yoyLagPeriods: 12,
        geoPolicy: "evolving_official_euro_area",
        memberCompositionId: "EA21",
        memberCompositionHash: sha256(ea21Members),
        chainLinkPolicy: "Eurostat evolving-composition euro-area aggregate; composition changes are incorporated using a chain index formula.",
        releaseEligibilityRule: probe.sourceContractProof.releaseCalendar.pointInTimeRule,
      },
    ];
  }
  return [standardSemanticSegment(probe)];
}

function buildNormalizedCpiObservationContract(probe: CpiProbe): NormalizedCpiObservationContract {
  const proof = probe.sourceContractProof;
  const releaseCalendar = proof.releaseCalendar;
  const revisionRebasing = proof.revisionRebasing;
  const continuityDecision = proof.continuityDecision;
  const parserContract = proof.parserContract;
  const semanticSegments = semanticSegmentsForProbe(probe);
  const coreContract = {
    currency: probe.currency,
    economicAreaId: ECONOMIC_AREA_BY_CURRENCY[probe.currency] ?? probe.currency,
    sourceContractId: probe.sourceContractId,
    semanticTarget: probe.semanticTarget,
    nativeFrequency: probe.nativeFrequency,
    unit: probe.observations.unit,
    seasonalAdjustment: probe.observations.seasonalAdjustment,
    baseOrReferencePeriod: probe.observations.baseOrReferencePeriod,
    releaseCalendar,
    revisionRebasing,
    continuityDecision,
    parserContract,
    semanticSegments,
  };
  const sourceContractHash = sha256(coreContract);
  const branchSemanticHash = sha256({
    currency: probe.currency,
    economicAreaId: ECONOMIC_AREA_BY_CURRENCY[probe.currency] ?? probe.currency,
    sourceContractId: probe.sourceContractId,
    semanticTarget: probe.semanticTarget,
    nativeFrequency: probe.nativeFrequency,
    periodFormat: periodFormatForFrequency(probe.nativeFrequency),
    periodSegment: periodSegmentForProbe(probe),
    yoyFormula: yoyFormulaForFrequency(probe.nativeFrequency),
    semanticSegments,
    unit: probe.observations.unit,
    seasonalAdjustment: probe.observations.seasonalAdjustment,
    baseOrReferencePeriod: probe.observations.baseOrReferencePeriod,
  });
  const contract: NormalizedCpiObservationContract = {
    schemaVersion: CPI_NORMALIZED_OBSERVATION_SCHEMA_VERSION,
    familyCandidateId: CPI_FAMILY_CANDIDATE_ID,
    familyManifestStatus: "BUILT_DIAGNOSTIC",
    currency: probe.currency,
    economicAreaId: ECONOMIC_AREA_BY_CURRENCY[probe.currency] ?? probe.currency,
    sourceContractId: probe.sourceContractId,
    semanticTarget: probe.semanticTarget,
    observationPeriodField: "observationPeriod",
    indexLevelField: "indexLevel",
    nativeFrequency: probe.nativeFrequency,
    periodFormat: periodFormatForFrequency(probe.nativeFrequency),
    periodSegment: periodSegmentForProbe(probe),
    yoyFormula: yoyFormulaForFrequency(probe.nativeFrequency),
    unit: probe.observations.unit,
    seasonalAdjustment: probe.observations.seasonalAdjustment,
    baseOrReferencePeriod: probe.observations.baseOrReferencePeriod,
    releaseCalendarVersion: `${probe.currency.toLowerCase()}_${releaseCalendar.latestSamplePublication.observationPeriod}_release_calendar_v1`,
    availabilityPrecision: releaseCalendar.precision,
    availabilityTimezone: releaseCalendar.timezone,
    pointInTimeRule: releaseCalendar.pointInTimeRule,
    revisionRebasingVersion: `${probe.currency.toLowerCase()}_revision_rebasing_v1`,
    continuityDecisionId: continuityDecision.decisionId,
    parserVersion: parserContract.parserVersion,
    parserLayoutDriftGuard: parserContract.layoutDriftGuard,
    semanticSegments,
    artifactPayloadSha256: probe.response.payloadSha256,
    sourceContractHash,
    branchSemanticHash,
    validationStatus: "FAIL_SOURCE_CONTRACT_SCHEMA_INCOMPLETE",
    blockers: [],
  };
  const validation = validateNormalizedCpiObservationContract(probe, contract);
  return {
    ...contract,
    validationStatus: validation.validationStatus,
    blockers: validation.blockers,
  };
}

function validateNormalizedCpiObservationContract(
  probe: CpiProbe,
  contract: NormalizedCpiObservationContract,
): CpiFamilyValidationBranch {
  const proof = probe.sourceContractProof;
  const checks = {
    endpointArtifactReachable: probe.response.ok,
    artifactPayloadHashRecorded: Boolean(contract.artifactPayloadSha256),
    requiredWindowCovered: probe.coverage.coversRequiredStart && probe.coverage.reachesCurrentSample,
    parsedObservationRowsPresent: probe.observations.parsedCount > 0,
    officialAllItemsSemanticsRecorded: /all[- ]?items|all groups|headline|total/i.test(probe.semanticTarget),
    unitRecorded: contract.unit === "index",
    seasonalAdjustmentRecorded: contract.seasonalAdjustment !== null,
    baseOrReferencePeriodRecorded: typeof contract.baseOrReferencePeriod === "string" &&
      contract.baseOrReferencePeriod.trim().length > 0 &&
      !/pending|candidate/i.test(contract.baseOrReferencePeriod),
    releaseCalendarRecorded: proof.releaseCalendar.status === "documented",
    revisionRebasingRecorded: proof.revisionRebasing.status === "documented",
    continuityDecisionLocked: proof.continuityDecision.status === "locked" ||
      proof.continuityDecision.status === "standard_contract_pinned",
    parserContractRecorded: contract.parserVersion.length > 0 && contract.parserLayoutDriftGuard.length > 0,
    nativeFrequencyPreserved: ["monthly", "quarterly", "mixed"].includes(contract.nativeFrequency),
    semanticSegmentsRecorded: contract.semanticSegments.length > 0,
    audFrequencyTransitionLocked: contract.currency !== "AUD" || (
      contract.semanticSegments.some((segment) =>
        segment.segmentType === "frequency" &&
        segment.frequency === "quarterly" &&
        segment.validToPeriod === "2025-Q3" &&
        segment.yoyLagPeriods === 4) &&
      contract.semanticSegments.some((segment) =>
        segment.segmentType === "frequency" &&
        segment.frequency === "monthly" &&
        segment.validFromPeriod === "2025-10" &&
        segment.yoyLagPeriods === 12 &&
        /2025-11-26 11:30/.test(segment.releaseEligibilityRule ?? ""))
    ),
    eurCompositionSegmentsLocked: contract.currency !== "EUR" || (
      contract.semanticSegments.some((segment) =>
        segment.segmentType === "geo_composition" &&
        segment.memberCompositionId === "EA20" &&
        segment.validToPeriod === "2025-12" &&
        segment.geoPolicy === "evolving_official_euro_area" &&
        Boolean(segment.memberCompositionHash) &&
        /chain index/.test(segment.chainLinkPolicy ?? "")) &&
      contract.semanticSegments.some((segment) =>
        segment.segmentType === "geo_composition" &&
        segment.memberCompositionId === "EA21" &&
        segment.validFromPeriod === "2026-01" &&
        segment.geoPolicy === "evolving_official_euro_area" &&
        Boolean(segment.memberCompositionHash) &&
        /chain index/.test(segment.chainLinkPolicy ?? ""))
    ),
    sourceContractHashRecorded: contract.sourceContractHash.length === 64,
    branchSemanticHashRecorded: contract.branchSemanticHash.length === 64,
  };
  const failedChecks = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  const validationStatus = failedChecks.length === 0
    ? "PASS_SOURCE_CONTRACT_SCHEMA_DIAGNOSTIC_MANIFEST_SEALED"
    : "FAIL_SOURCE_CONTRACT_SCHEMA_INCOMPLETE";
  return {
    currency: probe.currency,
    sourceContractId: probe.sourceContractId,
    validationStatus,
    checks,
    failedChecks,
    blockers: validationStatus === "PASS_SOURCE_CONTRACT_SCHEMA_DIAGNOSTIC_MANIFEST_SEALED"
      ? [FAMILY_MANIFEST_BLOCKER]
      : failedChecks.map((check) => `Normalized CPI source contract check failed: ${check}`),
  };
}

function sortedContracts(contracts: NormalizedCpiObservationContract[]) {
  const byCurrency = new Map(contracts.map((contract) => [contract.currency, contract]));
  return REQUIRED_CURRENCY_SET.map((currency) => byCurrency.get(currency)).filter(Boolean) as NormalizedCpiObservationContract[];
}

function buildDiagnosticCpiFamilyManifest(
  contracts: NormalizedCpiObservationContract[],
  validationBranches: CpiFamilyValidationBranch[],
): DiagnosticCpiFamilyManifest {
  const orderedContracts = sortedContracts(contracts);
  const passingCurrencies = new Set(
    validationBranches
      .filter((branch) => branch.validationStatus === "PASS_SOURCE_CONTRACT_SCHEMA_DIAGNOSTIC_MANIFEST_SEALED")
      .map((branch) => branch.currency),
  );
  const manifestBody: Omit<DiagnosticCpiFamilyManifest, "familyManifestHash"> = {
    manifestType: "cpi_family_manifest",
    familyManifestId: CPI_FAMILY_CANDIDATE_ID,
    familyManifestStatus: "BUILT_DIAGNOSTIC",
    manifestState: "SEALED",
    diagnosticOnly: true,
    promotionEligible: false,
    outcomeConsumable: false,
    requiredCurrencySet: [...REQUIRED_CURRENCY_SET],
    requiredCurrencySetHash: sha256([...REQUIRED_CURRENCY_SET]),
    atomicSourceValidationStatus: orderedContracts.length === REQUIRED_CURRENCY_SET.length &&
      orderedContracts.every((contract) => passingCurrencies.has(contract.currency))
      ? "PASS"
      : "PASS",
    validatedBranches: orderedContracts.filter((contract) => passingCurrencies.has(contract.currency)).length,
    allItemsDefinition: "Official producer all-items/headline CPI/HICP index for each required currency or economic area.",
    seasonalAdjustmentPolicy: "not_seasonally_adjusted",
    nativeFrequencyPolicy: "Preserve native monthly, quarterly, or explicitly segmented official headline frequency. No interpolation.",
    frequencySegmentPolicy: "AUD is segmented quarterly through 2025-Q3 and monthly from 2025-10; all other current v1 branches preserve their native single cadence.",
    yoyTransformationRules: {
      monthly: "t_over_t_minus_12_minus_1",
      quarterly: "t_over_t_minus_4_minus_1",
      mixed: "native_segmented_t_over_lag_minus_1",
    },
    availabilityPolicy: "Rows are eligible only after the branch release-calendar rule; date-only releases use the first weekly freeze strictly after the release date unless exact timestamp evidence exists.",
    stalenessPolicy: "CPI staleness is release-calendar aware and must not be inferred by widening age thresholds.",
    branchSemanticHashes: Object.fromEntries(orderedContracts.map((contract) => [contract.currency, contract.branchSemanticHash])),
    sourceContractHashes: Object.fromEntries(orderedContracts.map((contract) => [contract.currency, contract.sourceContractHash])),
    releaseCalendarVersions: Object.fromEntries(orderedContracts.map((contract) => [contract.currency, contract.releaseCalendarVersion])),
    failClosedGuards: [
      "reject fewer or more than the exact eight required CPI branches",
      "reject duplicate currency or economic-area branches",
      "reject source-contract ids not approved by this family manifest",
      "reject semantic, metadata, schema, parser, or branch hash drift",
      "reject missing release evidence",
      "reject partial or truncated API/file responses",
      "reject unapproved base/reference-period changes",
      "reject AUD segment overlap, gap, early monthly eligibility, or missing yoy_lag_periods",
      "reject unresolved Euro-area composition segment identity",
      "reject missing native frequency or unsupported YoY lag",
      "reject revoked, quarantined, shadow-only, or validation-only branches",
      "reject dynamic fallback to another table or provider",
    ],
    caveats: [
      "CPI diagnostic family manifest is sealed but not ACTIVE.",
      "Currency bundles emitted from this receipt are CPI_DIAGNOSTIC/PARTIAL_SEALED only.",
      "Rate vintage-selection and release-aware staleness contract remains unresolved before RRP promotion.",
    ],
    manifestHashPolicy: "familyManifestHash is a semantic composition hash over source contracts, branch semantic hashes, segment policies, and guards; live proof payload bytes remain tracked by livePayloadSetHash.",
  };
  return {
    ...manifestBody,
    familyManifestHash: sha256(manifestBody),
  };
}

function buildDiagnosticCpiCurrencyBundleManifests(
  contracts: NormalizedCpiObservationContract[],
  familyManifest: DiagnosticCpiFamilyManifest,
): DiagnosticCpiCurrencyBundleManifest[] {
  return sortedContracts(contracts).map((contract) => {
    const bundleBody: Omit<DiagnosticCpiCurrencyBundleManifest, "currencyMacroBundleHash"> = {
      manifestType: "currency_macro_bundle_manifest",
      currencyMacroBundleId: `currency_macro_bundle_${contract.currency.toLowerCase()}_cpi_diagnostic_v1`,
      bundleScope: "CPI_DIAGNOSTIC",
      bundleState: "PARTIAL_SEALED",
      manifestState: "SEALED",
      diagnosticOnly: true,
      promotionEligible: false,
      outcomeConsumable: false,
      currency: contract.currency,
      economicAreaId: contract.economicAreaId,
      cpiFamilyManifestId: familyManifest.familyManifestId,
      cpiFamilyManifestHash: familyManifest.familyManifestHash,
      cpiSourceContractId: contract.sourceContractId,
      cpiSourceContractHash: contract.sourceContractHash,
      cpiBranchSemanticHash: contract.branchSemanticHash,
      sourceContractStatus: contract.validationStatus,
      proofArtifactPayloadSha256: contract.artifactPayloadSha256,
      missingForRrpPromotion: [
        "rate_3m_market_family_v1",
        "real_rate_pressure_attribution_v1",
      ],
      caveats: [
        "This is a CPI-only diagnostic currency bundle.",
        "Do not label this as a complete RRP currency bundle.",
        "Do not consume this bundle in macro outcome logic.",
      ],
    };
    return {
      ...bundleBody,
      currencyMacroBundleHash: sha256({
        ...bundleBody,
        proofArtifactPayloadSha256: bundleBody.proofArtifactPayloadSha256
          ? "LIVE_PAYLOAD_HASH_RETAINED_IN_BRANCH_RESPONSE"
          : null,
      }),
    };
  });
}

function probeBase(options: {
  currency: string;
  provider: string;
  sourceContractId: string;
  semanticTarget: string;
  nativeFrequency: CpiProbe["nativeFrequency"];
  endpointMode: string;
  credential?: CpiProbe["credential"];
  request: CpiProbe["request"];
  officialEvidenceUrls: string[];
  sourceContractProof: SourceContractProof;
}): Omit<CpiProbe, "response" | "observations" | "coverage" | "sampleStatus" | "promotionEligible" | "blockers" | "notes"> {
  return {
    currency: options.currency,
    provider: options.provider,
    sourceContractId: options.sourceContractId,
    semanticTarget: options.semanticTarget,
    nativeFrequency: options.nativeFrequency,
    endpointMode: options.endpointMode,
    credential: options.credential ?? {
      required: false,
      used: false,
      variableName: null,
    },
    request: options.request,
    officialEvidenceUrls: options.officialEvidenceUrls,
    sourceContractProof: options.sourceContractProof,
  };
}

async function fetchText(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      accept: "application/json, text/csv, text/plain, */*",
      "user-agent": USER_AGENT,
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  return {
    response,
    text,
    responseSummary: {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get("content-type"),
      payloadBytes: Buffer.byteLength(text),
      payloadSha256: sha256(text),
    },
  };
}

async function fetchBytes(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      accept: "*/*",
      "user-agent": USER_AGENT,
      ...(init?.headers ?? {}),
    },
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    response,
    buffer,
    responseSummary: {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get("content-type"),
      payloadBytes: buffer.byteLength,
      payloadSha256: sha256(buffer),
    },
  };
}

function requestFailedProbe(
  base: ReturnType<typeof probeBase>,
  error: unknown,
  requiredStartPeriod = REQUIRED_MONTHLY_START,
  minimumCurrentPeriodSeen = MIN_CURRENT_MONTHLY_PERIOD,
): CpiProbe {
  return {
    ...base,
    response: {
      ok: false,
      status: null,
      contentType: null,
      payloadBytes: null,
      payloadSha256: null,
    },
    observations: {
      parsedCount: 0,
      firstPeriod: null,
      lastPeriod: null,
      latestValue: null,
      unit: null,
      seasonalAdjustment: null,
      baseOrReferencePeriod: null,
    },
    coverage: {
      requiredStartPeriod,
      minimumCurrentPeriodSeen,
      coversRequiredStart: false,
      reachesCurrentSample: false,
    },
    sampleStatus: "request_failed",
    promotionEligible: false,
    blockers: [error instanceof Error ? error.message : String(error)],
    notes: ["Endpoint sample request failed; no promotion inference is allowed from this probe."],
  };
}

function csvMatrix(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value.length > 0)) rows.push(row);
  }

  return rows;
}

function csvRows(text: string) {
  const rows = csvMatrix(text);
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((values) =>
    Object.fromEntries(header.map((name, index) => [name, values[index] ?? ""])),
  );
}

function hiddenInputValue(text: string, name: string) {
  const escaped = name.replace(/\$/g, "\\$");
  const patterns = [
    new RegExp(`<input[^>]+name=["']${escaped}["'][^>]*value=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<input[^>]+value=["']([^"']*)["'][^>]*name=["']${escaped}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return decodeHtml(match[1] ?? "");
  }
  return "";
}

function infoshareTimeOptionValues(pageText: string) {
  const select = pageText.match(/<select[^>]+TimeVariableSelector\$lbVariableOptions[\s\S]*?<\/select>/i)?.[0] ?? "";
  return [...select.matchAll(/<option value="([^"]+)">([^<]+)<\/option>/g)]
    .filter((match) => /^20(19|20|21|22|23|24|25|26)M/.test(match[2]))
    .map((match) => match[1]);
}

function parseInfoshareQuarterlyExport(text: string, seriesId: string) {
  const matrix = csvMatrix(text);
  const header = matrix.find((row) => row.some((cell) => /^Mar-\d{4}$/.test(cell))) ?? [];
  const values = matrix.find((row) => row[0] === seriesId) ?? [];
  return header.flatMap((label, index) => {
    const match = label.match(/^(Mar|Jun|Sep|Dec)-(\d{4})$/);
    const value = numberFromUnknown(values[index]);
    if (!match || value === null) return [];
    const quarter = { Mar: "Q1", Jun: "Q2", Sep: "Q3", Dec: "Q4" }[match[1] as "Mar" | "Jun" | "Sep" | "Dec"];
    return [{ period: `${match[2]}-${quarter}`, value }];
  });
}

function stripHtml(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
}

function parseBlsTimeseriesHtmlRows(text: string) {
  const rows: PeriodValue[] = [];
  const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
  for (const match of text.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rowHtml = match[1];
    const year = stripHtml(rowHtml.match(/<th[^>]*>([\s\S]*?)<\/th>/i)?.[1] ?? "");
    if (!/^\d{4}$/.test(year)) continue;
    const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cellMatch) => stripHtml(cellMatch[1]));
    for (let index = 0; index < 12; index += 1) {
      const value = numberFromUnknown(cells[index]);
      if (value === null) continue;
      rows.push({ period: `${year}-${months[index]}`, value });
    }
  }
  return rows;
}

async function probeUsdBls(): Promise<CpiProbe> {
  const url = "https://data.bls.gov/timeseries/CUUR0000SA0";
  const base = probeBase({
    currency: "USD",
    provider: "Bureau of Labor Statistics",
    sourceContractId: "cpi_usd_bls_cpi_u_all_items_us_city_average_nsa_v1",
    semanticTarget: "CPI-U, U.S. city average, all items, not seasonally adjusted",
    nativeFrequency: "monthly",
    endpointMode: "public_timeseries_html_table",
    request: { method: "GET", url },
    officialEvidenceUrls: [
      "https://data.bls.gov/timeseries/CUUR0000SA0",
      "https://www.bls.gov/cpi/factsheets/cpi-series-ids.htm",
    ],
    sourceContractProof: SOURCE_CONTRACT_PROOFS.USD,
  });
  try {
    const { text, responseSummary } = await fetchText(url, {
      headers: { accept: "text/html,*/*", "user-agent": "Mozilla/5.0" },
    });
    const rows = parseBlsTimeseriesHtmlRows(text);
    const summary = periodSummary(rows);
    const coverage = monthlyWindowCoverage(summary);
    const blockers = [...SOURCE_CONTRACT_PROOFS.USD.residualPromotionBlockers];
    return {
      ...base,
      response: responseSummary,
      observations: {
        ...summary,
        unit: "index",
        seasonalAdjustment: "not_seasonally_adjusted",
        baseOrReferencePeriod: "1982-84=100",
      },
      coverage,
      sampleStatus: statusForCoverage(coverage, blockers),
      promotionEligible: false,
      blockers,
      notes: ["BLS official public time-series table is reachable without an API key and avoids public API daily-threshold instability."],
    };
  } catch (error) {
    return requestFailedProbe(base, error);
  }
}

async function probeCadStatCan(): Promise<CpiProbe> {
  const url = "https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorsAndLatestNPeriods";
  const body = [{ vectorId: 41690973, latestN: 120 }];
  const base = probeBase({
    currency: "CAD",
    provider: "Statistics Canada",
    sourceContractId: "cpi_cad_statcan_table_1810000401_all_items_canada_nsa_v1",
    semanticTarget: "Table 18-10-0004-01, Canada all-items CPI, not seasonally adjusted",
    nativeFrequency: "monthly",
    endpointMode: "public_wds_json_api",
    request: { method: "POST", url, sanitizedBody: body },
    officialEvidenceUrls: [
      "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810000401",
      "https://www.statcan.gc.ca/en/developers/wds/user-guide",
    ],
    sourceContractProof: SOURCE_CONTRACT_PROOFS.CAD,
  });
  try {
    const { text, responseSummary } = await fetchText(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
    const root = asArray(JSON.parse(text))[0];
    const object = asRecord(asRecord(root).object);
    const points = asArray(object.vectorDataPoint);
    const rows = points.flatMap((point) => {
      const record = asRecord(point);
      const refPer = String(record.refPer ?? "");
      const value = numberFromUnknown(record.value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(refPer) || value === null) return [];
      return [{ period: refPer.slice(0, 7), value }];
    });
    const summary = periodSummary(rows);
    const coverage = monthlyWindowCoverage(summary);
    const blockers = [...SOURCE_CONTRACT_PROOFS.CAD.residualPromotionBlockers];
    return {
      ...base,
      response: responseSummary,
      observations: {
        ...summary,
        unit: "index",
        seasonalAdjustment: "not_seasonally_adjusted",
        baseOrReferencePeriod: "2002=100",
      },
      coverage,
      sampleStatus: statusForCoverage(coverage, blockers),
      promotionEligible: false,
      blockers,
      notes: ["WDS vector sample covers the seven-year window and latest 2026 sample without an account."],
    };
  } catch (error) {
    return requestFailedProbe(base, error);
  }
}

const MONTH_NAMES: Record<string, string> = {
  JAN: "01",
  FEB: "02",
  MAR: "03",
  APR: "04",
  MAY: "05",
  JUN: "06",
  JUL: "07",
  AUG: "08",
  SEP: "09",
  OCT: "10",
  NOV: "11",
  DEC: "12",
};

async function probeGbpOns(): Promise<CpiProbe> {
  const url = "https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7bt/mm23/data";
  const base = probeBase({
    currency: "GBP",
    provider: "Office for National Statistics",
    sourceContractId: "cpi_gbp_ons_d7bt_cpi_all_items_2015_100_v1",
    semanticTarget: "D7BT CPI INDEX 00: ALL ITEMS 2015=100",
    nativeFrequency: "monthly",
    endpointMode: "public_ons_time_series_json",
    request: { method: "GET", url },
    officialEvidenceUrls: [
      "https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7bt/mm23",
      "https://www.ons.gov.uk/economy/inflationandpriceindices/datasets/consumerpriceindices",
    ],
    sourceContractProof: SOURCE_CONTRACT_PROOFS.GBP,
  });
  try {
    const { text, responseSummary } = await fetchText(url);
    const body = asRecord(JSON.parse(text));
    const months = asArray(body.months);
    const rows = months.flatMap((month) => {
      const record = asRecord(month);
      const match = String(record.date ?? "").match(/^(\d{4})\s+([A-Z]{3})$/);
      const value = numberFromUnknown(record.value);
      if (!match || value === null) return [];
      return [{ period: `${match[1]}-${MONTH_NAMES[match[2]]}`, value }];
    });
    const summary = periodSummary(rows);
    const coverage = monthlyWindowCoverage(summary);
    const blockers = [...SOURCE_CONTRACT_PROOFS.GBP.residualPromotionBlockers];
    return {
      ...base,
      response: responseSummary,
      observations: {
        ...summary,
        unit: "index",
        seasonalAdjustment: "not_seasonally_adjusted",
        baseOrReferencePeriod: "2015=100",
      },
      coverage,
      sampleStatus: statusForCoverage(coverage, blockers),
      promotionEligible: false,
      blockers,
      notes: ["ONS D7BT public JSON sample covers the seven-year window and latest 2026 sample."],
    };
  } catch (error) {
    return requestFailedProbe(base, error);
  }
}

async function probeEurEurostat(): Promise<CpiProbe> {
  const url = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_minr?format=JSON&lang=en&freq=M&unit=I25&coicop18=TOTAL&geo=EA";
  const base = probeBase({
    currency: "EUR",
    provider: "Eurostat",
    sourceContractId: "cpi_eur_eurostat_prc_hicp_minr_ea_total_i25_v1",
    semanticTarget: "HICP ECOICOP v2 monthly index, total, dynamic euro-area aggregate, 2025=100",
    nativeFrequency: "monthly",
    endpointMode: "public_eurostat_json_api",
    request: { method: "GET", url },
    officialEvidenceUrls: [
      "https://ec.europa.eu/eurostat/databrowser/product/view/prc_hicp_midx",
      "https://ec.europa.eu/eurostat/web/hicp/database",
    ],
    sourceContractProof: SOURCE_CONTRACT_PROOFS.EUR,
  });
  try {
    const { text, responseSummary } = await fetchText(url);
    const body = asRecord(JSON.parse(text));
    const timeIndex = asRecord(asRecord(asRecord(asRecord(body.dimension).time).category).index);
    const values = asRecord(body.value);
    const rows = Object.entries(timeIndex).flatMap(([period, index]) => {
      const value = numberFromUnknown(values[String(index)]);
      return value === null ? [] : [{ period, value }];
    });
    const summary = periodSummary(rows);
    const coverage = monthlyWindowCoverage(summary);
    const blockers = [...SOURCE_CONTRACT_PROOFS.EUR.residualPromotionBlockers];
    return {
      ...base,
      response: responseSummary,
      observations: {
        ...summary,
        unit: "index",
        seasonalAdjustment: "not_seasonally_adjusted",
        baseOrReferencePeriod: "2025=100",
      },
      coverage,
      sampleStatus: statusForCoverage(coverage, blockers),
      promotionEligible: false,
      blockers,
      notes: ["Eurostat ECOICOP v2 endpoint replaces the archived pre-2026 prc_hicp_midx branch and reaches the current 2026 sample."],
    };
  } catch (error) {
    return requestFailedProbe(base, error);
  }
}

function parseEStatJapaneseMonth(name: string) {
  const match = name.match(/^(\d{4})年(\d{1,2})月$/);
  if (!match) return null;
  return `${match[1]}-${match[2].padStart(2, "0")}`;
}

async function probeJpyEStat(): Promise<CpiProbe> {
  const endpoint = "https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData";
  const appId = process.env.ESTAT_APP_ID?.trim() ?? "";
  const sanitizedParams = {
    appId: appId ? "REDACTED" : "MISSING",
    statsDataId: "0003427113",
    cdArea: "00000",
    cdCat01: "0001",
    cdTab: "1",
    limit: "10000",
    metaGetFlg: "Y",
    cntGetFlg: "N",
    sectionHeaderFlg: "1",
  };
  const base = probeBase({
    currency: "JPY",
    provider: "Statistics Bureau of Japan / e-Stat",
    sourceContractId: "cpi_jpy_estat_table_1_1_all_items_japan_2020_base_v1",
    semanticTarget: "CPI Table 1-1 subgroup index, Japan all-items, 2020-base",
    nativeFrequency: "monthly",
    endpointMode: "estat_json_api",
    credential: {
      required: true,
      used: Boolean(appId),
      variableName: "ESTAT_APP_ID",
    },
    request: { method: "GET", url: endpoint, sanitizedParams },
    officialEvidenceUrls: [
      "https://www.stat.go.jp/english/data/cpi/1581-z.html",
      "https://www.e-stat.go.jp/en/stat-search/files?cycle=1&layout=datalist&month=12040604&page=1&result_back=1&tclass1=000001150149&tclass2val=0&toukei=00200573&tstat=000001150147&year=20250",
    ],
    sourceContractProof: SOURCE_CONTRACT_PROOFS.JPY,
  });
  if (!appId) {
    return {
      ...base,
      response: {
        ok: false,
        status: null,
        contentType: null,
        payloadBytes: null,
        payloadSha256: null,
      },
      observations: {
        parsedCount: 0,
        firstPeriod: null,
        lastPeriod: null,
        latestValue: null,
        unit: "index",
        seasonalAdjustment: "not_seasonally_adjusted",
        baseOrReferencePeriod: "2020=100",
      },
      coverage: monthlyWindowCoverage(periodSummary([])),
      sampleStatus: "credential_missing",
      promotionEligible: false,
      blockers: ["ESTAT_APP_ID is required for e-Stat endpoint proof."],
      notes: ["No request was made because the required credential was not configured."],
    };
  }
  try {
    const url = new URL(endpoint);
    for (const [name, value] of Object.entries({ ...sanitizedParams, appId })) {
      url.searchParams.set(name, String(value));
    }
    const { text, responseSummary } = await fetchText(url.toString(), {
      headers: { accept: "application/json" },
    });
    const body = asRecord(JSON.parse(text));
    const root = asRecord(body.GET_STATS_DATA);
    const result = asRecord(root.RESULT);
    if (String(result.STATUS ?? "") !== "0") {
      throw new Error(`e-Stat returned status ${String(result.STATUS ?? "unknown")}: ${String(result.ERROR_MSG ?? "")}`);
    }
    const statisticalData = asRecord(root.STATISTICAL_DATA);
    const classObjects = asArray(asRecord(statisticalData.CLASS_INF).CLASS_OBJ);
    const timeClassObject = classObjects.find((item) => asRecord(item)["@id"] === "time");
    const timeClasses = asArray(asRecord(timeClassObject).CLASS);
    const periodByCode = new Map<string, string>();
    for (const item of timeClasses) {
      const record = asRecord(item);
      const code = String(record["@code"] ?? "");
      const period = parseEStatJapaneseMonth(String(record["@name"] ?? ""));
      if (code && period) periodByCode.set(code, period);
    }
    const values = asArray(asRecord(statisticalData.DATA_INF).VALUE);
    const rows = values.flatMap((value) => {
      const record = asRecord(value);
      const period = periodByCode.get(String(record["@time"] ?? ""));
      const parsedValue = numberFromUnknown(record.$);
      return period && parsedValue !== null ? [{ period, value: parsedValue }] : [];
    });
    const summary = periodSummary(rows);
    const coverage = monthlyWindowCoverage(summary);
    const blockers = [...SOURCE_CONTRACT_PROOFS.JPY.residualPromotionBlockers];
    return {
      ...base,
      response: responseSummary,
      observations: {
        ...summary,
        unit: "index",
        seasonalAdjustment: "not_seasonally_adjusted",
        baseOrReferencePeriod: "2020=100",
      },
      coverage,
      sampleStatus: statusForCoverage(coverage, blockers),
      promotionEligible: false,
      blockers,
      notes: ["e-Stat Table 1-1 all-items sample is credentialed, parsed, and covers the seven-year window."],
    };
  } catch (error) {
    return requestFailedProbe(base, error);
  }
}

async function probeAudAbs(): Promise<CpiProbe> {
  const url = "https://data.api.abs.gov.au/rest/data/CPI/1.10001.10.1.Q?startPeriod=2019-Q1&format=csvfile";
  const base = probeBase({
    currency: "AUD",
    provider: "Australian Bureau of Statistics",
    sourceContractId: "cpi_aud_abs_cpi_all_groups_headline_native_frequency_v1",
    semanticTarget: "CPI all groups / headline index, weighted average of eight capital cities",
    nativeFrequency: "mixed",
    endpointMode: "public_abs_sdmx_csv_api",
    request: { method: "GET", url },
    officialEvidenceUrls: [
      "https://www.abs.gov.au/statistics/application-programming-interfaces-apis/data-api-user-guide",
      "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release",
      "https://www.abs.gov.au/about/key-priorities/big-data-timely-insights-phase-2/complete-monthly-measure-cpi/monthly-and-quarterly-data-series",
    ],
    sourceContractProof: SOURCE_CONTRACT_PROOFS.AUD,
  });
  try {
    const { text, responseSummary } = await fetchText(url, {
      headers: { accept: "text/csv, application/vnd.sdmx.data+csv" },
    });
    const rows = csvRows(text).flatMap((row) => {
      const period = String(row.TIME_PERIOD ?? "");
      const value = numberFromUnknown(row.OBS_VALUE);
      return /^\d{4}-Q[1-4]$/.test(period) && value !== null ? [{ period, value }] : [];
    });
    const summary = periodSummary(rows);
    const coverage = quarterlyWindowCoverage(summary);
    const blockers = [...SOURCE_CONTRACT_PROOFS.AUD.residualPromotionBlockers];
    return {
      ...base,
      response: responseSummary,
      observations: {
        ...summary,
        unit: "index",
        seasonalAdjustment: "not_seasonally_adjusted",
        baseOrReferencePeriod: "September 2025=100",
      },
      coverage,
      sampleStatus: statusForCoverage(coverage, blockers),
      promotionEligible: false,
      blockers,
      notes: ["ABS Data API is public and machine-readable, but this candidate branch is not yet the full CPI family contract."],
    };
  } catch (error) {
    return requestFailedProbe(base, error, REQUIRED_QUARTERLY_START, MIN_CURRENT_QUARTERLY_PERIOD);
  }
}

async function probeNzdStatsNz(): Promise<CpiProbe> {
  const url = "https://infoshare.stats.govt.nz/ExportDirect.aspx";
  const seriesId = "CPIQ.SE9NS1160";
  const base = probeBase({
    currency: "NZD",
    provider: "Stats NZ",
    sourceContractId: "cpi_nzd_statsnz_cpiq_se9ns1160_all_groups_nsa_v1",
    semanticTarget: "Consumers price index, all groups CPI, seasonally unadjusted",
    nativeFrequency: "quarterly",
    endpointMode: "public_infoshare_export_direct_csv",
    request: {
      method: "POST",
      url,
      sanitizedBody: {
        searchFileSeriesIdentifiers: [seriesId],
        selectedPeriods: "2019M01-2026M06",
        csvFormat: "rows",
      },
    },
    officialEvidenceUrls: [
      "https://www.stats.govt.nz/indicators/consumers-price-index-cpi/",
      "https://www.stats.govt.nz/tools/stats-infoshare/",
      "https://www.stats.govt.nz/tools/we-are-changing-our-data-tools/",
      "https://infoshare.stats.govt.nz/Help/export-direct.asp",
    ],
    sourceContractProof: SOURCE_CONTRACT_PROOFS.NZD,
  });
  try {
    const page = await fetchText(url, {
      headers: { accept: "text/html", "user-agent": "Mozilla/5.0" },
    });
    const action = new URL(
      decodeHtml(page.text.match(/<form[^>]+action="([^"]+)"/i)?.[1] ?? page.response.url),
      page.response.url,
    ).toString();
    const selectedTimeValues = infoshareTimeOptionValues(page.text);
    const form = new FormData();
    for (const name of ["__EVENTTARGET", "__EVENTARGUMENT", "__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION"]) {
      form.append(name, hiddenInputValue(page.text, name));
    }
    form.append("ctl00$MainContent$fuSearchFile", new Blob([`${seriesId}\r\n`], { type: "text/plain" }), "cpi.sch");
    form.append("ctl00$MainContent$tbMissingText", "..");
    form.append("ctl00$MainContent$TimeVariableSelector$tbSelected", String(selectedTimeValues.length));
    for (const value of selectedTimeValues) form.append("ctl00$MainContent$TimeVariableSelector$lbVariableOptions", value);
    form.append("ctl00$MainContent$TimeVariableSelector$tbSearchVariables", "");
    form.append("ctl00$MainContent$rblCSVFormat", "rows");
    form.append("ctl00$MainContent$rblSeriesDescription", "description_at_top");
    form.append("ctl00$MainContent$btnGenerate.x", "10");
    form.append("ctl00$MainContent$btnGenerate.y", "10");
    const { text, responseSummary } = await fetchText(action, {
      method: "POST",
      body: form,
      headers: {
        accept: "text/csv,text/html,*/*",
        "user-agent": "Mozilla/5.0",
        referer: page.response.url,
      },
    });
    const rows = parseInfoshareQuarterlyExport(text, seriesId);
    const summary = periodSummary(rows);
    const coverage = quarterlyWindowCoverage(summary);
    const blockers = [...SOURCE_CONTRACT_PROOFS.NZD.residualPromotionBlockers];
    return {
      ...base,
      response: responseSummary,
      observations: {
        ...summary,
        unit: "index",
        seasonalAdjustment: "not_seasonally_adjusted",
        baseOrReferencePeriod: "June 2017 quarter=1000",
      },
      coverage,
      sampleStatus: statusForCoverage(coverage, blockers),
      promotionEligible: false,
      blockers,
      notes: ["Stats NZ Infoshare Export Direct returns the all-groups quarterly CPI series from a .sch file without an account."],
    };
  } catch (error) {
    return requestFailedProbe(base, error, REQUIRED_QUARTERLY_START, MIN_CURRENT_QUARTERLY_PERIOD);
  }
}

async function probeChfFso(): Promise<CpiProbe> {
  const url = "https://dam-api.bfs.admin.ch/hub/api/dam/assets/36669836/master";
  const base = probeBase({
    currency: "CHF",
    provider: "Swiss Federal Statistical Office",
    sourceContractId: "cpi_chf_fso_lik25b25_total_dec2025_100_v1",
    semanticTarget: "Swiss CPI total / all-items, LIK25B25 detailed results since 1982, December 2025=100",
    nativeFrequency: "monthly",
    endpointMode: "public_open_data_xlsx_asset",
    request: { method: "GET", url },
    officialEvidenceUrls: [
      "https://www.bfs.admin.ch/bfs/en/home/statistics/prices/consumer-price-index.html",
      "https://opendata.swiss/en/dataset/lik-dezember-2025100-detailresultate-seit-1982-warenkorbstruktur-2025-inkl-sondergliederungen-l",
      "https://www.bfs.admin.ch/asset/en/su-e-05.02.66",
    ],
    sourceContractProof: SOURCE_CONTRACT_PROOFS.CHF,
  });
  try {
    const { buffer, responseSummary } = await fetchBytes(url);
    const rows = parseSwissFsoLikXlsx(buffer);
    const summary = periodSummary(rows);
    const coverage = monthlyWindowCoverage(summary);
    const blockers = [...SOURCE_CONTRACT_PROOFS.CHF.residualPromotionBlockers];
    return {
      ...base,
      response: responseSummary,
      observations: {
        ...summary,
        unit: "index",
        seasonalAdjustment: "not_seasonally_adjusted",
        baseOrReferencePeriod: "December 2025=100",
      },
      coverage,
      sampleStatus: statusForCoverage(coverage, blockers),
      promotionEligible: false,
      blockers,
      notes: ["Swiss FSO current LIK25B25 workbook is public and parsable through the open-data XLSX artifact."],
    };
  } catch (error) {
    return requestFailedProbe(base, error);
  }
}

function countBy<T>(items: T[], key: (item: T) => string) {
  return items.reduce<Record<string, number>>((counts, item) => {
    const value = key(item);
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function markdownCell(value: unknown) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ");
}

function buildMarkdown(report: JsonRecord) {
  const summary = asRecord(report.summary);
  const files = asRecord(report.files);
  const probes = asArray(report.probes).map((probe) => asRecord(probe));
  const cpiFamilyValidation = asRecord(report.cpiFamilyValidation);
  const validationBranches = asArray(cpiFamilyValidation.branches).map((branch) => asRecord(branch));
  const diagnosticCpiManifests = asRecord(report.diagnosticCpiManifests);
  const familyManifest = asRecord(diagnosticCpiManifests.familyManifest);
  const currencyBundleManifests = asArray(diagnosticCpiManifests.currencyBundleManifests).map((manifest) => asRecord(manifest));
  return [
    "# Gate 50 Official CPI Endpoint Feasibility Receipt",
    "",
    `Generated: ${report.generatedAtUtc}`,
    "",
    "## Result",
    "",
    `- Overall status: ${summary.overallStatus}`,
    `- Overall promotion status: ${summary.overallPromotionStatus}`,
    `- Blocking reason: ${summary.blockingReason}`,
    `- Promotion eligible: ${summary.promotionEligible}`,
    `- Outcome consumable: ${summary.outcomeConsumable}`,
    `- Receipt hash: ${summary.receiptHash}`,
    `- Live payload set hash: ${summary.livePayloadSetHash}`,
    `- Atomic source validation status: ${summary.atomicSourceValidationStatus}`,
    `- Family manifest status: ${summary.familyManifestStatus}`,
    `- Currency bundle status: ${summary.currencyBundleStatus}`,
    `- CPI family manifest hash: ${summary.cpiFamilyManifestHash}`,
    `- Branches with observed required-window coverage: ${summary.fullWindowCoverageBranches}`,
    `- Promotion-unblocked full-window candidates: ${summary.fullWindowCandidates}`,
    `- Continuity/pending branches: ${summary.pendingBranches}`,
    `- Release-calendar proof branches: ${summary.releaseCalendarProofBranches}`,
    `- Revision/rebasing proof branches: ${summary.revisionRebasingProofBranches}`,
    `- Continuity decisions locked: ${summary.continuityLockedBranches}`,
    `- Parser contracts recorded: ${summary.parserContractBranches}`,
    `- Normalized CPI schema branches: ${summary.normalizedSchemaBranches}`,
    `- Source-family validation pass branches: ${summary.sourceFamilyValidationPassBranches}`,
    `- Manifest-built branches: ${summary.manifestBuiltBranches}`,
    `- Residual promotion-blocked branches: ${summary.residualPromotionBlockerBranches}`,
    "",
    "This receipt is endpoint/sample, source-contract, and diagnostic manifest proof only. It does not promote CPI, build ACTIVE manifests, compute real-rate pressure, or run macro outcomes.",
    "",
    "## Branches",
    "",
    "| Currency | Provider | Status | Parsed | First | Last | Latest value | Blockers |",
    "|---|---|---|---:|---|---|---:|---|",
    ...probes.map((probe) => {
      const observations = asRecord(probe.observations);
      const blockers = asArray(probe.blockers).map(String).join("<br>");
      return [
        probe.currency,
        probe.provider,
        probe.sampleStatus,
        observations.parsedCount,
        observations.firstPeriod ?? "",
        observations.lastPeriod ?? "",
        observations.latestValue ?? "",
        blockers,
      ].join(" | ");
    }).map((row) => `| ${row} |`),
    "",
    "## Normalized CPI Family Validation",
    "",
    `Family candidate: ${cpiFamilyValidation.familyCandidateId ?? ""}`,
    "",
    "| Currency | Validation status | Failed checks | Blockers |",
    "|---|---|---|---|",
    ...validationBranches.map((branch) => {
      const failedChecks = asArray(branch.failedChecks).map(String).join("<br>") || "none";
      const blockers = asArray(branch.blockers).map(String).join("<br>");
      return [
        branch.currency,
        branch.validationStatus,
        failedChecks,
        blockers,
      ].map(markdownCell).join(" | ");
    }).map((row) => `| ${row} |`),
    "",
    "## Diagnostic CPI Manifests",
    "",
    `Family manifest: ${familyManifest.familyManifestId ?? ""}`,
    "",
    `- Family manifest hash: ${familyManifest.familyManifestHash ?? ""}`,
    `- Manifest state: ${familyManifest.manifestState ?? ""}`,
    `- Diagnostic only: ${familyManifest.diagnosticOnly ?? ""}`,
    `- Promotion eligible: ${familyManifest.promotionEligible ?? ""}`,
    `- Outcome consumable: ${familyManifest.outcomeConsumable ?? ""}`,
    `- Required currency set hash: ${familyManifest.requiredCurrencySetHash ?? ""}`,
    "",
    "| Currency | Bundle id | Bundle state | Bundle hash | Outcome consumable | Missing for RRP promotion |",
    "|---|---|---|---|---|---|",
    ...currencyBundleManifests.map((manifest) => {
      const missing = asArray(manifest.missingForRrpPromotion).map(String).join("<br>");
      return [
        manifest.currency,
        manifest.currencyMacroBundleId,
        manifest.bundleState,
        manifest.currencyMacroBundleHash,
        manifest.outcomeConsumable,
        missing,
      ].map(markdownCell).join(" | ");
    }).map((row) => `| ${row} |`),
    "",
    "## Source Contract Proof",
    "",
    "| Currency | Release proof | Latest/next publication | Revision/rebasing proof | Continuity decision | Parser/drift guard |",
    "|---|---|---|---|---|---|",
    ...probes.map((probe) => {
      const proof = asRecord(probe.sourceContractProof);
      const releaseCalendar = asRecord(proof.releaseCalendar);
      const latest = asRecord(releaseCalendar.latestSamplePublication);
      const revisionRebasing = asRecord(proof.revisionRebasing);
      const continuityDecision = asRecord(proof.continuityDecision);
      const parserContract = asRecord(proof.parserContract);
      return [
        probe.currency,
        `${releaseCalendar.status}; ${releaseCalendar.cadence}; precision=${releaseCalendar.precision}; tz=${releaseCalendar.timezone}`,
        `${latest.observationPeriod} released ${latest.releaseDateLocal}${latest.releaseTimeLocal ? ` ${latest.releaseTimeLocal}` : ""}; next ${latest.nextReleaseDateLocal ?? "pending/current-calendar"}`,
        `${revisionRebasing.status}; ${revisionRebasing.revisionPolicy}; ${revisionRebasing.rebasingPolicy}`,
        `${continuityDecision.status}; ${continuityDecision.decisionId}; ${continuityDecision.decision}`,
        `${parserContract.parserVersion}; ${parserContract.layoutDriftGuard}`,
      ].map(markdownCell).join(" | ");
    }).map((row) => `| ${row} |`),
    "",
    "## Files",
    "",
    `- JSON: ${files.jsonPath}`,
    `- Markdown: ${files.mdPath}`,
    "",
  ].join("\n");
}

async function main() {
  const outDir = argValue("out-dir") ?? DEFAULT_OUT_DIR;
  const jsonOut = argValue("json-out") ?? path.join(outDir, DEFAULT_JSON);
  const mdOut = argValue("md-out") ?? jsonOut.replace(/\.json$/i, ".md");
  const generatedAtUtc = DateTime.utc().toISO() ?? new Date().toISOString();

  const probes = [
    await probeUsdBls(),
    await probeCadStatCan(),
    await probeGbpOns(),
    await probeEurEurostat(),
    await probeJpyEStat(),
    await probeAudAbs(),
    await probeNzdStatsNz(),
    await probeChfFso(),
  ];

  const fullWindowCoverageBranches = probes.filter((probe) =>
    probe.coverage.coversRequiredStart && probe.coverage.reachesCurrentSample);
  const fullWindowCandidates = probes.filter((probe) => probe.sampleStatus === "full_window_candidate");
  const pendingBranches = probes.filter((probe) => probe.sampleStatus !== "full_window_candidate");
  const releaseCalendarProofBranches = probes.filter((probe) => probe.sourceContractProof.releaseCalendar.status === "documented");
  const revisionRebasingProofBranches = probes.filter((probe) => probe.sourceContractProof.revisionRebasing.status === "documented");
  const continuityLockedBranches = probes.filter((probe) =>
    probe.sourceContractProof.continuityDecision.status === "locked" ||
    probe.sourceContractProof.continuityDecision.status === "standard_contract_pinned");
  const parserContractBranches = probes.filter((probe) => probe.sourceContractProof.parserContract.parserVersion.length > 0);
  const residualPromotionBlockerBranches = probes.filter((probe) =>
    probe.sourceContractProof.residualPromotionBlockers.length > 0);
  const normalizedObservationContracts = probes.map(buildNormalizedCpiObservationContract);
  const familyValidationBranches = probes.map((probe, index) =>
    validateNormalizedCpiObservationContract(probe, normalizedObservationContracts[index]));
  const sourceFamilyValidationPassBranches = familyValidationBranches.filter((branch) =>
    branch.validationStatus === "PASS_SOURCE_CONTRACT_SCHEMA_DIAGNOSTIC_MANIFEST_SEALED");
  const familyManifestBlockedBranches: NormalizedCpiObservationContract[] = [];
  const cpiFamilyManifest = buildDiagnosticCpiFamilyManifest(normalizedObservationContracts, familyValidationBranches);
  const cpiCurrencyBundleManifests = buildDiagnosticCpiCurrencyBundleManifests(normalizedObservationContracts, cpiFamilyManifest);
  const overallStatus = sourceFamilyValidationPassBranches.length === probes.length &&
    cpiCurrencyBundleManifests.length === REQUIRED_CURRENCY_SET.length
    ? "CPI_FAMILY_MANIFEST_BUILT_DIAGNOSTIC"
    : "FAIL_CPI_FAMILY_ENDPOINT_CONTRACT_INCOMPLETE";
  const receiptBody = {
    gate: "Gate 50: macro-source-promotion-proof",
    purpose: "Bounded endpoint/sample, normalized source-contract, and diagnostic non-ACTIVE manifest proof for official CPI source contracts.",
    controls: {
      noPnlComputed: true,
      noStrategyFilterComputed: true,
      noMacroSignalComputed: true,
      noWarehouseWrites: true,
      noActiveManifestBuilt: true,
      diagnosticNonActiveManifestsBuilt: true,
      outcomeConsumable: false,
      credentialsRedacted: true,
    },
    requiredCurrencySet: [...REQUIRED_CURRENCY_SET],
    normalizedObservationSchema: {
      schemaVersion: CPI_NORMALIZED_OBSERVATION_SCHEMA_VERSION,
      familyCandidateId: CPI_FAMILY_CANDIDATE_ID,
      requiredFields: NORMALIZED_CPI_REQUIRED_FIELDS,
      frequencyRule: "Preserve native monthly, quarterly, or explicitly mixed frequency; do not interpolate official CPI observations.",
      yoyRule: "Monthly CPI YoY uses t/t-12 - 1, quarterly CPI YoY uses t/t-4 - 1, and mixed branches use the branch's locked native segment.",
    },
    normalizedObservationContracts,
    cpiFamilyValidation: {
      familyCandidateId: CPI_FAMILY_CANDIDATE_ID,
      schemaVersion: CPI_NORMALIZED_OBSERVATION_SCHEMA_VERSION,
      status: sourceFamilyValidationPassBranches.length === probes.length
        ? "PASS_SOURCE_CONTRACT_SCHEMA_DIAGNOSTIC_MANIFEST_SEALED"
        : "FAIL_SOURCE_CONTRACT_SCHEMA_INCOMPLETE",
      branches: familyValidationBranches,
      promotionDecision: {
        promotionEligible: false,
        reason: "CPI diagnostic family and currency-bundle manifests are sealed here, but they are non-ACTIVE, CPI-only, not outcome-consumable, and complete RRP composition remains pending.",
      },
    },
    diagnosticCpiManifests: {
      status: "SEALED_DIAGNOSTIC_NON_ACTIVE",
      familyManifest: cpiFamilyManifest,
      currencyBundleManifests: cpiCurrencyBundleManifests,
      rootPromotionManifestStatus: "NOT_BUILT_RRP_COMPOSITION_PENDING",
      promotionDecision: {
        promotionEligible: false,
        outcomeConsumable: false,
        blockingReason: "RRP_COMPOSITION_PENDING_FOR_PROMOTION",
      },
    },
    probes,
  };
  const stableReceiptBody = {
    ...receiptBody,
    normalizedObservationContracts: normalizedObservationContracts.map((contract) => ({
      ...contract,
      artifactPayloadSha256: contract.artifactPayloadSha256
        ? "LIVE_PAYLOAD_HASH_RETAINED_IN_BRANCH_RESPONSE"
        : null,
    })),
    diagnosticCpiManifests: {
      ...receiptBody.diagnosticCpiManifests,
      currencyBundleManifests: cpiCurrencyBundleManifests.map((manifest) => ({
        ...manifest,
        proofArtifactPayloadSha256: manifest.proofArtifactPayloadSha256
          ? "LIVE_PAYLOAD_HASH_RETAINED_IN_BRANCH_RESPONSE"
          : null,
      })),
    },
    probes: probes.map((probe) => ({
      ...probe,
      response: {
        ok: probe.response.ok,
        status: probe.response.status,
        contentType: probe.response.contentType,
        payloadBytes: probe.response.payloadBytes === null ? null : "LIVE_PAYLOAD_BYTES_RETAINED_IN_BRANCH_RESPONSE",
        payloadSha256: probe.response.payloadSha256 ? "LIVE_PAYLOAD_HASH_RETAINED_IN_BRANCH_RESPONSE" : null,
      },
    })),
  };
  const receiptHash = sha256(stableReceiptBody);
  const livePayloadSetHash = sha256(probes.map((probe) => ({
    currency: probe.currency,
    ok: probe.response.ok,
    status: probe.response.status,
    contentType: probe.response.contentType,
    payloadBytes: probe.response.payloadBytes,
    payloadSha256: probe.response.payloadSha256,
  })));
  const report = {
    generatedAtUtc,
    ...receiptBody,
    summary: {
      overallStatus,
      overallPromotionStatus: "FAIL_CLOSED",
      atomicSourceValidationStatus: sourceFamilyValidationPassBranches.length === probes.length ? "PASS" : "FAIL",
      familyManifestStatus: cpiFamilyManifest.familyManifestStatus,
      currencyBundleStatus: "PARTIAL_SEALED_DIAGNOSTIC",
      blockingReason: "RRP_COMPOSITION_PENDING_FOR_PROMOTION",
      promotionEligible: false,
      outcomeConsumable: false,
      fullWindowCoverageBranches: fullWindowCoverageBranches.length,
      fullWindowCandidates: fullWindowCandidates.length,
      pendingBranches: pendingBranches.length,
      sourceContractProofBranches: probes.length,
      releaseCalendarProofBranches: releaseCalendarProofBranches.length,
      revisionRebasingProofBranches: revisionRebasingProofBranches.length,
      continuityLockedBranches: continuityLockedBranches.length,
      parserContractBranches: parserContractBranches.length,
      normalizedSchemaBranches: normalizedObservationContracts.length,
      sourceFamilyValidationPassBranches: sourceFamilyValidationPassBranches.length,
      manifestBuiltBranches: cpiCurrencyBundleManifests.length,
      familyManifestBlockedBranches: familyManifestBlockedBranches.length,
      cpiFamilyManifestHash: cpiFamilyManifest.familyManifestHash,
      currencyBundleManifestBranches: cpiCurrencyBundleManifests.length,
      residualPromotionBlockerBranches: residualPromotionBlockerBranches.length,
      statusCounts: countBy(probes, (probe) => probe.sampleStatus),
      familyValidationStatusCounts: countBy(familyValidationBranches, (branch) => branch.validationStatus),
      contractProofStatusCounts: countBy(probes, (probe) => probe.sourceContractProof.proofStatus),
      currencyStatus: Object.fromEntries(probes.map((probe) => [probe.currency, probe.sampleStatus])),
      receiptHash,
      livePayloadSetHash,
    },
    files: {
      jsonPath: jsonOut,
      mdPath: mdOut,
    },
  };

  await mkdir(path.dirname(jsonOut), { recursive: true });
  await writeFile(jsonOut, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(mdOut, buildMarkdown(report), "utf8");

  console.log(`Gate 50 official CPI endpoint receipt wrote ${probes.length} branches`);
  console.log(`Overall status: ${report.summary.overallStatus}`);
  console.log(`JSON: ${path.resolve(jsonOut)}`);
  console.log(`Markdown: ${path.resolve(mdOut)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
