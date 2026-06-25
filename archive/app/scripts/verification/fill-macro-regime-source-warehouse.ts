/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: fill-macro-regime-source-warehouse.ts
 *
 * Description:
 * Gate 47 data-only materializer for BPR, rates, CPI inflation, valuation
 * inputs, and derived real-rate snapshots. It stores source observations and
 * weekly currency snapshots for later regime research; it deliberately does
 * not decide how the rows should be interpreted as a filter.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

import { COT_ASSET_CLASSES } from "@/lib/cotMarkets";
import { query } from "@/lib/db";
import {
  MACRO_REGIME_DATASET_VERSION,
  ensureMacroRegimeWarehouseSchema,
  hashMacroRegimePayload,
  markMacroRegimeDatasetComplete,
  persistMacroAvailabilityEvents,
  persistMacroSourceArtifacts,
  persistMacroSourceObservations,
  persistMacroWeeklyCurrencySnapshots,
  persistMacroWeeklySnapshotManifests,
  readMacroRegimePersistCounts,
  upsertMacroRegimeDataset,
  type MacroAvailabilityEvent,
  type MacroSourceArtifact,
  type MacroSourceFamily,
  type MacroSourceObservation,
  type MacroWeeklyCurrencySnapshot,
  type MacroWeeklySnapshotManifest,
} from "@/lib/research/macroRegimeDataset";

loadEnvConfig(process.cwd());

type BankSide = {
  long: number;
  short: number;
};

type BankCommodityRow = {
  commodity: string;
  us: BankSide | null;
  nonUs: BankSide | null;
};

type BprReportType = "f" | "o";
type ReportFetchResult = {
  ok: boolean;
  year: number;
  month: number;
  reportType: BprReportType;
  url: string;
  canonicalCftcUrl: string;
  fetchSource: "cftc_live" | "wayback_cftc_archive" | "unresolved";
  archiveTimestamp: string | null;
  status: number | null;
  html: string | null;
  sourceHash: string | null;
  artifactId: string | null;
  artifact: MacroSourceArtifact | null;
  attempts: Array<{ url: string; status: number | null; hasReportDate: boolean }>;
};

type RateSource = {
  currency: string;
  sourceId: string;
  seriesId: string;
  instrument: string;
  label: string;
  sourceGroup: string;
  frequency: "daily" | "monthly";
  maxStaleDays: number;
  cadence: string;
  sourceUrl: string;
};

type InflationSource = {
  currency: string;
  sourceId: string;
  seriesId: string;
  fredFallbackSeriesId?: string;
  instrument: string;
  label: string;
  sourceGroup: string;
  frequency: "monthly" | "quarterly" | "mixed";
  lagPeriods: number;
  maxStaleDays: number;
  availabilityDelayDays: number;
  cadence: string;
  sourceUrl: string;
  notes?: string;
};

type OfficialCpiFrequency = "monthly" | "quarterly";

type OfficialCpiIndexRow = {
  period: string;
  observationDate: string;
  value: number;
  nativeFrequency: OfficialCpiFrequency;
  lagPeriods: number;
  availableAtUtc: string;
  sourceUrl: string;
  sourceHash: string;
  rawArtifactId: string | null;
  rawArtifactIds: string[];
  sourceContractId: string;
  seriesId: string;
  sourceContractHash: string;
  branchSemanticHash: string;
  parserVersion: string;
  continuityDecisionId: string;
  releaseCalendarVersion: string;
  revisionRebasingVersion: string;
  baseOrReferencePeriod: string;
  periodSegment: string;
  endpointMode: string;
  artifactPayloadSha256: string;
  layoutDriftGuard: string;
};

type OfficialCpiFetchResult = {
  rows: OfficialCpiIndexRow[];
  artifacts: MacroSourceArtifact[];
  sourceHash: string;
  sourceUrl: string;
};

type BaseValuationSource = {
  currency: string;
  sourceId: string;
  instrument: string;
  label: string;
  sourceGroup: string;
  frequency: "annual" | "monthly";
  maxStaleDays: number;
  availabilityDelayDays: number;
  cadence: string;
  sourceUrl: string;
  notes?: string;
};

type OecdValuationSource = BaseValuationSource & {
  provider: "oecd_table4";
  refArea: string;
  transaction: "PPP_P31S14" | "EXC_A";
};

type BisValuationSource = BaseValuationSource & {
  provider: "bis_eer";
  refArea: string;
  seriesKey: string;
  eerType: "N" | "R";
  eerBasket: "B";
};

type ValuationSource = OecdValuationSource | BisValuationSource;

type RealRatePressureSource = {
  currency: string;
  sourceId: string;
  instrument: string;
  sourceGroup: string;
  rateSourceId: string;
  inflationSourceId: string;
  maxStaleDays: number;
  cadence: string;
  sourceUrl: string;
};

type FredSource = RateSource | InflationSource;

type FredObservationRow = {
  observationDate: string;
  value: number;
  realtimeStart: string;
  realtimeEnd: string;
};

type SourceContract = {
  sourceFamily: MacroSourceFamily;
  sourceId: string;
  currency: string;
  instrument: string;
  maxStaleDays: number;
};

type ParentMacroDatasetRow = {
  regime_dataset_id: string;
  dataset_hash: string;
  dataset_version: string;
  status: string;
  promotion_manifest_id: string | null;
  contract_manifest_hash: string | null;
  snapshot_state: string | null;
  calendar_version: string | null;
  selector_version: string | null;
  validation_contract_version: string | null;
  build_version: string | null;
  source_versions: unknown;
  coverage: unknown;
};

export type ParentDatasetIdentity = {
  role: "rate" | "cpi";
  regimeDatasetId: string;
  datasetHash: string;
  datasetVersion: string;
  promotionManifestId: string;
  contractManifestHash: string;
  snapshotState: string;
  calendarVersion: string | null;
  selectorVersion: string | null;
  validationContractVersion: string | null;
  buildVersion: string | null;
  familyManifestId: string;
  familyManifestHash: string;
  sourceVersions: Record<string, unknown>;
  coverage: Record<string, unknown>;
};

type RrpCompositionSummary = {
  rateParent: ParentDatasetIdentity;
  cpiParent: ParentDatasetIdentity;
  rateParentSnapshots: MacroWeeklyCurrencySnapshot[];
  cpiParentSnapshots: MacroWeeklyCurrencySnapshot[];
  rrpSnapshots: MacroWeeklyCurrencySnapshot[];
  validation: {
    expectedWeeklyParentRows: number;
    rateParentWeeklyRows: number;
    cpiParentWeeklyRows: number;
    rrpWeeklyRows: number;
    rrpAvailableRows: number;
    rrpMissingRows: number;
    rrpStaleRows: number;
    currencyBundleCount: number;
    currencyBundleHashes: Record<string, string>;
  };
};

type ParentMacroSnapshotRow = {
  snapshot_id: string | null;
  promotion_manifest_id: string | null;
  contract_manifest_hash: string | null;
  macro_week_id: string | null;
  freeze_version: string | null;
  snapshot_hash: string | null;
  snapshot_state: string | null;
  sealed_at_utc: string | null;
  week_open_utc: string;
  source_family: MacroSourceFamily;
  source_id: string;
  currency: string;
  instrument: string;
  as_of_utc: string;
  source_observation_date: string | null;
  effective_at_utc: string | null;
  available_at_utc: string | null;
  raw_value_json: unknown;
  normalized_value_json: unknown;
  coverage: unknown;
  flags: unknown;
};

type RetrievalCapability =
  | "as_of_queryable"
  | "release_event_filterable"
  | "capture_before_freeze_required"
  | "derived";

type CanonicalAvailabilityPrecision =
  | "exact_timestamp"
  | "date"
  | "scheduled_window"
  | "inferred"
  | "inherited";

type EligibilityPolicy =
  | "eligible_at_or_before_freeze"
  | "first_freeze_strictly_after_date"
  | "capture_must_precede_freeze"
  | "inherit_from_parents";

type SourceRegistryEntry = {
  sourceFamily: MacroSourceFamily;
  sourceId: string;
  currency: string;
  instrument: string;
  featureRole: "raw_source" | "derived_feature";
  economicAuthority: string;
  compilerOrHarmonizer: string;
  disseminationEndpoint: string;
  promotedEndpoint: string;
  endpointContract: string;
  retrievalCapability: RetrievalCapability;
  availabilityPrecision: CanonicalAvailabilityPrecision;
  eligibilityPolicy: EligibilityPolicy;
  endpointExceptionStatus: "standard_contract" | "approved_exception" | "shadow_only" | "derived";
  seriesId: string | null;
  frequency: string;
  units: string;
  seasonalAdjustment: string | null;
  observationPeriodSemantics: string;
  availabilityContract: string;
  revisionPolicy: string;
  rebasingPolicy: string;
  sourceVersion: string;
  promotionState: string;
  semanticContractHash: string;
  providerMetadataHash: string;
  schemaVersionOrHash: string;
  seriesSegmentId: string;
  segmentValidFrom: string | null;
  segmentValidTo: string | null;
  continuityDecision: string;
  unitConversionVersion: string;
  normalizationVersion: string;
  driftAction: "fail_closed_pending_review" | "shadow_only" | "inherits_parent_drift_state";
  notes: string | null;
};

type SourceRegistryEntryInput = Omit<
  SourceRegistryEntry,
  | "semanticContractHash"
  | "providerMetadataHash"
  | "schemaVersionOrHash"
  | "seriesSegmentId"
  | "segmentValidFrom"
  | "segmentValidTo"
  | "continuityDecision"
  | "unitConversionVersion"
  | "normalizationVersion"
  | "driftAction"
>;

export type CliOptions = {
  fromWeekOpenUtc: string;
  toWeekOpenUtc: string;
  weekSource: "calendar" | "matrix-control";
  write: boolean;
  output: string | null;
  reportTypes: BprReportType[];
  allowExploratorySourceFallback: boolean;
  credentialPreflightOnly: boolean;
  includeBpr: boolean;
  includeRates: boolean;
  includeInflation: boolean;
  includeValuation: boolean;
  includeRealRatePressure: boolean;
  composeRrpFromParentDatasets: boolean;
  rateParentDatasetId: string | null;
  rateParentDatasetHash: string | null;
  cpiParentDatasetId: string | null;
  cpiParentDatasetHash: string | null;
  offlineArtifactReplay: boolean;
  offlineArtifactReplayDatasetIds: string[];
};

type CoverageReport = {
  generatedAtUtc: string;
  write: boolean;
  datasetHash: string;
  promotionManifestId: string;
  contractManifestHash: string;
  regimeDatasetId: string | null;
  range: {
    fromWeekOpenUtc: string;
    toWeekOpenUtc: string;
    weeks: number;
  };
  currencies: string[];
  observations: {
    total: number;
    bpr: number;
    rate: number;
    inflation: number;
    valuation: number;
  };
  artifacts: {
    total: number;
    endpoints: Record<string, number>;
    payloadBytes: number;
  };
  availabilityEvents: {
    total: number;
    precision: Record<string, number>;
    retrievalCapabilities: Record<string, number>;
    eligibilityPolicies: Record<string, number>;
  };
  weeklySnapshots: {
    total: number;
    manifests: number;
    bpr: number;
    rate: number;
    inflation: number;
    valuation: number;
    realRatePressure: number;
    stale: number;
    missing: number;
    missingByCurrency: Record<string, number>;
    missingBySourceId: Record<string, number>;
  };
  bpr: {
    attemptedReports: number;
    fetchedReports: number;
    archiveFetchedReports: number;
    failedReports: number;
    localFetchBlockedReports: number;
    failedReportKeys: string[];
    reportTypes: BprReportType[];
    exceptionCalendarVersion: string;
    availabilityModes: Record<string, number>;
    exceptionOrDelayObservations: number;
    promotionBlockedUntilExactPublicationDateObservations: number;
    availabilitySamples: Array<{
      reportType: string | null;
      year: number | null;
      month: number | null;
      reportDate: string;
      availableAtUtc: string;
      availableAtMode: string;
      exceptionOrDelayFlag: boolean;
      promotionBlockedUntilExactPublicationDate: boolean;
      releaseDateConfidence: string | null;
      releaseDateReason: string | null;
    }>;
  };
  rates: {
    sources: number;
    observations: number;
    latestBySource: Record<string, string | null>;
    selectionRuleVersion: string;
    stalenessRuleVersion: string;
    availabilityTimestampMode: string;
  };
  inflation: {
    sources: number;
    observations: number;
    latestBySource: Record<string, string | null>;
  };
  valuation: {
    sources: number;
    observations: number;
    latestBySource: Record<string, string | null>;
    weeklySnapshots: number;
    available: number;
    stale: number;
    missing: number;
  };
  realRatePressure: {
    sources: number;
    weeklySnapshots: number;
    available: number;
    stale: number;
    missing: number;
    composition: Record<string, unknown> | null;
  };
  persistedCounts: {
    artifacts: number;
    availabilityEvents: number;
    observations: number;
    weeklySnapshotManifests: number;
    weeklySnapshots: number;
  } | null;
  notes: string[];
};

const DEFAULT_FROM_WEEK_OPEN_UTC = "2019-01-07T00:00:00.000Z";
const DEFAULT_TO_WEEK_OPEN_UTC = "2026-06-12T15:00:00.000Z";
const CFTC_BPR_INDEX_URL = "https://www.cftc.gov/MarketReports/BankParticipationReports/index.htm";
const CFTC_BPR_EXPLANATORY_URL =
  "https://www.cftc.gov/MarketReports/BankParticipationReports/ExplanatoryNotes/index.htm";

const MONTH_CODES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;
const MONTH_FULL_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;
const BPR_SOURCE_IDS: Record<BprReportType, string> = {
  f: "cftc_bpr_futures",
  o: "cftc_bpr_options",
};
const BPR_INSTRUMENTS: Record<BprReportType, string> = {
  f: "bank_participation_futures",
  o: "bank_participation_futures_and_options",
};
const BPR_MAX_STALE_DAYS = 45;
const BPR_FETCH_CONCURRENCY = 2;

const FX_CURRENCIES = Object.keys(COT_ASSET_CLASSES.fx.markets).sort();
const OECD_TABLE4_SOURCE_URL =
  "https://sdmx.oecd.org/public/rest/data/OECD.SDD.NAD,DSD_NAMAIN10@DF_TABLE4/all?dimensionAtObservation=AllDimensions&format=csvfilewithlabels";
const OECD_TABLE4_REF_AREA_BY_CURRENCY: Record<string, string> = {
  AUD: "AUS",
  CAD: "CAN",
  CHF: "CHE",
  EUR: "EA20",
  GBP: "GBR",
  JPY: "JPN",
  NZD: "NZL",
  USD: "USA",
};
const BIS_EER_SOURCE_URL =
  "https://stats.bis.org/api/v2/data/dataflow/BIS/WS_EER/1.0";
const BIS_EER_REF_AREA_BY_CURRENCY: Record<string, string> = {
  AUD: "AU",
  CAD: "CA",
  CHF: "CH",
  EUR: "XM",
  GBP: "GB",
  JPY: "JP",
  NZD: "NZ",
  USD: "US",
};
const OECD_VALUATION_FEATURE_VERSION = "regime_v1_valuation_input_contract";
const OECD_VALUATION_MAX_STALE_DAYS = 455;
const OECD_VALUATION_AVAILABILITY_DELAY_DAYS = 180;
const BIS_VALUATION_FEATURE_VERSION = "regime_v1_bis_eer_monthly_broad_contract";
const BIS_VALUATION_MAX_STALE_DAYS = 70;
const BIS_VALUATION_AVAILABILITY_DELAY_DAYS = 25;
const MACRO_WEEKLY_SIGNAL_FREEZE_VERSION = "macro_weekly_signal_freeze_v1";
const MACRO_WEEKLY_SIGNAL_FREEZE_CADENCE = "weekly";
const MACRO_WEEKLY_SIGNAL_FREEZE_CUTOFF_FIELD = "week_open_utc";
const MACRO_WEEKLY_SIGNAL_FREEZE_RULE =
  "source rows are eligible only when available_at_utc is at or before the weekly freeze target; intra-week source changes roll to the next weekly snapshot";
const MACRO_SOURCE_CONTRACT_VERSION = "macro_source_contract_hardening_v5_boundary_repair";
const MACRO_CALENDAR_VERSION = "canonical_week_open_v1";
const MACRO_AVAILABILITY_RULE_VERSION = "macro_availability_event_v2_date_only_strict_after_freeze";
const MACRO_WEEKLY_SELECTOR_VERSION = "macro_weekly_snapshot_selector_v4_date_only_strict_and_aud_monthly";
const MACRO_SETTLEMENT_ACTIVATION_VERSION = "macro_weekly_settlement_activation_v1";
const MACRO_PROMOTION_MANIFEST_VERSION = "macro_promotion_manifest_v1";
const MACRO_WEEKLY_SNAPSHOT_MANIFEST_VERSION = "macro_weekly_snapshot_manifest_v1";
const MACRO_VALIDATION_CONTRACT_VERSION = "macro_source_validation_contract_v1";
const MACRO_BUILD_VERSION = "macro_source_fill_build_v5_boundary_repair";
const MACRO_SEMANTIC_REGISTRY_VERSION = "macro_semantic_registry_v1";
const MACRO_STALENESS_RULE_VERSION = "macro_family_staleness_rule_v1";
const MACRO_EXCEPTION_CALENDAR_VERSION = "macro_exception_calendar_v1";
const CFTC_BPR_EXCEPTION_CALENDAR_VERSION = "cftc_bpr_exception_calendar_v2_2019_2025_lapse_holiday";
const MACRO_ELIGIBILITY_CALENDAR_VERSION = "canonical_week_open_eligibility_calendar_v1";
const MACRO_RECONSTRUCTION_MODE = "latest_vintage_research_approximation";
const MACRO_PROMOTION_RECONSTRUCTION_MODE = "historical_first_release_point_in_time";
const MACRO_PROMOTION_READINESS = "exploratory_until_point_in_time_availability_and_vintages_pass";
const RATE_RECONSTRUCTION_MODE = "fred_alfred_realtime_period_latest_eligible_vintage_v2_date_only_strict";
const RATE_SELECTION_RULE_VERSION = "latest_eligible_vintage_as_of_weekly_freeze_date_only_strict_v2";
const RATE_STALENESS_RULE_VERSION = "rate_3m_market_release_aware_carry_v1";
const RATE_RELEASE_AWARE_CARRY_RULE =
  "carry_latest_eligible_real_time_period_row_until_a_newer_date-only_vintage_is_eligible_at_the_first_strictly_later_weekly_freeze";
const RATE_FAMILY_MANIFEST_ID = "rate_3m_market_family_v1";
const RATE_FAMILY_MANIFEST_HASH = "5e75faaadd2d7e19bdf6591df782b772fe10c7b8268713c0f892984867c421b2";
const RATE_PARENT_DATASET_ID = "dcdc850a-80a2-4178-8d08-dd759be6afb8";
const RATE_PARENT_DATASET_HASH = "3db4b84238dbf5c656a9ebaf2ff73219cc1efd2a6e1ff70842983945c4d23612";
const RATE_PARENT_PROMOTION_MANIFEST_ID = "12f04bd4bec599e37fdfdf926d0d39bd73902319654993baa71ce879bb8eecb5";
const RATE_PARENT_CONTRACT_MANIFEST_HASH = "92f93545c05b067bc204678e17283607207d59d212783eb913292ac5eef52556";
const CPI_FAMILY_MANIFEST_ID = "cpi_all_items_family_v1";
const CPI_FAMILY_MANIFEST_HASH = "b0e7f90e8abd7295e9886dec1c384b4ecc048c40eb3fce2feb52cebb58332beb";
const CPI_PARENT_DATASET_ID = "37b4081b-880e-4ae6-8d53-20ba900dff07";
const CPI_PARENT_DATASET_HASH = "0817b0ec5b4c03c2d01ddc5c014601a2b7028c78203d07f95b3393235c70cc17";
const CPI_PARENT_PROMOTION_MANIFEST_ID = "b0b4f8e1c42139791447e4c7413e48f20de1e738fcd5d051ed06acf57f4c286c";
const CPI_PARENT_CONTRACT_MANIFEST_HASH = "1a0e94ec8229b4ce169a95b8c4e3a4c0a401f87cb3502f269b312376bc0bf440";
const CPI_OFFICIAL_SOURCE_MAP_VERSION = "official_cpi_source_map_v2_aud_monthly_backfill_release_aware";
const CPI_OBSERVATION_SCHEMA_VERSION = "cpi_normalized_observation_v1";
const CPI_YOY_FORMULA_VERSION = "cpi_yoy_native_frequency_v1";
const CPI_SELECTION_RULE_VERSION = "latest_official_cpi_yoy_parent_set_as_of_weekly_freeze_aud_monthly_transition_v2";
const CPI_STALENESS_RULE_VERSION = "cpi_official_release_aware_carry_v1";
const CPI_RELEASE_AWARE_CARRY_RULE =
  "carry_latest_official_cpi_yoy_parent_set_until_a_newer_current_observation_is_eligible_at_the_weekly_freeze";
const RATE_REPAIRED_DATASET_VERSION = "macro_regime_source_dataset_v6_rate_date_only_strict";
const CPI_REPAIRED_DATASET_VERSION = "macro_regime_source_dataset_v7_official_cpi_aud_monthly_transition";
const RRP_COMPOSED_DATASET_VERSION = "macro_regime_source_dataset_v8_real_rate_pressure_boundary_repaired";
const RRP_COMPOSITION_BUILD_VERSION = "macro_source_fill_build_v5_rrp_boundary_repaired_parent_composition";
const RRP_COMPOSITION_CONTRACT_VERSION = "macro_source_contract_hardening_v5_rrp_boundary_repaired_parent_composition";
const RRP_FORMULA_VERSION = "real_rate_pressure_3m_rate_minus_cpi_yoy_v1";
const RRP_COMPOSITION_RULE_VERSION = "rate_cpi_parent_dataset_composition_v1";
const RRP_PARENT_ELIGIBILITY_RULE_VERSION = "latest_required_parent_eligibility_v1";
const RRP_CURRENCY_BUNDLE_MANIFEST_ID = "real_rate_pressure_currency_bundle_v1";
const RRP_FEATURE_BUNDLE_MANIFEST_ID = "real_rate_pressure_attribution_v1";
const FRED_INITIAL_RELEASE_OUTPUT_TYPE = "4";
const FRED_REALTIME_PERIOD_OUTPUT_TYPE = "1";
const FRED_REALTIME_START_MIN_DATE = "1776-07-04";
const FRED_REALTIME_END_MAX_DATE = "9999-12-31";
const ESTAT_JPY_CPI_TABLE11_STATS_DATA_ID = "0003427113";
const ESTAT_JPY_CPI_TABLE11_STAT_INF_ID = "000040276968";
const ESTAT_JPY_CPI_TABLE41_VALIDATION_STATS_DATA_ID = "000040276983";
const ESTAT_JPY_CPI_TABLE11_TAB_CODE = "1";
const ESTAT_JPY_CPI_TABLE11_CAT_ALL_ITEMS_CODE = "0001";
const ESTAT_JPY_CPI_TABLE11_AREA_ALL_JAPAN_CODE = "00000";
const DATE_ONLY_AVAILABILITY_ROLLOVER_RULE =
  "date-only or approximate availability is not promotion-bound and must roll to the first subsequent canonical week open before promotion";
const GATE44_MATRIX_CONTROL_DATASET_ID = "479624d1-f6a2-4928-82f1-981137762bdc";
const GATE44_MATRIX_CONTROL_DATASET_HASH = "cb3dfbd8b4725da3b4c3fdf60e3326810261f7d1334402dcac8a0391b1cadc36";
const CFTC_BPR_RELEASE_SCHEDULE_URL =
  "https://www.cftc.gov/MarketReports/BankParticipationReports/ReleaseSchedule/index.htm";
const CFTC_BPR_2019_DELAY_RELEASE_URL = "https://www.cftc.gov/PressRoom/PressReleases/7864-19";
const CFTC_BPR_HISTORICAL_SPECIAL_ANNOUNCEMENTS_URL =
  "https://www.cftc.gov/MarketReports/BankParticipationReports/HistoricalSpecialAnnouncements/index.htm";
const CFTC_BPR_EXACT_RELEASE_OVERRIDES: Record<string, {
  releaseDate: string;
  sourceUrl: string;
  reason: string;
}> = {
  "2019-01-08": {
    releaseDate: "2019-02-08",
    sourceUrl: CFTC_BPR_2019_DELAY_RELEASE_URL,
    reason: "2018-2019 lapse in appropriations delayed the January 2019 BPR to February 8, 2019",
  },
  "2019-02-05": {
    releaseDate: "2019-02-22",
    sourceUrl: CFTC_BPR_2019_DELAY_RELEASE_URL,
    reason: "2018-2019 lapse in appropriations delayed the February 2019 BPR to February 22, 2019",
  },
  "2025-12-02": {
    releaseDate: "2025-12-17",
    sourceUrl: CFTC_BPR_RELEASE_SCHEDULE_URL,
    reason: "CFTC BPR release schedule marks December 2025 as a catch-up release due to the 2025 lapse in appropriations",
  },
};
const CFTC_BPR_NOT_BEFORE_RELEASE_OVERRIDES: Record<string, {
  notBeforeDate: string;
  sourceUrl: string;
  reason: string;
}> = {
  "2025-10-07": {
    notBeforeDate: "2025-11-19",
    sourceUrl: CFTC_BPR_HISTORICAL_SPECIAL_ANNOUNCEMENTS_URL,
    reason: "CFTC says BPR publication was interrupted from October 1 through November 12, 2025 and resumed chronologically after normal operations returned; exact BPR catch-up date is not exposed in the current source page",
  },
  "2025-11-04": {
    notBeforeDate: "2025-11-19",
    sourceUrl: CFTC_BPR_HISTORICAL_SPECIAL_ANNOUNCEMENTS_URL,
    reason: "CFTC says BPR publication was interrupted from October 1 through November 12, 2025 and resumed chronologically after normal operations returned; exact BPR catch-up date is not exposed in the current source page",
  },
};
const OECD_VALUATION_SOURCES: OecdValuationSource[] = FX_CURRENCIES.flatMap((currency) => {
  const refArea = OECD_TABLE4_REF_AREA_BY_CURRENCY[currency];
  if (!refArea) return [];
  return [
    {
      provider: "oecd_table4",
      currency,
      sourceId: "oecd_table4_ppp_household_final_consumption",
      refArea,
      transaction: "PPP_P31S14",
      instrument: "ppp_household_final_consumption_xdc_per_usd",
      label: "OECD annual PPP, household final consumption expenditure",
      sourceGroup: "oecd_annual_ppp_table4",
      frequency: "annual",
      maxStaleDays: OECD_VALUATION_MAX_STALE_DAYS,
      availabilityDelayDays: OECD_VALUATION_AVAILABILITY_DELAY_DAYS,
      cadence: "OECD annual Table 4 PPP, observation date is calendar year",
      sourceUrl: OECD_TABLE4_SOURCE_URL,
      notes: "Raw PPP valuation input only; pair with FX price in a later versioned feature before deriving valuation gaps.",
    },
    {
      provider: "oecd_table4",
      currency,
      sourceId: "oecd_table4_exchange_rate_average",
      refArea,
      transaction: "EXC_A",
      instrument: "exchange_rate_average_xdc_per_usd",
      label: "OECD annual average exchange rate",
      sourceGroup: "oecd_annual_ppp_table4",
      frequency: "annual",
      maxStaleDays: OECD_VALUATION_MAX_STALE_DAYS,
      availabilityDelayDays: OECD_VALUATION_AVAILABILITY_DELAY_DAYS,
      cadence: "OECD annual Table 4 exchange rate, observation date is calendar year",
      sourceUrl: OECD_TABLE4_SOURCE_URL,
      notes: "Raw market-FX companion input for PPP; no valuation gap is derived in this fill layer.",
    },
  ];
});
const BIS_VALUATION_SOURCES: BisValuationSource[] = FX_CURRENCIES.flatMap((currency) => {
  const refArea = BIS_EER_REF_AREA_BY_CURRENCY[currency];
  if (!refArea) return [];
  return [
    {
      provider: "bis_eer",
      currency,
      sourceId: "bis_eer_monthly_broad_nominal",
      refArea,
      seriesKey: `M.N.B.${refArea}`,
      eerType: "N",
      eerBasket: "B",
      instrument: "neer_broad_index_2020_100",
      label: "BIS monthly broad nominal effective exchange rate",
      sourceGroup: "bis_effective_exchange_rates_monthly_broad",
      frequency: "monthly",
      maxStaleDays: BIS_VALUATION_MAX_STALE_DAYS,
      availabilityDelayDays: BIS_VALUATION_AVAILABILITY_DELAY_DAYS,
      cadence: "BIS monthly broad NEER, observation date is month start",
      sourceUrl: BIS_EER_SOURCE_URL,
      notes: "Raw BIS monthly broad NEER input only; no valuation or signal interpretation is derived in this fill layer.",
    },
    {
      provider: "bis_eer",
      currency,
      sourceId: "bis_eer_monthly_broad_real",
      refArea,
      seriesKey: `M.R.B.${refArea}`,
      eerType: "R",
      eerBasket: "B",
      instrument: "reer_broad_index_2020_100",
      label: "BIS monthly broad real effective exchange rate",
      sourceGroup: "bis_effective_exchange_rates_monthly_broad",
      frequency: "monthly",
      maxStaleDays: BIS_VALUATION_MAX_STALE_DAYS,
      availabilityDelayDays: BIS_VALUATION_AVAILABILITY_DELAY_DAYS,
      cadence: "BIS monthly broad REER, observation date is month start",
      sourceUrl: BIS_EER_SOURCE_URL,
      notes: "Raw BIS monthly broad REER input only; no valuation or signal interpretation is derived in this fill layer.",
    },
  ];
});
const VALUATION_SOURCES: ValuationSource[] = [
  ...OECD_VALUATION_SOURCES,
  ...BIS_VALUATION_SOURCES,
];

const RATE_SOURCES: RateSource[] = [
  {
    currency: "AUD",
    sourceId: "fred_IRSTCI01AUM156N",
    seriesId: "IRSTCI01AUM156N",
    instrument: "oecd_call_money_interbank_rate",
    label: "Australia immediate call money/interbank rate",
    sourceGroup: "fred_oecd_overnight_interbank_monthly",
    frequency: "monthly",
    maxStaleDays: 70,
    cadence: "FRED/OECD monthly, observation date is month start",
    sourceUrl: "https://fred.stlouisfed.org/series/IRSTCI01AUM156N",
  },
  {
    currency: "CAD",
    sourceId: "fred_IRSTCI01CAM156N",
    seriesId: "IRSTCI01CAM156N",
    instrument: "oecd_call_money_interbank_rate",
    label: "Canada immediate call money/interbank rate",
    sourceGroup: "fred_oecd_overnight_interbank_monthly",
    frequency: "monthly",
    maxStaleDays: 70,
    cadence: "FRED/OECD monthly, observation date is month start",
    sourceUrl: "https://fred.stlouisfed.org/series/IRSTCI01CAM156N",
  },
  {
    currency: "CHF",
    sourceId: "fred_IRSTCI01CHM156N",
    seriesId: "IRSTCI01CHM156N",
    instrument: "oecd_call_money_interbank_rate",
    label: "Switzerland immediate call money/interbank rate",
    sourceGroup: "fred_oecd_overnight_interbank_monthly",
    frequency: "monthly",
    maxStaleDays: 70,
    cadence: "FRED/OECD monthly, observation date is month start",
    sourceUrl: "https://fred.stlouisfed.org/series/IRSTCI01CHM156N",
  },
  {
    currency: "EUR",
    sourceId: "fred_IRSTCI01EZM156N",
    seriesId: "IRSTCI01EZM156N",
    instrument: "oecd_call_money_interbank_rate",
    label: "Euro area immediate call money/interbank rate",
    sourceGroup: "fred_oecd_overnight_interbank_monthly",
    frequency: "monthly",
    maxStaleDays: 70,
    cadence: "FRED/OECD monthly, observation date is month start",
    sourceUrl: "https://fred.stlouisfed.org/series/IRSTCI01EZM156N",
  },
  {
    currency: "GBP",
    sourceId: "fred_IRSTCI01GBM156N",
    seriesId: "IRSTCI01GBM156N",
    instrument: "oecd_call_money_interbank_rate",
    label: "United Kingdom immediate call money/interbank rate",
    sourceGroup: "fred_oecd_overnight_interbank_monthly",
    frequency: "monthly",
    maxStaleDays: 70,
    cadence: "FRED/OECD monthly, observation date is month start",
    sourceUrl: "https://fred.stlouisfed.org/series/IRSTCI01GBM156N",
  },
  {
    currency: "JPY",
    sourceId: "fred_IRSTCI01JPM156N",
    seriesId: "IRSTCI01JPM156N",
    instrument: "oecd_call_money_interbank_rate",
    label: "Japan immediate call money/interbank rate",
    sourceGroup: "fred_oecd_overnight_interbank_monthly",
    frequency: "monthly",
    maxStaleDays: 70,
    cadence: "FRED/OECD monthly, observation date is month start",
    sourceUrl: "https://fred.stlouisfed.org/series/IRSTCI01JPM156N",
  },
  {
    currency: "NZD",
    sourceId: "fred_IRSTCI01NZM156N",
    seriesId: "IRSTCI01NZM156N",
    instrument: "oecd_call_money_interbank_rate",
    label: "New Zealand immediate call money/interbank rate",
    sourceGroup: "fred_oecd_overnight_interbank_monthly",
    frequency: "monthly",
    maxStaleDays: 70,
    cadence: "FRED/OECD monthly, observation date is month start",
    sourceUrl: "https://fred.stlouisfed.org/series/IRSTCI01NZM156N",
  },
  {
    currency: "USD",
    sourceId: "fred_IRSTCI01USM156N",
    seriesId: "IRSTCI01USM156N",
    instrument: "oecd_call_money_interbank_rate",
    label: "United States immediate call money/interbank rate",
    sourceGroup: "fred_oecd_overnight_interbank_monthly",
    frequency: "monthly",
    maxStaleDays: 70,
    cadence: "FRED/OECD monthly, observation date is month start",
    sourceUrl: "https://fred.stlouisfed.org/series/IRSTCI01USM156N",
  },
  {
    currency: "AUD",
    sourceId: "fred_IR3TIB01AUM156N",
    seriesId: "IR3TIB01AUM156N",
    instrument: "oecd_3m_interbank_rate",
    label: "Australia 3-month interbank rate",
    sourceGroup: "fred_oecd_3m_interbank_monthly",
    frequency: "monthly",
    maxStaleDays: 70,
    cadence: "FRED/OECD monthly, observation date is month start",
    sourceUrl: "https://fred.stlouisfed.org/series/IR3TIB01AUM156N",
  },
  {
    currency: "CAD",
    sourceId: "fred_IR3TIB01CAM156N",
    seriesId: "IR3TIB01CAM156N",
    instrument: "oecd_3m_interbank_rate",
    label: "Canada 3-month interbank rate",
    sourceGroup: "fred_oecd_3m_interbank_monthly",
    frequency: "monthly",
    maxStaleDays: 70,
    cadence: "FRED/OECD monthly, observation date is month start",
    sourceUrl: "https://fred.stlouisfed.org/series/IR3TIB01CAM156N",
  },
  {
    currency: "CHF",
    sourceId: "fred_IR3TIB01CHM156N",
    seriesId: "IR3TIB01CHM156N",
    instrument: "oecd_3m_interbank_rate",
    label: "Switzerland 3-month interbank rate",
    sourceGroup: "fred_oecd_3m_interbank_monthly",
    frequency: "monthly",
    maxStaleDays: 70,
    cadence: "FRED/OECD monthly, observation date is month start",
    sourceUrl: "https://fred.stlouisfed.org/series/IR3TIB01CHM156N",
  },
  {
    currency: "EUR",
    sourceId: "fred_IR3TIB01EZM156N",
    seriesId: "IR3TIB01EZM156N",
    instrument: "oecd_3m_interbank_rate",
    label: "Euro area 3-month interbank rate",
    sourceGroup: "fred_oecd_3m_interbank_monthly",
    frequency: "monthly",
    maxStaleDays: 70,
    cadence: "FRED/OECD monthly, observation date is month start",
    sourceUrl: "https://fred.stlouisfed.org/series/IR3TIB01EZM156N",
  },
  {
    currency: "GBP",
    sourceId: "fred_IR3TIB01GBM156N",
    seriesId: "IR3TIB01GBM156N",
    instrument: "oecd_3m_interbank_rate",
    label: "United Kingdom 3-month interbank rate",
    sourceGroup: "fred_oecd_3m_interbank_monthly",
    frequency: "monthly",
    maxStaleDays: 70,
    cadence: "FRED/OECD monthly, observation date is month start",
    sourceUrl: "https://fred.stlouisfed.org/series/IR3TIB01GBM156N",
  },
  {
    currency: "JPY",
    sourceId: "fred_IR3TIB01JPM156N",
    seriesId: "IR3TIB01JPM156N",
    instrument: "oecd_3m_interbank_rate",
    label: "Japan 3-month interbank rate",
    sourceGroup: "fred_oecd_3m_interbank_monthly",
    frequency: "monthly",
    maxStaleDays: 70,
    cadence: "FRED/OECD monthly, observation date is month start",
    sourceUrl: "https://fred.stlouisfed.org/series/IR3TIB01JPM156N",
  },
  {
    currency: "NZD",
    sourceId: "fred_IR3TIB01NZM156N",
    seriesId: "IR3TIB01NZM156N",
    instrument: "oecd_3m_interbank_rate",
    label: "New Zealand 3-month interbank rate",
    sourceGroup: "fred_oecd_3m_interbank_monthly",
    frequency: "monthly",
    maxStaleDays: 70,
    cadence: "FRED/OECD monthly, observation date is month start",
    sourceUrl: "https://fred.stlouisfed.org/series/IR3TIB01NZM156N",
  },
  {
    currency: "USD",
    sourceId: "fred_IR3TIB01USM156N",
    seriesId: "IR3TIB01USM156N",
    instrument: "oecd_3m_interbank_rate",
    label: "United States 3-month interbank rate",
    sourceGroup: "fred_oecd_3m_interbank_monthly",
    frequency: "monthly",
    maxStaleDays: 70,
    cadence: "FRED/OECD monthly, observation date is month start",
    sourceUrl: "https://fred.stlouisfed.org/series/IR3TIB01USM156N",
  },
  {
    currency: "USD",
    sourceId: "fred_DFEDTARU",
    seriesId: "DFEDTARU",
    instrument: "federal_funds_target_upper_limit",
    label: "Federal funds target range upper limit",
    sourceGroup: "fred_daily_policy_or_reference",
    frequency: "daily",
    maxStaleDays: 10,
    cadence: "FRED daily, 7-day series from Board of Governors/FOMC",
    sourceUrl: "https://fred.stlouisfed.org/series/DFEDTARU",
  },
  {
    currency: "EUR",
    sourceId: "fred_ECBDFR",
    seriesId: "ECBDFR",
    instrument: "ecb_deposit_facility_rate",
    label: "ECB deposit facility rate",
    sourceGroup: "fred_daily_policy_or_reference",
    frequency: "daily",
    maxStaleDays: 10,
    cadence: "FRED daily ECB policy rate series",
    sourceUrl: "https://fred.stlouisfed.org/series/ECBDFR",
  },
  {
    currency: "GBP",
    sourceId: "fred_IUDSOIA",
    seriesId: "IUDSOIA",
    instrument: "sonia_overnight_index_average",
    label: "Sterling Overnight Index Average",
    sourceGroup: "fred_daily_policy_or_reference",
    frequency: "daily",
    maxStaleDays: 10,
    cadence: "FRED daily SONIA benchmark from Bank of England",
    sourceUrl: "https://fred.stlouisfed.org/series/IUDSOIA",
  },
];

const INFLATION_SOURCES: InflationSource[] = [
  {
    currency: "AUD",
    sourceId: "cpi_aud_abs_cpi_all_groups_headline_native_frequency_v1",
    seriesId: "ABS_CPI_1.10001.10.1",
    instrument: "cpi_all_items_yoy",
    label: "Australia CPI all-groups/headline native-frequency index",
    sourceGroup: "official_abs_cpi_native_frequency",
    frequency: "mixed",
    lagPeriods: 0,
    maxStaleDays: 0,
    availabilityDelayDays: 0,
    cadence: "ABS quarterly CPI through 2025-Q3, complete monthly CPI from 2025-10; no interpolation",
    sourceUrl: "https://data.api.abs.gov.au/rest/data/CPI/1.10001.10.1",
  },
  {
    currency: "CAD",
    sourceId: "cpi_cad_statcan_table_1810000401_all_items_canada_nsa_v1",
    seriesId: "41690973",
    instrument: "cpi_all_items_yoy",
    label: "Canada all-items CPI, not seasonally adjusted",
    sourceGroup: "official_statcan_cpi_monthly",
    frequency: "monthly",
    lagPeriods: 12,
    maxStaleDays: 0,
    availabilityDelayDays: 0,
    cadence: "Statistics Canada table 18-10-0004-01 vector 41690973 monthly all-items CPI",
    sourceUrl: "https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorsAndLatestNPeriods",
  },
  {
    currency: "CHF",
    sourceId: "cpi_chf_fso_lik25b25_total_dec2025_100_v1",
    seriesId: "LIK25B25_INDEX_m_TOTAL",
    instrument: "cpi_all_items_yoy",
    label: "Swiss CPI LIK25B25 all-items total index",
    sourceGroup: "official_swiss_fso_lik25b25_monthly",
    frequency: "monthly",
    lagPeriods: 12,
    maxStaleDays: 0,
    availabilityDelayDays: 0,
    cadence: "Swiss FSO LIK25B25 detailed result workbook monthly all-items CPI",
    sourceUrl: "https://dam-api.bfs.admin.ch/hub/api/dam/assets/36669836/master",
  },
  {
    currency: "EUR",
    sourceId: "cpi_eur_eurostat_prc_hicp_minr_ea_total_i25_v1",
    seriesId: "prc_hicp_minr",
    instrument: "cpi_all_items_yoy",
    label: "Eurostat HICP ECOICOP v2 total EA dynamic aggregate",
    sourceGroup: "official_eurostat_hicp_monthly",
    frequency: "monthly",
    lagPeriods: 12,
    maxStaleDays: 0,
    availabilityDelayDays: 0,
    cadence: "Eurostat prc_hicp_minr monthly full HICP index, TOTAL/I25, dynamic EA aggregate",
    sourceUrl: "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_minr",
  },
  {
    currency: "GBP",
    sourceId: "cpi_gbp_ons_d7bt_cpi_all_items_2015_100_v1",
    seriesId: "D7BT",
    instrument: "cpi_all_items_yoy",
    label: "ONS D7BT CPI all-items index",
    sourceGroup: "official_ons_cpi_monthly",
    frequency: "monthly",
    lagPeriods: 12,
    maxStaleDays: 0,
    availabilityDelayDays: 0,
    cadence: "ONS MM23 D7BT monthly CPI all-items index",
    sourceUrl: "https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7bt/mm23/data",
  },
  {
    currency: "JPY",
    sourceId: "cpi_jpy_estat_table_1_1_all_items_japan_2020_base_v1",
    seriesId: ESTAT_JPY_CPI_TABLE11_STATS_DATA_ID,
    fredFallbackSeriesId: "JPNCPIALLMINMEI",
    instrument: "cpi_all_items_yoy",
    label: "Japan CPI all-items index, e-Stat Table 1-1",
    sourceGroup: "official_estat_japan_cpi_monthly",
    frequency: "monthly",
    lagPeriods: 12,
    maxStaleDays: 0,
    availabilityDelayDays: 0,
    cadence: "Statistics Bureau/e-Stat 2020-base monthly Table 1-1 all-items index",
    sourceUrl: `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?statsDataId=${ESTAT_JPY_CPI_TABLE11_STATS_DATA_ID}&cdArea=${ESTAT_JPY_CPI_TABLE11_AREA_ALL_JAPAN_CODE}&cdCat01=${ESTAT_JPY_CPI_TABLE11_CAT_ALL_ITEMS_CODE}&cdTab=${ESTAT_JPY_CPI_TABLE11_TAB_CODE}&lang=E`,
    notes: "Pinned official Statistics Bureau/e-Stat CPI 2020-base Table 1-1 monthly Subgroup Index for Japan, exact all-items code; 2025-base is a future supersession audit.",
  },
  {
    currency: "NZD",
    sourceId: "cpi_nzd_statsnz_cpiq_se9ns1160_all_groups_nsa_v1",
    seriesId: "CPIQ.SE9NS1160",
    instrument: "cpi_all_items_yoy",
    label: "Stats NZ all-groups CPI quarterly index",
    sourceGroup: "official_statsnz_infoshare_cpi_quarterly",
    frequency: "quarterly",
    lagPeriods: 4,
    maxStaleDays: 0,
    availabilityDelayDays: 0,
    cadence: "Stats NZ Infoshare CPIQ.SE9NS1160 quarterly all-groups CPI",
    sourceUrl: "https://infoshare.stats.govt.nz/ExportDirect.aspx",
  },
  {
    currency: "USD",
    sourceId: "cpi_usd_bls_cpi_u_all_items_us_city_average_nsa_v1",
    seriesId: "CUUR0000SA0",
    instrument: "cpi_all_items_yoy",
    label: "BLS CPI-U U.S. city average all-items not seasonally adjusted",
    sourceGroup: "official_bls_cpi_monthly",
    frequency: "monthly",
    lagPeriods: 12,
    maxStaleDays: 0,
    availabilityDelayDays: 0,
    cadence: "BLS CPI-U CUUR0000SA0 monthly not seasonally adjusted index",
    sourceUrl: "https://data.bls.gov/timeseries/CUUR0000SA0",
  },
];

const REAL_RATE_PRESSURE_SOURCE_ID = "derived_real_rate_pressure_3m_interbank_v1";
const REAL_RATE_PRESSURE_INSTRUMENT = "real_rate_pressure_percent";
const REAL_RATE_PRESSURE_RATE_SOURCE_BY_CURRENCY: Record<string, string> = Object.fromEntries(
  RATE_SOURCES
    .filter((source) => source.instrument === "oecd_3m_interbank_rate")
    .map((source) => [source.currency, source.sourceId]),
);
const REAL_RATE_PRESSURE_INFLATION_SOURCE_BY_CURRENCY: Record<string, string> = Object.fromEntries(
  INFLATION_SOURCES.map((source) => [source.currency, source.sourceId]),
);
const REAL_RATE_PRESSURE_SOURCES: RealRatePressureSource[] = FX_CURRENCIES.map((currency) => ({
  currency,
  sourceId: REAL_RATE_PRESSURE_SOURCE_ID,
  instrument: REAL_RATE_PRESSURE_INSTRUMENT,
  sourceGroup: "derived_real_rate_3m_interbank_minus_cpi_yoy",
  rateSourceId: REAL_RATE_PRESSURE_RATE_SOURCE_BY_CURRENCY[currency] ?? "",
  inflationSourceId: REAL_RATE_PRESSURE_INFLATION_SOURCE_BY_CURRENCY[currency] ?? "",
  maxStaleDays: 0,
  cadence: "Derived weekly at week open from latest available 3-month interbank rate and CPI YoY snapshots",
  sourceUrl: "derived://macro-regime/real-rate/3m-interbank-minus-cpi-yoy/v1",
}));

function selectedRateSources(options: Pick<CliOptions, "allowExploratorySourceFallback">) {
  if (options.allowExploratorySourceFallback) return RATE_SOURCES;
  return RATE_SOURCES.filter((source) => source.instrument === "oecd_3m_interbank_rate");
}

type OfflineArtifactReplayRow = {
  regime_dataset_id: string;
  artifact_id: string;
  endpoint_url: string;
  http_status: number | null;
  raw_content_type: string | null;
  raw_payload_sha256: string;
  raw_payload_size_bytes: number;
  raw_payload_text: string | null;
  raw_payload_base64: string | null;
};

let offlineArtifactReplayConfig: {
  enabled: boolean;
  datasetIds: string[];
} = {
  enabled: false,
  datasetIds: [],
};

let offlineArtifactReplayCache: Promise<Map<string, OfflineArtifactReplayRow>> | null = null;

export function configureOfflineArtifactReplay(options: { enabled: boolean; datasetIds?: string[] }) {
  offlineArtifactReplayConfig = {
    enabled: options.enabled,
    datasetIds: options.datasetIds ?? [],
  };
  offlineArtifactReplayCache = null;
}

function sanitizeReplayUrl(url: string) {
  let sanitized = url;
  for (const secret of [process.env.FRED_API_KEY, process.env.ALFRED_API_KEY, process.env.ESTAT_APP_ID]) {
    if (secret) sanitized = sanitized.replaceAll(secret, "[redacted]");
  }
  sanitized = sanitized
    .replaceAll("%5Bredacted%5D", "[redacted]")
    .replaceAll("%5bredacted%5d", "[redacted]");
  return sanitized;
}

function redactedCredentialUrl(url: string, credential: string) {
  return sanitizeReplayUrl(url.replaceAll(credential, "[redacted]"));
}

function sha256Buffer(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

async function offlineArtifactReplayRows() {
  if (!offlineArtifactReplayConfig.enabled) return new Map<string, OfflineArtifactReplayRow>();
  if (offlineArtifactReplayConfig.datasetIds.length === 0) {
    throw new Error("Offline artifact replay requires at least one source dataset id.");
  }
  if (!offlineArtifactReplayCache) {
    offlineArtifactReplayCache = (async () => {
      const rows = await query<OfflineArtifactReplayRow>(
        `
          SELECT
            artifact.regime_dataset_id::text,
            artifact.artifact_id,
            artifact.endpoint_url,
            artifact.http_status,
            artifact.raw_content_type,
            artifact.raw_payload_sha256,
            artifact.raw_payload_size_bytes,
            artifact.raw_payload_text,
            archive.raw_payload_base64
          FROM research_macro_source_artifacts artifact
          LEFT JOIN research_macro_source_artifact_byte_archives archive
            ON archive.raw_payload_sha256 = artifact.raw_payload_sha256
          WHERE artifact.regime_dataset_id = ANY($1::uuid[])
          ORDER BY artifact.regime_dataset_id::text, artifact.endpoint_url, artifact.artifact_id
        `,
        [offlineArtifactReplayConfig.datasetIds],
      );
      const replayRows = new Map<string, OfflineArtifactReplayRow>();
      for (const row of rows) {
        if (replayRows.has(row.endpoint_url)) {
          throw new Error(`Offline artifact replay URL is ambiguous: ${row.endpoint_url}`);
        }
        replayRows.set(row.endpoint_url, row);
      }
      return replayRows;
    })();
  }
  return offlineArtifactReplayCache;
}

async function fetchOfflineArtifactReplaySource(url: string, init?: RequestInit) {
  const sanitizedUrl = sanitizeReplayUrl(url);
  const cache = await offlineArtifactReplayRows();
  let row = cache.get(sanitizedUrl);
  if (!row && String(init?.method ?? "GET").toUpperCase() === "POST") {
    const parsed = new URL(sanitizedUrl);
    if (
      parsed.hostname.toLowerCase() === "infoshare.stats.govt.nz" &&
      parsed.pathname.toLowerCase().endsWith("/exportdirect.aspx")
    ) {
      const candidates = [...cache.values()].filter((candidate) =>
        candidate.endpoint_url.includes("infoshare.stats.govt.nz") &&
        candidate.endpoint_url.toLowerCase().includes("exportdirect.aspx") &&
        candidate.raw_content_type?.toLowerCase().includes("text/csv"));
      if (candidates.length === 1) row = candidates[0];
    }
  }
  if (!row) {
    throw new Error(`Offline artifact replay cache miss for ${sanitizedUrl}`);
  }
  const body = row.raw_payload_text !== null
    ? row.raw_payload_text
    : row.raw_payload_base64
      ? Buffer.from(row.raw_payload_base64, "base64")
      : null;
  if (body === null) {
    throw new Error(`Offline artifact replay payload missing for ${row.artifact_id}`);
  }
  const bodyBuffer = typeof body === "string" ? Buffer.from(body, "utf8") : body;
  const actualHash = sha256Buffer(bodyBuffer);
  if (actualHash !== row.raw_payload_sha256 || bodyBuffer.byteLength !== row.raw_payload_size_bytes) {
    throw new Error(`Offline artifact replay payload identity mismatch for ${row.artifact_id}`);
  }
  const response = new Response(body, {
    status: row.http_status ?? 200,
    headers: row.raw_content_type ? { "content-type": row.raw_content_type } : undefined,
  });
  try {
    Object.defineProperty(response, "url", { value: row.endpoint_url });
  } catch {
    // Some runtimes keep Response.url non-configurable; source-specific URL
    // checks still fail closed if the parser cannot resolve relative actions.
  }
  return response;
}

function argValue(key: string) {
  const args = process.argv.slice(2);
  const direct = args.find((item) => item.startsWith(`${key}=`));
  if (direct) return direct.slice(key.length + 1);
  const index = args.findIndex((item) => item === key);
  if (index >= 0 && index + 1 < args.length) return args[index + 1];
  return null;
}

function hasFlag(flag: string) {
  return process.argv.slice(2).includes(flag);
}

function parseCli(): CliOptions {
  const reportTypes = (argValue("--report-types") ?? "f,o")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is BprReportType => value === "f" || value === "o");
  const composeRrpFromParentDatasets = hasFlag("--compose-rrp-from-parent-datasets");
  const offlineArtifactReplay = hasFlag("--offline-artifact-replay");
  const offlineArtifactReplayDatasetIds = (argValue("--offline-artifact-replay-dataset-ids") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return {
    fromWeekOpenUtc: argValue("--from-week") ?? DEFAULT_FROM_WEEK_OPEN_UTC,
    toWeekOpenUtc: argValue("--to-week") ?? DEFAULT_TO_WEEK_OPEN_UTC,
    weekSource: (argValue("--week-source") === "matrix-control" ? "matrix-control" : "calendar"),
    write: !hasFlag("--dry-run") && argValue("--write") !== "false",
    output: argValue("--output"),
    reportTypes: reportTypes.length > 0 ? reportTypes : ["f", "o"],
    allowExploratorySourceFallback: hasFlag("--allow-exploratory-source-fallback"),
    credentialPreflightOnly: hasFlag("--credential-preflight"),
    includeBpr: composeRrpFromParentDatasets ? false : !hasFlag("--skip-bpr"),
    includeRates: composeRrpFromParentDatasets ? false : !hasFlag("--skip-rates"),
    includeInflation: composeRrpFromParentDatasets ? false : !hasFlag("--skip-inflation"),
    includeValuation: composeRrpFromParentDatasets ? false : !hasFlag("--skip-valuation"),
    includeRealRatePressure: composeRrpFromParentDatasets
      ? true
      : !hasFlag("--skip-real-rate-pressure") && !hasFlag("--skip-real-value"),
    composeRrpFromParentDatasets,
    rateParentDatasetId: argValue("--rate-parent-dataset-id") ?? (composeRrpFromParentDatasets ? RATE_PARENT_DATASET_ID : null),
    rateParentDatasetHash: argValue("--rate-parent-dataset-hash") ?? (composeRrpFromParentDatasets ? RATE_PARENT_DATASET_HASH : null),
    cpiParentDatasetId: argValue("--cpi-parent-dataset-id") ?? (composeRrpFromParentDatasets ? CPI_PARENT_DATASET_ID : null),
    cpiParentDatasetHash: argValue("--cpi-parent-dataset-hash") ?? (composeRrpFromParentDatasets ? CPI_PARENT_DATASET_HASH : null),
    offlineArtifactReplay,
    offlineArtifactReplayDatasetIds,
  };
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function envValue(name: string) {
  return process.env[name]?.trim() || null;
}

function fredApiKey() {
  if (offlineArtifactReplayConfig.enabled) return "[redacted]";
  return envValue("FRED_API_KEY") ?? envValue("ALFRED_API_KEY");
}

function eStatAppId() {
  if (offlineArtifactReplayConfig.enabled) return "[redacted]";
  return envValue("ESTAT_APP_ID");
}

type CredentialProbe = {
  provider: "fred_alfred" | "estat";
  required: boolean;
  present: boolean;
  accepted: boolean;
  rejected: boolean;
};

type CredentialPreflightReport = {
  generatedAtUtc: string;
  promotionBound: boolean;
  credentials: CredentialProbe[];
  accepted: boolean;
};

async function validateFredCredential(required: boolean): Promise<CredentialProbe> {
  const key = fredApiKey();
  if (!required) {
    return { provider: "fred_alfred", required, present: Boolean(key), accepted: true, rejected: false };
  }
  if (!key) {
    return { provider: "fred_alfred", required, present: false, accepted: false, rejected: true };
  }
  try {
    const params = new URLSearchParams({
      api_key: key,
      file_type: "json",
      series_id: "CPIAUCSL",
      realtime_start: FRED_REALTIME_START_MIN_DATE,
      realtime_end: FRED_REALTIME_END_MAX_DATE,
      observation_start: "2020-01-01",
      observation_end: "2020-01-01",
      output_type: "1",
      limit: "1",
      sort_order: "asc",
    });
    const response = await fetchOfficialSource(`https://api.stlouisfed.org/fred/series/observations?${params.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return { provider: "fred_alfred", required, present: true, accepted: false, rejected: true };
    }
    const payload = await response.json() as { observations?: unknown[] };
    const accepted = Array.isArray(payload.observations);
    return { provider: "fred_alfred", required, present: true, accepted, rejected: !accepted };
  } catch {
    return { provider: "fred_alfred", required, present: true, accepted: false, rejected: true };
  }
}

async function validateEStatCredential(required: boolean): Promise<CredentialProbe> {
  const appId = eStatAppId();
  if (!required) {
    return { provider: "estat", required, present: Boolean(appId), accepted: true, rejected: false };
  }
  if (!appId) {
    return { provider: "estat", required, present: false, accepted: false, rejected: true };
  }
  try {
    const params = new URLSearchParams({
      appId,
      lang: "E",
      statsDataId: ESTAT_JPY_CPI_TABLE11_STATS_DATA_ID,
      cdArea: ESTAT_JPY_CPI_TABLE11_AREA_ALL_JAPAN_CODE,
      cdCat01: ESTAT_JPY_CPI_TABLE11_CAT_ALL_ITEMS_CODE,
      cdTab: ESTAT_JPY_CPI_TABLE11_TAB_CODE,
      limit: "1",
    });
    const response = await fetchOfficialSource(`https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?${params.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return { provider: "estat", required, present: true, accepted: false, rejected: true };
    }
    const payload = await response.json();
    const valueNode = deepFindValue(payload, "VALUE");
    const accepted = asArray(valueNode).length > 0;
    return { provider: "estat", required, present: true, accepted, rejected: !accepted };
  } catch {
    return { provider: "estat", required, present: true, accepted: false, rejected: true };
  }
}

async function runCredentialPreflight(cli: CliOptions, generatedAtUtc: string): Promise<CredentialPreflightReport> {
  if (cli.offlineArtifactReplay) {
    return {
      generatedAtUtc,
      promotionBound: true,
      credentials: [
        { provider: "fred_alfred", required: false, present: false, accepted: true, rejected: false },
        { provider: "estat", required: false, present: false, accepted: true, rejected: false },
      ],
      accepted: true,
    };
  }
  const promotionBound = !cli.allowExploratorySourceFallback;
  const fredRequired = promotionBound && cli.includeRates;
  const eStatRequired = promotionBound && cli.includeInflation;
  const credentials = [
    await validateFredCredential(fredRequired),
    await validateEStatCredential(eStatRequired),
  ];
  return {
    generatedAtUtc,
    promotionBound,
    credentials,
    accepted: credentials.filter((credential) => credential.required).every((credential) => credential.accepted),
  };
}

function credentialPreflightSummary(report: CredentialPreflightReport) {
  return report.credentials
    .filter((credential) => credential.required)
    .map((credential) => `${credential.provider}=${credential.accepted ? "accepted" : credential.present ? "rejected" : "missing"}`)
    .join(" ");
}

function hashJson(value: unknown) {
  return sha256(JSON.stringify(value));
}

function asJsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringArrayFromUnknown(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))].sort();
}

function latestIso(values: Array<string | null | undefined>) {
  return uniqueStrings(values).at(-1) ?? null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function responseHeadersRecord(response: Response) {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

function rawPayloadSizeBytes(text: string) {
  return new TextEncoder().encode(text).length;
}

async function fetchOfficialSource(url: string, init?: RequestInit) {
  if (offlineArtifactReplayConfig.enabled) {
    return fetchOfflineArtifactReplaySource(url, init);
  }
  const retryDelaysMs = [1500, 5000, 15000, 30000];
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (response.status !== 429 && response.status < 500) return response;
      if (attempt === retryDelaysMs.length) return response;
      await sleep(retryDelaysMs[attempt]);
    } catch (error) {
      lastError = error;
      if (attempt === retryDelaysMs.length) throw error;
      await sleep(retryDelaysMs[attempt]);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function sourceArtifactFromHttp(options: {
  sourceFamily: MacroSourceArtifact["sourceFamily"];
  sourceId: string;
  currency: string;
  endpointId: string;
  endpointUrl: string;
  fetchedAtUtc: string;
  response: Response;
  text: string;
  sanitizedRequest: Record<string, unknown>;
  coverage?: Record<string, unknown>;
  flags?: Record<string, unknown>;
}): MacroSourceArtifact {
  const rawPayloadSha256 = sha256(options.text);
  const responseHeaders = responseHeadersRecord(options.response);
  const rawContentType = typeof responseHeaders["content-type"] === "string"
    ? responseHeaders["content-type"]
    : null;
  const artifactId = hashJson({
    endpointId: options.endpointId,
    endpointUrl: options.endpointUrl,
    httpStatus: options.response.status,
    rawPayloadSha256,
  });
  return {
    artifactId,
    sourceFamily: options.sourceFamily,
    sourceId: options.sourceId,
    currency: options.currency,
    endpointId: options.endpointId,
    endpointUrl: options.endpointUrl,
    fetchedAtUtc: options.fetchedAtUtc,
    httpStatus: options.response.status,
    responseHeaders,
    sanitizedRequest: options.sanitizedRequest,
    rawContentType,
    rawPayloadSha256,
    rawPayloadSizeBytes: rawPayloadSizeBytes(options.text),
    rawPayloadText: options.text,
    coverage: {
      sourceContractVersion: MACRO_SOURCE_CONTRACT_VERSION,
      evidenceLayer: "immutable_raw_endpoint_payload_v1",
      ...options.coverage,
    },
    flags: {
      credentialsRedacted: true,
      ...options.flags,
    },
  };
}

function sourceArtifactFromBytes(options: {
  sourceFamily: MacroSourceArtifact["sourceFamily"];
  sourceId: string;
  currency: string;
  endpointId: string;
  endpointUrl: string;
  fetchedAtUtc: string;
  response: Response;
  buffer: Buffer;
  sanitizedRequest: Record<string, unknown>;
  coverage?: Record<string, unknown>;
  flags?: Record<string, unknown>;
}): MacroSourceArtifact {
  const rawPayloadSha256 = createHash("sha256").update(options.buffer).digest("hex");
  const responseHeaders = responseHeadersRecord(options.response);
  const rawContentType = typeof responseHeaders["content-type"] === "string"
    ? responseHeaders["content-type"]
    : null;
  const artifactId = hashJson({
    endpointId: options.endpointId,
    endpointUrl: options.endpointUrl,
    httpStatus: options.response.status,
    rawPayloadSha256,
  });
  return {
    artifactId,
    sourceFamily: options.sourceFamily,
    sourceId: options.sourceId,
    currency: options.currency,
    endpointId: options.endpointId,
    endpointUrl: options.endpointUrl,
    fetchedAtUtc: options.fetchedAtUtc,
    httpStatus: options.response.status,
    responseHeaders,
    sanitizedRequest: options.sanitizedRequest,
    rawContentType,
    rawPayloadSha256,
    rawPayloadSizeBytes: options.buffer.byteLength,
    rawPayloadText: null,
    rawPayloadBytesBase64: options.buffer.toString("base64"),
    coverage: {
      sourceContractVersion: MACRO_SOURCE_CONTRACT_VERSION,
      evidenceLayer: "immutable_raw_endpoint_payload_v1",
      ...options.coverage,
    },
    flags: {
      credentialsRedacted: true,
      ...(offlineArtifactReplayConfig.enabled
        ? { binaryPayloadStoredByHashOnly: true }
        : { binaryPayloadArchivedByHash: true }),
      ...options.flags,
    },
  };
}

function artifactIds(artifacts: MacroSourceArtifact[]) {
  return artifacts.map((artifact) => artifact.artifactId);
}

function primaryArtifactId(artifacts: MacroSourceArtifact[]) {
  return artifacts.at(-1)?.artifactId ?? null;
}

function macroObservationIdentity(row: MacroSourceObservation) {
  return {
    sourceFamily: row.sourceFamily,
    sourceId: row.sourceId,
    currency: row.currency,
    instrument: row.instrument,
    observationDate: row.observationDate,
    effectiveAtUtc: row.effectiveAtUtc,
    availableAtUtc: row.availableAtUtc,
    sourceUrl: row.sourceUrl,
    sourceHash: row.sourceHash,
    rawValue: row.rawValue,
    normalizedValue: row.normalizedValue,
  };
}

function macroObservationId(row: MacroSourceObservation) {
  return hashJson(macroObservationIdentity(row));
}

function normalizedMacroObservationHash(row: MacroSourceObservation) {
  return hashJson({
    sourceFamily: row.sourceFamily,
    sourceId: row.sourceId,
    currency: row.currency,
    instrument: row.instrument,
    observationDate: row.observationDate,
    normalizedValue: row.normalizedValue,
  });
}

function availabilityMode(row: MacroSourceObservation) {
  const mode = row.flags.availableAtMode;
  return typeof mode === "string" ? mode : "unspecified";
}

function availabilityPrecisionDetailFromMode(mode: string) {
  if (mode.includes("initial_release")) return "date_only_initial_release";
  if (mode.includes("real_time")) return "date_only_vintage";
  if (mode.includes("cftc_bpr_exception_calendar_not_before")) return "not_before_exception_calendar";
  if (mode.includes("_approx")) return "date_or_rule_approximation";
  if (mode.includes("1530_new_york")) return "scheduled_timestamp";
  return "unspecified";
}

function retrievalCapabilityFromMode(mode: string): RetrievalCapability {
  if (mode.includes("cftc_bpr_exception_calendar_not_before")) return "capture_before_freeze_required";
  if (mode.includes("cftc_bpr")) return "release_event_filterable";
  if (mode.includes("official_cpi")) return "release_event_filterable";
  if (mode.includes("initial_release") || mode.includes("real_time")) return "as_of_queryable";
  if (mode.includes("latest_vintage")) return "capture_before_freeze_required";
  if (mode.includes("_approx")) return "capture_before_freeze_required";
  if (mode.includes("missing_credential")) return "capture_before_freeze_required";
  return "capture_before_freeze_required";
}

function availabilityPrecisionFromMode(mode: string): CanonicalAvailabilityPrecision {
  if (mode.includes("cftc_bpr_exception_calendar_not_before")) return "inferred";
  if (mode.includes("cftc_bpr") || mode.includes("1530_new_york")) return "scheduled_window";
  if (mode.includes("initial_release") || mode.includes("real_time")) return "date";
  if (mode.includes("_approx")) return "inferred";
  if (mode.includes("latest_vintage") || mode.includes("missing_credential")) return "inferred";
  return "inferred";
}

function eligibilityPolicyFromMode(mode: string): EligibilityPolicy {
  if (mode.includes("cftc_bpr_exception_calendar_not_before")) return "first_freeze_strictly_after_date";
  if (mode.includes("cftc_bpr")) return "eligible_at_or_before_freeze";
  if (mode.includes("initial_release") || mode.includes("real_time")) return "first_freeze_strictly_after_date";
  if (mode.includes("latest_vintage")) return "capture_must_precede_freeze";
  if (mode.includes("_approx")) return "capture_must_precede_freeze";
  if (mode.includes("missing_credential")) return "capture_must_precede_freeze";
  return "capture_must_precede_freeze";
}

function availabilityBasisFromMode(mode: string) {
  if (mode.includes("cftc_bpr_exception_calendar")) return "cftc_publication_schedule_exception_calendar";
  if (mode.includes("cftc_bpr")) return "cftc_publication_schedule";
  if (mode.includes("official_cpi")) return "official_cpi_release_calendar_and_artifact";
  if (mode.includes("initial_release")) return "fred_alfred_initial_release";
  if (mode.includes("real_time")) return "fred_alfred_real_time_period";
  if (mode.includes("fred")) return "fred_latest_vintage_observation_rule";
  if (mode.includes("oecd_table4")) return "oecd_publication_lag_rule";
  if (mode.includes("bis_eer")) return "bis_publication_lag_rule";
  return "unspecified";
}

function availabilityTimezoneFromMode(mode: string) {
  if (mode.includes("new_york")) return "America/New_York";
  if (mode.includes("fred") || mode.includes("initial_release") || mode.includes("real_time")) return "America/Chicago";
  if (mode.includes("estat_japan")) return "Asia/Tokyo";
  return "UTC";
}

function availabilityConfidenceFromMode(mode: string) {
  if (mode.includes("cftc_bpr_exception_calendar_not_before")) return "official_not_before_conservative";
  if (mode.includes("1530_new_york")) return "scheduled_exact_unless_exception";
  if (mode.includes("official_cpi")) return "official_release_calendar_diagnostic";
  if (mode.includes("initial_release") || mode.includes("real_time")) return "date_precision_conservative";
  if (mode.includes("_approx")) return "approximate_shadow_or_exploratory";
  return "unknown";
}

function promotionEligibleAvailabilityBasesFromMode(mode: string) {
  if (mode.includes("cftc_bpr_exception_calendar_not_before")) return [];
  if (mode.includes("cftc_bpr_exception_calendar")) return ["cftc_publication_schedule_exception_calendar"];
  if (mode.includes("cftc_bpr")) return ["cftc_publication_schedule"];
  if (mode.includes("official_cpi")) return ["official_cpi_release_calendar_and_artifact"];
  if (mode.includes("initial_release")) return ["fred_alfred_initial_release"];
  if (mode.includes("real_time")) return ["fred_alfred_real_time_period"];
  return [];
}

function minimumAvailabilityConfidenceFromMode(mode: string) {
  if (mode.includes("cftc_bpr_exception_calendar_not_before")) return "exact_publication_date_required_for_promotion";
  if (mode.includes("cftc_bpr")) return "scheduled_exact_unless_exception";
  if (mode.includes("official_cpi")) return "diagnostic_sealed_not_active";
  if (mode.includes("initial_release") || mode.includes("real_time")) return "date_precision_conservative";
  return "promotion_blocked";
}

function exceptionCalendarVersionFromMode(mode: string) {
  if (mode.includes("cftc_bpr")) return CFTC_BPR_EXCEPTION_CALENDAR_VERSION;
  return MACRO_EXCEPTION_CALENDAR_VERSION;
}

function eligibilityCalendarVersionFromMode(_mode: string) {
  return MACRO_ELIGIBILITY_CALENDAR_VERSION;
}

function promotionBlockedFromAvailabilityMode(mode: string) {
  if (mode.includes("initial_release")) return false;
  if (mode.includes("real_time")) return false;
  if (mode.includes("cftc_bpr_exception_calendar_not_before")) return true;
  if (mode.includes("cftc_bpr")) return false;
  return true;
}

function canonicalWeekOpenFor(value: DateTime) {
  return value.setZone("utc").startOf("week");
}

function firstEligibleFreezeForAvailability(
  availableAtUtc: string,
  precision: string,
  eligibilityPolicy: string,
) {
  const availableAt = parseDateIso(availableAtUtc);
  const candidate = canonicalWeekOpenFor(availableAt);
  if (eligibilityPolicy === "first_freeze_strictly_after_date") {
    return isoUtc(candidate.plus({ weeks: 1 }));
  }
  const exactBoundaryEligible =
    eligibilityPolicy === "eligible_at_or_before_freeze" &&
    (precision === "scheduled_window" || precision === "exact_timestamp" || precision === "date");
  if (exactBoundaryEligible && availableAt.toMillis() === candidate.toMillis()) {
    return isoUtc(candidate);
  }
  return isoUtc(candidate.plus({ weeks: 1 }));
}

function availabilityEventIdForRow(row: MacroSourceObservation, mode: string) {
  const retrievalCapability = typeof row.coverage.retrievalCapability === "string"
    ? row.coverage.retrievalCapability
    : retrievalCapabilityFromMode(mode);
  const availabilityPrecision = typeof row.coverage.availabilityPrecision === "string"
    ? row.coverage.availabilityPrecision
    : availabilityPrecisionFromMode(mode);
  const eligibilityPolicy = typeof row.coverage.eligibilityPolicy === "string"
    ? row.coverage.eligibilityPolicy
    : eligibilityPolicyFromMode(mode);
  return hashJson({
    sourceFamily: row.sourceFamily,
    sourceId: row.sourceId,
    currency: row.currency,
    instrument: row.instrument,
    observationDate: row.observationDate,
    endpointAvailableAtUtc: row.availableAtUtc,
    availabilityBasis: availabilityBasisFromMode(mode),
    retrievalCapability,
    availabilityPrecision,
    eligibilityPolicy,
    rawArtifactId: row.coverage.rawArtifactId ?? row.flags.rawArtifactId ?? null,
    vintageDate: row.coverage.vintageDate ?? row.rawValue.realtimeStart ?? null,
  });
}

function enrichMacroObservation(row: MacroSourceObservation): MacroSourceObservation {
  const rawObservationId = macroObservationId(row);
  const normalizedRowHash = normalizedMacroObservationHash(row);
  const mode = availabilityMode(row);
  const availabilityPrecision = (
    typeof row.coverage.availabilityPrecision === "string"
      ? row.coverage.availabilityPrecision
      : availabilityPrecisionFromMode(mode)
  ) as CanonicalAvailabilityPrecision;
  const availabilityPrecisionDetail = availabilityPrecisionDetailFromMode(mode);
  const retrievalCapability = retrievalCapabilityFromMode(mode);
  const eligibilityPolicy = (
    typeof row.coverage.eligibilityPolicy === "string"
      ? row.coverage.eligibilityPolicy
      : eligibilityPolicyFromMode(mode)
  ) as EligibilityPolicy;
  const availabilityEventId = availabilityEventIdForRow(row, mode);
  const eligibleFromWeekOpenUtc = firstEligibleFreezeForAvailability(
    row.availableAtUtc,
    availabilityPrecision,
    eligibilityPolicy,
  );
  const promotionBlocked = promotionBlockedFromAvailabilityMode(mode);
  const reconstructionMode = typeof row.coverage.reconstructionMode === "string"
    ? row.coverage.reconstructionMode
    : promotionBlocked
      ? MACRO_RECONSTRUCTION_MODE
      : MACRO_PROMOTION_RECONSTRUCTION_MODE;
  const promotionReadiness = typeof row.coverage.promotionReadiness === "string"
    ? row.coverage.promotionReadiness
    : promotionBlocked
      ? MACRO_PROMOTION_READINESS
      : "point_in_time_source_contract";
  const rawArtifactIds = [
    ...(Array.isArray(row.coverage.rawArtifactIds) ? row.coverage.rawArtifactIds : []),
    ...(Array.isArray(row.flags.rawArtifactIds) ? row.flags.rawArtifactIds : []),
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
  const rawArtifactId = typeof row.coverage.rawArtifactId === "string"
    ? row.coverage.rawArtifactId
    : typeof row.flags.rawArtifactId === "string"
      ? row.flags.rawArtifactId
    : rawArtifactIds.at(-1) ?? null;
  return {
    ...row,
    coverage: {
      ...row.coverage,
      sourceContractVersion: MACRO_SOURCE_CONTRACT_VERSION,
      reconstructionMode,
      promotionReadiness,
      rawObservationId,
      normalizedRowHash,
      rawArtifactId,
      rawArtifactIds,
      availabilityEventId,
      economicEffectiveAtUtc: row.effectiveAtUtc,
      availableAtBasis: availabilityBasisFromMode(mode),
      retrievalCapability,
      availabilityPrecision,
      availabilityPrecisionDetail,
      eligibilityPolicy,
      availabilityTimezone: availabilityTimezoneFromMode(mode),
      availabilityConfidence: availabilityConfidenceFromMode(mode),
      promotionEligibleAvailabilityBases: promotionEligibleAvailabilityBasesFromMode(mode),
      minimumAvailabilityConfidence: minimumAvailabilityConfidenceFromMode(mode),
      exceptionCalendarVersion: exceptionCalendarVersionFromMode(mode),
      eligibilityCalendarVersion: eligibilityCalendarVersionFromMode(mode),
      availabilityRuleVersion: MACRO_AVAILABILITY_RULE_VERSION,
      eligibleFromWeekOpenUtc,
      availabilityRolloverRule: row.coverage.availabilityRolloverRule ?? DATE_ONLY_AVAILABILITY_ROLLOVER_RULE,
    },
    flags: {
      ...row.flags,
      rawObservationId,
      normalizedRowHash,
      rawArtifactId,
      rawArtifactIds,
      availabilityEventId,
      retrievalCapability,
      availabilityPrecision,
      eligibilityPolicy,
      latestVintageResearchApproximation: promotionBlocked,
      promotionBlockedUntilPointInTimeAvailability: promotionBlocked,
    },
  };
}

function buildAvailabilityEvents(observations: MacroSourceObservation[]): MacroAvailabilityEvent[] {
  const byId = new Map<string, MacroAvailabilityEvent>();
  for (const row of observations) {
    const mode = availabilityMode(row);
    const eventId = typeof row.coverage.availabilityEventId === "string"
      ? row.coverage.availabilityEventId
      : availabilityEventIdForRow(row, mode);
    const availabilityPrecision = typeof row.coverage.availabilityPrecision === "string"
      ? row.coverage.availabilityPrecision
      : availabilityPrecisionFromMode(mode);
    const retrievalCapability = typeof row.coverage.retrievalCapability === "string"
      ? row.coverage.retrievalCapability
      : retrievalCapabilityFromMode(mode);
    const eligibilityPolicy = typeof row.coverage.eligibilityPolicy === "string"
      ? row.coverage.eligibilityPolicy
      : eligibilityPolicyFromMode(mode);
    const rawArtifactId = typeof row.coverage.rawArtifactId === "string"
      ? row.coverage.rawArtifactId
      : typeof row.flags.rawArtifactId === "string"
        ? row.flags.rawArtifactId
        : null;
    byId.set(eventId, {
      availabilityEventId: eventId,
      sourceFamily: row.sourceFamily,
      sourceId: row.sourceId,
      currency: row.currency,
      instrument: row.instrument,
      observationDate: row.observationDate,
      releaseOrVintageId: String(row.coverage.vintageDate ?? row.rawValue.realtimeStart ?? row.observationDate),
      publicReleaseAtUtc: typeof row.coverage.publicReleaseAtUtc === "string" ? row.coverage.publicReleaseAtUtc : null,
      endpointAvailableAtUtc: row.availableAtUtc,
      availabilityDate: row.availableAtUtc.slice(0, 10),
      availabilityBasis: typeof row.coverage.availableAtBasis === "string"
        ? row.coverage.availableAtBasis
        : availabilityBasisFromMode(mode),
      retrievalCapability,
      availabilityPrecision,
      eligibilityPolicy,
      availabilityTimezone: typeof row.coverage.availabilityTimezone === "string"
        ? row.coverage.availabilityTimezone
        : availabilityTimezoneFromMode(mode),
      availabilityEvidenceArtifactId: rawArtifactId,
      availabilityRuleVersion: MACRO_AVAILABILITY_RULE_VERSION,
      availabilityConfidence: typeof row.coverage.availabilityConfidence === "string"
        ? row.coverage.availabilityConfidence
        : availabilityConfidenceFromMode(mode),
      promotionEligibleAvailabilityBases: Array.isArray(row.coverage.promotionEligibleAvailabilityBases)
        ? row.coverage.promotionEligibleAvailabilityBases.filter((value): value is string => typeof value === "string")
        : promotionEligibleAvailabilityBasesFromMode(mode),
      minimumAvailabilityConfidence: typeof row.coverage.minimumAvailabilityConfidence === "string"
        ? row.coverage.minimumAvailabilityConfidence
        : minimumAvailabilityConfidenceFromMode(mode),
      exceptionCalendarVersion: typeof row.coverage.exceptionCalendarVersion === "string"
        ? row.coverage.exceptionCalendarVersion
        : exceptionCalendarVersionFromMode(mode),
      eligibilityCalendarVersion: typeof row.coverage.eligibilityCalendarVersion === "string"
        ? row.coverage.eligibilityCalendarVersion
        : eligibilityCalendarVersionFromMode(mode),
      eligibleFromWeekOpenUtc: typeof row.coverage.eligibleFromWeekOpenUtc === "string"
        ? row.coverage.eligibleFromWeekOpenUtc
        : firstEligibleFreezeForAvailability(row.availableAtUtc, availabilityPrecision, eligibilityPolicy),
      exceptionOrDelayFlag: row.flags.delayedReportException === true || row.coverage.exceptionOrDelayFlag === true,
      coverage: {
        sourceContractVersion: MACRO_SOURCE_CONTRACT_VERSION,
        retrievalCapability,
        availabilityPrecision,
        eligibilityPolicy,
        promotionEligibleAvailabilityBases: Array.isArray(row.coverage.promotionEligibleAvailabilityBases)
          ? row.coverage.promotionEligibleAvailabilityBases
          : promotionEligibleAvailabilityBasesFromMode(mode),
        minimumAvailabilityConfidence: row.coverage.minimumAvailabilityConfidence ?? minimumAvailabilityConfidenceFromMode(mode),
        exceptionCalendarVersion: row.coverage.exceptionCalendarVersion ?? exceptionCalendarVersionFromMode(mode),
        eligibilityCalendarVersion: row.coverage.eligibilityCalendarVersion ?? eligibilityCalendarVersionFromMode(mode),
        availabilityRolloverRule: DATE_ONLY_AVAILABILITY_ROLLOVER_RULE,
      },
      flags: {
        noRegimeInterpretation: true,
        promotionBlockedUntilPointInTimeAvailability:
          row.flags.promotionBlockedUntilPointInTimeAvailability === true,
      },
    });
  }
  return [...byId.values()].sort((left, right) => left.availabilityEventId.localeCompare(right.availabilityEventId));
}

function freezeEligibility(row: MacroSourceObservation, freezeTarget: DateTime) {
  if (!rateRealtimePeriodContainsFreeze(row, freezeTarget)) {
    return { eligible: false, reason: "realtime_period_not_valid_for_freeze_date" };
  }
  const availableAt = parseDateIso(row.availableAtUtc);
  if (availableAt < freezeTarget) {
    return { eligible: true, reason: "available_before_freeze_target" };
  }
  if (availableAt > freezeTarget) {
    return { eligible: false, reason: "available_after_freeze_target" };
  }
  const precision = row.coverage.availabilityPrecision;
  const eligibilityPolicy = row.coverage.eligibilityPolicy;
  if (
    isRateLatestEligibleObservation(row) &&
    row.coverage.asOfQueryDateEligibleAtFreezeDate === true &&
    eligibilityPolicy === "eligible_at_or_before_freeze"
  ) {
    return { eligible: true, reason: "as_of_query_date_matches_freeze_date" };
  }
  if (
    eligibilityPolicy === "eligible_at_or_before_freeze" &&
    (precision === "scheduled_window" || precision === "exact_timestamp")
  ) {
    return { eligible: true, reason: "trusted_exact_boundary_timestamp" };
  }
  return { eligible: false, reason: "date_only_or_approximate_boundary_rolls_forward" };
}

function compareObservationSelectionPriority(left: MacroSourceObservation, right: MacroSourceObservation) {
  const leftKey = [
    left.observationDate,
    left.effectiveAtUtc,
    String(left.coverage.vintageDate ?? left.rawValue.realtimeStart ?? left.availableAtUtc),
    left.availableAtUtc,
    String(left.coverage.rawObservationId ?? left.flags.rawObservationId ?? ""),
  ];
  const rightKey = [
    right.observationDate,
    right.effectiveAtUtc,
    String(right.coverage.vintageDate ?? right.rawValue.realtimeStart ?? right.availableAtUtc),
    right.availableAtUtc,
    String(right.coverage.rawObservationId ?? right.flags.rawObservationId ?? ""),
  ];
  for (let index = 0; index < leftKey.length; index += 1) {
    const comparison = leftKey[index].localeCompare(rightKey[index]);
    if (comparison !== 0) return comparison;
  }
  return 0;
}

function selectObservationForFreeze(rows: MacroSourceObservation[], freezeTarget: DateTime) {
  let selected: MacroSourceObservation | null = null;
  let selectedEligibilityReason: string | null = null;
  let eligibleCandidates = 0;
  for (const row of rows) {
    const eligibility = freezeEligibility(row, freezeTarget);
    if (!eligibility.eligible) continue;
    eligibleCandidates += 1;
    if (!selected || compareObservationSelectionPriority(row, selected) > 0) {
      selected = row;
      selectedEligibilityReason = eligibility.reason;
    }
  }
  return { selected, selectedEligibilityReason, eligibleCandidates };
}

function parseUsDate(value: string) {
  const parsed = DateTime.fromFormat(value.trim(), "M/d/yyyy", { zone: "utc" });
  return parsed.isValid ? parsed.toISODate() : null;
}

function isoDate(value: DateTime) {
  const date = value.toISODate();
  if (!date) throw new Error(`Invalid date: ${value.toString()}`);
  return date;
}

function isoUtc(value: DateTime) {
  const iso = value.toUTC().toISO({ suppressMilliseconds: false });
  if (!iso) throw new Error(`Invalid timestamp: ${value.toString()}`);
  return iso;
}

function parseDateIso(value: string) {
  let parsed = DateTime.fromISO(value, { setZone: true });
  if (!parsed.isValid) parsed = DateTime.fromSQL(value, { zone: "utc" });
  if (!parsed.isValid) {
    const fallback = new Date(value);
    if (!Number.isNaN(fallback.getTime())) {
      parsed = DateTime.fromJSDate(fallback, { zone: "utc" });
    }
  }
  if (!parsed.isValid) throw new Error(`Invalid ISO date: ${value}`);
  return parsed;
}

function buildWeeklyRange(fromWeekOpenUtc: string, toWeekOpenUtc: string) {
  const from = parseDateIso(fromWeekOpenUtc);
  const to = parseDateIso(toWeekOpenUtc);
  const weeks: string[] = [];
  for (let cursor = from; cursor <= to; cursor = cursor.plus({ weeks: 1 })) {
    weeks.push(isoUtc(cursor));
  }
  return weeks;
}

async function readMatrixControlWeeks() {
  const rows = await query<{ week_open_utc: string }>(
    `
      SELECT DISTINCT week_open_utc::text
      FROM research_matrix_source_contexts
      WHERE dataset_id = $1::uuid
      ORDER BY week_open_utc
    `,
    [GATE44_MATRIX_CONTROL_DATASET_ID],
  );
  return rows.map((row) => isoUtc(parseDateIso(row.week_open_utc)));
}

async function buildWeeksForCli(cli: CliOptions) {
  if (cli.weekSource === "matrix-control") {
    const weeks = await readMatrixControlWeeks();
    if (weeks.length === 0) {
      throw new Error(`No matrix-control weeks found for dataset ${GATE44_MATRIX_CONTROL_DATASET_ID}`);
    }
    return weeks;
  }
  return buildWeeklyRange(cli.fromWeekOpenUtc, cli.toWeekOpenUtc);
}

function expectedParentManifest(role: "rate" | "cpi") {
  return role === "rate"
    ? {
      promotionManifestId: RATE_PARENT_PROMOTION_MANIFEST_ID,
      contractManifestHash: RATE_PARENT_CONTRACT_MANIFEST_HASH,
      familyManifestId: RATE_FAMILY_MANIFEST_ID,
      familyManifestHash: RATE_FAMILY_MANIFEST_HASH,
    }
    : {
      promotionManifestId: CPI_PARENT_PROMOTION_MANIFEST_ID,
      contractManifestHash: CPI_PARENT_CONTRACT_MANIFEST_HASH,
      familyManifestId: CPI_FAMILY_MANIFEST_ID,
      familyManifestHash: CPI_FAMILY_MANIFEST_HASH,
    };
}

async function readParentDatasetIdentity(options: {
  role: "rate" | "cpi";
  regimeDatasetId: string;
  datasetHash: string;
}): Promise<ParentDatasetIdentity> {
  const rows = await query<ParentMacroDatasetRow>(
    `
      SELECT
        regime_dataset_id::text,
        dataset_hash,
        dataset_version,
        status,
        promotion_manifest_id,
        contract_manifest_hash,
        snapshot_state,
        calendar_version,
        selector_version,
        validation_contract_version,
        build_version,
        source_versions,
        coverage
      FROM research_macro_regime_datasets
      WHERE regime_dataset_id = $1::uuid
        AND dataset_hash = $2
      LIMIT 1
    `,
    [options.regimeDatasetId, options.datasetHash],
  );
  const row = rows[0];
  if (!row) {
    throw new Error(`${options.role} parent dataset not found or hash mismatch: ${options.regimeDatasetId}`);
  }

  const expected = expectedParentManifest(options.role);
  const blockers = [
    row.status !== "complete" ? `${options.role}_parent_dataset_not_complete` : null,
    row.snapshot_state !== "SEALED" ? `${options.role}_parent_dataset_not_sealed` : null,
    row.promotion_manifest_id !== expected.promotionManifestId
      ? `${options.role}_parent_promotion_manifest_mismatch`
      : null,
    row.contract_manifest_hash !== expected.contractManifestHash
      ? `${options.role}_parent_contract_manifest_mismatch`
      : null,
  ].filter((blocker): blocker is string => Boolean(blocker));
  if (blockers.length > 0) {
    throw new Error(`${options.role} parent dataset rejected: ${blockers.join(", ")}`);
  }

  return {
    role: options.role,
    regimeDatasetId: row.regime_dataset_id,
    datasetHash: row.dataset_hash,
    datasetVersion: row.dataset_version,
    promotionManifestId: row.promotion_manifest_id ?? expected.promotionManifestId,
    contractManifestHash: row.contract_manifest_hash ?? expected.contractManifestHash,
    snapshotState: row.snapshot_state ?? "SEALED",
    calendarVersion: row.calendar_version,
    selectorVersion: row.selector_version,
    validationContractVersion: row.validation_contract_version,
    buildVersion: row.build_version,
    familyManifestId: expected.familyManifestId,
    familyManifestHash: expected.familyManifestHash,
    sourceVersions: asJsonRecord(row.source_versions),
    coverage: asJsonRecord(row.coverage),
  };
}

function utcText(columnName: string) {
  return `to_char(${columnName} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
}

function nullableUtcText(columnName: string) {
  return `CASE WHEN ${columnName} IS NULL THEN NULL ELSE ${utcText(columnName)} END`;
}

async function readParentWeeklySnapshots(options: {
  parent: ParentDatasetIdentity;
  weeks: string[];
  sourceFamily: MacroSourceFamily;
  instrument: string;
}): Promise<MacroWeeklyCurrencySnapshot[]> {
  const rows = await query<ParentMacroSnapshotRow>(
    `
      SELECT
        snapshot_id,
        promotion_manifest_id,
        contract_manifest_hash,
        macro_week_id,
        freeze_version,
        snapshot_hash,
        snapshot_state,
        ${nullableUtcText("sealed_at_utc")} AS sealed_at_utc,
        ${utcText("week_open_utc")} AS week_open_utc,
        source_family,
        source_id,
        currency,
        instrument,
        ${utcText("as_of_utc")} AS as_of_utc,
        source_observation_date::text,
        ${nullableUtcText("effective_at_utc")} AS effective_at_utc,
        ${nullableUtcText("available_at_utc")} AS available_at_utc,
        raw_value_json,
        normalized_value_json,
        coverage,
        flags
      FROM research_macro_weekly_currency_snapshots
      WHERE regime_dataset_id = $1::uuid
        AND week_open_utc = ANY($2::timestamptz[])
        AND source_family = $3
        AND instrument = $4
      ORDER BY week_open_utc, currency, source_id, instrument
    `,
    [options.parent.regimeDatasetId, options.weeks, options.sourceFamily, options.instrument],
  );

  return rows.map((row) => ({
    snapshotId: row.snapshot_id,
    promotionManifestId: row.promotion_manifest_id,
    contractManifestHash: row.contract_manifest_hash,
    macroWeekId: row.macro_week_id,
    freezeVersion: row.freeze_version,
    snapshotHash: row.snapshot_hash,
    snapshotState: row.snapshot_state as MacroWeeklyCurrencySnapshot["snapshotState"],
    sealedAtUtc: row.sealed_at_utc,
    weekOpenUtc: row.week_open_utc,
    sourceFamily: row.source_family,
    sourceId: row.source_id,
    currency: row.currency.toUpperCase(),
    instrument: row.instrument,
    asOfUtc: row.as_of_utc,
    sourceObservationDate: row.source_observation_date,
    effectiveAtUtc: row.effective_at_utc,
    availableAtUtc: row.available_at_utc,
    rawValue: asJsonRecord(row.raw_value_json),
    normalizedValue: asJsonRecord(row.normalized_value_json),
    coverage: asJsonRecord(row.coverage),
    flags: asJsonRecord(row.flags),
  }));
}

function datasetVersionForCli(cli: CliOptions) {
  if (cli.composeRrpFromParentDatasets) return RRP_COMPOSED_DATASET_VERSION;
  if (cli.includeRates && !cli.includeInflation && !cli.includeBpr && !cli.includeValuation && !cli.includeRealRatePressure) {
    return RATE_REPAIRED_DATASET_VERSION;
  }
  if (cli.includeInflation && !cli.includeRates && !cli.includeBpr && !cli.includeValuation && !cli.includeRealRatePressure) {
    return CPI_REPAIRED_DATASET_VERSION;
  }
  return MACRO_REGIME_DATASET_VERSION;
}

function buildVersionForCli(cli: CliOptions) {
  if (cli.composeRrpFromParentDatasets) return RRP_COMPOSITION_BUILD_VERSION;
  if (cli.includeRates && !cli.includeInflation && !cli.includeBpr && !cli.includeValuation && !cli.includeRealRatePressure) {
    return "macro_source_fill_build_v5_rate_date_only_strict";
  }
  if (cli.includeInflation && !cli.includeRates && !cli.includeBpr && !cli.includeValuation && !cli.includeRealRatePressure) {
    return "macro_source_fill_build_v5_cpi_aud_monthly_transition";
  }
  return MACRO_BUILD_VERSION;
}

function reconstructionModeForCli(cli: CliOptions) {
  if (cli.composeRrpFromParentDatasets) return "sealed_parent_dataset_composition_v1";
  if (cli.includeInflation && !cli.includeRates && !cli.includeBpr && !cli.includeValuation && !cli.includeRealRatePressure) {
    return "official_cpi_current_vintage_release_aware_v2_aud_monthly_transition";
  }
  return cli.allowExploratorySourceFallback ? MACRO_RECONSTRUCTION_MODE : RATE_RECONSTRUCTION_MODE;
}

function withRrpCompositionSourceVersions(
  sourceVersions: ReturnType<typeof sourceVersionPayload>,
  composition: RrpCompositionSummary | null,
) {
  if (!composition) return sourceVersions;
  return {
    ...sourceVersions,
    realRatePressureComposition: {
      enabled: true,
      datasetVersion: RRP_COMPOSED_DATASET_VERSION,
      compositionRuleVersion: RRP_COMPOSITION_RULE_VERSION,
      formulaVersion: RRP_FORMULA_VERSION,
      cpiYoyFormulaVersion: CPI_YOY_FORMULA_VERSION,
      parentEligibilityRuleVersion: RRP_PARENT_ELIGIBILITY_RULE_VERSION,
      featureBundleManifestId: RRP_FEATURE_BUNDLE_MANIFEST_ID,
      currencyBundleManifestId: RRP_CURRENCY_BUNDLE_MANIFEST_ID,
      parentDatasets: [
        {
          role: "rate",
          datasetId: composition.rateParent.regimeDatasetId,
          datasetHash: composition.rateParent.datasetHash,
          datasetVersion: composition.rateParent.datasetVersion,
          promotionManifestId: composition.rateParent.promotionManifestId,
          contractManifestHash: composition.rateParent.contractManifestHash,
          calendarVersion: composition.rateParent.calendarVersion,
          selectorVersion: composition.rateParent.selectorVersion,
          validationContractVersion: composition.rateParent.validationContractVersion,
          buildVersion: composition.rateParent.buildVersion,
          familyManifestId: composition.rateParent.familyManifestId,
          familyManifestHash: composition.rateParent.familyManifestHash,
        },
        {
          role: "cpi",
          datasetId: composition.cpiParent.regimeDatasetId,
          datasetHash: composition.cpiParent.datasetHash,
          datasetVersion: composition.cpiParent.datasetVersion,
          promotionManifestId: composition.cpiParent.promotionManifestId,
          contractManifestHash: composition.cpiParent.contractManifestHash,
          calendarVersion: composition.cpiParent.calendarVersion,
          selectorVersion: composition.cpiParent.selectorVersion,
          validationContractVersion: composition.cpiParent.validationContractVersion,
          buildVersion: composition.cpiParent.buildVersion,
          familyManifestId: composition.cpiParent.familyManifestId,
          familyManifestHash: composition.cpiParent.familyManifestHash,
        },
      ],
      validation: composition.validation,
      failClosedRule:
        "RRP row is unavailable when any required parent snapshot is missing, stale, non-SEALED, revoked, or missing observation/event/artifact lineage.",
      noOutcomeLogic: true,
      diagnosticOnly: true,
      promotionEligible: false,
    },
  };
}

async function buildRrpCompositionSummary(options: {
  cli: CliOptions;
  weeks: string[];
}): Promise<RrpCompositionSummary> {
  if (!options.cli.rateParentDatasetId || !options.cli.rateParentDatasetHash) {
    throw new Error("RRP composition requires --rate-parent-dataset-id and --rate-parent-dataset-hash.");
  }
  if (!options.cli.cpiParentDatasetId || !options.cli.cpiParentDatasetHash) {
    throw new Error("RRP composition requires --cpi-parent-dataset-id and --cpi-parent-dataset-hash.");
  }
  const rateParent = await readParentDatasetIdentity({
    role: "rate",
    regimeDatasetId: options.cli.rateParentDatasetId,
    datasetHash: options.cli.rateParentDatasetHash,
  });
  const cpiParent = await readParentDatasetIdentity({
    role: "cpi",
    regimeDatasetId: options.cli.cpiParentDatasetId,
    datasetHash: options.cli.cpiParentDatasetHash,
  });
  const rateParentSnapshots = await readParentWeeklySnapshots({
    parent: rateParent,
    weeks: options.weeks,
    sourceFamily: "rate",
    instrument: "oecd_3m_interbank_rate",
  });
  const cpiParentSnapshots = await readParentWeeklySnapshots({
    parent: cpiParent,
    weeks: options.weeks,
    sourceFamily: "inflation",
    instrument: "cpi_all_items_yoy",
  });
  const rrpSnapshots = buildRealRatePressureSnapshots({
    weeks: options.weeks,
    snapshots: [...rateParentSnapshots, ...cpiParentSnapshots],
    rateParent,
    cpiParent,
  });
  const parentDatasetRefs = [
    {
      role: "rate",
      datasetId: rateParent.regimeDatasetId,
      datasetHash: rateParent.datasetHash,
      datasetVersion: rateParent.datasetVersion,
      calendarVersion: rateParent.calendarVersion,
      selectorVersion: rateParent.selectorVersion,
      familyManifestId: rateParent.familyManifestId,
      familyManifestHash: rateParent.familyManifestHash,
    },
    {
      role: "cpi",
      datasetId: cpiParent.regimeDatasetId,
      datasetHash: cpiParent.datasetHash,
      datasetVersion: cpiParent.datasetVersion,
      calendarVersion: cpiParent.calendarVersion,
      selectorVersion: cpiParent.selectorVersion,
      familyManifestId: cpiParent.familyManifestId,
      familyManifestHash: cpiParent.familyManifestHash,
    },
  ];
  const currencyBundleHashes = applyRealRatePressureCurrencyBundleHashes({
    weeks: options.weeks,
    snapshots: rrpSnapshots,
    parentDatasetRefs,
  });
  return {
    rateParent,
    cpiParent,
    rateParentSnapshots,
    cpiParentSnapshots,
    rrpSnapshots,
    validation: {
      expectedWeeklyParentRows: options.weeks.length * FX_CURRENCIES.length,
      rateParentWeeklyRows: rateParentSnapshots.length,
      cpiParentWeeklyRows: cpiParentSnapshots.length,
      rrpWeeklyRows: rrpSnapshots.length,
      rrpAvailableRows: rrpSnapshots.filter((row) => row.coverage.valueAvailable === true).length,
      rrpMissingRows: rrpSnapshots.filter((row) => row.coverage.valueAvailable !== true).length,
      rrpStaleRows: rrpSnapshots.filter((row) => row.coverage.isStale === true).length,
      currencyBundleCount: Object.keys(currencyBundleHashes).length,
      currencyBundleHashes,
    },
  };
}

function macroWeeklySignalFreezeMetadata(weekOpenUtc: string) {
  const freezeTargetUtc = isoUtc(parseDateIso(weekOpenUtc));
  return {
    sourceContractVersion: MACRO_SOURCE_CONTRACT_VERSION,
    calendarVersion: MACRO_CALENDAR_VERSION,
    weeklySignalFreezeVersion: MACRO_WEEKLY_SIGNAL_FREEZE_VERSION,
    weeklySignalFreezeCadence: MACRO_WEEKLY_SIGNAL_FREEZE_CADENCE,
    freezeTargetUtc,
    freezeCutoffField: MACRO_WEEKLY_SIGNAL_FREEZE_CUTOFF_FIELD,
    sourceEligibilityRule: MACRO_WEEKLY_SIGNAL_FREEZE_RULE,
    availabilityRolloverRule: DATE_ONLY_AVAILABILITY_ROLLOVER_RULE,
    intraWeekUpdatesDeferred: true,
    nextEligibleWeekOpenUtc: isoUtc(parseDateIso(weekOpenUtc).plus({ weeks: 1 })),
    liveSettlementRule:
      "weekly snapshot must be built, sealed, reported, and verified before 20:00 America/New_York execution; live execution fails closed otherwise",
  };
}

function buildMonthRange(fromWeekOpenUtc: string, toWeekOpenUtc: string) {
  const from = parseDateIso(fromWeekOpenUtc).minus({ months: 2 }).startOf("month");
  const to = parseDateIso(toWeekOpenUtc).startOf("month");
  const months: Array<{ year: number; month: number }> = [];
  for (let cursor = from; cursor <= to; cursor = cursor.plus({ months: 1 })) {
    months.push({ year: cursor.year, month: cursor.month });
  }
  return months;
}

function firstTuesday(year: number, month: number) {
  const first = DateTime.utc(year, month, 1);
  const offset = (2 - first.weekday + 7) % 7;
  return first.plus({ days: offset });
}

function isCftcBprFirstTuesdayFederalHoliday(value: DateTime) {
  return (value.month === 1 && value.day === 1) || (value.month === 7 && value.day === 4);
}

function scheduledBprReportDate(year: number, month: number) {
  const candidate = firstTuesday(year, month);
  return isCftcBprFirstTuesdayFederalHoliday(candidate)
    ? candidate.plus({ weeks: 1 })
    : candidate;
}

function cftcBprReleaseAtLocalDate(releaseDateIso: string) {
  const releaseDate = DateTime.fromISO(releaseDateIso, { zone: "America/New_York" });
  if (!releaseDate.isValid) throw new Error(`Invalid CFTC BPR release date: ${releaseDateIso}`);
  return isoUtc(releaseDate.startOf("day").set({ hour: 15, minute: 30, second: 0, millisecond: 0 }));
}

function cftcBprAvailableAt(reportDateIso: string) {
  const reportDate = DateTime.fromISO(reportDateIso, { zone: "America/New_York" }).startOf("day");
  const offsetToFriday = (5 - reportDate.weekday + 7) % 7;
  return cftcBprReleaseAtLocalDate(isoDate(reportDate.plus({ days: offsetToFriday })));
}

function cftcBprAvailabilitySchedule(reportDateIso: string) {
  const normalAvailableAtUtc = cftcBprAvailableAt(reportDateIso);
  const exactOverride = CFTC_BPR_EXACT_RELEASE_OVERRIDES[reportDateIso];
  if (exactOverride) {
    return {
      reportDate: reportDateIso,
      normalAvailableAtUtc,
      availableAtUtc: cftcBprReleaseAtLocalDate(exactOverride.releaseDate),
      availableAtMode: "computed_from_cftc_bpr_exception_calendar_release_date_1530_new_york",
      exceptionOrDelayFlag: true,
      promotionBlockedUntilExactPublicationDate: false,
      releaseDateConfidence: "official_exception_schedule",
      releaseDateSourceUrl: exactOverride.sourceUrl,
      releaseDateReason: exactOverride.reason,
    };
  }
  const notBeforeOverride = CFTC_BPR_NOT_BEFORE_RELEASE_OVERRIDES[reportDateIso];
  if (notBeforeOverride) {
    return {
      reportDate: reportDateIso,
      normalAvailableAtUtc,
      availableAtUtc: cftcBprReleaseAtLocalDate(notBeforeOverride.notBeforeDate),
      availableAtMode: "computed_from_cftc_bpr_exception_calendar_not_before_1530_new_york",
      exceptionOrDelayFlag: true,
      promotionBlockedUntilExactPublicationDate: true,
      releaseDateConfidence: "official_interruption_not_before_conservative",
      releaseDateSourceUrl: notBeforeOverride.sourceUrl,
      releaseDateReason: notBeforeOverride.reason,
    };
  }
  return {
    reportDate: reportDateIso,
    normalAvailableAtUtc,
    availableAtUtc: normalAvailableAtUtc,
    availableAtMode: "computed_from_cftc_bpr_report_date_friday_1530_new_york",
    exceptionOrDelayFlag: false,
    promotionBlockedUntilExactPublicationDate: false,
    releaseDateConfidence: "normal_schedule",
    releaseDateSourceUrl: CFTC_BPR_RELEASE_SCHEDULE_URL,
    releaseDateReason: null,
  };
}

function bprScheduleCoverage(schedule: ReturnType<typeof cftcBprAvailabilitySchedule>) {
  return {
    normalAvailableAtUtc: schedule.normalAvailableAtUtc,
    exceptionCalendarVersion: CFTC_BPR_EXCEPTION_CALENDAR_VERSION,
    exceptionOrDelayFlag: schedule.exceptionOrDelayFlag,
    releaseDateConfidence: schedule.releaseDateConfidence,
    releaseDateSourceUrl: schedule.releaseDateSourceUrl,
    releaseDateReason: schedule.releaseDateReason,
  };
}

function bprScheduleFlags(schedule: ReturnType<typeof cftcBprAvailabilitySchedule>) {
  return {
    availableAtMode: schedule.availableAtMode,
    delayedReportException: schedule.exceptionOrDelayFlag,
    promotionBlockedUntilExactPublicationDate: schedule.promotionBlockedUntilExactPublicationDate,
  };
}

function approximateFredAvailableAt(
  observationDateIso: string,
  frequency: RateSource["frequency"] | InflationSource["frequency"],
  availabilityDelayDays?: number,
) {
  const observationDate = DateTime.fromISO(observationDateIso, { zone: "utc" });
  const endOfDay = observationDate.set({ hour: 23, minute: 59, second: 59, millisecond: 0 });
  if (availabilityDelayDays !== undefined) {
    return isoUtc(endOfDay.plus({ days: availabilityDelayDays }));
  }
  if (frequency === "monthly") {
    return isoUtc(endOfDay.plus({ days: 15 }));
  }
  return isoUtc(endOfDay);
}

function bprUrlCandidates(year: number, month: number, reportType: BprReportType) {
  const yy = String(year).slice(2);
  const code = MONTH_CODES[month - 1];
  const fullCode = MONTH_FULL_NAMES[month - 1];
  const token = `dea${code}${yy}${reportType}`;
  const fullToken = `dea${fullCode}${yy}${reportType}`;
  const historicalToken =
    year === 2019 && reportType === "f" && month === 2
      ? `deajfeb${yy}${reportType}`
      : year === 2019 && reportType === "f" && month === 3
        ? `deajmar${yy}${reportType}`
        : null;
  const currentPath = `https://www.cftc.gov/MarketReports/BankParticipation/${token}`;
  const oldPath = `https://www.cftc.gov/MarketReports/BankParticipationReports/${token}`;
  const currentFullPath = `https://www.cftc.gov/MarketReports/BankParticipation/${fullToken}`;
  const oldFullPath = `https://www.cftc.gov/MarketReports/BankParticipationReports/${fullToken}`;
  const historicalOldPath = historicalToken
    ? `https://www.cftc.gov/MarketReports/BankParticipationReports/${historicalToken}`
    : null;
  if (year >= 2023) return [currentPath, oldPath];
  if (year <= 2021) {
    return [
      historicalOldPath,
      oldPath,
      oldFullPath,
      currentPath,
      currentFullPath,
      `${oldPath}.html`,
    ].filter((url): url is string => Boolean(url));
  }
  return [currentPath, oldPath, currentFullPath, oldFullPath];
}

function bprLegacyCftcUrl(year: number, month: number, reportType: BprReportType) {
  const yy = String(year).slice(2);
  const code = MONTH_CODES[month - 1];
  return `https://www.cftc.gov/MarketReports/BankParticipationReports/dea${code}${yy}${reportType}`;
}

function waybackReplayUrl(cftcUrl: string) {
  return `https://web.archive.org/web/${cftcUrl}`;
}

function bprArchiveUrlCandidates(year: number, month: number, reportType: BprReportType) {
  const yy = String(year).slice(2);
  const code = MONTH_CODES[month - 1];
  const fullCode = MONTH_FULL_NAMES[month - 1];
  const token = `dea${code}${yy}${reportType}`;
  const fullToken = `dea${fullCode}${yy}${reportType}`;
  const historicalToken =
    year === 2019 && reportType === "f" && month === 2
      ? `deajfeb${yy}${reportType}`
      : year === 2019 && reportType === "f" && month === 3
        ? `deajmar${yy}${reportType}`
        : null;
  const currentPath = `https://www.cftc.gov/MarketReports/BankParticipation/${token}`;
  const oldPath = `https://www.cftc.gov/MarketReports/BankParticipationReports/${token}`;
  const currentFullPath = `https://www.cftc.gov/MarketReports/BankParticipation/${fullToken}`;
  const oldFullPath = `https://www.cftc.gov/MarketReports/BankParticipationReports/${fullToken}`;
  const historicalOldPath = historicalToken
    ? `https://www.cftc.gov/MarketReports/BankParticipationReports/${historicalToken}`
    : null;
  if (year === 2019) {
    return [
      historicalOldPath,
      oldPath,
      oldFullPath,
      currentPath,
      currentFullPath,
    ].filter((url): url is string => Boolean(url));
  }
  if (year === 2022) return [currentPath, oldPath];
  if (year === 2020 || year === 2021) return [oldPath, oldFullPath, currentPath, currentFullPath];
  if (year >= 2023) return [currentPath];
  return [];
}

function archiveTimestampFromUrl(url: string) {
  return url.match(/\/web\/(\d{14})\//)?.[1] ?? null;
}

function waybackCdxUrl(cftcUrl: string) {
  const parsed = new URL(cftcUrl);
  return `https://web.archive.org/cdx?url=${encodeURIComponent(parsed.host + parsed.pathname)}&output=json&fl=timestamp,original,statuscode,mimetype&filter=statuscode:200&limit=3`;
}

async function mapLimit<T, U>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<U>,
) {
  const results: U[] = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function fetchTextWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    return { response, text };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWaybackSnapshotCandidates(cftcUrl: string) {
  try {
    const { response, text } = await fetchTextWithTimeout(waybackCdxUrl(cftcUrl), {
      cache: "no-store",
      headers: {
        "user-agent": "Mozilla/5.0 LimniResearch/1.0",
        accept: "application/json,text/plain,*/*",
      },
    }, 30_000);
    if (!response.ok) return [];
    const rows = JSON.parse(text) as unknown;
    if (!Array.isArray(rows) || rows.length <= 1) return [];
    return rows.slice(1).flatMap((row) => {
      if (!Array.isArray(row)) return [];
      const timestamp = String(row[0] ?? "");
      const original = String(row[1] ?? cftcUrl);
      return /^\d{14}$/.test(timestamp)
        ? [`https://web.archive.org/web/${timestamp}id_/${original}`]
        : [];
    });
  } catch {
    return [];
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryFetchArchivedBpr(
  archiveUrl: string,
  attempts: ReportFetchResult["attempts"],
) {
  for (let archiveAttempt = 1; archiveAttempt <= 2; archiveAttempt += 1) {
    try {
      if (archiveAttempt > 1) {
        await sleep(1_500 * archiveAttempt);
      }
      const { response, text: html } = await fetchTextWithTimeout(archiveUrl, {
        cache: "no-store",
        redirect: "follow",
        headers: {
          "user-agent": "Mozilla/5.0 LimniResearch/1.0",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      }, 30_000);
      const hasReportDate = /REPORT DATE:\s*[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4}/i.test(html);
      attempts.push({ url: archiveUrl, status: response.status, hasReportDate });
      return { response, html, hasReportDate };
    } catch {
      attempts.push({ url: archiveUrl, status: null, hasReportDate: false });
    }
  }
  return null;
}

async function fetchBprReport(
  year: number,
  month: number,
  reportType: BprReportType,
  fetchedAtUtc: string,
): Promise<ReportFetchResult> {
  const attempts: ReportFetchResult["attempts"] = [];
  let lastUrl = "";
  let lastStatus: number | null = null;
  let canonicalCftcUrl = bprLegacyCftcUrl(year, month, reportType);
  for (const url of bprUrlCandidates(year, month, reportType)) {
    lastUrl = url;
    canonicalCftcUrl = url.includes("/BankParticipationReports/") ? url.replace(/\.html?$/i, "") : canonicalCftcUrl;
    try {
      const { response, text: html } = await fetchTextWithTimeout(url, {
        cache: "no-store",
        headers: {
          "user-agent": "Mozilla/5.0 LimniResearch/1.0",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      }, 25_000);
      lastStatus = response.status;
      const hasReportDate = /REPORT DATE:\s*[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4}/i.test(html);
      attempts.push({ url, status: response.status, hasReportDate });
      if (response.ok && hasReportDate) {
        const artifact = sourceArtifactFromHttp({
          sourceFamily: "bpr",
          sourceId: BPR_SOURCE_IDS[reportType],
          currency: "ALL",
          endpointId: "cftc_bpr_live_html",
          endpointUrl: url,
          fetchedAtUtc,
          response,
          text: html,
          sanitizedRequest: {
            method: "GET",
            url,
            headers: {
              accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "user-agent": "Mozilla/5.0 LimniResearch/1.0",
            },
          },
          coverage: {
            year,
            month,
            reportType,
            canonicalCftcUrl: url,
          },
          flags: {
            fetchSource: "cftc_live",
          },
        });
        return {
          ok: true,
          year,
          month,
          reportType,
          url,
          canonicalCftcUrl: url,
          fetchSource: "cftc_live",
          archiveTimestamp: null,
          status: response.status,
          html,
          sourceHash: sha256(html),
          artifactId: artifact.artifactId,
          artifact,
          attempts,
        };
      }
    } catch {
      attempts.push({ url, status: null, hasReportDate: false });
    }
  }

  for (const archiveSourceUrl of bprArchiveUrlCandidates(year, month, reportType)) {
    const archiveUrl = waybackReplayUrl(archiveSourceUrl);
    const replay = await tryFetchArchivedBpr(archiveUrl, attempts);
    if (replay) {
      lastUrl = replay.response.url || archiveUrl;
      lastStatus = replay.response.status;
      if (replay.response.ok && replay.hasReportDate) {
        const endpointUrl = replay.response.url || archiveUrl;
        const artifact = sourceArtifactFromHttp({
          sourceFamily: "bpr",
          sourceId: BPR_SOURCE_IDS[reportType],
          currency: "ALL",
          endpointId: "wayback_cftc_bpr_html",
          endpointUrl,
          fetchedAtUtc,
          response: replay.response,
          text: replay.html,
          sanitizedRequest: {
            method: "GET",
            url: archiveUrl,
            headers: {
              accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "user-agent": "Mozilla/5.0 LimniResearch/1.0",
            },
          },
          coverage: {
            year,
            month,
            reportType,
            canonicalCftcUrl: archiveSourceUrl,
            archiveTimestamp: archiveTimestampFromUrl(endpointUrl),
          },
          flags: {
            fetchSource: "wayback_cftc_archive",
          },
        });
        return {
          ok: true,
          year,
          month,
          reportType,
          url: replay.response.url || archiveUrl,
          canonicalCftcUrl: archiveSourceUrl,
          fetchSource: "wayback_cftc_archive",
          archiveTimestamp: archiveTimestampFromUrl(replay.response.url),
          status: replay.response.status,
          html: replay.html,
          sourceHash: sha256(replay.html),
          artifactId: artifact.artifactId,
          artifact,
          attempts,
        };
      }
    }

    const snapshots = await fetchWaybackSnapshotCandidates(archiveSourceUrl);
    for (const snapshotUrl of snapshots) {
      const snapshot = await tryFetchArchivedBpr(snapshotUrl, attempts);
      if (!snapshot) continue;
      lastUrl = snapshot.response.url || snapshotUrl;
      lastStatus = snapshot.response.status;
      if (snapshot.response.ok && snapshot.hasReportDate) {
        const endpointUrl = snapshot.response.url || snapshotUrl;
        const artifact = sourceArtifactFromHttp({
          sourceFamily: "bpr",
          sourceId: BPR_SOURCE_IDS[reportType],
          currency: "ALL",
          endpointId: "wayback_cftc_bpr_html",
          endpointUrl,
          fetchedAtUtc,
          response: snapshot.response,
          text: snapshot.html,
          sanitizedRequest: {
            method: "GET",
            url: snapshotUrl,
            headers: {
              accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "user-agent": "Mozilla/5.0 LimniResearch/1.0",
            },
          },
          coverage: {
            year,
            month,
            reportType,
            canonicalCftcUrl: archiveSourceUrl,
            archiveTimestamp: archiveTimestampFromUrl(endpointUrl),
          },
          flags: {
            fetchSource: "wayback_cftc_archive",
          },
        });
        return {
          ok: true,
          year,
          month,
          reportType,
          url: snapshot.response.url || snapshotUrl,
          canonicalCftcUrl: archiveSourceUrl,
          fetchSource: "wayback_cftc_archive",
          archiveTimestamp: archiveTimestampFromUrl(snapshot.response.url || snapshotUrl),
          status: snapshot.response.status,
          html: snapshot.html,
          sourceHash: sha256(snapshot.html),
          artifactId: artifact.artifactId,
          artifact,
          attempts,
        };
      }
    }
  }

  return {
    ok: false,
    year,
    month,
    reportType,
    url: lastUrl,
    canonicalCftcUrl,
    fetchSource: "unresolved",
    archiveTimestamp: null,
    status: lastStatus,
    html: null,
    sourceHash: null,
    artifactId: null,
    artifact: null,
    attempts,
  };
}

function scoreCommodityMatch(commodity: string, marketName: string) {
  const left = commodity.toUpperCase();
  const right = marketName.toUpperCase();
  if (left.includes(right)) return right.length;
  if (right.includes(left)) return left.length;
  return -1;
}

function normalizeBprHtmlCells(html: string) {
  return html
    .replace(/\r/g, "")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/t[dh]>/gi, "\n")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/<[^>]+>/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((cell) => cell.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function parseBprNumber(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isBprBankType(value: string) {
  const upper = value.toUpperCase().replace(/\s+/g, " ");
  return upper === "U.S." || upper === "U.S" || upper === "NON U.S." || upper === "NON U.S";
}

function bprBankTypeKey(value: string): "us" | "nonUs" | null {
  const upper = value.toUpperCase().replace(/\s+/g, " ");
  if (upper.startsWith("NON U.S")) return "nonUs";
  if (upper.startsWith("U.S")) return "us";
  return null;
}

function isLikelyBprCommodityStart(cells: string[], index: number) {
  const value = cells[index];
  const next = cells[index + 1];
  if (!value || !next || !isBprBankType(next)) return false;
  if (value.toUpperCase() === "COMMODITY" || value.toUpperCase().startsWith("REPORT DATE")) return false;
  return parseBprNumber(value) === null;
}

function parseBprSide(cells: string[], bankTypeIndex: number, bankType: "us" | "nonUs"): BankSide | null {
  const numbers: number[] = [];
  for (let index = bankTypeIndex + 1; index < cells.length && numbers.length < 6; index += 1) {
    if (isBprBankType(cells[index]) || isLikelyBprCommodityStart(cells, index)) break;
    const parsed = parseBprNumber(cells[index]);
    if (parsed === null) break;
    numbers.push(parsed);
  }
  if (numbers.length < 4) return null;

  const firstLooksLikeBankCount =
    bankType === "us"
      ? numbers.length >= 6 && numbers[0] <= 100 && Number.isInteger(numbers[0])
      : numbers[0] <= 100 && Number.isInteger(numbers[0]);
  const longIndex = firstLooksLikeBankCount ? 1 : 0;
  const shortIndex = firstLooksLikeBankCount ? 3 : 2;
  const long = numbers[longIndex];
  const short = numbers[shortIndex];
  if (!Number.isFinite(long) || !Number.isFinite(short)) return null;

  return { long, short };
}

function parseBprReportHtmlForWarehouse(html: string) {
  const dateMatch = html.match(/REPORT DATE:\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i);
  if (!dateMatch) {
    throw new Error("BPR report missing REPORT DATE.");
  }
  const reportDate = parseUsDate(dateMatch[1]);
  if (!reportDate) {
    throw new Error(`Invalid BPR report date: ${dateMatch[1]}`);
  }

  const cells = normalizeBprHtmlCells(html);
  const marketMap = new Map<string, BankCommodityRow>();
  let currentCommodity = "";

  for (let index = 0; index < cells.length; index += 1) {
    if (isLikelyBprCommodityStart(cells, index)) {
      currentCommodity = cells[index].toUpperCase();
      if (!marketMap.has(currentCommodity)) {
        marketMap.set(currentCommodity, {
          commodity: currentCommodity,
          us: null,
          nonUs: null,
        });
      }
      continue;
    }

    const bankType = bprBankTypeKey(cells[index]);
    if (!bankType || !currentCommodity) continue;
    const side = parseBprSide(cells, index, bankType);
    if (!side) continue;
    const existing = marketMap.get(currentCommodity) ?? {
      commodity: currentCommodity,
      us: null,
      nonUs: null,
    };
    if (bankType === "us") {
      existing.us = side;
    } else {
      existing.nonUs = side;
    }
    marketMap.set(currentCommodity, existing);
  }

  return {
    reportDate,
    markets: [...marketMap.values()].filter((row) => row.us || row.nonUs),
  };
}

function bestBprMarket(currency: string, rows: BankCommodityRow[]) {
  const definition = COT_ASSET_CLASSES.fx.markets[currency];
  if (!definition) return null;
  let bestRow: BankCommodityRow | null = null;
  let bestScore = -1;
  for (const row of rows) {
    for (const marketName of definition.marketNames) {
      const score = scoreCommodityMatch(row.commodity, marketName);
      if (score > bestScore) {
        bestRow = row;
        bestScore = score;
      }
    }
  }
  return bestScore >= 0 ? bestRow : null;
}

function bprObservationFromMarket(options: {
  reportType: BprReportType;
  reportDate: string;
  availableAtUtc: string;
  availabilitySchedule: ReturnType<typeof cftcBprAvailabilitySchedule>;
  fetchedAtUtc: string;
  sourceUrl: string;
  sourceHash: string | null;
  artifactId: string | null;
  fetchSource: ReportFetchResult["fetchSource"];
  canonicalCftcUrl: string;
  archiveTimestamp: string | null;
  currency: string;
  row: BankCommodityRow | null;
}): MacroSourceObservation {
  const usLong = options.row?.us?.long ?? null;
  const usShort = options.row?.us?.short ?? null;
  const nonUsLong = options.row?.nonUs?.long ?? null;
  const nonUsShort = options.row?.nonUs?.short ?? null;
  const totalLong = (usLong ?? 0) + (nonUsLong ?? 0);
  const totalShort = (usShort ?? 0) + (nonUsShort ?? 0);
  const hasValues = options.row !== null && (totalLong !== 0 || totalShort !== 0);
  const gross = totalLong + totalShort;
  const net = totalLong - totalShort;

  return {
    sourceFamily: "bpr",
    sourceId: BPR_SOURCE_IDS[options.reportType],
    currency: options.currency,
    instrument: BPR_INSTRUMENTS[options.reportType],
    observationDate: options.reportDate,
    effectiveAtUtc: isoUtc(DateTime.fromISO(options.reportDate, { zone: "utc" })),
    availableAtUtc: options.availableAtUtc,
    fetchedAtUtc: options.fetchedAtUtc,
    sourceUrl: options.sourceUrl,
    sourceHash: options.sourceHash,
    rawValue: {
      reportType: options.reportType,
      commodity: options.row?.commodity ?? null,
      us: options.row?.us ?? null,
      nonUs: options.row?.nonUs ?? null,
    },
    normalizedValue: hasValues
      ? {
          totalBankLongContracts: totalLong,
          totalBankShortContracts: totalShort,
          netBankContracts: net,
          grossBankContracts: gross,
          netShareOfGross: gross === 0 ? null : net / gross,
        }
      : {},
    coverage: {
      valueAvailable: hasValues,
      marketMatched: options.row !== null,
      officialCadence: "monthly first Friday after 15:30 Eastern, using first Tuesday data unless the first Tuesday is a federal holiday",
      sourceIndexUrl: CFTC_BPR_INDEX_URL,
      rawArtifactId: options.artifactId,
      rawArtifactIds: options.artifactId ? [options.artifactId] : [],
      ...bprScheduleCoverage(options.availabilitySchedule),
    },
    flags: {
      noRegimeInterpretation: true,
      fetchSource: options.fetchSource,
      canonicalCftcUrl: options.canonicalCftcUrl,
      archiveTimestamp: options.archiveTimestamp,
      explanatoryNotesUrl: CFTC_BPR_EXPLANATORY_URL,
      ...bprScheduleFlags(options.availabilitySchedule),
    },
  };
}

function bprAvailabilityObservation(options: {
  reportType: BprReportType;
  year: number;
  month: number;
  fetchedAtUtc: string;
  fetch: ReportFetchResult;
  reportDate: string;
  availableAtUtc: string;
  availabilitySchedule: ReturnType<typeof cftcBprAvailabilitySchedule>;
  marketsCount: number | null;
}): MacroSourceObservation {
  return {
    sourceFamily: "bpr",
    sourceId: BPR_SOURCE_IDS[options.reportType],
    currency: "ALL",
    instrument: "bpr_report_availability",
    observationDate: options.reportDate,
    effectiveAtUtc: isoUtc(DateTime.fromISO(options.reportDate, { zone: "utc" })),
    availableAtUtc: options.availableAtUtc,
    fetchedAtUtc: options.fetchedAtUtc,
    sourceUrl: options.fetch.url,
    sourceHash: options.fetch.sourceHash,
    rawValue: {
      year: options.year,
      month: options.month,
      reportType: options.reportType,
      status: options.fetch.status,
      ok: options.fetch.ok,
      fetchSource: options.fetch.fetchSource,
      canonicalCftcUrl: options.fetch.canonicalCftcUrl,
      archiveTimestamp: options.fetch.archiveTimestamp,
      attempts: options.fetch.attempts,
      marketsCount: options.marketsCount,
    },
    normalizedValue: {},
    coverage: {
      reportFetched: options.fetch.ok,
      archiveFetched: options.fetch.fetchSource === "wayback_cftc_archive",
      localFetchBlocked: options.fetch.attempts.some((attempt) => attempt.status === 403),
      sourceUrlResolved: options.fetch.ok,
      rawArtifactId: options.fetch.artifactId,
      rawArtifactIds: options.fetch.artifactId ? [options.fetch.artifactId] : [],
      ...bprScheduleCoverage(options.availabilitySchedule),
    },
    flags: {
      noRegimeInterpretation: true,
      rowPurpose: "source_availability_metadata",
      ...bprScheduleFlags(options.availabilitySchedule),
    },
  };
}

async function buildBprObservations(options: CliOptions, fetchedAtUtc: string) {
  const observations: MacroSourceObservation[] = [];
  const artifacts: MacroSourceArtifact[] = [];
  const months = buildMonthRange(options.fromWeekOpenUtc, options.toWeekOpenUtc);
  const tasks = options.reportTypes.flatMap((reportType) =>
    months.map(({ year, month }) => ({ year, month, reportType })));
  let attemptedReports = 0;
  let fetchedReports = 0;
  let archiveFetchedReports = 0;
  let localFetchBlockedReports = 0;
  const failedReportKeys: string[] = [];

  const fetchResults = await mapLimit(tasks, BPR_FETCH_CONCURRENCY, (task) =>
    fetchBprReport(task.year, task.month, task.reportType, fetchedAtUtc));

  for (const fetchResult of fetchResults) {
      const { year, month, reportType } = fetchResult;
      attemptedReports += 1;
      if (fetchResult.attempts.some((attempt) => attempt.status === 403)) {
        localFetchBlockedReports += 1;
      }
      const expectedReportDate = isoDate(scheduledBprReportDate(year, month));
      let reportDate = expectedReportDate;
      let availabilitySchedule = cftcBprAvailabilitySchedule(reportDate);
      let availableAtUtc = availabilitySchedule.availableAtUtc;
      let marketsCount: number | null = null;

      if (fetchResult.ok && fetchResult.html) {
        if (fetchResult.artifact) {
          artifacts.push(fetchResult.artifact);
        }
        fetchedReports += 1;
        if (fetchResult.fetchSource === "wayback_cftc_archive") {
          archiveFetchedReports += 1;
        }
        const report = parseBprReportHtmlForWarehouse(fetchResult.html);
        reportDate = report.reportDate;
        availabilitySchedule = cftcBprAvailabilitySchedule(reportDate);
        availableAtUtc = availabilitySchedule.availableAtUtc;
        marketsCount = report.markets.length;
        observations.push(bprAvailabilityObservation({
          reportType,
          year,
          month,
          fetchedAtUtc,
          fetch: fetchResult,
          reportDate,
          availableAtUtc,
          availabilitySchedule,
          marketsCount,
        }));
        for (const currency of FX_CURRENCIES) {
          observations.push(bprObservationFromMarket({
            reportType,
            reportDate,
            availableAtUtc,
            availabilitySchedule,
            fetchedAtUtc,
            sourceUrl: fetchResult.url,
            sourceHash: fetchResult.sourceHash,
            artifactId: fetchResult.artifactId,
            fetchSource: fetchResult.fetchSource,
            canonicalCftcUrl: fetchResult.canonicalCftcUrl,
            archiveTimestamp: fetchResult.archiveTimestamp,
            currency,
            row: bestBprMarket(currency, report.markets),
          }));
        }
      } else {
        failedReportKeys.push(`${year}-${String(month).padStart(2, "0")}-${reportType}`);
        observations.push(bprAvailabilityObservation({
          reportType,
          year,
          month,
          fetchedAtUtc,
          fetch: fetchResult,
          reportDate,
          availableAtUtc,
          availabilitySchedule,
          marketsCount,
        }));
      }
  }

  return {
    artifacts,
    observations,
    attemptedReports,
    fetchedReports,
    archiveFetchedReports,
    failedReports: attemptedReports - fetchedReports,
    localFetchBlockedReports,
    failedReportKeys,
  };
}

function parseFredCsv(csv: string, seriesId: string) {
  const lines = csv.trim().split(/\r?\n/);
  const header = lines[0] ?? "";
  if (!header.includes(seriesId)) {
    throw new Error(`Unexpected FRED CSV header for ${seriesId}: ${header}`);
  }
  return lines.slice(1).flatMap((line) => {
    const [observationDate, rawValue] = line.split(",");
    if (!observationDate || !rawValue || rawValue === ".") return [];
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return [];
    return [{ observationDate, value }];
  });
}

function fredSourceFamily(source: FredSource): "rate" | "inflation" {
  return "lagPeriods" in source ? "inflation" : "rate";
}

function fredInitialReleaseAvailableAt(realtimeStart: string) {
  return isoUtc(DateTime.fromISO(realtimeStart, { zone: "utc" }).endOf("day"));
}

function fredRealtimePeriodAvailableAt(realtimeStart: string) {
  return isoUtc(DateTime.fromISO(realtimeStart, { zone: "utc" }).startOf("day"));
}

function isCanonicalRateSource(source: FredSource): source is RateSource {
  return source.instrument === "oecd_3m_interbank_rate";
}

function isCanonicalRateContract(contract: SourceContract) {
  return contract.sourceFamily === "rate" && contract.instrument === "oecd_3m_interbank_rate";
}

function isRateLatestEligibleObservation(row: MacroSourceObservation) {
  return row.sourceFamily === "rate" && row.coverage.selectionRule === RATE_SELECTION_RULE_VERSION;
}

function isOfficialCpiContract(contract: SourceContract) {
  return contract.sourceFamily === "inflation" && contract.instrument === "cpi_all_items_yoy";
}

function isOfficialCpiObservation(row: MacroSourceObservation) {
  return row.sourceFamily === "inflation" && row.coverage.selectionRule === CPI_SELECTION_RULE_VERSION;
}

function rateRealtimePeriodContainsFreeze(row: MacroSourceObservation, freezeTarget: DateTime) {
  if (!isRateLatestEligibleObservation(row)) return true;
  const realtimeStart = typeof row.rawValue.realtimeStart === "string"
    ? row.rawValue.realtimeStart
    : typeof row.coverage.realtimeStart === "string"
      ? row.coverage.realtimeStart
      : null;
  const realtimeEnd = typeof row.rawValue.realtimeEnd === "string"
    ? row.rawValue.realtimeEnd
    : typeof row.coverage.realtimeEnd === "string"
      ? row.coverage.realtimeEnd
      : null;
  const freezeDate = freezeTarget.toISODate();
  if (!realtimeStart || !realtimeEnd || !freezeDate) return true;
  return realtimeStart <= freezeDate && freezeDate <= realtimeEnd;
}

function fredSafeRealtimeEnd() {
  return DateTime.utc().minus({ days: 1 }).startOf("day");
}

function fredRealtimeWindows(options: { from: DateTime; to: DateTime }) {
  const start = options.from.minus({ years: 1 }).startOf("day");
  const endCandidate = options.to.plus({ years: 2 }).startOf("day");
  const end = DateTime.min(endCandidate, fredSafeRealtimeEnd());
  if (end < start) return [];
  const windows: Array<{ realtimeStart: string; realtimeEnd: string }> = [];
  let cursor = start;
  while (cursor <= end) {
    const windowEnd = DateTime.min(cursor.plus({ days: 699 }), end);
    windows.push({
      realtimeStart: isoDate(cursor),
      realtimeEnd: isoDate(windowEnd),
    });
    cursor = windowEnd.plus({ days: 1 });
  }
  return windows;
}

async function fetchFredInitialReleaseRows(options: {
  source: FredSource;
  from: DateTime;
  to: DateTime;
  apiKey: string;
  fetchedAtUtc: string;
}) {
  const rows: FredObservationRow[] = [];
  const artifacts: MacroSourceArtifact[] = [];
  const limit = 100000;
  const payloadHashes: string[] = [];
  let requestUrl = "";
  const seenRows = new Set<string>();

  for (const window of fredRealtimeWindows({ from: options.from, to: options.to })) {
    let offset = 0;
    while (true) {
      const params = new URLSearchParams({
        api_key: options.apiKey,
        file_type: "json",
        series_id: options.source.seriesId,
        realtime_start: window.realtimeStart,
        realtime_end: window.realtimeEnd,
        observation_start: isoDate(options.from),
        observation_end: isoDate(options.to),
        output_type: FRED_INITIAL_RELEASE_OUTPUT_TYPE,
        limit: String(limit),
        offset: String(offset),
        sort_order: "asc",
      });
      requestUrl = `https://api.stlouisfed.org/fred/series/observations?${params.toString()}`;
      const response = await fetchOfficialSource(requestUrl, { cache: "no-store" });
      const text = await response.text();
      const sanitizedUrl = redactedCredentialUrl(requestUrl, options.apiKey);
      const artifact = sourceArtifactFromHttp({
        sourceFamily: fredSourceFamily(options.source),
        sourceId: options.source.sourceId,
        currency: options.source.currency,
        endpointId: "fred_alfred_series_observations_initial_release",
        endpointUrl: sanitizedUrl,
        fetchedAtUtc: options.fetchedAtUtc,
        response,
        text,
        sanitizedRequest: {
          method: "GET",
          url: sanitizedUrl,
          params: {
            file_type: "json",
            series_id: options.source.seriesId,
            realtime_start: window.realtimeStart,
            realtime_end: window.realtimeEnd,
            observation_start: isoDate(options.from),
            observation_end: isoDate(options.to),
            output_type: FRED_INITIAL_RELEASE_OUTPUT_TYPE,
            limit,
            offset,
            sort_order: "asc",
            api_key: "[redacted]",
          },
        },
        coverage: {
          seriesId: options.source.seriesId,
          outputType: FRED_INITIAL_RELEASE_OUTPUT_TYPE,
          realtimeStart: window.realtimeStart,
          realtimeEnd: window.realtimeEnd,
          pageOffset: offset,
          pageLimit: limit,
        },
        flags: {
          reconstructionMode: MACRO_PROMOTION_RECONSTRUCTION_MODE,
        },
      });
      artifacts.push(artifact);
      payloadHashes.push(sha256(text));
      if (!response.ok) {
        if (response.status === 400 && text.includes("No vintage dates exist for the specified real-time period")) {
          break;
        }
        throw new Error(`FRED initial-release fetch failed for ${options.source.seriesId}: HTTP ${response.status}`);
      }
      const payload = JSON.parse(text) as {
        observations?: Array<{
          date?: string;
          value?: string;
          realtime_start?: string;
          realtime_end?: string;
        }>;
        count?: number;
      };
      const observations = payload.observations ?? [];
      for (const observation of observations) {
        if (!observation.date || !observation.value || observation.value === ".") continue;
        const value = Number(observation.value);
        if (!Number.isFinite(value)) continue;
        const realtimeStart = observation.realtime_start ?? observation.date;
        const realtimeEnd = observation.realtime_end ?? realtimeStart;
        const rowKey = `${observation.date}|${realtimeStart}|${realtimeEnd}|${value}`;
        if (seenRows.has(rowKey)) continue;
        seenRows.add(rowKey);
        rows.push({
          observationDate: observation.date,
          value,
          realtimeStart,
          realtimeEnd,
        });
      }
      offset += observations.length;
      if (observations.length < limit || (payload.count !== undefined && offset >= payload.count)) break;
    }
  }

  return {
    rows: rows.sort((left, right) =>
      left.observationDate.localeCompare(right.observationDate)
      || left.realtimeStart.localeCompare(right.realtimeStart)),
    artifacts,
    sourceHash: sha256(payloadHashes.join("\n")),
    sourceUrl: redactedCredentialUrl(requestUrl, options.apiKey),
  };
}

async function fetchFredRealtimePeriodRows(options: {
  source: RateSource;
  from: DateTime;
  to: DateTime;
  apiKey: string;
  fetchedAtUtc: string;
}) {
  const rows: FredObservationRow[] = [];
  const artifacts: MacroSourceArtifact[] = [];
  const limit = 100000;
  const payloadHashes: string[] = [];
  let requestUrl = "";
  const seenRows = new Set<string>();

  for (const window of fredRealtimeWindows({ from: options.from, to: options.to })) {
    let offset = 0;
    while (true) {
      const params = new URLSearchParams({
        api_key: options.apiKey,
        file_type: "json",
        series_id: options.source.seriesId,
        realtime_start: window.realtimeStart,
        realtime_end: window.realtimeEnd,
        observation_start: isoDate(options.from),
        observation_end: isoDate(options.to),
        output_type: FRED_REALTIME_PERIOD_OUTPUT_TYPE,
        limit: String(limit),
        offset: String(offset),
        sort_order: "asc",
      });
      requestUrl = `https://api.stlouisfed.org/fred/series/observations?${params.toString()}`;
      const response = await fetchOfficialSource(requestUrl, { cache: "no-store" });
      const text = await response.text();
      const sanitizedUrl = redactedCredentialUrl(requestUrl, options.apiKey);
      const artifact = sourceArtifactFromHttp({
        sourceFamily: "rate",
        sourceId: options.source.sourceId,
        currency: options.source.currency,
        endpointId: "fred_alfred_series_observations_realtime_period",
        endpointUrl: sanitizedUrl,
        fetchedAtUtc: options.fetchedAtUtc,
        response,
        text,
        sanitizedRequest: {
          method: "GET",
          url: sanitizedUrl,
          params: {
            file_type: "json",
            series_id: options.source.seriesId,
            realtime_start: window.realtimeStart,
            realtime_end: window.realtimeEnd,
            observation_start: isoDate(options.from),
            observation_end: isoDate(options.to),
            output_type: FRED_REALTIME_PERIOD_OUTPUT_TYPE,
            limit,
            offset,
            sort_order: "asc",
            api_key: "[redacted]",
          },
        },
        coverage: {
          seriesId: options.source.seriesId,
          outputType: FRED_REALTIME_PERIOD_OUTPUT_TYPE,
          realtimeStart: window.realtimeStart,
          realtimeEnd: window.realtimeEnd,
          pageOffset: offset,
          pageLimit: limit,
          selectionRule: RATE_SELECTION_RULE_VERSION,
          stalenessRuleVersion: RATE_STALENESS_RULE_VERSION,
        },
        flags: {
          reconstructionMode: RATE_RECONSTRUCTION_MODE,
        },
      });
      artifacts.push(artifact);
      payloadHashes.push(sha256(text));
      if (!response.ok) {
        if (response.status === 400 && text.includes("No vintage dates exist for the specified real-time period")) {
          break;
        }
        throw new Error(`FRED real-time-period fetch failed for ${options.source.seriesId}: HTTP ${response.status}`);
      }
      const payload = JSON.parse(text) as {
        observations?: Array<{
          date?: string;
          value?: string;
          realtime_start?: string;
          realtime_end?: string;
        }>;
        count?: number;
      };
      const observations = payload.observations ?? [];
      for (const observation of observations) {
        if (!observation.date || !observation.value || observation.value === ".") continue;
        const value = Number(observation.value);
        if (!Number.isFinite(value)) continue;
        const realtimeStart = observation.realtime_start ?? observation.date;
        const realtimeEnd = observation.realtime_end ?? realtimeStart;
        const rowKey = `${observation.date}|${realtimeStart}|${realtimeEnd}|${value}`;
        if (seenRows.has(rowKey)) continue;
        seenRows.add(rowKey);
        rows.push({
          observationDate: observation.date,
          value,
          realtimeStart,
          realtimeEnd,
        });
      }
      offset += observations.length;
      if (observations.length < limit || (payload.count !== undefined && offset >= payload.count)) break;
    }
  }

  return {
    rows: rows.sort((left, right) =>
      left.observationDate.localeCompare(right.observationDate)
      || left.realtimeStart.localeCompare(right.realtimeStart)
      || left.realtimeEnd.localeCompare(right.realtimeEnd)),
    artifacts,
    sourceHash: sha256(payloadHashes.join("\n")),
    sourceUrl: redactedCredentialUrl(requestUrl, options.apiKey),
  };
}

async function fetchFredLatestVintageRows(options: {
  source: FredSource;
  from: DateTime;
  to: DateTime;
  fetchedAtUtc: string;
}) {
  const csvUrl = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${options.source.seriesId}`;
  const response = await fetchOfficialSource(csvUrl, { cache: "no-store" });
  const csv = await response.text();
  const sourceHash = sha256(csv);
  const artifact = sourceArtifactFromHttp({
    sourceFamily: fredSourceFamily(options.source),
    sourceId: options.source.sourceId,
    currency: options.source.currency,
    endpointId: "fred_graph_latest_vintage_csv",
    endpointUrl: csvUrl,
    fetchedAtUtc: options.fetchedAtUtc,
    response,
    text: csv,
    sanitizedRequest: {
      method: "GET",
      url: csvUrl,
      params: {
        id: options.source.seriesId,
      },
    },
    coverage: {
      seriesId: options.source.seriesId,
      reconstructionMode: MACRO_RECONSTRUCTION_MODE,
    },
    flags: {
      exploratoryLatestVintageFallback: true,
    },
  });
  if (!response.ok) {
    throw new Error(`FRED latest-vintage fetch failed for ${options.source.seriesId}: HTTP ${response.status}`);
  }
  const rows = parseFredCsv(csv, options.source.seriesId)
    .filter((row) => {
      const date = DateTime.fromISO(row.observationDate, { zone: "utc" });
      return date >= options.from && date <= options.to;
    })
    .map((row) => ({
      observationDate: row.observationDate,
      value: row.value,
      realtimeStart: row.observationDate,
      realtimeEnd: row.observationDate,
    }));
  return {
    rows,
    artifacts: [artifact],
    sourceHash,
    sourceUrl: csvUrl,
  };
}

async function fetchFredRowsForContract(options: {
  source: FredSource;
  from: DateTime;
  to: DateTime;
  fetchedAtUtc: string;
  cli: CliOptions;
}) {
  const key = fredApiKey();
  if (key) {
    if (isCanonicalRateSource(options.source)) {
      return {
        ...(await fetchFredRealtimePeriodRows({
          source: options.source,
          from: options.from,
          to: options.to,
          apiKey: key,
          fetchedAtUtc: options.fetchedAtUtc,
        })),
        availabilityMode: "fred_alfred_real_time_period_as_of_weekly_freeze",
        reconstructionMode: RATE_RECONSTRUCTION_MODE,
        promotionReadiness: "point_in_time_rate_source_contract",
      };
    }
    return {
      ...(await fetchFredInitialReleaseRows({
        source: options.source,
        from: options.from,
        to: options.to,
        apiKey: key,
        fetchedAtUtc: options.fetchedAtUtc,
      })),
      availabilityMode: "fred_alfred_initial_release_date_end_of_day_conservative",
      reconstructionMode: MACRO_PROMOTION_RECONSTRUCTION_MODE,
      promotionReadiness: "point_in_time_source_contract",
    };
  }
  if (!options.cli.allowExploratorySourceFallback) {
    throw new Error(
      `FRED_API_KEY or ALFRED_API_KEY is required for promotion-bound ${options.source.seriesId}. ` +
      "Pass --allow-exploratory-source-fallback only for latest-vintage exploratory research.",
    );
  }
  return {
    ...(await fetchFredLatestVintageRows({
      source: options.source,
      from: options.from,
      to: options.to,
      fetchedAtUtc: options.fetchedAtUtc,
    })),
    availabilityMode: options.source.frequency === "monthly"
      ? "fred_latest_vintage_observation_month_start_plus_delay_approx"
      : "fred_latest_vintage_observation_date_end_of_day_approx",
    reconstructionMode: MACRO_RECONSTRUCTION_MODE,
    promotionReadiness: MACRO_PROMOTION_READINESS,
  };
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function deepFindValue(node: unknown, key: string): unknown {
  const record = recordValue(node);
  if (record) {
    if (Object.prototype.hasOwnProperty.call(record, key)) return record[key];
    for (const value of Object.values(record)) {
      const found = deepFindValue(value, key);
      if (found !== undefined) return found;
    }
  }
  if (Array.isArray(node)) {
    for (const value of node) {
      const found = deepFindValue(value, key);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function eStatClassNameMap(payload: unknown) {
  const classInf = deepFindValue(payload, "CLASS_INF");
  const classObjs = asArray(recordValue(classInf)?.CLASS_OBJ);
  const names = new Map<string, string>();
  for (const rawObj of classObjs) {
    const classObj = recordValue(rawObj);
    const id = typeof classObj?.["@id"] === "string" ? classObj["@id"] : null;
    if (!id) continue;
    for (const rawClass of asArray(classObj.CLASS)) {
      const classRecord = recordValue(rawClass);
      const code = typeof classRecord?.["@code"] === "string" ? classRecord["@code"] : null;
      const name = typeof classRecord?.["@name"] === "string" ? classRecord["@name"] : null;
      if (code && name) names.set(`${id}:${code}`, name);
    }
  }
  return names;
}

function parseEStatMonth(attrValue: unknown, metaName?: string) {
  const candidates = [attrValue, metaName].flatMap((value) =>
    typeof value === "string" ? [value] : []);
  for (const candidate of candidates) {
    const compact = candidate.replace(/\s+/g, " ");
    const numeric = compact.match(/(20\d{2})\D?([01]\d)/);
    if (numeric) {
      const year = Number(numeric[1]);
      const month = Number(numeric[2]);
      if (month >= 1 && month <= 12) return `${year}-${String(month).padStart(2, "0")}-01`;
    }
    const parsed = DateTime.fromFormat(compact, "yyyy LLL", { zone: "utc" });
    if (parsed.isValid) return isoDate(parsed.startOf("month"));
    const parsedAlt = DateTime.fromFormat(compact.replace(".", ""), "LLL yyyy", { zone: "utc" });
    if (parsedAlt.isValid) return isoDate(parsedAlt.startOf("month"));
  }
  return null;
}

function parseEStatNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function eStatValueText(record: Record<string, unknown>) {
  return record["$"] ?? record["#text"] ?? record["@value"] ?? record["VALUE"];
}

function extractEStatMonthlyAllItemsIndexRows(payload: unknown) {
  const valueNode = deepFindValue(payload, "VALUE");
  const values = asArray(valueNode).flatMap((value) => {
    const record = recordValue(value);
    return record ? [record] : [];
  });
  const classNames = eStatClassNameMap(payload);
  const rows: Array<{ observationDate: string; value: number }> = [];

  for (const value of values) {
    const attrs = Object.entries(value)
      .filter(([key]) => key.startsWith("@"))
      .map(([key, code]) => {
        const id = key.slice(1);
        const codeString = typeof code === "string" ? code : String(code ?? "");
        return { id, code: codeString, name: classNames.get(`${id}:${codeString}`) ?? "" };
      });
    const attrById = new Map(attrs.map((attr) => [attr.id, attr]));
    if (attrById.get("tab")?.code !== ESTAT_JPY_CPI_TABLE11_TAB_CODE) continue;
    if (attrById.get("cat01")?.code !== ESTAT_JPY_CPI_TABLE11_CAT_ALL_ITEMS_CODE) continue;
    if (attrById.get("area")?.code !== ESTAT_JPY_CPI_TABLE11_AREA_ALL_JAPAN_CODE) continue;
    const names = attrs.map((attr) => attr.name.trim()).filter(Boolean);
    const hasAllItems = names.some((name) => {
      const lower = name.toLowerCase();
      return lower === "all items" || name === "総合";
    });
    if (!hasAllItems) continue;
    if (names.some((name) => /change|rate|contribution|percent|前年比|前月比/i.test(name))) continue;
    const hasIndexDimension = names.some((name) => /(^|\s)index($|\s)|指数/i.test(name));
    if (names.length > 0 && !hasIndexDimension && names.some((name) => /monthly|annual|seasonally/i.test(name))) {
      continue;
    }
    const timeAttr = attrs.find((attr) => attr.id.toLowerCase().includes("time"))
      ?? attrs.find((attr) => parseEStatMonth(attr.code, attr.name) !== null);
    const observationDate = parseEStatMonth(timeAttr?.code, timeAttr?.name);
    if (!observationDate) continue;
    const numericValue = parseEStatNumber(eStatValueText(value));
    if (numericValue === null) continue;
    rows.push({ observationDate, value: numericValue });
  }

  const byDate = new Map<string, number>();
  for (const row of rows) byDate.set(row.observationDate, row.value);
  return [...byDate.entries()]
    .map(([observationDate, value]) => ({ observationDate, value }))
    .sort((left, right) => left.observationDate.localeCompare(right.observationDate));
}

async function fetchEStatJpyCpiRows(options: {
  appId: string;
  statsDataId: string;
  from: DateTime;
  to: DateTime;
  fetchedAtUtc: string;
}) {
  const params = new URLSearchParams({
    appId: options.appId,
    lang: "E",
    statsDataId: options.statsDataId,
    cdArea: ESTAT_JPY_CPI_TABLE11_AREA_ALL_JAPAN_CODE,
    cdCat01: ESTAT_JPY_CPI_TABLE11_CAT_ALL_ITEMS_CODE,
    cdTab: ESTAT_JPY_CPI_TABLE11_TAB_CODE,
    limit: "100000",
  });
  const requestUrl = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?${params.toString()}`;
  const response = await fetchOfficialSource(requestUrl, { cache: "no-store" });
  const text = await response.text();
  const sourceHash = sha256(text);
  const sanitizedUrl = redactedCredentialUrl(requestUrl, options.appId);
  const artifact = sourceArtifactFromHttp({
    sourceFamily: "inflation",
    sourceId: "estat_japan_cpi_table_1_1_all_items_2020_base",
    currency: "JPY",
    endpointId: "estat_get_stats_data_table_1_1_cpi_json",
    endpointUrl: sanitizedUrl,
    fetchedAtUtc: options.fetchedAtUtc,
    response,
    text,
    sanitizedRequest: {
      method: "GET",
      url: sanitizedUrl,
      params: {
        appId: "[redacted]",
        lang: "E",
        statsDataId: options.statsDataId,
        cdArea: ESTAT_JPY_CPI_TABLE11_AREA_ALL_JAPAN_CODE,
        cdCat01: ESTAT_JPY_CPI_TABLE11_CAT_ALL_ITEMS_CODE,
        cdTab: ESTAT_JPY_CPI_TABLE11_TAB_CODE,
        limit: "100000",
      },
    },
    coverage: {
      statsDataId: options.statsDataId,
      statInfId: ESTAT_JPY_CPI_TABLE11_STAT_INF_ID,
      tableNumber: "1-1",
      tabCode: ESTAT_JPY_CPI_TABLE11_TAB_CODE,
      categoryCode: ESTAT_JPY_CPI_TABLE11_CAT_ALL_ITEMS_CODE,
      areaCode: ESTAT_JPY_CPI_TABLE11_AREA_ALL_JAPAN_CODE,
      validationStatsDataId: ESTAT_JPY_CPI_TABLE41_VALIDATION_STATS_DATA_ID,
      exceptionPath: "direct_national_source_for_jpy_cpi",
    },
    flags: {
      promotionReadiness: "official_source_current_vintage_pending_release_specific_history",
    },
  });
  if (!response.ok) {
    throw new Error(`e-Stat CPI fetch failed for statsDataId=${options.statsDataId}: HTTP ${response.status}`);
  }
  const payload = JSON.parse(text);
  const rows = extractEStatMonthlyAllItemsIndexRows(payload)
    .filter((row) => {
      const date = DateTime.fromISO(row.observationDate, { zone: "utc" });
      return date >= options.from && date <= options.to;
    });
  return {
    rows,
    artifacts: [artifact],
    sourceHash,
    sourceUrl: sanitizedUrl,
  };
}

function eStatJpyCpiAvailableAt(observationDateIso: string) {
  const observationDate = DateTime.fromISO(observationDateIso, { zone: "utc" });
  return isoUtc(observationDate.endOf("month").plus({ days: 24 }).set({
    hour: 23,
    minute: 59,
    second: 59,
    millisecond: 0,
  }));
}

function numberFromUnknown(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function recordFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayFrom(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null ? [] : [value];
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

function cpiMonthlyObservationDate(period: string) {
  return `${period}-01`;
}

function cpiQuarterlyObservationDate(period: string) {
  const match = period.match(/^(\d{4})-Q([1-4])$/);
  if (!match) throw new Error(`Invalid quarterly CPI period: ${period}`);
  const month = (Number(match[2]) - 1) * 3 + 1;
  return `${match[1]}-${String(month).padStart(2, "0")}-01`;
}

function cpiPeriodMinus(period: string, frequency: OfficialCpiFrequency, lagPeriods: number) {
  if (frequency === "monthly") {
    return DateTime.fromISO(`${period}-01`, { zone: "utc" })
      .minus({ months: lagPeriods })
      .toFormat("yyyy-MM");
  }
  const match = period.match(/^(\d{4})-Q([1-4])$/);
  if (!match) throw new Error(`Invalid quarterly CPI period: ${period}`);
  const month = (Number(match[2]) - 1) * 3 + 1;
  const lagged = DateTime.utc(Number(match[1]), month, 1).minus({ quarters: lagPeriods });
  const quarter = Math.floor((lagged.month - 1) / 3) + 1;
  return `${lagged.year}-Q${quarter}`;
}

function fixedDateAvailability(dateIso: string, zone: string, hour = 23, minute = 59) {
  return isoUtc(DateTime.fromISO(dateIso, { zone }).set({
    hour,
    minute,
    second: 0,
    millisecond: 0,
  }));
}

function monthlyDelayAvailability(period: string, delayDays: number, zone = "UTC") {
  return isoUtc(DateTime.fromISO(`${period}-01`, { zone }).endOf("month").plus({ days: delayDays }).set({
    hour: 23,
    minute: 59,
    second: 0,
    millisecond: 0,
  }));
}

function quarterlyDelayAvailability(period: string, delayDays: number, zone = "UTC") {
  return isoUtc(DateTime.fromISO(cpiQuarterlyObservationDate(period), { zone })
    .plus({ months: 3 })
    .minus({ days: 1 })
    .plus({ days: delayDays })
    .set({ hour: 23, minute: 59, second: 0, millisecond: 0 }));
}

const AUD_MONTHLY_COMPLETE_SERIES_FIRST_RELEASE_AT_UTC =
  fixedDateAvailability("2025-11-26", "Australia/Sydney", 11, 30);

function audMonthlyAvailability(period: string) {
  const exact: Record<string, string> = {
    "2025-10": AUD_MONTHLY_COMPLETE_SERIES_FIRST_RELEASE_AT_UTC,
    "2025-11": fixedDateAvailability("2026-01-07", "Australia/Sydney", 11, 30),
    "2025-12": fixedDateAvailability("2026-01-28", "Australia/Sydney", 11, 30),
    "2026-01": fixedDateAvailability("2026-02-25", "Australia/Sydney", 11, 30),
    "2026-02": fixedDateAvailability("2026-03-25", "Australia/Sydney", 11, 30),
    "2026-03": fixedDateAvailability("2026-04-29", "Australia/Sydney", 11, 30),
    "2026-04": fixedDateAvailability("2026-05-27", "Australia/Sydney", 11, 30),
  };
  if (period >= "2024-04" && period < "2025-10") {
    return AUD_MONTHLY_COMPLETE_SERIES_FIRST_RELEASE_AT_UTC;
  }
  if (exact[period]) return exact[period];
  const fallbackDate = DateTime.fromISO(`${period}-01`, { zone: "Australia/Sydney" })
    .plus({ months: 1 })
    .set({ day: 28 })
    .toISODate();
  return fixedDateAvailability(fallbackDate ?? `${period}-28`, "Australia/Sydney", 11, 30);
}

function euroAreaIdForPeriod(period: string) {
  return period <= "2025-12" ? "EA20" : "EA21";
}

function cpiSourceContractHash(source: InflationSource) {
  return hashJson({
    sourceMapVersion: CPI_OFFICIAL_SOURCE_MAP_VERSION,
    sourceId: source.sourceId,
    seriesId: source.seriesId,
    currency: source.currency,
    sourceGroup: source.sourceGroup,
    frequency: source.frequency,
    cadence: source.cadence,
  });
}

function cpiBranchSemanticHash(source: InflationSource) {
  return hashJson({
    familyManifestId: CPI_FAMILY_MANIFEST_ID,
    sourceId: source.sourceId,
    instrument: source.instrument,
    label: source.label,
    sourceGroup: source.sourceGroup,
    frequency: source.frequency,
  });
}

function csvMatrix(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "\"" && inQuotes && next === "\"") {
      cell += "\"";
      index += 1;
      continue;
    }
    if (char === "\"") {
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
    .filter((match) => /^20(1[78]|19|20|21|22|23|24|25|26)M/.test(match[2]))
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
  const rows: Array<{ period: string; value: number }> = [];
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

function officialCpiMetadata(source: InflationSource) {
  const common = {
    sourceContractId: source.sourceId,
    sourceContractHash: cpiSourceContractHash(source),
    branchSemanticHash: cpiBranchSemanticHash(source),
  };
  switch (source.currency) {
    case "AUD":
      return {
        ...common,
        parserVersion: "abs_sdmx_csv_native_frequency_parser_v1",
        continuityDecisionId: "aud_quarterly_through_2025q3_monthly_from_2025m10_no_interpolation_v1",
        releaseCalendarVersion: "aud_monthly_complete_cpi_first_release_2025_11_26_v2",
        revisionRebasingVersion: "aud_revision_rebasing_release_vintage_preserved_v2",
        baseOrReferencePeriod: "Sep 2025 = 100",
        endpointMode: "abs_data_api_sdmx_csv_quarterly_and_monthly",
        layoutDriftGuard: "abs_csv_requires_TIME_PERIOD_OBS_VALUE_FREQ_INDEX_10001_TSEST_10_REGION_1",
      };
    case "CAD":
      return {
        ...common,
        parserVersion: "statcan_wds_vector_data_point_parser_v1",
        continuityDecisionId: "cad_table_1810000401_vector_41690973_monthly_all_items_v1",
        releaseCalendarVersion: "cad_2026-05_release_calendar_v1",
        revisionRebasingVersion: "cad_revision_rebasing_v1",
        baseOrReferencePeriod: "2002 = 100",
        endpointMode: "statcan_wds_vector_latest_periods",
        layoutDriftGuard: "statcan_wds_requires_vectorDataPoint_refPer_value_releaseTime",
      };
    case "CHF":
      return {
        ...common,
        parserVersion: "swiss_fso_lik25b25_index_m_total_row_xlsx_parser_v1",
        continuityDecisionId: "chf_lik25b25_dec2025_100_monthly_total_index_v1",
        releaseCalendarVersion: "chf_2026-05_release_calendar_v1",
        revisionRebasingVersion: "chf_revision_rebasing_v1",
        baseOrReferencePeriod: "Dec 2025 = 100",
        endpointMode: "swiss_fso_dam_xlsx_master",
        layoutDriftGuard: "fail_closed_unless_sheet1_row4_date_headers_and_row5_total_index_values_exist",
      };
    case "EUR":
      return {
        ...common,
        parserVersion: "eurostat_jsonstat_prc_hicp_minr_parser_v1",
        continuityDecisionId: "eur_prc_hicp_minr_dynamic_ea_ea20_to_2025m12_ea21_from_2026m01_v1",
        releaseCalendarVersion: "eur_2026-05_release_calendar_v1",
        revisionRebasingVersion: "eur_revision_rebasing_v1",
        baseOrReferencePeriod: "2025 = 100",
        endpointMode: "eurostat_dissemination_jsonstat_prc_hicp_minr_total_i25_geo_ea",
        layoutDriftGuard: "eurostat_jsonstat_requires_dimension_time_category_index_and_value",
      };
    case "GBP":
      return {
        ...common,
        parserVersion: "ons_timeseries_d7bt_json_parser_v1",
        continuityDecisionId: "gbp_ons_d7bt_cpi_all_items_2015_100_v1",
        releaseCalendarVersion: "gbp_2026-05_release_calendar_v1",
        revisionRebasingVersion: "gbp_revision_rebasing_v1",
        baseOrReferencePeriod: "2015 = 100",
        endpointMode: "ons_timeseries_mm23_json",
        layoutDriftGuard: "ons_json_requires_months_date_value_updateDate",
      };
    case "JPY":
      return {
        ...common,
        parserVersion: "estat_statsdata_table_1_1_json_parser_v1",
        continuityDecisionId: "jpy_2020_base_table_1_1_selected_until_2025_base_audit_v1",
        releaseCalendarVersion: "jpy_2026-05_release_calendar_v1",
        revisionRebasingVersion: "jpy_revision_rebasing_v1",
        baseOrReferencePeriod: "2020 = 100",
        endpointMode: "estat_get_stats_data_table_1_1_json",
        layoutDriftGuard: "estat_requires_tab_1_cat01_0001_area_00000_monthly_index_values",
      };
    case "NZD":
      return {
        ...common,
        parserVersion: "statsnz_infoshare_exportdirect_sch_csv_parser_v1",
        continuityDecisionId: "nzd_infoshare_cpiq_se9ns1160_quarterly_all_groups_v1",
        releaseCalendarVersion: "nzd_2026-Q1_release_calendar_v1",
        revisionRebasingVersion: "nzd_revision_rebasing_v1",
        baseOrReferencePeriod: "Index reference period per Infoshare CPIQ.SE9NS1160",
        endpointMode: "statsnz_infoshare_export_direct_sch",
        layoutDriftGuard: "infoshare_export_requires_CPIQ_SE9NS1160_quarter_headers_and_series_row",
      };
    case "USD":
      return {
        ...common,
        parserVersion: "bls_public_timeseries_html_table_parser_v1",
        continuityDecisionId: "usd_bls_cpi_u_cuur0000sa0_monthly_all_items_nsa_v1",
        releaseCalendarVersion: "usd_2026-05_release_calendar_v1",
        revisionRebasingVersion: "usd_revision_rebasing_v1",
        baseOrReferencePeriod: "1982-84 = 100",
        endpointMode: "bls_public_timeseries_html_table",
        layoutDriftGuard: "bls_html_requires_year_rows_and_twelve_month_value_cells_for_CUUR0000SA0",
      };
    default:
      throw new Error(`Unsupported official CPI source currency: ${source.currency}`);
  }
}

function officialCpiAvailableAt(source: InflationSource, row: {
  period: string;
  observationDate: string;
  nativeFrequency: OfficialCpiFrequency;
  releaseTime?: string | null;
  updateDate?: string | null;
}) {
  if (source.currency === "CAD") {
    return monthlyDelayAvailability(row.period, 22, "America/Toronto");
  }
  if (source.currency === "GBP" && row.updateDate) {
    return isoUtc(DateTime.fromISO(row.updateDate, { zone: "utc" }));
  }
  if (source.currency === "AUD" && row.nativeFrequency === "monthly") {
    return audMonthlyAvailability(row.period);
  }
  if (source.currency === "AUD") {
    return quarterlyDelayAvailability(row.period, 28, "Australia/Sydney");
  }
  if (source.currency === "NZD") {
    return quarterlyDelayAvailability(row.period, 21, "Pacific/Auckland");
  }
  if (source.currency === "CHF") {
    return monthlyDelayAvailability(row.period, 4, "Europe/Zurich");
  }
  if (source.currency === "USD") {
    return monthlyDelayAvailability(row.period, 10, "America/New_York");
  }
  if (source.currency === "EUR") {
    return monthlyDelayAvailability(row.period, 17, "Europe/Luxembourg");
  }
  if (source.currency === "JPY") {
    return eStatJpyCpiAvailableAt(row.observationDate);
  }
  return monthlyDelayAvailability(row.period, 30, "UTC");
}

function officialCpiAvailabilityTimezone(source: InflationSource) {
  const zones: Record<string, string> = {
    AUD: "Australia/Sydney",
    CAD: "America/Toronto",
    CHF: "Europe/Zurich",
    EUR: "Europe/Luxembourg",
    GBP: "Europe/London",
    JPY: "Asia/Tokyo",
    NZD: "Pacific/Auckland",
    USD: "America/New_York",
  };
  return zones[source.currency] ?? "UTC";
}

function cpiParentObservationId(row: OfficialCpiIndexRow) {
  return hashJson({
    sourceContractId: row.sourceContractId,
    seriesId: row.seriesId,
    observationPeriod: row.period,
    observationDate: row.observationDate,
    nativeFrequency: row.nativeFrequency,
    rawArtifactIds: row.rawArtifactIds,
    sourceHash: row.sourceHash,
    parserVersion: row.parserVersion,
    currentVintageIdentity: "official_current_vintage_artifact_hash",
  });
}

function cpiParentAvailabilityEventId(row: OfficialCpiIndexRow) {
  return hashJson({
    sourceContractId: row.sourceContractId,
    observationPeriod: row.period,
    nativeFrequency: row.nativeFrequency,
    availableAtUtc: row.availableAtUtc,
    releaseCalendarVersion: row.releaseCalendarVersion,
    rawArtifactIds: row.rawArtifactIds,
  });
}

function buildOfficialCpiRows(options: {
  source: InflationSource;
  rows: Array<{
    period: string;
    value: number;
    nativeFrequency: OfficialCpiFrequency;
    releaseTime?: string | null;
    updateDate?: string | null;
    periodSegment?: string | null;
    baseOrReferencePeriod?: string | null;
  }>;
  sourceUrl: string;
  sourceHash: string;
  artifacts: MacroSourceArtifact[];
}) {
  const metadata = officialCpiMetadata(options.source);
  const rawArtifactIds = artifactIds(options.artifacts);
  const rawArtifactId = primaryArtifactId(options.artifacts);
  const artifactPayloadSha256 = options.artifacts
    .map((artifact) => artifact.rawPayloadSha256)
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join("|");
  return options.rows
    .map((row): OfficialCpiIndexRow => {
      const observationDate = row.nativeFrequency === "quarterly"
        ? cpiQuarterlyObservationDate(row.period)
        : cpiMonthlyObservationDate(row.period);
      return {
        period: row.period,
        observationDate,
        value: row.value,
        nativeFrequency: row.nativeFrequency,
        lagPeriods: row.nativeFrequency === "quarterly" ? 4 : 12,
        availableAtUtc: officialCpiAvailableAt(options.source, {
          period: row.period,
          observationDate,
          nativeFrequency: row.nativeFrequency,
          releaseTime: row.releaseTime,
          updateDate: row.updateDate,
        }),
        sourceUrl: options.sourceUrl,
        sourceHash: options.sourceHash,
        rawArtifactId,
        rawArtifactIds,
        ...metadata,
        seriesId: options.source.seriesId,
        baseOrReferencePeriod: row.baseOrReferencePeriod ?? metadata.baseOrReferencePeriod,
        periodSegment: row.periodSegment ?? `${row.nativeFrequency}_official_current_vintage`,
        artifactPayloadSha256,
      };
    })
    .sort((left, right) => left.observationDate.localeCompare(right.observationDate));
}

function monthPeriodFromOnsRow(row: Record<string, unknown>) {
  const year = String(row.year ?? "").trim();
  const month = String(row.month ?? "").trim();
  if (!/^\d{4}$/.test(year) || !month) return null;
  const parsed = DateTime.fromFormat(`${year} ${month}`, "yyyy LLLL", { zone: "utc" });
  return parsed.isValid ? parsed.toFormat("yyyy-MM") : null;
}

function stripHtml(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
}

function parseBlsTimeseriesHtmlRows(text: string) {
  const rows: Array<{ period: string; value: number; nativeFrequency: OfficialCpiFrequency; periodSegment: string }> = [];
  const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
  for (const match of text.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rowHtml = match[1];
    const year = stripHtml(rowHtml.match(/<th[^>]*>([\s\S]*?)<\/th>/i)?.[1] ?? "");
    if (!/^\d{4}$/.test(year)) continue;
    const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cellMatch) => stripHtml(cellMatch[1]));
    for (let index = 0; index < 12; index += 1) {
      const value = numberFromUnknown(cells[index]);
      if (value === null) continue;
      rows.push({
        period: `${year}-${months[index]}`,
        value,
        nativeFrequency: "monthly",
        periodSegment: "monthly_us_cpi_u_all_items_nsa_1982_84_100_bls_timeseries_html",
      });
    }
  }
  return rows;
}

async function fetchOfficialCpiRows(
  source: InflationSource,
  fetchedAtUtc: string,
  from: DateTime,
  to: DateTime,
): Promise<OfficialCpiFetchResult> {
  const fromYear = from.year;
  const toYear = to.year;

  if (source.currency === "USD") {
    const url = source.sourceUrl;
    const response = await fetchOfficialSource(url, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html,*/*" },
    });
    const text = await response.text();
    const sourceHash = sha256(text);
    const artifact = sourceArtifactFromHttp({
      sourceFamily: "inflation",
      sourceId: source.sourceId,
      currency: source.currency,
      endpointId: "bls_public_timeseries_html_table",
      endpointUrl: url,
      fetchedAtUtc,
      response,
      text,
      sanitizedRequest: { method: "GET", url, headers: { Accept: "text/html,*/*" } },
      coverage: officialCpiMetadata(source),
      flags: { diagnosticOnly: true },
    });
    if (!response.ok) throw new Error(`BLS CPI time-series table fetch failed: HTTP ${response.status}`);
    const rows = parseBlsTimeseriesHtmlRows(text)
      .filter((row) => Number(row.period.slice(0, 4)) >= fromYear && Number(row.period.slice(0, 4)) <= toYear);
    return {
      rows: buildOfficialCpiRows({ source, rows, sourceUrl: url, sourceHash, artifacts: [artifact] }),
      artifacts: [artifact],
      sourceHash,
      sourceUrl: url,
    };
  }

  if (source.currency === "CAD") {
    const latestN = Math.max(140, (toYear - fromYear + 3) * 12);
    const body = JSON.stringify([{ vectorId: Number(source.seriesId), latestN }]);
    const response = await fetchOfficialSource(source.sourceUrl, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body,
    });
    const text = await response.text();
    const sourceHash = sha256(text);
    const artifact = sourceArtifactFromHttp({
      sourceFamily: "inflation",
      sourceId: source.sourceId,
      currency: source.currency,
      endpointId: "statcan_wds_vector_latest_periods",
      endpointUrl: source.sourceUrl,
      fetchedAtUtc,
      response,
      text,
      sanitizedRequest: { method: "POST", url: source.sourceUrl, body: [{ vectorId: Number(source.seriesId), latestN }] },
      coverage: officialCpiMetadata(source),
      flags: { diagnosticOnly: true },
    });
    if (!response.ok) throw new Error(`Statistics Canada CPI fetch failed: HTTP ${response.status}`);
    const payload = JSON.parse(text) as unknown;
    const payloadRecord = recordFrom(arrayFrom(payload)[0]);
    const points = arrayFrom(recordFrom(payloadRecord.object).vectorDataPoint);
    const rows = points.flatMap((item) => {
      const record = recordFrom(item);
      const refPer = String(record.refPer ?? "");
      const value = numberFromUnknown(record.value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(refPer) || value === null) return [];
      return [{
        period: refPer.slice(0, 7),
        value,
        nativeFrequency: "monthly" as const,
        releaseTime: typeof record.releaseTime === "string" ? record.releaseTime : null,
        periodSegment: "monthly_canada_all_items_nsa_2002_100",
      }];
    });
    return {
      rows: buildOfficialCpiRows({ source, rows, sourceUrl: source.sourceUrl, sourceHash, artifacts: [artifact] }),
      artifacts: [artifact],
      sourceHash,
      sourceUrl: source.sourceUrl,
    };
  }

  if (source.currency === "GBP") {
    const response = await fetchOfficialSource(source.sourceUrl, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const text = await response.text();
    const sourceHash = sha256(text);
    const artifact = sourceArtifactFromHttp({
      sourceFamily: "inflation",
      sourceId: source.sourceId,
      currency: source.currency,
      endpointId: "ons_mm23_d7bt_timeseries_json",
      endpointUrl: source.sourceUrl,
      fetchedAtUtc,
      response,
      text,
      sanitizedRequest: { method: "GET", url: source.sourceUrl, headers: { Accept: "application/json" } },
      coverage: officialCpiMetadata(source),
      flags: { diagnosticOnly: true },
    });
    if (!response.ok) throw new Error(`ONS CPI fetch failed: HTTP ${response.status}`);
    const payload = JSON.parse(text) as Record<string, unknown>;
    const rows = arrayFrom(payload.months).flatMap((item) => {
      const record = recordFrom(item);
      const period = monthPeriodFromOnsRow(record);
      const value = numberFromUnknown(record.value);
      if (!period || value === null) return [];
      return [{
        period,
        value,
        nativeFrequency: "monthly" as const,
        updateDate: typeof record.updateDate === "string" ? record.updateDate : null,
        periodSegment: "monthly_uk_d7bt_all_items_2015_100",
      }];
    });
    return {
      rows: buildOfficialCpiRows({ source, rows, sourceUrl: source.sourceUrl, sourceHash, artifacts: [artifact] }),
      artifacts: [artifact],
      sourceHash,
      sourceUrl: source.sourceUrl,
    };
  }

  if (source.currency === "EUR") {
    const url = `${source.sourceUrl}?format=JSON&lang=en&freq=M&unit=I25&coicop18=TOTAL&geo=EA`;
    const response = await fetchOfficialSource(url, { cache: "no-store" });
    const text = await response.text();
    const sourceHash = sha256(text);
    const artifact = sourceArtifactFromHttp({
      sourceFamily: "inflation",
      sourceId: source.sourceId,
      currency: source.currency,
      endpointId: "eurostat_prc_hicp_minr_jsonstat",
      endpointUrl: url,
      fetchedAtUtc,
      response,
      text,
      sanitizedRequest: { method: "GET", url },
      coverage: officialCpiMetadata(source),
      flags: { diagnosticOnly: true },
    });
    if (!response.ok) throw new Error(`Eurostat CPI fetch failed: HTTP ${response.status}`);
    const payload = JSON.parse(text) as Record<string, unknown>;
    const timeIndex = recordFrom(recordFrom(recordFrom(recordFrom(payload.dimension).time).category).index);
    const values = recordFrom(payload.value);
    const rows = Object.entries(timeIndex).flatMap(([period, index]) => {
      const value = numberFromUnknown(values[String(index)]);
      if (!/^\d{4}-\d{2}$/.test(period) || value === null) return [];
      const euroArea = euroAreaIdForPeriod(period);
      return [{
        period,
        value,
        nativeFrequency: "monthly" as const,
        periodSegment: `monthly_${euroArea}_dynamic_ea_total_i25`,
      }];
    });
    return {
      rows: buildOfficialCpiRows({ source, rows, sourceUrl: url, sourceHash, artifacts: [artifact] }),
      artifacts: [artifact],
      sourceHash,
      sourceUrl: url,
    };
  }

  if (source.currency === "JPY") {
    const appId = eStatAppId();
    if (!appId) throw new Error("ESTAT_APP_ID is required for official JPY CPI fill");
    const params = new URLSearchParams({
      appId,
      lang: "E",
      statsDataId: ESTAT_JPY_CPI_TABLE11_STATS_DATA_ID,
      cdArea: ESTAT_JPY_CPI_TABLE11_AREA_ALL_JAPAN_CODE,
      cdCat01: ESTAT_JPY_CPI_TABLE11_CAT_ALL_ITEMS_CODE,
      cdTab: ESTAT_JPY_CPI_TABLE11_TAB_CODE,
      limit: "100000",
    });
    const requestUrl = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?${params.toString()}`;
    const sanitizedUrl = redactedCredentialUrl(requestUrl, appId);
    const response = await fetchOfficialSource(requestUrl, { cache: "no-store" });
    const text = await response.text();
    const sourceHash = sha256(text);
    const artifact = sourceArtifactFromHttp({
      sourceFamily: "inflation",
      sourceId: source.sourceId,
      currency: source.currency,
      endpointId: "estat_get_stats_data_table_1_1_cpi_json",
      endpointUrl: sanitizedUrl,
      fetchedAtUtc,
      response,
      text,
      sanitizedRequest: {
        method: "GET",
        url: sanitizedUrl,
        params: {
          appId: "[redacted]",
          lang: "E",
          statsDataId: ESTAT_JPY_CPI_TABLE11_STATS_DATA_ID,
          cdArea: ESTAT_JPY_CPI_TABLE11_AREA_ALL_JAPAN_CODE,
          cdCat01: ESTAT_JPY_CPI_TABLE11_CAT_ALL_ITEMS_CODE,
          cdTab: ESTAT_JPY_CPI_TABLE11_TAB_CODE,
          limit: "100000",
        },
      },
      coverage: officialCpiMetadata(source),
      flags: { diagnosticOnly: true },
    });
    if (!response.ok) throw new Error(`e-Stat CPI fetch failed: HTTP ${response.status}`);
    const payload = JSON.parse(text);
    const rows = extractEStatMonthlyAllItemsIndexRows(payload).map((row) => ({
      period: row.observationDate.slice(0, 7),
      value: row.value,
      nativeFrequency: "monthly" as const,
      periodSegment: "monthly_japan_2020_base_table_1_1_all_items",
    }));
    return {
      rows: buildOfficialCpiRows({ source, rows, sourceUrl: sanitizedUrl, sourceHash, artifacts: [artifact] }),
      artifacts: [artifact],
      sourceHash,
      sourceUrl: sanitizedUrl,
    };
  }

  if (source.currency === "AUD") {
    const quarterlyUrl = `${source.sourceUrl}.Q?startPeriod=2017-Q1&format=csvfile`;
    const monthlyUrl = `${source.sourceUrl}.M?startPeriod=2024-04&format=csvfile`;
    const [quarterlyResponse, monthlyResponse] = await Promise.all([
      fetchOfficialSource(quarterlyUrl, { cache: "no-store" }),
      fetchOfficialSource(monthlyUrl, { cache: "no-store" }),
    ]);
    const quarterlyText = await quarterlyResponse.text();
    const monthlyText = await monthlyResponse.text();
    const sourceHash = sha256(`${quarterlyText}\n${monthlyText}`);
    const quarterlyArtifact = sourceArtifactFromHttp({
      sourceFamily: "inflation",
      sourceId: source.sourceId,
      currency: source.currency,
      endpointId: "abs_cpi_quarterly_sdmx_csv",
      endpointUrl: quarterlyUrl,
      fetchedAtUtc,
      response: quarterlyResponse,
      text: quarterlyText,
      sanitizedRequest: { method: "GET", url: quarterlyUrl },
      coverage: { ...officialCpiMetadata(source), segment: "quarterly_through_2025_Q3" },
      flags: { diagnosticOnly: true },
    });
    const monthlyArtifact = sourceArtifactFromHttp({
      sourceFamily: "inflation",
      sourceId: source.sourceId,
      currency: source.currency,
      endpointId: "abs_cpi_monthly_sdmx_csv",
      endpointUrl: monthlyUrl,
      fetchedAtUtc,
      response: monthlyResponse,
      text: monthlyText,
      sanitizedRequest: { method: "GET", url: monthlyUrl },
      coverage: { ...officialCpiMetadata(source), segment: "monthly_from_2025_10" },
      flags: { diagnosticOnly: true },
    });
    if (!quarterlyResponse.ok) throw new Error(`ABS quarterly CPI fetch failed: HTTP ${quarterlyResponse.status}`);
    if (!monthlyResponse.ok) throw new Error(`ABS monthly CPI fetch failed: HTTP ${monthlyResponse.status}`);
    const quarterlyRows = csvRows(quarterlyText).flatMap((row) => {
      const period = String(row.TIME_PERIOD ?? "");
      const value = numberFromUnknown(row.OBS_VALUE);
      if (!/^\d{4}-Q[1-4]$/.test(period) || period > "2025-Q3" || value === null) return [];
      return [{
        period,
        value,
        nativeFrequency: "quarterly" as const,
        periodSegment: "quarterly_abs_cpi_all_groups_through_2025_q3",
        baseOrReferencePeriod: String(row.BASE_PERIOD ?? "Sep 2025 = 100"),
      }];
    });
    const monthlyRows = csvRows(monthlyText).flatMap((row) => {
      const period = String(row.TIME_PERIOD ?? "");
      const value = numberFromUnknown(row.OBS_VALUE);
      if (!/^\d{4}-\d{2}$/.test(period) || period < "2024-04" || value === null) return [];
      return [{
        period,
        value,
        nativeFrequency: "monthly" as const,
        periodSegment: period < "2025-10"
          ? "monthly_abs_complete_cpi_backfill_2024_04_to_2025_09_available_2025_11_26"
          : "monthly_abs_complete_cpi_from_2025_10",
        baseOrReferencePeriod: String(row.BASE_PERIOD ?? "Sep 2025 = 100"),
      }];
    });
    const artifacts = [quarterlyArtifact, monthlyArtifact];
    return {
      rows: buildOfficialCpiRows({
        source,
        rows: [...quarterlyRows, ...monthlyRows],
        sourceUrl: `${quarterlyUrl}|${monthlyUrl}`,
        sourceHash,
        artifacts,
      }),
      artifacts,
      sourceHash,
      sourceUrl: `${quarterlyUrl}|${monthlyUrl}`,
    };
  }

  if (source.currency === "NZD") {
    const formResponse = await fetchOfficialSource(source.sourceUrl, { cache: "no-store" });
    const formText = await formResponse.text();
    const action = new URL(
      decodeHtml(formText.match(/<form[^>]+action="([^"]+)"/i)?.[1] ?? formResponse.url),
      formResponse.url,
    ).toString();
    const selectedTimes = infoshareTimeOptionValues(formText);
    const formArtifact = sourceArtifactFromHttp({
      sourceFamily: "inflation",
      sourceId: source.sourceId,
      currency: source.currency,
      endpointId: "statsnz_infoshare_exportdirect_form",
      endpointUrl: source.sourceUrl,
      fetchedAtUtc,
      response: formResponse,
      text: formText,
      sanitizedRequest: { method: "GET", url: source.sourceUrl },
      coverage: { ...officialCpiMetadata(source), selectedTimeOptions: selectedTimes.length },
      flags: { diagnosticOnly: true },
    });
    if (!formResponse.ok) throw new Error(`Stats NZ Infoshare form fetch failed: HTTP ${formResponse.status}`);
    const exportBody = new FormData();
    for (const name of ["__EVENTTARGET", "__EVENTARGUMENT", "__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION"]) {
      exportBody.append(name, hiddenInputValue(formText, name));
    }
    exportBody.append("ctl00$MainContent$fuSearchFile", new Blob([`${source.seriesId}\r\n`], { type: "text/plain" }), "cpi.sch");
    exportBody.append("ctl00$MainContent$tbMissingText", "..");
    exportBody.append("ctl00$MainContent$TimeVariableSelector$tbSelected", String(selectedTimes.length));
    for (const value of selectedTimes) {
      exportBody.append("ctl00$MainContent$TimeVariableSelector$lbVariableOptions", value);
    }
    exportBody.append("ctl00$MainContent$TimeVariableSelector$tbSearchVariables", "");
    exportBody.append("ctl00$MainContent$rblCSVFormat", "rows");
    exportBody.append("ctl00$MainContent$rblSeriesDescription", "description_at_top");
    exportBody.append("ctl00$MainContent$btnGenerate.x", "10");
    exportBody.append("ctl00$MainContent$btnGenerate.y", "10");
    const exportResponse = await fetchOfficialSource(action, {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "text/csv,*/*",
        Referer: formResponse.url,
      },
      body: exportBody,
    });
    const exportText = await exportResponse.text();
    const sourceHash = sha256(`${formText}\n${exportText}`);
    const exportEndpointUrl = offlineArtifactReplayConfig.enabled ? exportResponse.url || action : action;
    const exportArtifact = sourceArtifactFromHttp({
      sourceFamily: "inflation",
      sourceId: source.sourceId,
      currency: source.currency,
      endpointId: "statsnz_infoshare_exportdirect_sch",
      endpointUrl: exportEndpointUrl,
      fetchedAtUtc,
      response: exportResponse,
      text: exportText,
      sanitizedRequest: {
        method: "POST",
        url: exportEndpointUrl,
        body: {
          series: source.seriesId,
          selectedTimeOptions: selectedTimes.length,
          stateFieldsRedacted: true,
        },
      },
      coverage: officialCpiMetadata(source),
      flags: { diagnosticOnly: true },
    });
    if (!exportResponse.ok) throw new Error(`Stats NZ Infoshare export failed: HTTP ${exportResponse.status}`);
    const rows = parseInfoshareQuarterlyExport(exportText, source.seriesId).map((row) => ({
      period: row.period,
      value: row.value,
      nativeFrequency: "quarterly" as const,
      periodSegment: "quarterly_statsnz_cpiq_se9ns1160_all_groups",
    }));
    const artifacts = [formArtifact, exportArtifact];
    return {
      rows: buildOfficialCpiRows({ source, rows, sourceUrl: source.sourceUrl, sourceHash, artifacts }),
      artifacts,
      sourceHash,
      sourceUrl: source.sourceUrl,
    };
  }

  if (source.currency === "CHF") {
    const response = await fetchOfficialSource(source.sourceUrl, { cache: "no-store" });
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const sourceHash = createHash("sha256").update(buffer).digest("hex");
    const artifact = sourceArtifactFromBytes({
      sourceFamily: "inflation",
      sourceId: source.sourceId,
      currency: source.currency,
      endpointId: "swiss_fso_lik25b25_xlsx_master",
      endpointUrl: source.sourceUrl,
      fetchedAtUtc,
      response,
      buffer,
      sanitizedRequest: { method: "GET", url: source.sourceUrl },
      coverage: officialCpiMetadata(source),
      flags: { diagnosticOnly: true },
    });
    if (!response.ok) throw new Error(`Swiss FSO CPI workbook fetch failed: HTTP ${response.status}`);
    const rows = parseSwissFsoLikXlsx(buffer).map((row) => ({
      period: row.period,
      value: row.value,
      nativeFrequency: "monthly" as const,
      periodSegment: "monthly_swiss_fso_lik25b25_index_m_total",
    }));
    return {
      rows: buildOfficialCpiRows({ source, rows, sourceUrl: source.sourceUrl, sourceHash, artifacts: [artifact] }),
      artifacts: [artifact],
      sourceHash,
      sourceUrl: source.sourceUrl,
    };
  }

  throw new Error(`Unsupported official CPI source: ${source.sourceId}`);
}

async function buildRateObservations(options: CliOptions, fetchedAtUtc: string) {
  const observations: MacroSourceObservation[] = [];
  const artifacts: MacroSourceArtifact[] = [];
  const from = parseDateIso(options.fromWeekOpenUtc).minus({ years: 1 });
  const to = parseDateIso(options.toWeekOpenUtc).plus({ months: 1 });
  const latestBySource: Record<string, string | null> = {};

  for (const source of selectedRateSources(options)) {
    let fetchResult: Awaited<ReturnType<typeof fetchFredRowsForContract>>;
    try {
      fetchResult = await fetchFredRowsForContract({ source, from, to, fetchedAtUtc, cli: options });
    } catch (error) {
      const fallbackDate = isoDate(parseDateIso(options.fromWeekOpenUtc));
      observations.push({
        sourceFamily: "rate",
        sourceId: source.sourceId,
        currency: source.currency,
        instrument: source.instrument,
        observationDate: fallbackDate,
        effectiveAtUtc: isoUtc(DateTime.fromISO(fallbackDate, { zone: "utc" })),
        availableAtUtc: isoUtc(DateTime.fromISO(fallbackDate, { zone: "utc" })),
        fetchedAtUtc,
        sourceUrl: source.sourceUrl,
        sourceHash: null,
        rawValue: {
          error: error instanceof Error ? error.message : String(error),
          seriesId: source.seriesId,
        },
        normalizedValue: {},
        coverage: {
          valueAvailable: false,
          sourceFetched: false,
          reconstructionMode: MACRO_PROMOTION_RECONSTRUCTION_MODE,
          promotionReadiness: "blocked_missing_fred_api_key_or_fetch_failure",
        },
        flags: {
          noRegimeInterpretation: true,
          sourceGroup: source.sourceGroup,
          label: source.label,
          fetchError: true,
        },
      });
      latestBySource[source.sourceId] = null;
      if (!options.allowExploratorySourceFallback) {
        throw error;
      }
      continue;
    }

    const rows = fetchResult.rows;
    artifacts.push(...fetchResult.artifacts);
    const rawArtifactIds = artifactIds(fetchResult.artifacts);
    const rawArtifactId = primaryArtifactId(fetchResult.artifacts);
    latestBySource[source.sourceId] = rows.at(-1)?.observationDate ?? null;

    for (const row of rows) {
      const isLatestEligibleRate = fetchResult.reconstructionMode === RATE_RECONSTRUCTION_MODE;
      const availableAtUtc = isLatestEligibleRate
        ? fredRealtimePeriodAvailableAt(row.realtimeStart)
        : fetchResult.reconstructionMode === MACRO_PROMOTION_RECONSTRUCTION_MODE
        ? fredInitialReleaseAvailableAt(row.realtimeStart)
        : approximateFredAvailableAt(row.observationDate, source.frequency);
      observations.push({
        sourceFamily: "rate",
        sourceId: source.sourceId,
        currency: source.currency,
        instrument: source.instrument,
        observationDate: row.observationDate,
        effectiveAtUtc: isoUtc(DateTime.fromISO(row.observationDate, { zone: "utc" })),
        availableAtUtc,
        fetchedAtUtc,
        sourceUrl: fetchResult.sourceUrl,
        sourceHash: fetchResult.sourceHash,
        rawValue: {
          seriesId: source.seriesId,
          value: row.value,
          realtimeStart: row.realtimeStart,
          realtimeEnd: row.realtimeEnd,
          units: "percent",
          frequency: source.frequency,
          sourceGroup: source.sourceGroup,
        },
        normalizedValue: {
          ratePercent: row.value,
          rateDecimal: row.value / 100,
        },
        coverage: {
          valueAvailable: true,
          sourceFetched: true,
          cadence: source.cadence,
          fredSeriesUrl: source.sourceUrl,
          vintageDate: row.realtimeStart,
          reconstructionMode: fetchResult.reconstructionMode,
          promotionReadiness: fetchResult.promotionReadiness,
          selectionRule: isLatestEligibleRate ? RATE_SELECTION_RULE_VERSION : null,
          stalenessRuleVersion: isLatestEligibleRate ? RATE_STALENESS_RULE_VERSION : null,
          releaseAwareCarryRule: isLatestEligibleRate ? RATE_RELEASE_AWARE_CARRY_RULE : null,
          realtimeStart: row.realtimeStart,
          realtimeEnd: row.realtimeEnd,
          outputType: isLatestEligibleRate ? FRED_REALTIME_PERIOD_OUTPUT_TYPE : FRED_INITIAL_RELEASE_OUTPUT_TYPE,
          eligibilityPolicy: isLatestEligibleRate ? "first_freeze_strictly_after_date" : undefined,
          availabilityPrecision: isLatestEligibleRate ? "date" : undefined,
          asOfQueryDateEligibleAtFreezeDate: false,
          rawArtifactId,
          rawArtifactIds,
        },
        flags: {
          noRegimeInterpretation: true,
          availableAtMode: fetchResult.availabilityMode,
          sourceGroup: source.sourceGroup,
          label: source.label,
        },
      });
    }
  }

  return {
    artifacts,
    observations,
    latestBySource,
  };
}

async function buildInflationObservations(options: CliOptions, fetchedAtUtc: string) {
  const observations: MacroSourceObservation[] = [];
  const artifacts: MacroSourceArtifact[] = [];
  const from = parseDateIso(options.fromWeekOpenUtc).minus({ years: 2 });
  const to = parseDateIso(options.toWeekOpenUtc).plus({ months: 3 });
  const latestBySource: Record<string, string | null> = {};

  for (const source of INFLATION_SOURCES) {
    let fetchResult: OfficialCpiFetchResult;
    try {
      fetchResult = await fetchOfficialCpiRows(source, fetchedAtUtc, from, to);
    } catch (error) {
      const fallbackDate = isoDate(parseDateIso(options.fromWeekOpenUtc));
      observations.push({
        sourceFamily: "inflation",
        sourceId: source.sourceId,
        currency: source.currency,
        instrument: source.instrument,
        observationDate: fallbackDate,
        effectiveAtUtc: isoUtc(DateTime.fromISO(fallbackDate, { zone: "utc" })),
        availableAtUtc: isoUtc(DateTime.fromISO(fallbackDate, { zone: "utc" })),
        fetchedAtUtc,
        sourceUrl: source.sourceUrl,
        sourceHash: null,
        rawValue: {
          error: error instanceof Error ? error.message : String(error),
          seriesId: source.seriesId,
        },
        normalizedValue: {},
        coverage: {
          valueAvailable: false,
          sourceFetched: false,
          reconstructionMode: "official_cpi_current_vintage_release_aware_v1",
          promotionReadiness: "blocked_official_cpi_fetch_failure",
          cpiFamilyManifestId: CPI_FAMILY_MANIFEST_ID,
          cpiSourceMapVersion: CPI_OFFICIAL_SOURCE_MAP_VERSION,
          sourceContractId: source.sourceId,
          sourceContractHash: cpiSourceContractHash(source),
        },
        flags: {
          noRegimeInterpretation: true,
          sourceGroup: source.sourceGroup,
          label: source.label,
          sourceNotes: source.notes ?? null,
          fetchError: true,
          availableAtMode: "official_cpi_current_vintage_fetch_failure",
        },
      });
      latestBySource[source.sourceId] = null;
      if (!options.allowExploratorySourceFallback) {
        throw error;
      }
      continue;
    }

    const rows = fetchResult.rows;
    artifacts.push(...fetchResult.artifacts);
    const byPeriod = new Map(rows.map((row) => [row.period, row]));
    latestBySource[source.sourceId] = rows.at(-1)?.observationDate ?? null;

    for (const row of rows) {
      const lagPeriod = cpiPeriodMinus(row.period, row.nativeFrequency, row.lagPeriods);
      const lagRow = byPeriod.get(lagPeriod);
      if (!lagRow || lagRow.value === 0) continue;
      const inflationYoYPercent = ((row.value / lagRow.value) - 1) * 100;
      if (!Number.isFinite(inflationYoYPercent)) continue;
      const availableAtUtc = [row.availableAtUtc, lagRow.availableAtUtc].sort().at(-1) ?? row.availableAtUtc;
      const currentParentObservationId = cpiParentObservationId(row);
      const lagParentObservationId = cpiParentObservationId(lagRow);
      const currentParentAvailabilityEventId = cpiParentAvailabilityEventId(row);
      const lagParentAvailabilityEventId = cpiParentAvailabilityEventId(lagRow);
      const parentRawArtifactIds = [...new Set([...row.rawArtifactIds, ...lagRow.rawArtifactIds])].sort();
      observations.push({
        sourceFamily: "inflation",
        sourceId: source.sourceId,
        currency: source.currency,
        instrument: source.instrument,
        observationDate: row.observationDate,
        effectiveAtUtc: isoUtc(DateTime.fromISO(row.observationDate, { zone: "utc" })),
        availableAtUtc,
        fetchedAtUtc,
        sourceUrl: fetchResult.sourceUrl,
        sourceHash: fetchResult.sourceHash,
        rawValue: {
          seriesId: source.seriesId,
          cpiIndex: row.value,
          lagCpiIndex: lagRow.value,
          currentObservationPeriod: row.period,
          lagObservationPeriod: lagRow.period,
          currentObservationDate: row.observationDate,
          lagObservationDate: lagRow.observationDate,
          currentParentObservationId,
          lagParentObservationId,
          currentParentAvailabilityEventId,
          lagParentAvailabilityEventId,
          sourceContractId: row.sourceContractId,
          sourceContractHash: row.sourceContractHash,
          branchSemanticHash: row.branchSemanticHash,
          parserVersion: row.parserVersion,
          continuityDecisionId: row.continuityDecisionId,
          releaseCalendarVersion: row.releaseCalendarVersion,
          revisionRebasingVersion: row.revisionRebasingVersion,
          realtimeStart: null,
          realtimeEnd: null,
          units: "index",
          frequency: row.nativeFrequency,
          sourceGroup: source.sourceGroup,
          formulaVersion: CPI_YOY_FORMULA_VERSION,
        },
        normalizedValue: {
          cpiIndex: row.value,
          lagCpiIndex: lagRow.value,
          inflationYoYPercent,
          inflationYoYDecimal: inflationYoYPercent / 100,
        },
        coverage: {
          valueAvailable: true,
          sourceFetched: true,
          cadence: source.cadence,
          nativeFrequency: row.nativeFrequency,
          lagPeriods: row.lagPeriods,
          currentObservationPeriod: row.period,
          lagObservationPeriod: lagRow.period,
          currentObservationDate: row.observationDate,
          lagObservationDate: lagRow.observationDate,
          currentCpiParent: {
            sourceContractId: row.sourceContractId,
            seriesId: row.seriesId,
            observationPeriod: row.period,
            observationDate: row.observationDate,
            nativeFrequency: row.nativeFrequency,
            cpiIndex: row.value,
            availableAtUtc: row.availableAtUtc,
            rawArtifactId: row.rawArtifactId,
            rawArtifactIds: row.rawArtifactIds,
            sourceObservationId: currentParentObservationId,
            availabilityEventId: currentParentAvailabilityEventId,
          },
          lagCpiParent: {
            sourceContractId: lagRow.sourceContractId,
            seriesId: lagRow.seriesId,
            observationPeriod: lagRow.period,
            observationDate: lagRow.observationDate,
            nativeFrequency: lagRow.nativeFrequency,
            cpiIndex: lagRow.value,
            availableAtUtc: lagRow.availableAtUtc,
            rawArtifactId: lagRow.rawArtifactId,
            rawArtifactIds: lagRow.rawArtifactIds,
            sourceObservationId: lagParentObservationId,
            availabilityEventId: lagParentAvailabilityEventId,
          },
          currentParentObservationId,
          lagParentObservationId,
          parentRawObservationIds: [currentParentObservationId, lagParentObservationId],
          currentParentAvailabilityEventId,
          lagParentAvailabilityEventId,
          parentAvailabilityEventIds: [currentParentAvailabilityEventId, lagParentAvailabilityEventId],
          sourceContractId: row.sourceContractId,
          sourceContractHash: row.sourceContractHash,
          branchSemanticHash: row.branchSemanticHash,
          cpiFamilyManifestId: CPI_FAMILY_MANIFEST_ID,
          cpiSourceMapVersion: CPI_OFFICIAL_SOURCE_MAP_VERSION,
          cpiObservationSchemaVersion: CPI_OBSERVATION_SCHEMA_VERSION,
          cpiYoyFormulaVersion: CPI_YOY_FORMULA_VERSION,
          releaseCalendarVersion: row.releaseCalendarVersion,
          revisionRebasingVersion: row.revisionRebasingVersion,
          continuityDecisionId: row.continuityDecisionId,
          parserVersion: row.parserVersion,
          parserLayoutDriftGuard: row.layoutDriftGuard,
          baseOrReferencePeriod: row.baseOrReferencePeriod,
          periodSegment: row.periodSegment,
          endpointMode: row.endpointMode,
          artifactPayloadSha256: row.artifactPayloadSha256,
          reconstructionMode: "official_cpi_current_vintage_release_aware_v1",
          promotionReadiness: "point_in_time_cpi_source_contract_diagnostic",
          selectionRule: CPI_SELECTION_RULE_VERSION,
          stalenessRuleVersion: CPI_STALENESS_RULE_VERSION,
          releaseAwareCarryRule: CPI_RELEASE_AWARE_CARRY_RULE,
          availableAtBasis: "official_cpi_release_calendar_and_artifact",
          retrievalCapability: "release_event_filterable",
          availabilityPrecision: row.availableAtUtc.includes("T23:59") ? "date" : "exact_timestamp",
          availabilityTimezone: officialCpiAvailabilityTimezone(source),
          availabilityConfidence: "official_release_calendar_diagnostic",
          promotionEligibleAvailabilityBases: ["official_cpi_release_calendar_and_artifact"],
          minimumAvailabilityConfidence: "diagnostic_sealed_not_active",
          eligibilityPolicy: row.availableAtUtc.includes("T23:59")
            ? "first_freeze_strictly_after_date"
            : "eligible_at_or_before_freeze",
          rawArtifactId: row.rawArtifactId,
          rawArtifactIds: parentRawArtifactIds,
        },
        flags: {
          noRegimeInterpretation: true,
          availableAtMode: "official_cpi_current_vintage_release_aware",
          sourceGroup: source.sourceGroup,
          label: source.label,
          sourceNotes: source.notes ?? null,
          releaseAwareCarry: true,
          diagnosticOnly: true,
        },
      });
    }
  }

  return {
    artifacts,
    observations,
    latestBySource,
  };
}

function parseCsvRecords(csv: string) {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    if (inQuotes) {
      if (char === "\"" && csv[index + 1] === "\"") {
        field += "\"";
        index += 1;
      } else if (char === "\"") {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      if (row.some((value) => value.length > 0)) records.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  row.push(field);
  if (row.some((value) => value.length > 0)) records.push(row);

  const header = records[0] ?? [];
  return records.slice(1).map((values) => Object.fromEntries(
    header.map((key, index) => [key, values[index] ?? ""]),
  ));
}

function oecdTable4FetchUrl(startYear: number, endYear: number) {
  return `${OECD_TABLE4_SOURCE_URL}&startPeriod=${startYear}&endPeriod=${endYear}`;
}

function oecdAnnualAvailableAt(year: number, source: OecdValuationSource) {
  return isoUtc(DateTime.utc(year, 12, 31, 23, 59, 59).plus({ days: source.availabilityDelayDays }));
}

function bisEerFetchUrl(source: BisValuationSource, startPeriod: string, endPeriod: string) {
  return `${BIS_EER_SOURCE_URL}/${source.seriesKey}?startPeriod=${startPeriod}&endPeriod=${endPeriod}&format=csvfilewithlabels`;
}

function bisMonthlyAvailableAt(observationDateIso: string, source: BisValuationSource) {
  const monthStart = DateTime.fromISO(observationDateIso, { zone: "utc" });
  return isoUtc(monthStart.endOf("month").plus({ days: source.availabilityDelayDays }));
}

function normalizedOecdValuationValue(source: OecdValuationSource, value: number) {
  if (source.transaction === "EXC_A") {
    return {
      exchangeRateAverageXdcPerUsd: value,
      valuationInputValue: value,
    };
  }
  return {
    pppHouseholdFinalConsumptionXdcPerUsd: value,
    valuationInputValue: value,
  };
}

function normalizedBisEerValue(source: BisValuationSource, value: number) {
  if (source.eerType === "R") {
    return {
      reerBroadIndex2020: value,
      valuationInputValue: value,
    };
  }
  return {
    neerBroadIndex2020: value,
    valuationInputValue: value,
  };
}

async function buildOecdValuationObservations(options: CliOptions, fetchedAtUtc: string) {
  const observations: MacroSourceObservation[] = [];
  const fromYear = parseDateIso(options.fromWeekOpenUtc).year - 2;
  const toYear = parseDateIso(options.toWeekOpenUtc).year;
  const csvUrl = oecdTable4FetchUrl(fromYear, toYear);
  const response = await fetch(csvUrl, {
    cache: "no-store",
    headers: {
      Accept: "text/csv,*/*",
      "Accept-Language": "en",
      "User-Agent": "limni-gate47-source-warehouse/1.0",
    },
  });
  const csv = await response.text();
  const sourceHash = sha256(csv);
  const artifact = sourceArtifactFromHttp({
    sourceFamily: "valuation",
    sourceId: "oecd_table4_bulk_valuation_inputs",
    currency: "ALL",
    endpointId: "oecd_sdmx_table4_csv",
    endpointUrl: csvUrl,
    fetchedAtUtc,
    response,
    text: csv,
    sanitizedRequest: {
      method: "GET",
      url: csvUrl,
      headers: {
        Accept: "text/csv,*/*",
        "Accept-Language": "en",
        "User-Agent": "limni-gate47-source-warehouse/1.0",
      },
      params: {
        startPeriod: fromYear,
        endPeriod: toYear,
        format: "csvfilewithlabels",
      },
    },
    coverage: {
      provider: "oecd_table4",
      featureVersion: OECD_VALUATION_FEATURE_VERSION,
    },
    flags: {
      exploratoryShadowOnly: true,
    },
  });
  const rawArtifactIds = [artifact.artifactId];
  const latestBySource: Record<string, string | null> = {};

  if (!response.ok) {
    const fallbackDate = isoDate(parseDateIso(options.fromWeekOpenUtc));
    for (const source of OECD_VALUATION_SOURCES) {
      latestBySource[`${source.sourceId}:${source.currency}`] = null;
      observations.push({
        sourceFamily: "valuation",
        sourceId: source.sourceId,
        currency: source.currency,
        instrument: source.instrument,
        observationDate: fallbackDate,
        effectiveAtUtc: isoUtc(DateTime.fromISO(fallbackDate, { zone: "utc" })),
        availableAtUtc: isoUtc(DateTime.fromISO(fallbackDate, { zone: "utc" })),
        fetchedAtUtc,
        sourceUrl: csvUrl,
        sourceHash,
        rawValue: {
          status: response.status,
          refArea: source.refArea,
          transaction: source.transaction,
        },
        normalizedValue: {},
        coverage: { valueAvailable: false, sourceFetched: false },
        flags: {
          noRegimeInterpretation: true,
          featureVersion: OECD_VALUATION_FEATURE_VERSION,
          sourceGroup: source.sourceGroup,
          label: source.label,
          sourceNotes: source.notes ?? null,
          rawArtifactId: artifact.artifactId,
          rawArtifactIds,
        },
      });
    }
    return { artifacts: [artifact], observations, latestBySource };
  }

  const rows = parseCsvRecords(csv);
  for (const source of OECD_VALUATION_SOURCES) {
    const sourceRows = rows
      .filter((row) => (
        row.REF_AREA === source.refArea
        && row.TRANSACTION === source.transaction
        && row.UNIT_MEASURE === "XDC_USD"
        && row.FREQ === "A"
      ))
      .map((row) => ({
        row,
        year: Number(row.TIME_PERIOD),
        value: Number(row.OBS_VALUE),
      }))
      .filter((row) => Number.isInteger(row.year) && Number.isFinite(row.value))
      .sort((left, right) => left.year - right.year);

    latestBySource[`${source.sourceId}:${source.currency}`] =
      sourceRows.at(-1)?.row.TIME_PERIOD ?? null;

    for (const sourceRow of sourceRows) {
      const observationDate = `${sourceRow.year}-01-01`;
      observations.push({
        sourceFamily: "valuation",
        sourceId: source.sourceId,
        currency: source.currency,
        instrument: source.instrument,
        observationDate,
        effectiveAtUtc: isoUtc(DateTime.utc(sourceRow.year, 12, 31, 23, 59, 59)),
        availableAtUtc: oecdAnnualAvailableAt(sourceRow.year, source),
        fetchedAtUtc,
        sourceUrl: csvUrl,
        sourceHash,
        rawValue: {
          refArea: source.refArea,
          refAreaLabel: sourceRow.row["Reference area"] ?? null,
          transaction: source.transaction,
          transactionLabel: sourceRow.row.Transaction ?? null,
          tableIdentifier: sourceRow.row.TABLE_IDENTIFIER ?? null,
          timePeriod: sourceRow.row.TIME_PERIOD,
          value: sourceRow.value,
          unitMeasure: sourceRow.row.UNIT_MEASURE,
          unitMeasureLabel: sourceRow.row["Unit of measure"] ?? null,
          currency: sourceRow.row.CURRENCY ?? null,
          currencyLabel: sourceRow.row.Currency ?? null,
          frequency: source.frequency,
          sourceGroup: source.sourceGroup,
        },
        normalizedValue: {
          ...normalizedOecdValuationValue(source, sourceRow.value),
          unitMeasure: "xdc_per_usd",
          featureVersion: OECD_VALUATION_FEATURE_VERSION,
        },
        coverage: {
          valueAvailable: true,
          sourceFetched: true,
          cadence: source.cadence,
          refArea: source.refArea,
          transaction: source.transaction,
          availabilityDelayDays: source.availabilityDelayDays,
          sourceUrl: source.sourceUrl,
          rawArtifactId: artifact.artifactId,
          rawArtifactIds,
        },
        flags: {
          noRegimeInterpretation: true,
          featureVersion: OECD_VALUATION_FEATURE_VERSION,
          availableAtMode: `oecd_table4_calendar_year_end_plus_${source.availabilityDelayDays}_days_utc_approx`,
          fallbackLevel: "institutional_primary_annual_ppp_table4",
          sourceGroup: source.sourceGroup,
          label: source.label,
          sourceNotes: source.notes ?? null,
        },
      });
    }
  }

  return {
    artifacts: [artifact],
    observations,
    latestBySource,
  };
}

async function buildBisValuationObservations(options: CliOptions, fetchedAtUtc: string) {
  const observations: MacroSourceObservation[] = [];
  const artifacts: MacroSourceArtifact[] = [];
  const from = parseDateIso(options.fromWeekOpenUtc).minus({ months: 3 }).startOf("month");
  const to = parseDateIso(options.toWeekOpenUtc).plus({ months: 1 }).startOf("month");
  const startPeriod = from.toFormat("yyyy-MM");
  const endPeriod = to.toFormat("yyyy-MM");
  const latestBySource: Record<string, string | null> = {};

  for (const source of BIS_VALUATION_SOURCES) {
    const csvUrl = bisEerFetchUrl(source, startPeriod, endPeriod);
    const response = await fetch(csvUrl, {
      cache: "no-store",
      headers: {
        Accept: "text/csv,*/*",
        "Accept-Language": "en",
        "User-Agent": "limni-gate47-source-warehouse/1.0",
      },
    });
    const csv = await response.text();
    const sourceHash = sha256(csv);
    const artifact = sourceArtifactFromHttp({
      sourceFamily: "valuation",
      sourceId: source.sourceId,
      currency: source.currency,
      endpointId: "bis_eer_v2_csv",
      endpointUrl: csvUrl,
      fetchedAtUtc,
      response,
      text: csv,
      sanitizedRequest: {
        method: "GET",
        url: csvUrl,
        headers: {
          Accept: "text/csv,*/*",
          "Accept-Language": "en",
          "User-Agent": "limni-gate47-source-warehouse/1.0",
        },
        params: {
          seriesKey: source.seriesKey,
          startPeriod,
          endPeriod,
          format: "csvfilewithlabels",
        },
      },
      coverage: {
        provider: "bis_eer",
        featureVersion: BIS_VALUATION_FEATURE_VERSION,
        refArea: source.refArea,
        seriesKey: source.seriesKey,
      },
      flags: {
        exploratoryShadowOnly: true,
      },
    });
    artifacts.push(artifact);
    const rawArtifactIds = [artifact.artifactId];

    if (!response.ok) {
      const fallbackDate = isoDate(parseDateIso(options.fromWeekOpenUtc));
      latestBySource[`${source.sourceId}:${source.currency}`] = null;
      observations.push({
        sourceFamily: "valuation",
        sourceId: source.sourceId,
        currency: source.currency,
        instrument: source.instrument,
        observationDate: fallbackDate,
        effectiveAtUtc: isoUtc(DateTime.fromISO(fallbackDate, { zone: "utc" })),
        availableAtUtc: isoUtc(DateTime.fromISO(fallbackDate, { zone: "utc" })),
        fetchedAtUtc,
        sourceUrl: csvUrl,
        sourceHash,
        rawValue: {
          status: response.status,
          refArea: source.refArea,
          seriesKey: source.seriesKey,
          eerType: source.eerType,
          eerBasket: source.eerBasket,
        },
        normalizedValue: {},
        coverage: { valueAvailable: false, sourceFetched: false },
        flags: {
          noRegimeInterpretation: true,
          featureVersion: BIS_VALUATION_FEATURE_VERSION,
          sourceGroup: source.sourceGroup,
          label: source.label,
          sourceNotes: source.notes ?? null,
          rawArtifactId: artifact.artifactId,
          rawArtifactIds,
        },
      });
      continue;
    }

    const sourceRows = parseCsvRecords(csv)
      .filter((row) => (
        row.FREQ === "M"
        && row.EER_TYPE === source.eerType
        && row.EER_BASKET === source.eerBasket
        && row.REF_AREA === source.refArea
      ))
      .map((row) => ({
        row,
        observationDate: `${row.TIME_PERIOD}-01`,
        value: Number(row.OBS_VALUE),
      }))
      .filter((row) => DateTime.fromISO(row.observationDate, { zone: "utc" }).isValid && Number.isFinite(row.value))
      .sort((left, right) => left.observationDate.localeCompare(right.observationDate));

    latestBySource[`${source.sourceId}:${source.currency}`] =
      sourceRows.at(-1)?.row.TIME_PERIOD ?? null;

    for (const sourceRow of sourceRows) {
      const observationDate = sourceRow.observationDate;
      const monthStart = DateTime.fromISO(observationDate, { zone: "utc" });
      observations.push({
        sourceFamily: "valuation",
        sourceId: source.sourceId,
        currency: source.currency,
        instrument: source.instrument,
        observationDate,
        effectiveAtUtc: isoUtc(monthStart.endOf("month")),
        availableAtUtc: bisMonthlyAvailableAt(observationDate, source),
        fetchedAtUtc,
        sourceUrl: csvUrl,
        sourceHash,
        rawValue: {
          refArea: source.refArea,
          seriesKey: source.seriesKey,
          eerType: source.eerType,
          eerBasket: source.eerBasket,
          title: sourceRow.row.TITLE_TS ?? null,
          timePeriod: sourceRow.row.TIME_PERIOD,
          value: sourceRow.value,
          unitMeasure: sourceRow.row.UNIT_MEASURE ?? "2020=100",
          frequency: source.frequency,
          sourceGroup: source.sourceGroup,
        },
        normalizedValue: {
          ...normalizedBisEerValue(source, sourceRow.value),
          unitMeasure: "index_2020_100",
          featureVersion: BIS_VALUATION_FEATURE_VERSION,
        },
        coverage: {
          valueAvailable: true,
          sourceFetched: true,
          cadence: source.cadence,
          refArea: source.refArea,
          seriesKey: source.seriesKey,
          eerType: source.eerType,
          eerBasket: source.eerBasket,
          availabilityDelayDays: source.availabilityDelayDays,
          sourceUrl: source.sourceUrl,
          rawArtifactId: artifact.artifactId,
          rawArtifactIds,
        },
        flags: {
          noRegimeInterpretation: true,
          featureVersion: BIS_VALUATION_FEATURE_VERSION,
          availableAtMode: `bis_eer_month_end_plus_${source.availabilityDelayDays}_days_utc_approx`,
          fallbackLevel: "institutional_primary_bis_eer_v2_api",
          sourceGroup: source.sourceGroup,
          label: source.label,
          sourceNotes: source.notes ?? null,
        },
      });
    }
  }

  return {
    artifacts,
    observations,
    latestBySource,
  };
}

async function buildValuationObservations(options: CliOptions, fetchedAtUtc: string) {
  const oecdSummary = await buildOecdValuationObservations(options, fetchedAtUtc);
  const bisSummary = await buildBisValuationObservations(options, fetchedAtUtc);
  return {
    artifacts: [
      ...oecdSummary.artifacts,
      ...bisSummary.artifacts,
    ],
    observations: [
      ...oecdSummary.observations,
      ...bisSummary.observations,
    ],
    latestBySource: {
      ...oecdSummary.latestBySource,
      ...bisSummary.latestBySource,
    },
  };
}

function observationKey(row: Pick<MacroSourceObservation, "sourceFamily" | "sourceId" | "currency" | "instrument">) {
  return `${row.sourceFamily}|${row.sourceId}|${row.currency.toUpperCase()}|${row.instrument}`;
}

function buildSourceContracts(options: CliOptions): SourceContract[] {
  const contracts: SourceContract[] = [];
  if (options.includeBpr) {
    for (const reportType of options.reportTypes) {
      for (const currency of FX_CURRENCIES) {
        contracts.push({
          sourceFamily: "bpr",
          sourceId: BPR_SOURCE_IDS[reportType],
          currency,
          instrument: BPR_INSTRUMENTS[reportType],
          maxStaleDays: BPR_MAX_STALE_DAYS,
        });
      }
    }
  }
  if (options.includeRates) {
    for (const source of selectedRateSources(options)) {
      contracts.push({
        sourceFamily: "rate",
        sourceId: source.sourceId,
        currency: source.currency,
        instrument: source.instrument,
        maxStaleDays: source.maxStaleDays,
      });
    }
  }
  if (options.includeInflation) {
    for (const source of INFLATION_SOURCES) {
      contracts.push({
        sourceFamily: "inflation",
        sourceId: source.sourceId,
        currency: source.currency,
        instrument: source.instrument,
        maxStaleDays: source.maxStaleDays,
      });
    }
  }
  if (options.includeValuation) {
    for (const source of VALUATION_SOURCES) {
      contracts.push({
        sourceFamily: "valuation",
        sourceId: source.sourceId,
        currency: source.currency,
        instrument: source.instrument,
        maxStaleDays: source.maxStaleDays,
      });
    }
  }
  return contracts;
}

function rateAuthority(source: RateSource) {
  if (source.seriesId === "DFEDTARU") return "Board of Governors of the Federal Reserve System / FOMC";
  if (source.seriesId === "ECBDFR") return "European Central Bank";
  if (source.seriesId === "IUDSOIA") return "Bank of England";
  return "OECD Main Economic Indicators / national monetary authority as compiled by OECD";
}

function inflationAuthority(source: InflationSource) {
  if (source.sourceGroup.includes("abs")) return "Australian Bureau of Statistics";
  if (source.sourceGroup.includes("statcan")) return "Statistics Canada";
  if (source.sourceGroup.includes("swiss_fso")) return "Swiss Federal Statistical Office";
  if (source.sourceGroup.includes("eurostat")) return "Eurostat";
  if (source.sourceGroup.includes("ons")) return "Office for National Statistics";
  if (source.sourceGroup.includes("estat_japan")) return "Statistics Bureau of Japan / e-Stat";
  if (source.sourceGroup.includes("statsnz")) return "Stats NZ";
  if (source.sourceGroup.includes("bls")) return "US Bureau of Labor Statistics";
  return "OECD Main Economic Indicators / national statistical authority as compiled by OECD";
}

function valuationAuthority(source: ValuationSource) {
  return source.provider === "bis_eer"
    ? "Bank for International Settlements"
    : "Organisation for Economic Co-operation and Development";
}

function registrySchemaVersion(entry: SourceRegistryEntryInput) {
  if (entry.disseminationEndpoint.includes("FRED/ALFRED")) return "fred_alfred_observations_schema_v1";
  if (entry.disseminationEndpoint.includes("e-Stat")) return "estat_get_stats_data_schema_v1";
  if (entry.disseminationEndpoint.includes("BIS")) return "bis_sdmx_csv_schema_v1";
  if (entry.disseminationEndpoint.includes("OECD")) return "oecd_sdmx_csv_schema_v1";
  if (entry.disseminationEndpoint.includes("CFTC")) return "cftc_bpr_html_schema_v1";
  if (entry.endpointExceptionStatus === "derived") return "limni_derived_macro_feature_schema_v1";
  return "macro_source_schema_v1";
}

function finalizeSourceRegistryEntry(entry: SourceRegistryEntryInput): SourceRegistryEntry {
  const semanticContract = {
    sourceFamily: entry.sourceFamily,
    sourceId: entry.sourceId,
    currency: entry.currency,
    instrument: entry.instrument,
    economicAuthority: entry.economicAuthority,
    compilerOrHarmonizer: entry.compilerOrHarmonizer,
    seriesId: entry.seriesId,
    frequency: entry.frequency,
    units: entry.units,
    seasonalAdjustment: entry.seasonalAdjustment,
    observationPeriodSemantics: entry.observationPeriodSemantics,
    revisionPolicy: entry.revisionPolicy,
    rebasingPolicy: entry.rebasingPolicy,
  };
  const providerMetadata = {
    disseminationEndpoint: entry.disseminationEndpoint,
    promotedEndpoint: entry.promotedEndpoint,
    endpointContract: entry.endpointContract,
    retrievalCapability: entry.retrievalCapability,
    availabilityPrecision: entry.availabilityPrecision,
    eligibilityPolicy: entry.eligibilityPolicy,
    availabilityContract: entry.availabilityContract,
  };
  return {
    ...entry,
    semanticContractHash: hashJson(semanticContract),
    providerMetadataHash: hashJson(providerMetadata),
    schemaVersionOrHash: registrySchemaVersion(entry),
    seriesSegmentId: hashJson({
      sourceId: entry.sourceId,
      currency: entry.currency,
      seriesId: entry.seriesId,
      sourceVersion: entry.sourceVersion,
      rebasingPolicy: entry.rebasingPolicy,
    }),
    segmentValidFrom: null,
    segmentValidTo: null,
    continuityDecision: entry.endpointExceptionStatus === "derived"
      ? "inherits_parent_continuity"
      : entry.endpointExceptionStatus === "shadow_only"
        ? "shadow_only_pending_availability_contract"
        : "single_segment_until_metadata_or_base_change",
    unitConversionVersion: "macro_unit_conversion_v1",
    normalizationVersion: entry.endpointExceptionStatus === "derived"
      ? "real_rate_pressure_formula_v1"
      : "macro_observation_normalization_v1",
    driftAction: entry.endpointExceptionStatus === "derived"
      ? "inherits_parent_drift_state"
      : entry.endpointExceptionStatus === "shadow_only"
        ? "shadow_only"
        : "fail_closed_pending_review",
  };
}

function buildSourceRegistry(options: CliOptions): SourceRegistryEntry[] {
  const entries: SourceRegistryEntryInput[] = [];

  if (options.includeBpr) {
    for (const reportType of options.reportTypes) {
      for (const currency of FX_CURRENCIES) {
        entries.push({
          sourceFamily: "bpr",
          sourceId: BPR_SOURCE_IDS[reportType],
          currency,
          instrument: BPR_INSTRUMENTS[reportType],
          featureRole: "raw_source",
          economicAuthority: "US Commodity Futures Trading Commission",
          compilerOrHarmonizer: "US Commodity Futures Trading Commission",
          disseminationEndpoint: "CFTC Bank Participation Reports HTML; frozen archive replays canonical CFTC artifacts for historical evidence",
          promotedEndpoint: "cftc_bpr_canonical_html_with_internal_replay_evidence",
          endpointContract: "official CFTC report date, normally first Tuesday positions published first Friday after 15:30 America/New_York; first-Tuesday federal holidays and delayed-report exceptions override the schedule",
          retrievalCapability: "release_event_filterable",
          availabilityPrecision: "scheduled_window",
          eligibilityPolicy: "eligible_at_or_before_freeze",
          endpointExceptionStatus: "standard_contract",
          seriesId: reportType,
          frequency: "monthly",
          units: "contracts",
          seasonalAdjustment: null,
          observationPeriodSemantics: "monthly report row for the report date, mapped to the best COT market for the FX currency",
          availabilityContract: "scheduled timestamp unless a holiday, shutdown, or delayed CFTC report is detected",
          revisionPolicy: "CFTC published report HTML is stored as immutable payload evidence; later corrections require a new artifact and dataset hash",
          rebasingPolicy: "not applicable",
          sourceVersion: MACRO_SOURCE_CONTRACT_VERSION,
          promotionState: "eligible_after_delayed_report_exception_check",
          notes: "BPR remains a positioning source, not combined regime logic.",
        });
      }
    }
  }

  if (options.includeRates) {
    for (const source of selectedRateSources(options)) {
      const latestEligibleRate = isCanonicalRateSource(source);
      entries.push({
        sourceFamily: "rate",
        sourceId: source.sourceId,
        currency: source.currency,
        instrument: source.instrument,
        featureRole: "raw_source",
        economicAuthority: rateAuthority(source),
        compilerOrHarmonizer: source.sourceGroup.includes("oecd") ? "OECD via FRED/ALFRED" : "FRED/ALFRED source metadata",
        disseminationEndpoint: "Federal Reserve Bank of St. Louis FRED/ALFRED series observations API",
        promotedEndpoint: latestEligibleRate
          ? `fred/series/observations output_type=${FRED_REALTIME_PERIOD_OUTPUT_TYPE}`
          : `fred/series/observations output_type=${FRED_INITIAL_RELEASE_OUTPUT_TYPE}`,
        endpointContract: latestEligibleRate
          ? "real-time-period observation rows; select the latest vintage whose closed real-time period contains the weekly freeze date, with date-only vintage availability first eligible at the strictly later canonical weekly freeze"
          : "initial-release observation rows with date-only realtime_start; exact-boundary ties roll to the subsequent canonical week open",
        retrievalCapability: "as_of_queryable",
        availabilityPrecision: "date",
        eligibilityPolicy: "first_freeze_strictly_after_date",
        endpointExceptionStatus: "standard_contract",
        seriesId: source.seriesId,
        frequency: source.frequency,
        units: "percent",
        seasonalAdjustment: null,
        observationPeriodSemantics: source.cadence,
        availabilityContract: "requires FRED_API_KEY or ALFRED_API_KEY; latest-vintage graph CSV is exploratory fallback only",
        revisionPolicy: latestEligibleRate
          ? "latest eligible vintage as of each weekly freeze is selected; date-only revisions affect only freezes after the vintage date"
          : "initial release vintage is selected for promotion-bound fills; later FRED revisions remain separate vintages",
        rebasingPolicy: "not applicable",
        sourceVersion: MACRO_SOURCE_CONTRACT_VERSION,
        promotionState: latestEligibleRate
          ? "diagnostic_sealed_rate_contract_latest_eligible_vintage"
          : "exploratory_rate_contract_not_selected_for_promotion",
        notes: source.label,
      });
    }
  }

  if (options.includeInflation) {
    for (const source of INFLATION_SOURCES) {
      const metadata = officialCpiMetadata(source);
      entries.push({
        sourceFamily: "inflation",
        sourceId: source.sourceId,
        currency: source.currency,
        instrument: source.instrument,
        featureRole: "raw_source",
        economicAuthority: inflationAuthority(source),
        compilerOrHarmonizer: inflationAuthority(source),
        disseminationEndpoint: metadata.endpointMode,
        promotedEndpoint: source.sourceUrl,
        endpointContract: `${metadata.continuityDecisionId}; parser=${metadata.parserVersion}; drift_guard=${metadata.layoutDriftGuard}`,
        retrievalCapability: source.currency === "USD" || source.currency === "CAD" || source.currency === "GBP" || source.currency === "EUR" || source.currency === "JPY" || source.currency === "AUD" || source.currency === "NZD" || source.currency === "CHF"
          ? "release_event_filterable"
          : "capture_before_freeze_required",
        availabilityPrecision: source.currency === "AUD" || source.currency === "CHF" || source.currency === "GBP"
          ? "exact_timestamp"
          : "date",
        eligibilityPolicy: source.currency === "AUD" || source.currency === "CHF" || source.currency === "GBP"
          ? "eligible_at_or_before_freeze"
          : "first_freeze_strictly_after_date",
        endpointExceptionStatus: "standard_contract",
        seriesId: source.seriesId,
        frequency: source.frequency,
        units: "index",
        seasonalAdjustment: "not seasonally adjusted or original headline CPI per source contract",
        observationPeriodSemantics: `${source.cadence}; YoY inflation derives from the same source id lagged ${source.lagPeriods} periods`,
        availabilityContract: `${metadata.releaseCalendarVersion}; ${CPI_RELEASE_AWARE_CARRY_RULE}`,
        revisionPolicy: metadata.revisionRebasingVersion,
        rebasingPolicy: metadata.baseOrReferencePeriod,
        sourceVersion: CPI_OFFICIAL_SOURCE_MAP_VERSION,
        promotionState: "diagnostic_sealed_cpi_contract_not_active",
        notes: source.notes ?? source.label,
      });
    }
  }

  if (options.includeValuation) {
    for (const source of VALUATION_SOURCES) {
      entries.push({
        sourceFamily: "valuation",
        sourceId: source.sourceId,
        currency: source.currency,
        instrument: source.instrument,
        featureRole: "raw_source",
        economicAuthority: valuationAuthority(source),
        compilerOrHarmonizer: valuationAuthority(source),
        disseminationEndpoint: source.provider === "bis_eer" ? "BIS SDMX v2 API" : "OECD SDMX Table 4 CSV API",
        promotedEndpoint: source.provider === "bis_eer" ? "BIS WS_EER monthly broad EER endpoint" : "OECD Table 4 annual PPP/exchange-rate endpoint",
        endpointContract: "stored as shadow valuation input only in Gate 49; no promoted regime eligibility until availability contract is hardened",
        retrievalCapability: "capture_before_freeze_required",
        availabilityPrecision: "inferred",
        eligibilityPolicy: "capture_must_precede_freeze",
        endpointExceptionStatus: "shadow_only",
        seriesId: source.provider === "bis_eer" ? source.seriesKey : source.transaction,
        frequency: source.frequency,
        units: source.provider === "bis_eer" ? "index_2020_100" : "xdc_per_usd",
        seasonalAdjustment: null,
        observationPeriodSemantics: source.cadence,
        availabilityContract: "modeled lag only; shadow-only until point-in-time availability is hardened",
        revisionPolicy: "payload hash and artifact record preserve the endpoint response for exploratory valuation rows",
        rebasingPolicy: source.provider === "bis_eer" ? "BIS base changes require new feature version" : "OECD PPP method/table changes require new feature version",
        sourceVersion: source.provider === "bis_eer" ? BIS_VALUATION_FEATURE_VERSION : OECD_VALUATION_FEATURE_VERSION,
        promotionState: "shadow_only_not_promotion_bound",
        notes: source.notes ?? source.label,
      });
    }
  }

  if (options.includeRealRatePressure) {
    for (const source of REAL_RATE_PRESSURE_SOURCES) {
      entries.push({
        sourceFamily: "real_rate_pressure",
        sourceId: source.sourceId,
        currency: source.currency,
        instrument: source.instrument,
        featureRole: "derived_feature",
        economicAuthority: "derived from the selected nominal-rate and CPI source contracts",
        compilerOrHarmonizer: "Limni macro regime warehouse",
        disseminationEndpoint: "derived://macro-regime/real-rate/3m-interbank-minus-cpi-yoy/v1",
        promotedEndpoint: source.sourceUrl,
        endpointContract: "derived weekly only after parent rate and inflation snapshots satisfy the same weekly freeze",
        retrievalCapability: "derived",
        availabilityPrecision: "inherited",
        eligibilityPolicy: "inherit_from_parents",
        endpointExceptionStatus: "derived",
        seriesId: null,
        frequency: "weekly",
        units: "percent",
        seasonalAdjustment: null,
        observationPeriodSemantics: source.cadence,
        availabilityContract: "inherits the latest eligible parent available_at_utc and all parent raw observation/artifact ids",
        revisionPolicy: "recomputed under a new dataset hash when any parent source contract, vintage, or freeze rule changes",
        rebasingPolicy: "inherits CPI rebasing policy from the parent inflation source",
        sourceVersion: MACRO_SOURCE_CONTRACT_VERSION,
        promotionState: "blocked_until_all_parent_sources_are_promotion_grade",
        notes: `Parents: rate=${source.rateSourceId}; inflation=${source.inflationSourceId}.`,
      });
    }
  }

  return entries.map(finalizeSourceRegistryEntry).sort((left, right) =>
    `${left.sourceFamily}|${left.sourceId}|${left.currency}|${left.instrument}`
      .localeCompare(`${right.sourceFamily}|${right.sourceId}|${right.currency}|${right.instrument}`));
}

function buildWeeklySnapshots(options: {
  weeks: string[];
  observations: MacroSourceObservation[];
  contracts: SourceContract[];
}): MacroWeeklyCurrencySnapshot[] {
  const byContract = new Map<string, MacroSourceObservation[]>();
  for (const observation of options.observations) {
    if (observation.currency === "ALL") continue;
    const key = observationKey(observation);
    const rows = byContract.get(key) ?? [];
    rows.push(observation);
    byContract.set(key, rows);
  }
  for (const rows of byContract.values()) {
    rows.sort((left, right) => compareObservationSelectionPriority(left, right));
  }

  const snapshots: MacroWeeklyCurrencySnapshot[] = [];
  for (const contract of options.contracts) {
    const contractUsesRateCarry = isCanonicalRateContract(contract);
    const contractUsesCpiCarry = isOfficialCpiContract(contract);
    const rows = byContract.get(observationKey(contract)) ?? [];
    for (const weekOpenUtc of options.weeks) {
      const freezeMetadata = macroWeeklySignalFreezeMetadata(weekOpenUtc);
      const freezeTarget = parseDateIso(freezeMetadata.freezeTargetUtc);
      const { selected, selectedEligibilityReason, eligibleCandidates } =
        selectObservationForFreeze(rows, freezeTarget);

      if (!selected) {
        snapshots.push({
          weekOpenUtc,
          sourceFamily: contract.sourceFamily,
          sourceId: contract.sourceId,
          currency: contract.currency,
          instrument: contract.instrument,
          asOfUtc: freezeMetadata.freezeTargetUtc,
          sourceObservationDate: null,
          effectiveAtUtc: null,
          availableAtUtc: null,
          rawValue: {},
          normalizedValue: {},
          coverage: {
            ...freezeMetadata,
            valueAvailable: false,
            missingReason: "no_observation_available_as_of_macro_weekly_freeze_target",
            maxStaleDays: contractUsesRateCarry || contractUsesCpiCarry ? null : contract.maxStaleDays,
            stalenessRuleVersion: contractUsesRateCarry
              ? RATE_STALENESS_RULE_VERSION
              : contractUsesCpiCarry
                ? CPI_STALENESS_RULE_VERSION
                : MACRO_STALENESS_RULE_VERSION,
            observationAgeAtFreezeDays: null,
            releaseOverdueDurationDays: null,
            carryForwardFlag: false,
            staleFlag: false,
            staleReason: null,
            maxValidThroughFreezeId: null,
            trustedForFreeze: false,
            eligibilityDecision: "missing",
            eligibilityReason: "no_source_row_available_before_freeze_target",
            selectedRawObservationId: null,
            selectedVintageDate: null,
            selectedRawArtifactId: null,
            selectedRawArtifactIds: [],
            selectedAvailabilityEventId: null,
            selectionRuleVersion: contractUsesRateCarry
              ? RATE_SELECTION_RULE_VERSION
              : contractUsesCpiCarry
                ? CPI_SELECTION_RULE_VERSION
                : MACRO_WEEKLY_SELECTOR_VERSION,
            eligibleCandidates: 0,
            releaseAwareCarryRule: contractUsesRateCarry
              ? RATE_RELEASE_AWARE_CARRY_RULE
              : contractUsesCpiCarry
                ? CPI_RELEASE_AWARE_CARRY_RULE
                : null,
          },
          flags: {
            noRegimeInterpretation: true,
            weeklySignalFreeze: true,
          },
        });
        continue;
      }

      const staleDays = Math.floor(freezeTarget.diff(parseDateIso(selected.availableAtUtc), "days").days);
      const usesRateReleaseAwareCarry = contractUsesRateCarry && isRateLatestEligibleObservation(selected);
      const usesCpiReleaseAwareCarry = contractUsesCpiCarry && isOfficialCpiObservation(selected);
      const usesReleaseAwareCarry = usesRateReleaseAwareCarry || usesCpiReleaseAwareCarry;
      const isStale = usesReleaseAwareCarry ? false : staleDays > contract.maxStaleDays;
      const observationAgeAtFreezeDays = Math.floor(freezeTarget.diff(parseDateIso(selected.effectiveAtUtc), "days").days);
      const releaseOverdueDurationDays = usesReleaseAwareCarry
        ? 0
        : isStale
          ? staleDays - contract.maxStaleDays
          : 0;
      const carryForwardFlag = selected.coverage.valueAvailable === true && (
        usesReleaseAwareCarry
          ? selected.observationDate < weekOpenUtc.slice(0, 10)
          : !isStale && staleDays > 0
      );
      snapshots.push({
        weekOpenUtc,
        sourceFamily: contract.sourceFamily,
        sourceId: contract.sourceId,
        currency: contract.currency,
        instrument: contract.instrument,
        asOfUtc: freezeMetadata.freezeTargetUtc,
        sourceObservationDate: selected.observationDate,
        effectiveAtUtc: selected.effectiveAtUtc,
        availableAtUtc: selected.availableAtUtc,
        rawValue: selected.rawValue,
        normalizedValue: selected.normalizedValue,
        coverage: {
          ...selected.coverage,
          ...freezeMetadata,
          selectedRawObservationId: selected.coverage.rawObservationId ?? selected.flags.rawObservationId ?? null,
          selectedVintageDate: selected.coverage.vintageDate ?? null,
          selectedRawArtifactId: selected.coverage.rawArtifactId ?? selected.flags.rawArtifactId ?? null,
          selectedRawArtifactIds: selected.coverage.rawArtifactIds ?? selected.flags.rawArtifactIds ?? [],
          selectedAvailabilityEventId: selected.coverage.availabilityEventId ?? selected.flags.availabilityEventId ?? null,
          eligibilityDecision: "selected",
          eligibilityReason: selectedEligibilityReason,
          eligibleCandidates,
          selectionRuleVersion: usesRateReleaseAwareCarry
            ? RATE_SELECTION_RULE_VERSION
            : usesCpiReleaseAwareCarry
              ? CPI_SELECTION_RULE_VERSION
              : MACRO_WEEKLY_SELECTOR_VERSION,
          selectionOrder: usesRateReleaseAwareCarry
            ? "newest_observation_period_whose_realtime_period_contains_freeze_then_latest_eligible_vintage_as_of_freeze_then_deterministic_raw_observation_id"
            : usesCpiReleaseAwareCarry
              ? "newest_official_cpi_yoy_parent_set_whose_max_parent_availability_is_eligible_at_freeze_then_deterministic_parent_observation_ids"
              : "newest_eligible_observation_period_then_latest_eligible_vintage_then_allowed_prelim_final_state_then_deterministic_raw_observation_id",
          valueAvailable: selected.coverage.valueAvailable === true,
          stalenessDays: staleDays,
          stalenessRuleVersion: usesRateReleaseAwareCarry
            ? RATE_STALENESS_RULE_VERSION
            : usesCpiReleaseAwareCarry
              ? CPI_STALENESS_RULE_VERSION
              : MACRO_STALENESS_RULE_VERSION,
          observationAgeAtFreezeDays,
          releaseOverdueDurationDays,
          carryForwardFlag,
          staleFlag: isStale,
          staleReason: usesReleaseAwareCarry
            ? null
            : isStale
              ? "selected_observation_available_at_exceeds_family_max_stale_days"
              : null,
          maxValidThroughFreezeId: isStale ? null : weekOpenUtc,
          maxStaleDays: usesReleaseAwareCarry ? null : contract.maxStaleDays,
          releaseAwareCarryRule: usesRateReleaseAwareCarry
            ? RATE_RELEASE_AWARE_CARRY_RULE
            : usesCpiReleaseAwareCarry
              ? CPI_RELEASE_AWARE_CARRY_RULE
              : null,
          fixedAgeStalenessBypassed: usesReleaseAwareCarry,
          isStale,
          trustedForFreeze: selected.coverage.valueAvailable === true && !isStale,
        },
        flags: {
          ...selected.flags,
          noRegimeInterpretation: true,
          weeklySignalFreeze: true,
          staleByCadence: isStale,
          releaseAwareCarry: usesReleaseAwareCarry,
        },
      });
    }
  }

  return snapshots;
}

function snapshotValueNumber(
  snapshot: MacroWeeklyCurrencySnapshot | null,
  key: "ratePercent" | "inflationYoYPercent",
) {
  const value = snapshot?.normalizedValue[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function buildRealRatePressureSnapshots(options: {
  weeks: string[];
  snapshots: MacroWeeklyCurrencySnapshot[];
  rateParent?: ParentDatasetIdentity | null;
  cpiParent?: ParentDatasetIdentity | null;
}): MacroWeeklyCurrencySnapshot[] {
  const byWeekAndContract = new Map<string, MacroWeeklyCurrencySnapshot>();
  for (const snapshot of options.snapshots) {
    byWeekAndContract.set(`${snapshot.weekOpenUtc}|${observationKey(snapshot)}`, snapshot);
  }
  const strictParentLineage = Boolean(options.rateParent && options.cpiParent);

  const derivedSnapshots: MacroWeeklyCurrencySnapshot[] = [];
  for (const source of REAL_RATE_PRESSURE_SOURCES) {
    for (const weekOpenUtc of options.weeks) {
      const freezeMetadata = macroWeeklySignalFreezeMetadata(weekOpenUtc);
      const rateSnapshot = byWeekAndContract.get(`${weekOpenUtc}|rate|${source.rateSourceId}|${source.currency}|oecd_3m_interbank_rate`) ?? null;
      const inflationSnapshot = byWeekAndContract.get(`${weekOpenUtc}|inflation|${source.inflationSourceId}|${source.currency}|cpi_all_items_yoy`) ?? null;
      const rateCoverage = asJsonRecord(rateSnapshot?.coverage);
      const inflationCoverage = asJsonRecord(inflationSnapshot?.coverage);
      const nominalRatePercent = snapshotValueNumber(rateSnapshot, "ratePercent");
      const inflationYoYPercent = snapshotValueNumber(inflationSnapshot, "inflationYoYPercent");
      const rateAvailable = rateCoverage.valueAvailable === true && nominalRatePercent !== null;
      const inflationAvailable = inflationCoverage.valueAvailable === true && inflationYoYPercent !== null;
      const rateStale = rateCoverage.isStale === true;
      const inflationStale = inflationCoverage.isStale === true;
      const isStale = rateStale || inflationStale;
      const rateObservationId = stringOrNull(rateCoverage.selectedRawObservationId);
      const cpiObservationId = stringOrNull(inflationCoverage.selectedRawObservationId);
      const cpiCurrentParentObservationId = stringOrNull(inflationCoverage.currentParentObservationId);
      const cpiLagParentObservationId = stringOrNull(inflationCoverage.lagParentObservationId);
      const rateAvailabilityEventIds = uniqueStrings([
        stringOrNull(rateCoverage.selectedAvailabilityEventId),
        stringOrNull(rateCoverage.availabilityEventId),
      ]);
      const cpiAvailabilityEventIds = uniqueStrings([
        stringOrNull(inflationCoverage.selectedAvailabilityEventId),
        stringOrNull(inflationCoverage.availabilityEventId),
        stringOrNull(inflationCoverage.currentParentAvailabilityEventId),
        stringOrNull(inflationCoverage.lagParentAvailabilityEventId),
        ...stringArrayFromUnknown(inflationCoverage.parentAvailabilityEventIds),
      ]);
      const parentAvailabilityEventIds = uniqueStrings([
        ...rateAvailabilityEventIds,
        ...cpiAvailabilityEventIds,
      ]);
      const rateRawArtifactIds = uniqueStrings([
        stringOrNull(rateCoverage.selectedRawArtifactId),
        stringOrNull(rateCoverage.rawArtifactId),
        ...stringArrayFromUnknown(rateCoverage.selectedRawArtifactIds),
        ...stringArrayFromUnknown(rateCoverage.rawArtifactIds),
      ]);
      const cpiRawArtifactIds = uniqueStrings([
        stringOrNull(inflationCoverage.selectedRawArtifactId),
        stringOrNull(inflationCoverage.rawArtifactId),
        ...stringArrayFromUnknown(inflationCoverage.selectedRawArtifactIds),
        ...stringArrayFromUnknown(inflationCoverage.rawArtifactIds),
      ]);
      const parentRawArtifactIds = uniqueStrings([...rateRawArtifactIds, ...cpiRawArtifactIds]);
      const parentRawObservationIds = uniqueStrings([
        rateObservationId,
        cpiObservationId,
        cpiCurrentParentObservationId,
        cpiLagParentObservationId,
        ...stringArrayFromUnknown(inflationCoverage.parentRawObservationIds),
      ]);
      const parentSnapshotsSealed =
        rateSnapshot?.snapshotState === "SEALED" &&
        inflationSnapshot?.snapshotState === "SEALED";
      const sharedMacroWeekId = macroWeekIdFor(weekOpenUtc);
      const parentWeeklySelectionIdentity = {
        weekOpenUtc,
        macroWeekId: sharedMacroWeekId,
        freezeTargetUtc: freezeMetadata.freezeTargetUtc,
        freezeVersion: MACRO_WEEKLY_SIGNAL_FREEZE_VERSION,
        calendarVersion: MACRO_CALENDAR_VERSION,
        selectorVersion: MACRO_WEEKLY_SELECTOR_VERSION,
        rateParentMacroWeekId: rateSnapshot?.macroWeekId ?? null,
        rateParentFreezeVersion: rateSnapshot?.freezeVersion ?? null,
        rateParentFreezeTargetUtc: rateSnapshot?.asOfUtc ?? null,
        rateParentCalendarVersion: stringOrNull(rateCoverage.calendarVersion),
        rateParentSelectorVersion: options.rateParent?.selectorVersion ?? null,
        rateParentSelectionRuleVersion: stringOrNull(rateCoverage.selectionRuleVersion),
        cpiParentMacroWeekId: inflationSnapshot?.macroWeekId ?? null,
        cpiParentFreezeVersion: inflationSnapshot?.freezeVersion ?? null,
        cpiParentFreezeTargetUtc: inflationSnapshot?.asOfUtc ?? null,
        cpiParentCalendarVersion: stringOrNull(inflationCoverage.calendarVersion),
        cpiParentSelectorVersion: options.cpiParent?.selectorVersion ?? null,
        cpiParentSelectionRuleVersion: stringOrNull(inflationCoverage.selectionRuleVersion),
      };
      const parentWeeklySelectionIdentityComplete =
        parentWeeklySelectionIdentity.rateParentMacroWeekId === sharedMacroWeekId &&
        parentWeeklySelectionIdentity.cpiParentMacroWeekId === sharedMacroWeekId &&
        parentWeeklySelectionIdentity.rateParentFreezeVersion === MACRO_WEEKLY_SIGNAL_FREEZE_VERSION &&
        parentWeeklySelectionIdentity.cpiParentFreezeVersion === MACRO_WEEKLY_SIGNAL_FREEZE_VERSION &&
        parentWeeklySelectionIdentity.rateParentFreezeTargetUtc === freezeMetadata.freezeTargetUtc &&
        parentWeeklySelectionIdentity.cpiParentFreezeTargetUtc === freezeMetadata.freezeTargetUtc &&
        parentWeeklySelectionIdentity.rateParentCalendarVersion === MACRO_CALENDAR_VERSION &&
        parentWeeklySelectionIdentity.cpiParentCalendarVersion === MACRO_CALENDAR_VERSION &&
        Boolean(parentWeeklySelectionIdentity.rateParentSelectorVersion) &&
        Boolean(parentWeeklySelectionIdentity.cpiParentSelectorVersion);
      const parentSnapshotLineageComplete = Boolean(
        rateSnapshot?.snapshotId &&
        rateSnapshot?.snapshotHash &&
        inflationSnapshot?.snapshotId &&
        inflationSnapshot?.snapshotHash,
      );
      const parentObservationLineageComplete = Boolean(
        rateObservationId &&
        cpiObservationId &&
        cpiCurrentParentObservationId &&
        cpiLagParentObservationId,
      );
      const parentAvailabilityLineageComplete =
        rateAvailabilityEventIds.length > 0 &&
        cpiAvailabilityEventIds.includes(cpiCurrentParentObservationId ? stringOrNull(inflationCoverage.currentParentAvailabilityEventId) ?? "" : "__missing__") &&
        cpiAvailabilityEventIds.includes(cpiLagParentObservationId ? stringOrNull(inflationCoverage.lagParentAvailabilityEventId) ?? "" : "__missing__");
      const parentArtifactLineageComplete = rateRawArtifactIds.length > 0 && cpiRawArtifactIds.length > 0;
      const strictLineageComplete = strictParentLineage
        ? parentSnapshotsSealed &&
          parentWeeklySelectionIdentityComplete &&
          parentSnapshotLineageComplete &&
          parentObservationLineageComplete &&
          parentAvailabilityLineageComplete &&
          parentArtifactLineageComplete
        : true;
      const valueAvailable = rateAvailable && inflationAvailable && !isStale && strictLineageComplete;
      const missingReasons = [
        !source.rateSourceId ? "missing_real_rate_pressure_rate_source_contract" : null,
        !source.inflationSourceId ? "missing_real_rate_pressure_inflation_source_contract" : null,
        rateSnapshot ? null : "missing_parent_rate_snapshot",
        inflationSnapshot ? null : "missing_parent_cpi_snapshot",
        rateAvailable ? null : "missing_nominal_rate_snapshot",
        inflationAvailable ? null : "missing_inflation_snapshot",
        rateStale ? "stale_parent_rate_snapshot" : null,
        inflationStale ? "stale_parent_cpi_snapshot" : null,
        strictParentLineage && !parentSnapshotsSealed ? "non_sealed_parent_snapshot" : null,
        strictParentLineage && !parentWeeklySelectionIdentityComplete ? "lineage_missing_or_mismatched_parent_weekly_selection_identity" : null,
        strictParentLineage && !parentSnapshotLineageComplete ? "lineage_missing_parent_snapshot_id_or_hash" : null,
        strictParentLineage && !parentObservationLineageComplete ? "lineage_missing_parent_observation_id" : null,
        strictParentLineage && !parentAvailabilityLineageComplete ? "lineage_missing_parent_availability_event_id" : null,
        strictParentLineage && !parentArtifactLineageComplete ? "lineage_missing_parent_artifact_id" : null,
      ].filter((reason): reason is string => Boolean(reason));
      const realRatePercent = nominalRatePercent !== null && inflationYoYPercent !== null
        ? nominalRatePercent - inflationYoYPercent
        : null;
      const currentCpiParent = asJsonRecord(inflationCoverage.currentCpiParent);
      const lagCpiParent = asJsonRecord(inflationCoverage.lagCpiParent);
      const latestAvailableAt = latestIso([
        rateSnapshot?.availableAtUtc,
        inflationSnapshot?.availableAtUtc,
        stringOrNull(currentCpiParent.availableAtUtc),
        stringOrNull(lagCpiParent.availableAtUtc),
      ]);
      const latestEffectiveAt = latestIso([rateSnapshot?.effectiveAtUtc, inflationSnapshot?.effectiveAtUtc]);
      const latestObservationDate = latestIso([
        rateSnapshot?.sourceObservationDate,
        inflationSnapshot?.sourceObservationDate,
        stringOrNull(lagCpiParent.observationDate),
      ]);
      const parentDatasetRefs = [
        options.rateParent
          ? {
            role: "rate",
            datasetId: options.rateParent.regimeDatasetId,
            datasetHash: options.rateParent.datasetHash,
            datasetVersion: options.rateParent.datasetVersion,
            promotionManifestId: options.rateParent.promotionManifestId,
            contractManifestHash: options.rateParent.contractManifestHash,
            familyManifestId: options.rateParent.familyManifestId,
            familyManifestHash: options.rateParent.familyManifestHash,
          }
          : null,
        options.cpiParent
          ? {
            role: "cpi",
            datasetId: options.cpiParent.regimeDatasetId,
            datasetHash: options.cpiParent.datasetHash,
            datasetVersion: options.cpiParent.datasetVersion,
            promotionManifestId: options.cpiParent.promotionManifestId,
            contractManifestHash: options.cpiParent.contractManifestHash,
            familyManifestId: options.cpiParent.familyManifestId,
            familyManifestHash: options.cpiParent.familyManifestHash,
          }
          : null,
      ].filter((value): value is NonNullable<typeof value> => value !== null);
      const currencyBundleSelectionHash = hashJson({
        manifestId: RRP_CURRENCY_BUNDLE_MANIFEST_ID,
        currency: source.currency,
        formulaVersion: RRP_FORMULA_VERSION,
        compositionRuleVersion: RRP_COMPOSITION_RULE_VERSION,
        parentDatasetRefs,
        rateSnapshotId: rateSnapshot?.snapshotId ?? null,
        rateSnapshotHash: rateSnapshot?.snapshotHash ?? null,
        cpiSnapshotId: inflationSnapshot?.snapshotId ?? null,
        cpiSnapshotHash: inflationSnapshot?.snapshotHash ?? null,
        parentWeeklySelectionIdentity,
        parentRawObservationIds,
        parentAvailabilityEventIds,
        parentRawArtifactIds,
      });
      const currencyBundleId = `${RRP_CURRENCY_BUNDLE_MANIFEST_ID}:${source.currency}`;

      derivedSnapshots.push({
        weekOpenUtc,
        sourceFamily: "real_rate_pressure",
        sourceId: source.sourceId,
        currency: source.currency,
        instrument: source.instrument,
        asOfUtc: freezeMetadata.freezeTargetUtc,
        sourceObservationDate: latestObservationDate,
        effectiveAtUtc: latestEffectiveAt,
        availableAtUtc: latestAvailableAt,
        rawValue: {
          nominalRate: rateSnapshot
            ? {
                parentDatasetId: options.rateParent?.regimeDatasetId ?? null,
                parentDatasetHash: options.rateParent?.datasetHash ?? null,
                parentFamilyManifestId: options.rateParent?.familyManifestId ?? null,
                parentFamilyManifestHash: options.rateParent?.familyManifestHash ?? null,
                snapshotId: rateSnapshot.snapshotId ?? null,
                snapshotHash: rateSnapshot.snapshotHash ?? null,
                snapshotState: rateSnapshot.snapshotState ?? null,
                macroWeekId: rateSnapshot.macroWeekId ?? null,
                freezeVersion: rateSnapshot.freezeVersion ?? null,
                freezeTargetUtc: rateSnapshot.asOfUtc,
                calendarVersion: rateCoverage.calendarVersion ?? null,
                selectorVersion: rateCoverage.selectionRuleVersion ?? null,
                sourceId: rateSnapshot.sourceId,
                observationDate: rateSnapshot.sourceObservationDate,
                availableAtUtc: rateSnapshot.availableAtUtc,
                selectedRawObservationId: rateObservationId,
                selectedAvailabilityEventIds: rateAvailabilityEventIds,
                selectedRawArtifactIds: rateRawArtifactIds,
                rawValue: rateSnapshot.rawValue,
                normalizedValue: rateSnapshot.normalizedValue,
              }
            : null,
          inflation: inflationSnapshot
            ? {
                parentDatasetId: options.cpiParent?.regimeDatasetId ?? null,
                parentDatasetHash: options.cpiParent?.datasetHash ?? null,
                parentFamilyManifestId: options.cpiParent?.familyManifestId ?? null,
                parentFamilyManifestHash: options.cpiParent?.familyManifestHash ?? null,
                snapshotId: inflationSnapshot.snapshotId ?? null,
                snapshotHash: inflationSnapshot.snapshotHash ?? null,
                snapshotState: inflationSnapshot.snapshotState ?? null,
                macroWeekId: inflationSnapshot.macroWeekId ?? null,
                freezeVersion: inflationSnapshot.freezeVersion ?? null,
                freezeTargetUtc: inflationSnapshot.asOfUtc,
                calendarVersion: inflationCoverage.calendarVersion ?? null,
                selectorVersion: inflationCoverage.selectionRuleVersion ?? null,
                sourceId: inflationSnapshot.sourceId,
                observationDate: inflationSnapshot.sourceObservationDate,
                availableAtUtc: inflationSnapshot.availableAtUtc,
                selectedRawObservationId: cpiObservationId,
                currentParentObservationId: cpiCurrentParentObservationId,
                lagParentObservationId: cpiLagParentObservationId,
                selectedAvailabilityEventIds: cpiAvailabilityEventIds,
                selectedRawArtifactIds: cpiRawArtifactIds,
                currentCpiParent,
                lagCpiParent,
                rawValue: inflationSnapshot.rawValue,
                normalizedValue: inflationSnapshot.normalizedValue,
              }
            : null,
          parentDatasets: parentDatasetRefs,
          currencyBundleId,
          currencyBundleHash: currencyBundleSelectionHash,
          currencyBundleSelectionHash,
        },
        normalizedValue: valueAvailable
          ? {
              realRatePercent,
              realRateDecimal: realRatePercent === null ? null : realRatePercent / 100,
              nominalRatePercent,
              inflationYoYPercent,
              rateSourceId: source.rateSourceId,
              inflationSourceId: source.inflationSourceId,
            }
          : {},
        coverage: {
          ...freezeMetadata,
          valueAvailable,
          isStale,
          rateStale,
          inflationStale,
          rateValueAvailable: rateAvailable,
          inflationValueAvailable: inflationAvailable,
          strictParentLineage,
          parentSnapshotsSealed,
          parentSnapshotLineageComplete,
          parentWeeklySelectionIdentityComplete,
          parentObservationLineageComplete,
          parentAvailabilityLineageComplete,
          parentArtifactLineageComplete,
          rateSourceId: source.rateSourceId,
          inflationSourceId: source.inflationSourceId,
          rateParentDatasetId: options.rateParent?.regimeDatasetId ?? null,
          rateParentDatasetHash: options.rateParent?.datasetHash ?? null,
          rateParentPromotionManifestId: options.rateParent?.promotionManifestId ?? null,
          rateParentContractManifestHash: options.rateParent?.contractManifestHash ?? null,
          rateParentCalendarVersion: options.rateParent?.calendarVersion ?? null,
          rateParentSelectorVersion: options.rateParent?.selectorVersion ?? null,
          rateFamilyManifestId: options.rateParent?.familyManifestId ?? RATE_FAMILY_MANIFEST_ID,
          rateFamilyManifestHash: options.rateParent?.familyManifestHash ?? RATE_FAMILY_MANIFEST_HASH,
          cpiParentDatasetId: options.cpiParent?.regimeDatasetId ?? null,
          cpiParentDatasetHash: options.cpiParent?.datasetHash ?? null,
          cpiParentPromotionManifestId: options.cpiParent?.promotionManifestId ?? null,
          cpiParentContractManifestHash: options.cpiParent?.contractManifestHash ?? null,
          cpiParentCalendarVersion: options.cpiParent?.calendarVersion ?? null,
          cpiParentSelectorVersion: options.cpiParent?.selectorVersion ?? null,
          cpiFamilyManifestId: options.cpiParent?.familyManifestId ?? CPI_FAMILY_MANIFEST_ID,
          cpiFamilyManifestHash: options.cpiParent?.familyManifestHash ?? CPI_FAMILY_MANIFEST_HASH,
          parentDatasets: parentDatasetRefs,
          parentSourceIds: [source.rateSourceId, source.inflationSourceId].filter(Boolean),
          parentRawObservationIds,
          parentAvailabilityEventIds,
          parentRawArtifactIds,
          rateParentSnapshotId: rateSnapshot?.snapshotId ?? null,
          rateParentSnapshotHash: rateSnapshot?.snapshotHash ?? null,
          rateParentMacroWeekId: rateSnapshot?.macroWeekId ?? null,
          rateParentFreezeVersion: rateSnapshot?.freezeVersion ?? null,
          rateParentFreezeTargetUtc: rateSnapshot?.asOfUtc ?? null,
          cpiParentSnapshotId: inflationSnapshot?.snapshotId ?? null,
          cpiParentSnapshotHash: inflationSnapshot?.snapshotHash ?? null,
          cpiParentMacroWeekId: inflationSnapshot?.macroWeekId ?? null,
          cpiParentFreezeVersion: inflationSnapshot?.freezeVersion ?? null,
          cpiParentFreezeTargetUtc: inflationSnapshot?.asOfUtc ?? null,
          parentWeeklySelectionIdentity,
          sharedMacroWeekId,
          sharedFreezeTargetUtc: freezeMetadata.freezeTargetUtc,
          sharedCalendarVersion: MACRO_CALENDAR_VERSION,
          sharedSelectorVersion: MACRO_WEEKLY_SELECTOR_VERSION,
          currentCpiParent,
          lagCpiParent,
          currentParentObservationId: cpiCurrentParentObservationId,
          lagParentObservationId: cpiLagParentObservationId,
          selectedRawObservationId: null,
          selectedVintageDate: null,
          selectedRawArtifactId: null,
          selectedRawArtifactIds: parentRawArtifactIds,
          selectedAvailabilityEventId: null,
          missingReasons,
          formulaVersion: RRP_FORMULA_VERSION,
          cpiYoyFormulaVersion: CPI_YOY_FORMULA_VERSION,
          compositionRuleVersion: RRP_COMPOSITION_RULE_VERSION,
          parentEligibilityRuleVersion: RRP_PARENT_ELIGIBILITY_RULE_VERSION,
          derivedEligibilityAtUtc: latestAvailableAt,
          currencyBundleManifestId: RRP_CURRENCY_BUNDLE_MANIFEST_ID,
          currencyBundleId,
          currencyBundleHash: currencyBundleSelectionHash,
          currencyBundleSelectionHash,
          featureBundleManifestId: RRP_FEATURE_BUNDLE_MANIFEST_ID,
          requiredParentFamilySet: [RATE_FAMILY_MANIFEST_ID, CPI_FAMILY_MANIFEST_ID],
          derivation: "nominal_3m_interbank_rate_percent_minus_cpi_yoy_percent",
          failClosedOnParentMissingStaleRevokedOrLineageIncomplete: true,
          trustedForFreeze: valueAvailable && !isStale,
        },
        flags: {
          noRegimeInterpretation: true,
          weeklySignalFreeze: true,
          derivedMetric: true,
          diagnosticOnly: true,
          sourceGroup: source.sourceGroup,
          sourceUrl: source.sourceUrl,
          cadence: source.cadence,
          staleByCadence: isStale,
          formulaVersion: RRP_FORMULA_VERSION,
          compositionRuleVersion: RRP_COMPOSITION_RULE_VERSION,
          currencyBundleId,
          currencyBundleHash: currencyBundleSelectionHash,
          currencyBundleSelectionHash,
        },
      });
    }
  }

  return derivedSnapshots;
}

export function applyRealRatePressureCurrencyBundleHashes(options: {
  weeks: string[];
  snapshots: MacroWeeklyCurrencySnapshot[];
  parentDatasetRefs: Array<Record<string, unknown>>;
}) {
  const currencyBundleHashes = Object.fromEntries(FX_CURRENCIES.map((currency) => {
    const rows = options.snapshots
      .filter((row) => row.currency === currency)
      .sort((left, right) => left.weekOpenUtc.localeCompare(right.weekOpenUtc));
    const bundleHash = hashJson({
      manifestId: RRP_CURRENCY_BUNDLE_MANIFEST_ID,
      currency,
      formulaVersion: RRP_FORMULA_VERSION,
      compositionRuleVersion: RRP_COMPOSITION_RULE_VERSION,
      parentDatasetRefs: options.parentDatasetRefs,
      weeklySelections: rows.map((row) => ({
        weekOpenUtc: row.weekOpenUtc,
        selectionHash: stringOrNull(row.coverage.currencyBundleSelectionHash),
        rateParentSnapshotId: stringOrNull(row.coverage.rateParentSnapshotId),
        rateParentSnapshotHash: stringOrNull(row.coverage.rateParentSnapshotHash),
        cpiParentSnapshotId: stringOrNull(row.coverage.cpiParentSnapshotId),
        cpiParentSnapshotHash: stringOrNull(row.coverage.cpiParentSnapshotHash),
        parentRawObservationIds: stringArrayFromUnknown(row.coverage.parentRawObservationIds),
        parentAvailabilityEventIds: stringArrayFromUnknown(row.coverage.parentAvailabilityEventIds),
        parentRawArtifactIds: stringArrayFromUnknown(row.coverage.parentRawArtifactIds),
        valueAvailable: row.coverage.valueAvailable === true,
        isStale: row.coverage.isStale === true,
      })),
    });
    const complete = rows.length === options.weeks.length &&
      rows.every((row) => row.coverage.valueAvailable === true && row.coverage.isStale !== true);
    for (const row of rows) {
      row.rawValue = {
        ...row.rawValue,
        currencyBundleHash: bundleHash,
        currencyBundleStatus: complete ? "COMPLETE_SEALED_DIAGNOSTIC" : "INCOMPLETE_FAIL_CLOSED",
      };
      row.coverage = {
        ...row.coverage,
        currencyBundleHash: bundleHash,
        currencyBundleStatus: complete ? "COMPLETE_SEALED_DIAGNOSTIC" : "INCOMPLETE_FAIL_CLOSED",
        currencyBundleWeeklyRows: rows.length,
      };
      row.flags = {
        ...row.flags,
        currencyBundleHash: bundleHash,
        currencyBundleStatus: complete ? "COMPLETE_SEALED_DIAGNOSTIC" : "INCOMPLETE_FAIL_CLOSED",
      };
    }
    return [currency, bundleHash];
  }));
  return currencyBundleHashes;
}

function sourceVersionPayload(
  options: CliOptions,
  manifest?: {
    contractManifestHash: string;
    promotionManifestId: string;
  },
) {
  const rateSources = selectedRateSources(options);
  return {
    promotionManifest: manifest
      ? {
        version: MACRO_PROMOTION_MANIFEST_VERSION,
        promotionManifestId: manifest.promotionManifestId,
        contractManifestHash: manifest.contractManifestHash,
        commitsTo: [
          "source registry version",
          "source-map version",
          "semantic contracts",
          "endpoint ids",
          "retrieval capabilities",
          "availability precision and eligibility rules",
          "exception and eligibility calendars",
          "parser and normalization versions",
          "CPI YoY formula version",
          "real-rate-pressure formula version",
          "staleness rules",
          "freeze calendar and freeze version",
          "selector version",
          "validation contract",
          "promotion-state allowlist",
        ],
      }
      : null,
    sourceRegistry: {
      version: MACRO_SOURCE_CONTRACT_VERSION,
      contractLayers: [
        "economic_authority",
        "compiler_or_harmonizer",
        "dissemination_endpoint",
        "immutable_evidence_artifact",
        "weekly_freeze_snapshot",
      ],
      entries: buildSourceRegistry(options),
      invalidExceptionTriggers: [
        "using a national endpoint only because it publishes a few hours earlier than the contracted endpoint",
        "using a proxy frequency that cannot be reconstructed across the seven-year test",
        "using credential availability as a reason to switch endpoints",
        "letting market volatility alter the source endpoint for a live week",
      ],
      validExceptionTriggers: [
        "contracted endpoint cannot provide promotion-grade continuity for the feature",
        "national authority provides the only release-specific historical table needed for point-in-time reconstruction",
        "a future rebasing or table migration is explicitly versioned and retested",
      ],
    },
    fourClockModel: {
      version: MACRO_SETTLEMENT_ACTIVATION_VERSION,
      requiredOrdering:
        "freeze_target_utc <= settlement_deadline_utc; settlement_completed_at_utc <= settlement_deadline_utc; sealed_at_utc <= settlement_deadline_utc; sealed_at_utc <= verified_at_utc <= activated_at_utc <= effective_from_utc",
      clocks: {
        freezeTargetUtc: "latest public information eligible for the weekly snapshot",
        settlementDeadlineUtc: "last time Limni may finish local acquisition and validation for live use",
        settlementCompletedAtUtc: "time local acquisition and validation completed",
        sealedAtUtc: "time the weekly snapshot payload was sealed and hashed",
        verifiedAtUtc: "time the completed snapshot passes integrity and coverage checks",
        activatedAtUtc: "time a verified snapshot becomes the active executable weekly truth",
        effectiveFromUtc: "earliest time execution may consume the snapshot",
      },
      historicalMode:
        "historical promotion depends on point-in-time endpoint evidence and archived artifacts; historical fetched_at_utc is not required to be before the historical settlement deadline",
      liveMode:
        "live activation additionally requires local acquisition, validation, verification, and activation before effective_from_utc",
    },
    snapshotActivation: {
      version: MACRO_SETTLEMENT_ACTIVATION_VERSION,
      states: ["BUILDING", "VALIDATED", "SEALED", "VERIFIED", "ACTIVE", "REVOKED", "QUARANTINED"],
      failureStates: ["REJECTED", "SETTLEMENT_FAILED", "VERIFICATION_FAILED"],
      executableKey: [
        "promotion_manifest_id",
        "macro_week_id",
        "freeze_version",
        "snapshot_id",
        "snapshot_hash",
        "snapshot_state=ACTIVE",
        "effective_from_utc <= execution_time",
        "execution_time < effective_to_utc when effective_to_utc is present",
      ],
      activeSnapshotUniqueness:
        "exactly one ACTIVE aggregate weekly snapshot manifest may exist for each (promotion_manifest_id, macro_week_id, freeze_version)",
      executionRequirement:
        "execution must read an ACTIVE aggregate weekly snapshot manifest; SEALED row-level source snapshots are evidence only",
      correctionPolicy:
        "before effective_from_utc a candidate may be superseded; after effective_from_utc changed values cannot replace the trading truth for that macro week, and material defects revoke or quarantine the snapshot so execution fails closed until the next eligible weekly snapshot",
      noCarryForwardFallback:
        "execution must not reuse a prior week's sealed or active snapshot when the current macro week fails settlement, verification, activation, or hash checks",
      stateTransitionLedger:
        "research_macro_snapshot_state_transitions records from_state, to_state, transitioned_at_utc, transition_run_id, reason, and actor_or_service_version",
      executionReceiptContract:
        "research_macro_execution_receipts records execution_run_id, decision_at_utc, macro_week_id, promotion_manifest_id, snapshot_id, snapshot_hash, snapshot_state_observed, and snapshot_read_at_utc",
    },
    endpointAvailabilityDimensions: {
      retrievalCapabilities: {
        as_of_queryable:
          "endpoint can reconstruct historical state as of a requested date or vintage; post-freeze acquisition may be allowed only under that source contract",
        release_event_filterable:
          "trusted release events permit exclusion of post-freeze additions",
        capture_before_freeze_required:
          "endpoint has no reliable as-of mechanism; live artifact must be captured by the freeze/settlement contract before use",
        derived:
          "derived feature inherits retrieval and availability constraints from all parent observations",
      },
      availabilityPrecisions: {
        exact_timestamp: "trusted timestamp with intraday precision",
        date: "date-only vintage or release precision; equality with the freeze boundary is not sufficient",
        scheduled_window: "scheduled publication window that remains subject to exception-calendar checks",
        inferred: "modeled or current-only availability; promotion-blocked unless captured before freeze",
        inherited: "derived feature inherits parent availability precision",
      },
      eligibilityPolicies: {
        eligible_at_or_before_freeze:
          "source row is eligible when the trusted endpoint availability timestamp/window is at or before the freeze target",
        first_freeze_strictly_after_date:
          "date-only availability first becomes eligible at the next canonical weekly freeze after that date",
        capture_must_precede_freeze:
          "artifact acquisition must precede the freeze target; post-freeze acquisition is not promotion-safe",
        inherit_from_parents:
          "derived row uses the maximum parent availability and parent eligibility constraints",
      },
    },
    weeklySignalFreeze: {
      enabled: true,
      version: MACRO_WEEKLY_SIGNAL_FREEZE_VERSION,
      weekSource: options.weekSource,
      matrixControlDatasetId: options.weekSource === "matrix-control" ? GATE44_MATRIX_CONTROL_DATASET_ID : null,
      matrixControlDatasetHash: options.weekSource === "matrix-control" ? GATE44_MATRIX_CONTROL_DATASET_HASH : null,
      sourceContractVersion: MACRO_SOURCE_CONTRACT_VERSION,
      calendarVersion: MACRO_CALENDAR_VERSION,
      selectorVersion: MACRO_WEEKLY_SELECTOR_VERSION,
      availabilityRuleVersion: MACRO_AVAILABILITY_RULE_VERSION,
      cadence: MACRO_WEEKLY_SIGNAL_FREEZE_CADENCE,
      freezeTarget: MACRO_WEEKLY_SIGNAL_FREEZE_CUTOFF_FIELD,
      sourceEligibility: "available_at_utc <= freeze_target_utc",
      rule: MACRO_WEEKLY_SIGNAL_FREEZE_RULE,
      availabilityRolloverRule: DATE_ONLY_AVAILABILITY_ROLLOVER_RULE,
      reconstructionMode: MACRO_RECONSTRUCTION_MODE,
      promotionReadiness: MACRO_PROMOTION_READINESS,
      promotedBacktestPolicy:
        "first seven-year macro test uses weekly frozen inputs; midweek source releases are stored as raw observations but cannot change an already-frozen week",
      liveSettlementPolicy:
        "weekly snapshot must be built, sealed, reported, and verified before 20:00 America/New_York execution; live execution fails closed otherwise",
    },
    sourceHardening: {
      allowExploratorySourceFallback: options.allowExploratorySourceFallback,
      fredPointInTimeMode:
        `rates use FRED/ALFRED series observations output_type=${FRED_REALTIME_PERIOD_OUTPUT_TYPE} real-time periods; official CPI no longer uses FRED/OECD except as shadow validation outside this fill`,
      eStatJpyCpiMode:
        "Statistics Bureau/e-Stat Table 1-1 all-items is required for JPY CPI continuity; Table 4-1 all-items is validation-only and never runtime fallback under this contract",
      credentialsExcludedFromHashes: ["FRED_API_KEY", "ALFRED_API_KEY", "ESTAT_APP_ID"],
    },
    bpr: {
      enabled: options.includeBpr,
      reportTypes: options.reportTypes,
      sourceIds: options.reportTypes.map((reportType) => BPR_SOURCE_IDS[reportType]),
      indexUrl: CFTC_BPR_INDEX_URL,
      explanatoryNotesUrl: CFTC_BPR_EXPLANATORY_URL,
      cadence: "monthly first Friday after 15:30 Eastern, using first Tuesday data unless the first Tuesday is a federal holiday",
      availabilityTimestampMode: "computed_from_report_date_friday_1530_new_york",
      exceptionPolicy: "holiday, shutdown, or delayed-report exceptions must override the normal schedule before promotion",
      fetchModes: ["cftc_live", "internal_replay_of_archived_canonical_cftc_artifact"],
      historicalUrlAliases: ["2019 deajfeb/deajmar futures", "older June/July full-month route aliases"],
      maxStaleDays: BPR_MAX_STALE_DAYS,
    },
    rates: {
      enabled: options.includeRates,
      sourceIds: rateSources.map((source) => source.sourceId),
      groups: [...new Set(rateSources.map((source) => source.sourceGroup))].sort(),
      availabilityTimestampMode: "fred_alfred_real_time_period_as_of_weekly_freeze",
      selectionRuleVersion: RATE_SELECTION_RULE_VERSION,
      stalenessRuleVersion: RATE_STALENESS_RULE_VERSION,
      releaseAwareCarryRule: RATE_RELEASE_AWARE_CARRY_RULE,
      promotionRequirement:
        "diagnostic SEALED rate snapshots must prove latest eligible vintage selection, strict date-only vintage eligibility, release-aware carries, and no fixed-age stale rows before activation",
      sources: rateSources.map((source) => ({
        currency: source.currency,
        sourceId: source.sourceId,
        seriesId: source.seriesId,
        instrument: source.instrument,
        label: source.label,
        sourceGroup: source.sourceGroup,
        frequency: source.frequency,
        maxStaleDays: source.maxStaleDays,
        cadence: source.cadence,
        sourceUrl: source.sourceUrl,
      })),
    },
    inflation: {
      enabled: options.includeInflation,
      familyManifestId: CPI_FAMILY_MANIFEST_ID,
      sourceMapVersion: CPI_OFFICIAL_SOURCE_MAP_VERSION,
      observationSchemaVersion: CPI_OBSERVATION_SCHEMA_VERSION,
      formulaVersion: CPI_YOY_FORMULA_VERSION,
      sourceIds: INFLATION_SOURCES.map((source) => source.sourceId),
      groups: [...new Set(INFLATION_SOURCES.map((source) => source.sourceGroup))].sort(),
      availabilityTimestampMode: "official_release_aware_current_vintage_parent_set",
      selectionRuleVersion: CPI_SELECTION_RULE_VERSION,
      stalenessRuleVersion: CPI_STALENESS_RULE_VERSION,
      releaseAwareCarryRule: CPI_RELEASE_AWARE_CARRY_RULE,
      promotionRequirement:
        "diagnostic SEALED CPI snapshots must prove selected current and lag CPI parents, official artifacts, release eligibility, and no stale/missing rows before RRP composition",
      derivation: "cpi_index_same_native_frequency_period_prior_year",
      sources: INFLATION_SOURCES.map((source) => ({
        currency: source.currency,
        sourceId: source.sourceId,
        seriesId: source.seriesId,
        instrument: source.instrument,
        label: source.label,
        sourceGroup: source.sourceGroup,
        frequency: source.frequency,
        lagPeriods: source.lagPeriods,
        sourceContractHash: cpiSourceContractHash(source),
        branchSemanticHash: cpiBranchSemanticHash(source),
        continuityDecisionId: officialCpiMetadata(source).continuityDecisionId,
        releaseCalendarVersion: officialCpiMetadata(source).releaseCalendarVersion,
        revisionRebasingVersion: officialCpiMetadata(source).revisionRebasingVersion,
        parserVersion: officialCpiMetadata(source).parserVersion,
        maxStaleDays: null,
        availabilityDelayDays: null,
        cadence: source.cadence,
        sourceUrl: source.sourceUrl,
        notes: source.notes ?? null,
      })),
    },
    valuation: {
      enabled: options.includeValuation,
      featureVersions: {
        oecdTable4: OECD_VALUATION_FEATURE_VERSION,
        bisEer: BIS_VALUATION_FEATURE_VERSION,
      },
      sourceIds: [...new Set(VALUATION_SOURCES.map((source) => source.sourceId))].sort(),
      groups: [...new Set(VALUATION_SOURCES.map((source) => source.sourceGroup))].sort(),
      availabilityTimestampModes: {
        oecdTable4: `oecd_table4_calendar_year_end_plus_${OECD_VALUATION_AVAILABILITY_DELAY_DAYS}_days_utc_approx`,
        bisEer: `bis_eer_month_end_plus_${BIS_VALUATION_AVAILABILITY_DELAY_DAYS}_days_utc_approx`,
      },
      sourceAudit: {
        bisEffectiveExchangeRates:
          "BIS monthly broad REER/NEER ingestion uses the official BIS v2 SDMX API and requires Accept-Language: en.",
        oecdMonthlyComparativePriceLevels:
          "OECD monthly CPL was current-period only in the audited API pull and is shadow-only for seven-year parity.",
        oecdAnnualPppTable4:
          "OECD annual Table 4 PPP and exchange-rate rows cover all eight FX currencies for the seven-year window with annual cadence.",
      },
      sources: VALUATION_SOURCES.map((source) => ({
        provider: source.provider,
        currency: source.currency,
        sourceId: source.sourceId,
        refArea: source.refArea,
        transaction: source.provider === "oecd_table4" ? source.transaction : null,
        seriesKey: source.provider === "bis_eer" ? source.seriesKey : null,
        eerType: source.provider === "bis_eer" ? source.eerType : null,
        eerBasket: source.provider === "bis_eer" ? source.eerBasket : null,
        instrument: source.instrument,
        label: source.label,
        sourceGroup: source.sourceGroup,
        frequency: source.frequency,
        maxStaleDays: source.maxStaleDays,
        availabilityDelayDays: source.availabilityDelayDays,
        cadence: source.cadence,
        sourceUrl: source.sourceUrl,
        notes: source.notes ?? null,
      })),
    },
    realRatePressure: {
      enabled: options.includeRealRatePressure,
      sourceId: REAL_RATE_PRESSURE_SOURCE_ID,
      instrument: REAL_RATE_PRESSURE_INSTRUMENT,
      derivation: "nominal_3m_interbank_rate_percent_minus_cpi_yoy_percent",
      sourceGroup: "derived_real_rate_3m_interbank_minus_cpi_yoy",
      sources: REAL_RATE_PRESSURE_SOURCES.map((source) => ({
        currency: source.currency,
        sourceId: source.sourceId,
        instrument: source.instrument,
        sourceGroup: source.sourceGroup,
        rateSourceId: source.rateSourceId,
        inflationSourceId: source.inflationSourceId,
        cadence: source.cadence,
        sourceUrl: source.sourceUrl,
      })),
    },
  };
}

function buildCoverageReport(options: {
  generatedAtUtc: string;
  cli: CliOptions;
  datasetHash: string;
  promotionManifestId: string;
  contractManifestHash: string;
  regimeDatasetId: string | null;
  weeks: string[];
  artifacts: MacroSourceArtifact[];
  availabilityEvents: MacroAvailabilityEvent[];
  observations: MacroSourceObservation[];
  weeklySnapshotManifests: MacroWeeklySnapshotManifest[];
  snapshots: MacroWeeklyCurrencySnapshot[];
  bprSummary: Awaited<ReturnType<typeof buildBprObservations>> | null;
  rateSummary: Awaited<ReturnType<typeof buildRateObservations>> | null;
  inflationSummary: Awaited<ReturnType<typeof buildInflationObservations>> | null;
  valuationSummary: Awaited<ReturnType<typeof buildValuationObservations>> | null;
  rrpCompositionSummary: RrpCompositionSummary | null;
  persistedCounts: CoverageReport["persistedCounts"];
}): CoverageReport {
  const realRatePressureSnapshots = options.snapshots.filter((row) => row.sourceFamily === "real_rate_pressure");
  const valuationSnapshots = options.snapshots.filter((row) => row.sourceFamily === "valuation");
  const bprObservations = options.observations.filter((row) => row.sourceFamily === "bpr");
  return {
    generatedAtUtc: options.generatedAtUtc,
    write: options.cli.write,
    datasetHash: options.datasetHash,
    promotionManifestId: options.promotionManifestId,
    contractManifestHash: options.contractManifestHash,
    regimeDatasetId: options.regimeDatasetId,
    range: {
      fromWeekOpenUtc: options.cli.fromWeekOpenUtc,
      toWeekOpenUtc: options.cli.toWeekOpenUtc,
      weeks: options.weeks.length,
    },
    currencies: FX_CURRENCIES,
    observations: {
      total: options.observations.length,
      bpr: options.observations.filter((row) => row.sourceFamily === "bpr").length,
      rate: options.observations.filter((row) => row.sourceFamily === "rate").length,
      inflation: options.observations.filter((row) => row.sourceFamily === "inflation").length,
      valuation: options.observations.filter((row) => row.sourceFamily === "valuation").length,
    },
    artifacts: {
      total: options.artifacts.length,
      endpoints: options.artifacts.reduce<Record<string, number>>((counts, artifact) => {
        counts[artifact.endpointId] = (counts[artifact.endpointId] ?? 0) + 1;
        return counts;
      }, {}),
      payloadBytes: options.artifacts.reduce((sum, artifact) => sum + artifact.rawPayloadSizeBytes, 0),
    },
    availabilityEvents: {
      total: options.availabilityEvents.length,
      precision: options.availabilityEvents.reduce<Record<string, number>>((counts, event) => {
        counts[event.availabilityPrecision] = (counts[event.availabilityPrecision] ?? 0) + 1;
        return counts;
      }, {}),
      retrievalCapabilities: options.availabilityEvents.reduce<Record<string, number>>((counts, event) => {
        const capability = String(event.retrievalCapability ?? "unspecified");
        counts[capability] = (counts[capability] ?? 0) + 1;
        return counts;
      }, {}),
      eligibilityPolicies: options.availabilityEvents.reduce<Record<string, number>>((counts, event) => {
        const policy = String(event.eligibilityPolicy ?? "unspecified");
        counts[policy] = (counts[policy] ?? 0) + 1;
        return counts;
      }, {}),
    },
    weeklySnapshots: {
      total: options.snapshots.length,
      manifests: options.weeklySnapshotManifests.length,
      bpr: options.snapshots.filter((row) => row.sourceFamily === "bpr").length,
      rate: options.snapshots.filter((row) => row.sourceFamily === "rate").length,
      inflation: options.snapshots.filter((row) => row.sourceFamily === "inflation").length,
      valuation: valuationSnapshots.length,
      realRatePressure: realRatePressureSnapshots.length,
      stale: options.snapshots.filter((row) => row.coverage.isStale === true).length,
      missing: options.snapshots.filter((row) => row.coverage.valueAvailable !== true).length,
      missingByCurrency: options.snapshots
        .filter((row) => row.coverage.valueAvailable !== true)
        .reduce<Record<string, number>>((counts, row) => {
          counts[row.currency] = (counts[row.currency] ?? 0) + 1;
          return counts;
        }, {}),
      missingBySourceId: options.snapshots
        .filter((row) => row.coverage.valueAvailable !== true)
        .reduce<Record<string, number>>((counts, row) => {
          counts[row.sourceId] = (counts[row.sourceId] ?? 0) + 1;
          return counts;
        }, {}),
    },
    bpr: {
      attemptedReports: options.bprSummary?.attemptedReports ?? 0,
      fetchedReports: options.bprSummary?.fetchedReports ?? 0,
      archiveFetchedReports: options.bprSummary?.archiveFetchedReports ?? 0,
      failedReports: options.bprSummary?.failedReports ?? 0,
      localFetchBlockedReports: options.bprSummary?.localFetchBlockedReports ?? 0,
      failedReportKeys: options.bprSummary?.failedReportKeys ?? [],
      reportTypes: options.cli.reportTypes,
      exceptionCalendarVersion: CFTC_BPR_EXCEPTION_CALENDAR_VERSION,
      availabilityModes: bprObservations.reduce<Record<string, number>>((counts, row) => {
        const mode = typeof row.flags.availableAtMode === "string" ? row.flags.availableAtMode : "unspecified";
        counts[mode] = (counts[mode] ?? 0) + 1;
        return counts;
      }, {}),
      exceptionOrDelayObservations: bprObservations.filter((row) =>
        row.flags.delayedReportException === true || row.coverage.exceptionOrDelayFlag === true).length,
      promotionBlockedUntilExactPublicationDateObservations: bprObservations.filter((row) =>
        row.flags.promotionBlockedUntilExactPublicationDate === true).length,
      availabilitySamples: bprObservations
        .filter((row) => row.instrument === "bpr_report_availability")
        .map((row) => ({
          reportType: typeof row.rawValue.reportType === "string" ? row.rawValue.reportType : null,
          year: typeof row.rawValue.year === "number" ? row.rawValue.year : null,
          month: typeof row.rawValue.month === "number" ? row.rawValue.month : null,
          reportDate: row.observationDate,
          availableAtUtc: row.availableAtUtc,
          availableAtMode: typeof row.flags.availableAtMode === "string" ? row.flags.availableAtMode : "unspecified",
          exceptionOrDelayFlag: row.flags.delayedReportException === true || row.coverage.exceptionOrDelayFlag === true,
          promotionBlockedUntilExactPublicationDate:
            row.flags.promotionBlockedUntilExactPublicationDate === true,
          releaseDateConfidence: typeof row.coverage.releaseDateConfidence === "string"
            ? row.coverage.releaseDateConfidence
            : null,
          releaseDateReason: typeof row.coverage.releaseDateReason === "string"
            ? row.coverage.releaseDateReason
            : null,
        })),
    },
    rates: {
      sources: options.rateSummary ? selectedRateSources(options.cli).length : 0,
      observations: options.rateSummary?.observations.length ?? 0,
      latestBySource: options.rateSummary?.latestBySource ?? {},
      selectionRuleVersion: RATE_SELECTION_RULE_VERSION,
      stalenessRuleVersion: RATE_STALENESS_RULE_VERSION,
      availabilityTimestampMode: "fred_alfred_real_time_period_as_of_weekly_freeze",
    },
    inflation: {
      sources: options.inflationSummary ? INFLATION_SOURCES.length : 0,
      observations: options.inflationSummary?.observations.length ?? 0,
      latestBySource: options.inflationSummary?.latestBySource ?? {},
    },
    valuation: {
      sources: options.valuationSummary ? VALUATION_SOURCES.length : 0,
      observations: options.valuationSummary?.observations.length ?? 0,
      latestBySource: options.valuationSummary?.latestBySource ?? {},
      weeklySnapshots: valuationSnapshots.length,
      available: valuationSnapshots.filter((row) => row.coverage.valueAvailable === true).length,
      stale: valuationSnapshots.filter((row) => row.coverage.isStale === true).length,
      missing: valuationSnapshots.filter((row) => row.coverage.valueAvailable !== true).length,
    },
    realRatePressure: {
      sources: options.cli.includeRealRatePressure ? REAL_RATE_PRESSURE_SOURCES.length : 0,
      weeklySnapshots: realRatePressureSnapshots.length,
      available: realRatePressureSnapshots.filter((row) => row.coverage.valueAvailable === true).length,
      stale: realRatePressureSnapshots.filter((row) => row.coverage.isStale === true).length,
      missing: realRatePressureSnapshots.filter((row) => row.coverage.valueAvailable !== true).length,
      composition: options.rrpCompositionSummary
        ? {
          datasetVersion: RRP_COMPOSED_DATASET_VERSION,
          formulaVersion: RRP_FORMULA_VERSION,
          compositionRuleVersion: RRP_COMPOSITION_RULE_VERSION,
          parentEligibilityRuleVersion: RRP_PARENT_ELIGIBILITY_RULE_VERSION,
          rateParent: {
            datasetId: options.rrpCompositionSummary.rateParent.regimeDatasetId,
            datasetHash: options.rrpCompositionSummary.rateParent.datasetHash,
            datasetVersion: options.rrpCompositionSummary.rateParent.datasetVersion,
            promotionManifestId: options.rrpCompositionSummary.rateParent.promotionManifestId,
            contractManifestHash: options.rrpCompositionSummary.rateParent.contractManifestHash,
            familyManifestId: options.rrpCompositionSummary.rateParent.familyManifestId,
            familyManifestHash: options.rrpCompositionSummary.rateParent.familyManifestHash,
          },
          cpiParent: {
            datasetId: options.rrpCompositionSummary.cpiParent.regimeDatasetId,
            datasetHash: options.rrpCompositionSummary.cpiParent.datasetHash,
            datasetVersion: options.rrpCompositionSummary.cpiParent.datasetVersion,
            promotionManifestId: options.rrpCompositionSummary.cpiParent.promotionManifestId,
            contractManifestHash: options.rrpCompositionSummary.cpiParent.contractManifestHash,
            familyManifestId: options.rrpCompositionSummary.cpiParent.familyManifestId,
            familyManifestHash: options.rrpCompositionSummary.cpiParent.familyManifestHash,
          },
          validation: options.rrpCompositionSummary.validation,
        }
        : null,
    },
    persistedCounts: options.persistedCounts,
    notes: [
      "Gate 50 source-contract materialization only. No BPR/rate/inflation/real-rate-pressure regime interpretation, pair filter, stop policy, TP, runner, or grid-entry logic is encoded.",
      "Weekly snapshots are frozen at the macro weekly signal freeze target, currently week_open_utc; raw rows released after that cutoff are stored but first become eligible in the next weekly snapshot.",
      "Date-only or approximate availability remains exploratory/latest-vintage research and must roll forward at exact-boundary ties before promotion.",
      "Canonical rate rows use FRED/ALFRED output_type=1 real-time periods, latest eligible vintage selection, and release-aware carry in SEALED diagnostic mode.",
      "Official CPI rows use the Gate 50 source contracts and remain SEALED diagnostic evidence until CPI-only and RRP promotion proofs pass.",
      "BPR report fetches use canonical CFTC artifacts; archived canonical CFTC pages are internal replay evidence for historical fills, not runtime provider fallback.",
      "Inflation rows compute CPI YoY from native-frequency index levels and preserve current and lag parent observation metadata, artifacts, and availability events.",
      "Valuation rows store OECD annual PPP/exchange-rate inputs and BIS monthly broad NEER/REER inputs only; no PPP gap, support/oppose state, or combined regime logic is derived here.",
      "Real-rate-pressure rows are derived weekly from 3-month interbank rate minus CPI YoY; BPR remains a separate positioning source.",
      "Japan CPI uses official Statistics Bureau/e-Stat Table 1-1 all-items; Table 4-1 remains validation-only evidence and is never runtime fallback under this contract.",
    ],
  };
}

function macroWeekIdFor(weekOpenUtc: string) {
  return `macro_week_${weekOpenUtc.slice(0, 10)}`;
}

function featureBundleManifestIdForSnapshots(snapshots: MacroWeeklyCurrencySnapshot[]) {
  const families = [...new Set(snapshots.map((snapshot) => snapshot.sourceFamily))].sort();
  if (families.length === 1) {
    if (families[0] === "bpr") return "bpr_attribution_v1";
    if (families[0] === "rate") return "rate_attribution_v1";
    if (families[0] === "inflation") return "inflation_attribution_v1";
    if (families[0] === "real_rate_pressure") return "real_rate_pressure_attribution_v1";
    if (families[0] === "valuation") return "valuation_attribution_v1";
  }
  if (families.includes("real_rate_pressure")) return "real_rate_pressure_attribution_v1";
  return "full_macro_regime_v1";
}

export function sealMacroSnapshots(
  snapshots: MacroWeeklyCurrencySnapshot[],
  datasetManifestHash: string,
  snapshotSealedAtUtc: string,
  promotionManifestId: string,
  contractManifestHash: string,
) {
  return snapshots.map((snapshot) => {
    const macroWeekId = macroWeekIdFor(snapshot.weekOpenUtc);
    const snapshotHash = hashMacroRegimePayload({
      datasetManifestHash,
      promotionManifestId,
      contractManifestHash,
      macroWeekId,
      freezeVersion: MACRO_WEEKLY_SIGNAL_FREEZE_VERSION,
      weekOpenUtc: snapshot.weekOpenUtc,
      sourceFamily: snapshot.sourceFamily,
      sourceId: snapshot.sourceId,
      currency: snapshot.currency,
      instrument: snapshot.instrument,
      asOfUtc: snapshot.asOfUtc,
      sourceObservationDate: snapshot.sourceObservationDate,
      effectiveAtUtc: snapshot.effectiveAtUtc,
      availableAtUtc: snapshot.availableAtUtc,
      rawValue: snapshot.rawValue,
      normalizedValue: snapshot.normalizedValue,
      coverage: snapshot.coverage,
      flags: snapshot.flags,
    });
    const snapshotId = hashMacroRegimePayload({
      type: "macro_weekly_currency_snapshot_v1",
      promotionManifestId,
      macroWeekId,
      freezeVersion: MACRO_WEEKLY_SIGNAL_FREEZE_VERSION,
      snapshotHash,
    });
    return {
      ...snapshot,
      snapshotId,
      promotionManifestId,
      contractManifestHash,
      macroWeekId,
      freezeVersion: MACRO_WEEKLY_SIGNAL_FREEZE_VERSION,
      snapshotHash,
      snapshotState: "SEALED" as const,
      sealedAtUtc: snapshotSealedAtUtc,
      coverage: {
        ...snapshot.coverage,
        datasetManifestHash,
        promotionManifestId,
        contractManifestHash,
        macroWeekId,
        freezeVersion: MACRO_WEEKLY_SIGNAL_FREEZE_VERSION,
        snapshotId,
        snapshotSealedAtUtc,
        snapshotHash,
      },
      flags: {
        ...snapshot.flags,
        promotionManifestId,
        macroWeekId,
        freezeVersion: MACRO_WEEKLY_SIGNAL_FREEZE_VERSION,
        snapshotId,
        snapshotHash,
      },
    };
  });
}

export function buildWeeklySnapshotManifests(options: {
  weeks: string[];
  snapshots: MacroWeeklyCurrencySnapshot[];
  promotionManifestId: string;
  contractManifestHash: string;
  sealedAtUtc: string;
  featureBundleManifestId?: string | null;
  activationScope?: string | null;
}): MacroWeeklySnapshotManifest[] {
  const rowsByWeek = new Map<string, MacroWeeklyCurrencySnapshot[]>();
  for (const snapshot of options.snapshots) {
    const rows = rowsByWeek.get(snapshot.weekOpenUtc) ?? [];
    rows.push(snapshot);
    rowsByWeek.set(snapshot.weekOpenUtc, rows);
  }

  return options.weeks.map((weekOpenUtc) => {
    const rows = (rowsByWeek.get(weekOpenUtc) ?? []).sort((left, right) =>
      `${left.sourceFamily}|${left.sourceId}|${left.currency}|${left.instrument}`
        .localeCompare(`${right.sourceFamily}|${right.sourceId}|${right.currency}|${right.instrument}`));
    const featureBundleManifestId =
      options.featureBundleManifestId ?? featureBundleManifestIdForSnapshots(rows);
    const macroWeekId = macroWeekIdFor(weekOpenUtc);
    const freezeMetadata = macroWeeklySignalFreezeMetadata(weekOpenUtc);
    const rowSnapshotHashes = rows.map((row) => ({
      snapshotId: row.snapshotId ?? null,
      snapshotHash: row.snapshotHash ?? row.flags.snapshotHash ?? row.coverage.snapshotHash ?? null,
      sourceFamily: row.sourceFamily,
      sourceId: row.sourceId,
      currency: row.currency,
      instrument: row.instrument,
    }));
    const snapshotHash = hashMacroRegimePayload({
      version: MACRO_WEEKLY_SNAPSHOT_MANIFEST_VERSION,
      promotionManifestId: options.promotionManifestId,
      contractManifestHash: options.contractManifestHash,
      macroWeekId,
      freezeVersion: MACRO_WEEKLY_SIGNAL_FREEZE_VERSION,
      freezeMetadata,
      rowSnapshotHashes,
    });
    const snapshotId = hashMacroRegimePayload({
      version: MACRO_WEEKLY_SNAPSHOT_MANIFEST_VERSION,
      promotionManifestId: options.promotionManifestId,
      macroWeekId,
      freezeVersion: MACRO_WEEKLY_SIGNAL_FREEZE_VERSION,
      snapshotHash,
    });
    const availableRows = rows.filter((row) => row.coverage.valueAvailable === true).length;
    const staleRows = rows.filter((row) => row.coverage.isStale === true).length;
    const missingRows = rows.filter((row) => row.coverage.valueAvailable !== true).length;

    return {
      promotionManifestId: options.promotionManifestId,
      featureBundleManifestId,
      activationScope: options.activationScope ?? null,
      contractManifestHash: options.contractManifestHash,
      macroWeekId,
      freezeVersion: MACRO_WEEKLY_SIGNAL_FREEZE_VERSION,
      snapshotId,
      snapshotHash,
      snapshotState: "SEALED",
      sealedAtUtc: options.sealedAtUtc,
      settlementDeadlineUtc: null,
      settlementCompletedAtUtc: null,
      verifiedAtUtc: null,
      activatedAtUtc: null,
      effectiveFromUtc: null,
      effectiveToUtc: null,
      revokedAtUtc: null,
      revocationReason: null,
      supersedesSnapshotId: null,
      supersededBySnapshotId: null,
      rowSnapshotCount: rows.length,
      coverage: {
        ...freezeMetadata,
        featureBundleManifestId,
        activationScope: options.activationScope ?? null,
        availableRows,
        staleRows,
        missingRows,
        rowSnapshotCount: rows.length,
        rowSnapshotHashes,
        activationContract:
          "execution may consume this macro week only after this aggregate manifest is VERIFIED then ACTIVE under the effective-time invariant",
      },
      flags: {
        noRegimeInterpretation: true,
        weeklySignalFreeze: true,
        aggregateSnapshotManifest: true,
        featureBundleManifestId,
        executionRequiresActiveManifest: true,
      },
    };
  });
}

export async function buildMacroRegimeSourcePayload(cli: CliOptions, generatedAtUtc = isoUtc(DateTime.utc())) {
  const weeks = await buildWeeksForCli(cli);
  const effectiveCli: CliOptions = {
    ...cli,
    fromWeekOpenUtc: weeks[0],
    toWeekOpenUtc: weeks[weeks.length - 1],
  };

  const rrpCompositionSummary = effectiveCli.composeRrpFromParentDatasets
    ? await buildRrpCompositionSummary({ cli: effectiveCli, weeks })
    : null;
  const bprSummary = effectiveCli.includeBpr ? await buildBprObservations(effectiveCli, generatedAtUtc) : null;
  const rateSummary = effectiveCli.includeRates ? await buildRateObservations(effectiveCli, generatedAtUtc) : null;
  const inflationSummary = effectiveCli.includeInflation ? await buildInflationObservations(effectiveCli, generatedAtUtc) : null;
  const valuationSummary = effectiveCli.includeValuation ? await buildValuationObservations(effectiveCli, generatedAtUtc) : null;
  const artifacts = [
    ...(bprSummary?.artifacts ?? []),
    ...(rateSummary?.artifacts ?? []),
    ...(inflationSummary?.artifacts ?? []),
    ...(valuationSummary?.artifacts ?? []),
  ];
  const observations = [
    ...(bprSummary?.observations ?? []),
    ...(rateSummary?.observations ?? []),
    ...(inflationSummary?.observations ?? []),
    ...(valuationSummary?.observations ?? []),
  ].map(enrichMacroObservation);
  const availabilityEvents = buildAvailabilityEvents(observations);
  const contracts = buildSourceContracts(effectiveCli);
  const rawSnapshots = rrpCompositionSummary ? [] : buildWeeklySnapshots({ weeks, observations, contracts });
  const realRatePressureSnapshots = rrpCompositionSummary
    ? rrpCompositionSummary.rrpSnapshots
    : effectiveCli.includeRealRatePressure
    ? buildRealRatePressureSnapshots({ weeks, snapshots: rawSnapshots })
    : [];
  const snapshots = [...rawSnapshots, ...realRatePressureSnapshots];
  const datasetVersion = datasetVersionForCli(effectiveCli);
  const buildVersion = buildVersionForCli(effectiveCli);
  const sourceContractVersion = effectiveCli.composeRrpFromParentDatasets
    ? RRP_COMPOSITION_CONTRACT_VERSION
    : MACRO_SOURCE_CONTRACT_VERSION;
  const baseSourceVersions = withRrpCompositionSourceVersions(
    sourceVersionPayload(effectiveCli),
    rrpCompositionSummary,
  );
  const contractManifestHash = hashMacroRegimePayload({
    version: "macro_contract_manifest_v1",
    datasetVersion,
    sourceVersions: baseSourceVersions,
    sourceContractVersion,
    weeklyFreezeVersion: MACRO_WEEKLY_SIGNAL_FREEZE_VERSION,
    availabilityRuleVersion: MACRO_AVAILABILITY_RULE_VERSION,
    calendarVersion: MACRO_CALENDAR_VERSION,
    eligibilityCalendarVersion: MACRO_ELIGIBILITY_CALENDAR_VERSION,
    exceptionCalendarVersion: MACRO_EXCEPTION_CALENDAR_VERSION,
    selectorVersion: MACRO_WEEKLY_SELECTOR_VERSION,
    settlementActivationVersion: MACRO_SETTLEMENT_ACTIVATION_VERSION,
    validationContractVersion: MACRO_VALIDATION_CONTRACT_VERSION,
    buildVersion,
    promotionReadiness: MACRO_PROMOTION_READINESS,
  });
  const promotionManifestId = hashMacroRegimePayload({
    version: MACRO_PROMOTION_MANIFEST_VERSION,
    contractManifestHash,
    weeklyFreezeVersion: MACRO_WEEKLY_SIGNAL_FREEZE_VERSION,
    selectorVersion: MACRO_WEEKLY_SELECTOR_VERSION,
    validationContractVersion: MACRO_VALIDATION_CONTRACT_VERSION,
  });
  const sourceVersions = withRrpCompositionSourceVersions(
    sourceVersionPayload(effectiveCli, {
      contractManifestHash,
      promotionManifestId,
    }),
    rrpCompositionSummary,
  );
  const datasetHash = hashMacroRegimePayload({
    datasetVersion,
    fromWeekOpenUtc: effectiveCli.fromWeekOpenUtc,
    toWeekOpenUtc: effectiveCli.toWeekOpenUtc,
    currencies: FX_CURRENCIES,
    promotionManifestId,
    contractManifestHash,
    sourceVersions,
    artifacts: artifacts.map((artifact) => ({
      artifactId: artifact.artifactId,
      sourceFamily: artifact.sourceFamily,
      sourceId: artifact.sourceId,
      currency: artifact.currency,
      endpointId: artifact.endpointId,
      endpointUrl: artifact.endpointUrl,
      httpStatus: artifact.httpStatus,
      rawPayloadSha256: artifact.rawPayloadSha256,
      rawPayloadSizeBytes: artifact.rawPayloadSizeBytes,
      coverage: artifact.coverage,
      flags: artifact.flags,
    })),
    availabilityEvents: availabilityEvents.map((event) => ({
      availabilityEventId: event.availabilityEventId,
      sourceFamily: event.sourceFamily,
      sourceId: event.sourceId,
      currency: event.currency,
      instrument: event.instrument,
      observationDate: event.observationDate,
      endpointAvailableAtUtc: event.endpointAvailableAtUtc,
      availabilityBasis: event.availabilityBasis,
      retrievalCapability: event.retrievalCapability,
      availabilityPrecision: event.availabilityPrecision,
      eligibilityPolicy: event.eligibilityPolicy,
      availabilityRuleVersion: event.availabilityRuleVersion,
      promotionEligibleAvailabilityBases: event.promotionEligibleAvailabilityBases,
      minimumAvailabilityConfidence: event.minimumAvailabilityConfidence,
      exceptionCalendarVersion: event.exceptionCalendarVersion,
      eligibilityCalendarVersion: event.eligibilityCalendarVersion,
      eligibleFromWeekOpenUtc: event.eligibleFromWeekOpenUtc,
      evidenceArtifactId: event.availabilityEvidenceArtifactId,
    })),
    observations: observations.map((row) => ({
      sourceFamily: row.sourceFamily,
      sourceId: row.sourceId,
      currency: row.currency,
      instrument: row.instrument,
      observationDate: row.observationDate,
      sourceUrl: row.sourceUrl,
      rawValue: row.rawValue,
      normalizedValue: row.normalizedValue,
      coverage: row.coverage,
      flags: row.flags,
    })),
  });
  const sealedSnapshots = sealMacroSnapshots(
    snapshots,
    datasetHash,
    generatedAtUtc,
    promotionManifestId,
    contractManifestHash,
  );
  const weeklySnapshotManifests = buildWeeklySnapshotManifests({
    weeks,
    snapshots: sealedSnapshots,
    promotionManifestId,
    contractManifestHash,
    sealedAtUtc: generatedAtUtc,
  });
  const report = buildCoverageReport({
    generatedAtUtc,
    cli: effectiveCli,
    datasetHash,
    promotionManifestId,
    contractManifestHash,
    regimeDatasetId: null,
    weeks,
    artifacts,
    availabilityEvents,
    observations,
    weeklySnapshotManifests,
    snapshots: sealedSnapshots,
    bprSummary,
    rateSummary,
    inflationSummary,
    valuationSummary,
    rrpCompositionSummary,
    persistedCounts: null,
  });

  return {
    generatedAtUtc,
    cli: effectiveCli,
    weeks,
    datasetVersion,
    buildVersion,
    sourceVersions,
    datasetHash,
    promotionManifestId,
    contractManifestHash,
    artifacts,
    observations,
    availabilityEvents,
    snapshots: sealedSnapshots,
    weeklySnapshotManifests,
    bprSummary,
    rateSummary,
    inflationSummary,
    valuationSummary,
    rrpCompositionSummary,
    report,
  };
}

async function main() {
  const cli = parseCli();
  configureOfflineArtifactReplay({
    enabled: cli.offlineArtifactReplay,
    datasetIds: cli.offlineArtifactReplayDatasetIds,
  });
  const generatedAtUtc = isoUtc(DateTime.utc());

  const credentialPreflight = await runCredentialPreflight(cli, generatedAtUtc);
  if (cli.credentialPreflightOnly) {
    if (cli.output) {
      const outputPath = path.resolve(process.cwd(), cli.output);
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, `${JSON.stringify(credentialPreflight, null, 2)}\n`, "utf-8");
      console.log(`[macro-regime] wrote credential preflight report ${outputPath}`);
    }
    console.log(JSON.stringify(credentialPreflight, null, 2));
    if (!credentialPreflight.accepted) process.exitCode = 1;
    return;
  }
  if (!credentialPreflight.accepted) {
    throw new Error(`Credential preflight rejected: ${credentialPreflightSummary(credentialPreflight)}`);
  }
  if (credentialPreflight.credentials.some((credential) => credential.required)) {
    console.log(`[macro-regime] credential preflight accepted: ${credentialPreflightSummary(credentialPreflight)}`);
  }

  const weeks = await buildWeeksForCli(cli);
  const effectiveCli: CliOptions = {
    ...cli,
    fromWeekOpenUtc: weeks[0],
    toWeekOpenUtc: weeks[weeks.length - 1],
  };

  const rrpCompositionSummary = effectiveCli.composeRrpFromParentDatasets
    ? await buildRrpCompositionSummary({ cli: effectiveCli, weeks })
    : null;
  const bprSummary = effectiveCli.includeBpr ? await buildBprObservations(effectiveCli, generatedAtUtc) : null;
  const rateSummary = effectiveCli.includeRates ? await buildRateObservations(effectiveCli, generatedAtUtc) : null;
  const inflationSummary = effectiveCli.includeInflation ? await buildInflationObservations(effectiveCli, generatedAtUtc) : null;
  const valuationSummary = effectiveCli.includeValuation ? await buildValuationObservations(effectiveCli, generatedAtUtc) : null;
  const artifacts = [
    ...(bprSummary?.artifacts ?? []),
    ...(rateSummary?.artifacts ?? []),
    ...(inflationSummary?.artifacts ?? []),
    ...(valuationSummary?.artifacts ?? []),
  ];
  const observations = [
    ...(bprSummary?.observations ?? []),
    ...(rateSummary?.observations ?? []),
    ...(inflationSummary?.observations ?? []),
    ...(valuationSummary?.observations ?? []),
  ].map(enrichMacroObservation);
  const availabilityEvents = buildAvailabilityEvents(observations);
  const contracts = buildSourceContracts(effectiveCli);
  const rawSnapshots = rrpCompositionSummary ? [] : buildWeeklySnapshots({ weeks, observations, contracts });
  const realRatePressureSnapshots = rrpCompositionSummary
    ? rrpCompositionSummary.rrpSnapshots
    : effectiveCli.includeRealRatePressure
    ? buildRealRatePressureSnapshots({ weeks, snapshots: rawSnapshots })
    : [];
  const snapshots = [...rawSnapshots, ...realRatePressureSnapshots];
  const datasetVersion = datasetVersionForCli(effectiveCli);
  const buildVersion = buildVersionForCli(effectiveCli);
  const sourceContractVersion = effectiveCli.composeRrpFromParentDatasets
    ? RRP_COMPOSITION_CONTRACT_VERSION
    : MACRO_SOURCE_CONTRACT_VERSION;
  const baseSourceVersions = withRrpCompositionSourceVersions(
    sourceVersionPayload(effectiveCli),
    rrpCompositionSummary,
  );
  const contractManifestHash = hashMacroRegimePayload({
    version: "macro_contract_manifest_v1",
    datasetVersion,
    sourceVersions: baseSourceVersions,
    sourceContractVersion,
    weeklyFreezeVersion: MACRO_WEEKLY_SIGNAL_FREEZE_VERSION,
    availabilityRuleVersion: MACRO_AVAILABILITY_RULE_VERSION,
    calendarVersion: MACRO_CALENDAR_VERSION,
    eligibilityCalendarVersion: MACRO_ELIGIBILITY_CALENDAR_VERSION,
    exceptionCalendarVersion: MACRO_EXCEPTION_CALENDAR_VERSION,
    selectorVersion: MACRO_WEEKLY_SELECTOR_VERSION,
    settlementActivationVersion: MACRO_SETTLEMENT_ACTIVATION_VERSION,
    validationContractVersion: MACRO_VALIDATION_CONTRACT_VERSION,
    buildVersion,
    promotionReadiness: MACRO_PROMOTION_READINESS,
  });
  const promotionManifestId = hashMacroRegimePayload({
    version: MACRO_PROMOTION_MANIFEST_VERSION,
    contractManifestHash,
    weeklyFreezeVersion: MACRO_WEEKLY_SIGNAL_FREEZE_VERSION,
    selectorVersion: MACRO_WEEKLY_SELECTOR_VERSION,
    validationContractVersion: MACRO_VALIDATION_CONTRACT_VERSION,
  });
  const sourceVersions = withRrpCompositionSourceVersions(
    sourceVersionPayload(effectiveCli, {
      contractManifestHash,
      promotionManifestId,
    }),
    rrpCompositionSummary,
  );
  const datasetHash = hashMacroRegimePayload({
    datasetVersion,
    fromWeekOpenUtc: effectiveCli.fromWeekOpenUtc,
    toWeekOpenUtc: effectiveCli.toWeekOpenUtc,
    currencies: FX_CURRENCIES,
    promotionManifestId,
    contractManifestHash,
    sourceVersions,
    artifacts: artifacts.map((artifact) => ({
      artifactId: artifact.artifactId,
      sourceFamily: artifact.sourceFamily,
      sourceId: artifact.sourceId,
      currency: artifact.currency,
      endpointId: artifact.endpointId,
      endpointUrl: artifact.endpointUrl,
      httpStatus: artifact.httpStatus,
      rawPayloadSha256: artifact.rawPayloadSha256,
      rawPayloadSizeBytes: artifact.rawPayloadSizeBytes,
      coverage: artifact.coverage,
      flags: artifact.flags,
    })),
    availabilityEvents: availabilityEvents.map((event) => ({
      availabilityEventId: event.availabilityEventId,
      sourceFamily: event.sourceFamily,
      sourceId: event.sourceId,
      currency: event.currency,
      instrument: event.instrument,
      observationDate: event.observationDate,
      endpointAvailableAtUtc: event.endpointAvailableAtUtc,
      availabilityBasis: event.availabilityBasis,
      retrievalCapability: event.retrievalCapability,
      availabilityPrecision: event.availabilityPrecision,
      eligibilityPolicy: event.eligibilityPolicy,
      availabilityRuleVersion: event.availabilityRuleVersion,
      promotionEligibleAvailabilityBases: event.promotionEligibleAvailabilityBases,
      minimumAvailabilityConfidence: event.minimumAvailabilityConfidence,
      exceptionCalendarVersion: event.exceptionCalendarVersion,
      eligibilityCalendarVersion: event.eligibilityCalendarVersion,
      eligibleFromWeekOpenUtc: event.eligibleFromWeekOpenUtc,
      evidenceArtifactId: event.availabilityEvidenceArtifactId,
    })),
    observations: observations.map((row) => ({
      sourceFamily: row.sourceFamily,
      sourceId: row.sourceId,
      currency: row.currency,
      instrument: row.instrument,
      observationDate: row.observationDate,
      sourceUrl: row.sourceUrl,
      rawValue: row.rawValue,
      normalizedValue: row.normalizedValue,
      coverage: row.coverage,
      flags: row.flags,
    })),
  });
  const sealedSnapshots = sealMacroSnapshots(
    snapshots,
    datasetHash,
    generatedAtUtc,
    promotionManifestId,
    contractManifestHash,
  );
  const weeklySnapshotManifests = buildWeeklySnapshotManifests({
    weeks,
    snapshots: sealedSnapshots,
    promotionManifestId,
    contractManifestHash,
    sealedAtUtc: generatedAtUtc,
  });

  let regimeDatasetId: string | null = null;
  let persistedCounts: CoverageReport["persistedCounts"] = null;

  if (cli.write) {
    await ensureMacroRegimeWarehouseSchema();
    const dataset = await upsertMacroRegimeDataset({
      datasetVersion,
      datasetHash,
      assetClass: "fx",
      fromWeekOpenUtc: effectiveCli.fromWeekOpenUtc,
      toWeekOpenUtc: effectiveCli.toWeekOpenUtc,
      currencies: FX_CURRENCIES,
      sourceVersions,
      coverage: {
        promotionManifestId,
        contractManifestHash,
        weeks: weeks.length,
        artifacts: artifacts.length,
        availabilityEvents: availabilityEvents.length,
        observations: observations.length,
        weeklySnapshotManifests: weeklySnapshotManifests.length,
        weeklySnapshots: sealedSnapshots.length,
        bprReportsFetched: bprSummary?.fetchedReports ?? 0,
        bprReportsFetchedViaArchive: bprSummary?.archiveFetchedReports ?? 0,
        bprReportsFailed: bprSummary?.failedReports ?? 0,
        rateSources: rateSummary ? selectedRateSources(effectiveCli).length : 0,
        inflationSources: inflationSummary ? INFLATION_SOURCES.length : 0,
        valuationSources: valuationSummary ? VALUATION_SOURCES.length : 0,
        realRatePressureSources: effectiveCli.includeRealRatePressure ? REAL_RATE_PRESSURE_SOURCES.length : 0,
        rrpComposition: rrpCompositionSummary?.validation ?? null,
      },
      notes: [
        "Gate 50 macro regime source-contract dataset.",
        "BPR, rates, inflation, and valuation are separate source families; real-rate-pressure rows are derived snapshots, not a combined filter decision.",
        "Canonical rates use latest eligible FRED/ALFRED real-time-period vintages at each weekly freeze and release-aware carries.",
        "Macro weekly snapshots are frozen source inputs; source rows released after the weekly freeze target do not alter the already-frozen week.",
        "RRP composition datasets bind immutable rate and CPI parent datasets by ID/hash; they do not refetch or rewrite parent source rows.",
        "This dataset remains diagnostic SEALED source proof until CPI materialization, RRP join coverage, deterministic rebuild, boundary proofs, and activation proofs pass.",
      ],
      status: "building",
      promotionManifestId,
      contractManifestHash,
      snapshotState: "SEALED",
      settlementDeadlineUtc: null,
      settlementCompletedAtUtc: null,
      sealedAtUtc: generatedAtUtc,
      verifiedAtUtc: null,
      activatedAtUtc: null,
      effectiveFromUtc: null,
      effectiveToUtc: null,
      revokedAtUtc: null,
      revocationReason: null,
      supersedesSnapshotId: null,
      supersededBySnapshotId: null,
      verificationRunId: null,
      reconstructionMode: reconstructionModeForCli(effectiveCli),
      calendarVersion: MACRO_CALENDAR_VERSION,
      selectorVersion: MACRO_WEEKLY_SELECTOR_VERSION,
      validationContractVersion: MACRO_VALIDATION_CONTRACT_VERSION,
      buildVersion,
    });
    regimeDatasetId = dataset.regimeDatasetId;
    const artifactRows = await persistMacroSourceArtifacts({
      regimeDatasetId,
      rows: artifacts,
    });
    const availabilityEventRows = await persistMacroAvailabilityEvents({
      regimeDatasetId,
      rows: availabilityEvents,
    });
    const observationRows = await persistMacroSourceObservations({
      regimeDatasetId,
      rows: observations,
    });
    const weeklyRows = await persistMacroWeeklyCurrencySnapshots({
      regimeDatasetId,
      rows: sealedSnapshots,
    });
    const weeklyManifestRows = await persistMacroWeeklySnapshotManifests({
      regimeDatasetId,
      rows: weeklySnapshotManifests,
    });
    await markMacroRegimeDatasetComplete(regimeDatasetId);
    persistedCounts = await readMacroRegimePersistCounts(regimeDatasetId);
    console.log(`[macro-regime] persisted artifacts=${artifactRows} availabilityEvents=${availabilityEventRows} observations=${observationRows} weeklySnapshotManifests=${weeklyManifestRows} weeklySnapshots=${weeklyRows}`);
  }

  const report = buildCoverageReport({
    generatedAtUtc,
    cli: effectiveCli,
    datasetHash,
    promotionManifestId,
    contractManifestHash,
    regimeDatasetId,
    weeks,
    artifacts,
    availabilityEvents,
    observations,
    weeklySnapshotManifests,
    snapshots: sealedSnapshots,
    bprSummary,
    rateSummary,
    inflationSummary,
    valuationSummary,
    rrpCompositionSummary,
    persistedCounts,
  });

  if (cli.output) {
    const outputPath = path.resolve(process.cwd(), cli.output);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
    console.log(`[macro-regime] wrote coverage report ${outputPath}`);
  }

  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/fill-macro-regime-source-warehouse.ts")) {
  main().catch((error) => {
    console.error("[macro-regime] Failed:", error);
    process.exitCode = 1;
  });
}
