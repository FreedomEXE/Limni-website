import { createHash } from "node:crypto";

import { query, transaction } from "@/lib/db";

export const MACRO_REGIME_DATASET_VERSION = "macro_regime_source_dataset_v4_official_cpi";

export type MacroSourceFamily = "bpr" | "rate" | "inflation" | "real_rate_pressure" | "valuation";
export type MacroDatasetStatus = "building" | "complete";
export type MacroActivationScope = "historical_backtest" | "live_forward";
export type MacroSnapshotState =
  | "BUILDING"
  | "VALIDATED"
  | "SEALED"
  | "VERIFIED"
  | "ACTIVE"
  | "REVOKED"
  | "QUARANTINED"
  | "REJECTED"
  | "SETTLEMENT_FAILED"
  | "VERIFICATION_FAILED";

export const MACRO_ACTIVE_FEATURE_BUNDLE_FALLBACK = "__missing_feature_bundle__";
export const MACRO_ACTIVE_SCOPE_FALLBACK = "__missing_activation_scope__";

export const MACRO_ALLOWED_SNAPSHOT_STATE_TRANSITIONS: Record<MacroSnapshotState, MacroSnapshotState[]> = {
  BUILDING: ["VALIDATED", "REJECTED", "SETTLEMENT_FAILED"],
  VALIDATED: ["SEALED", "REJECTED", "SETTLEMENT_FAILED"],
  SEALED: ["VERIFIED", "REVOKED", "QUARANTINED", "VERIFICATION_FAILED"],
  VERIFIED: ["ACTIVE", "REVOKED", "QUARANTINED"],
  ACTIVE: ["REVOKED", "QUARANTINED"],
  REVOKED: [],
  QUARANTINED: [],
  REJECTED: [],
  SETTLEMENT_FAILED: [],
  VERIFICATION_FAILED: [],
};

export type MacroActiveUniquenessInput = {
  promotionManifestId: string | null | undefined;
  featureBundleManifestId: string | null | undefined;
  macroWeekId: string | null | undefined;
  freezeVersion: string | null | undefined;
  activationScope: string | null | undefined;
};

export type MacroExecutionReadRequest = MacroActiveUniquenessInput & {
  regimeDatasetId: string | null | undefined;
  snapshotId: string | null | undefined;
  snapshotHash: string | null | undefined;
  resolvedContentJoinMapHash: string | null | undefined;
  requestAlias?: string | null | undefined;
};

function requiredString(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function aliasOrWildcard(value: string | null | undefined) {
  if (!requiredString(value)) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "latest" || normalized === "latest_active" || normalized === "latest active" || normalized === "*";
}

export function isMacroSnapshotStateTransitionAllowed(
  fromState: MacroSnapshotState | null,
  toState: MacroSnapshotState,
) {
  if (fromState === null) return toState === "BUILDING";
  return MACRO_ALLOWED_SNAPSHOT_STATE_TRANSITIONS[fromState]?.includes(toState) === true;
}

export function macroSnapshotStateOutcomeEligible(state: MacroSnapshotState | string | null | undefined) {
  return state === "ACTIVE";
}

export function validateMacroSnapshotConsumptionState(input: {
  snapshotState: MacroSnapshotState | string | null | undefined;
  revokedAtUtc?: string | null | undefined;
  supersededBySnapshotId?: string | null | undefined;
}) {
  const blockers = [
    input.snapshotState !== "ACTIVE" ? "snapshot_not_active" : null,
    input.snapshotState === "REVOKED" || input.revokedAtUtc ? "snapshot_revoked" : null,
    input.snapshotState === "QUARANTINED" ? "snapshot_quarantined" : null,
    input.supersededBySnapshotId ? "snapshot_superseded" : null,
  ].filter((blocker): blocker is string => Boolean(blocker));

  return {
    ok: blockers.length === 0,
    blockers,
  };
}

export function macroActiveUniquenessKey(input: MacroActiveUniquenessInput) {
  const blockers = [
    !requiredString(input.promotionManifestId) ? "missing_promotion_manifest_id" : null,
    !requiredString(input.featureBundleManifestId) ? "missing_feature_bundle_manifest_id" : null,
    !requiredString(input.macroWeekId) ? "missing_macro_week_id" : null,
    !requiredString(input.freezeVersion) ? "missing_freeze_version" : null,
    !requiredString(input.activationScope) ? "missing_activation_scope" : null,
  ].filter((blocker): blocker is string => Boolean(blocker));

  if (blockers.length > 0) {
    throw new Error(`Invalid macro ACTIVE uniqueness key: ${blockers.join(", ")}`);
  }

  return [
    input.promotionManifestId!.trim(),
    input.featureBundleManifestId!.trim(),
    input.macroWeekId!.trim(),
    input.freezeVersion!.trim(),
    input.activationScope!.trim(),
  ].join("|");
}

export function validatePinnedMacroExecutionReadRequest(input: MacroExecutionReadRequest) {
  const requiredBlockers = [
    !requiredString(input.regimeDatasetId) ? "missing_regime_dataset_id" : null,
    !requiredString(input.promotionManifestId) ? "missing_promotion_manifest_id" : null,
    !requiredString(input.featureBundleManifestId) ? "missing_feature_bundle_manifest_id" : null,
    !requiredString(input.macroWeekId) ? "missing_macro_week_id" : null,
    !requiredString(input.freezeVersion) ? "missing_freeze_version" : null,
    !requiredString(input.activationScope) ? "missing_activation_scope" : null,
    !requiredString(input.snapshotId) ? "missing_snapshot_id" : null,
    !requiredString(input.snapshotHash) ? "missing_snapshot_hash" : null,
    !requiredString(input.resolvedContentJoinMapHash) ? "missing_resolved_content_join_map_hash" : null,
  ].filter((blocker): blocker is string => Boolean(blocker));
  const aliasBlockers = [
    aliasOrWildcard(input.requestAlias) ? "alias_read_request_forbidden" : null,
    aliasOrWildcard(input.regimeDatasetId) ? "alias_regime_dataset_id_forbidden" : null,
    aliasOrWildcard(input.promotionManifestId) ? "alias_promotion_manifest_id_forbidden" : null,
    aliasOrWildcard(input.snapshotId) ? "alias_snapshot_id_forbidden" : null,
    aliasOrWildcard(input.snapshotHash) ? "alias_snapshot_hash_forbidden" : null,
  ].filter((blocker): blocker is string => Boolean(blocker));

  return {
    ok: requiredBlockers.length === 0 && aliasBlockers.length === 0,
    blockers: [...requiredBlockers, ...aliasBlockers],
  };
}

export type MacroRegimeDatasetRecord = {
  regimeDatasetId: string;
  datasetHash: string;
};

export type MacroRegimeDatasetInput = {
  datasetVersion: string;
  datasetHash: string;
  assetClass: "fx";
  fromWeekOpenUtc: string;
  toWeekOpenUtc: string;
  currencies: string[];
  sourceVersions: Record<string, unknown>;
  coverage?: Record<string, unknown>;
  notes?: string[];
  status?: MacroDatasetStatus;
  promotionManifestId?: string | null;
  contractManifestHash?: string | null;
  snapshotState?: MacroSnapshotState;
  settlementDeadlineUtc?: string | null;
  settlementCompletedAtUtc?: string | null;
  sealedAtUtc?: string | null;
  verifiedAtUtc?: string | null;
  activatedAtUtc?: string | null;
  effectiveFromUtc?: string | null;
  effectiveToUtc?: string | null;
  revokedAtUtc?: string | null;
  revocationReason?: string | null;
  supersedesSnapshotId?: string | null;
  supersededBySnapshotId?: string | null;
  verificationRunId?: string | null;
  supersedesRegimeDatasetId?: string | null;
  reconstructionMode?: string | null;
  calendarVersion?: string | null;
  selectorVersion?: string | null;
  validationContractVersion?: string | null;
  buildVersion?: string | null;
};

export type MacroSourceObservation = {
  sourceFamily: MacroSourceFamily;
  sourceId: string;
  currency: string;
  instrument: string;
  observationDate: string;
  effectiveAtUtc: string;
  availableAtUtc: string;
  fetchedAtUtc: string;
  sourceUrl: string;
  sourceHash: string | null;
  rawValue: Record<string, unknown>;
  normalizedValue: Record<string, unknown>;
  coverage: Record<string, unknown>;
  flags: Record<string, unknown>;
};

export type MacroSourceArtifact = {
  artifactId: string;
  sourceFamily: MacroSourceFamily | "multi";
  sourceId: string;
  currency: string;
  endpointId: string;
  endpointUrl: string;
  fetchedAtUtc: string;
  httpStatus: number | null;
  responseHeaders: Record<string, unknown>;
  sanitizedRequest: Record<string, unknown>;
  rawContentType: string | null;
  rawPayloadSha256: string;
  rawPayloadSizeBytes: number;
  rawPayloadText: string | null;
  rawPayloadBytesBase64?: string | null;
  coverage: Record<string, unknown>;
  flags: Record<string, unknown>;
};

export type MacroAvailabilityEvent = {
  availabilityEventId: string;
  sourceFamily: MacroSourceFamily;
  sourceId: string;
  currency: string;
  instrument: string;
  observationDate: string;
  releaseOrVintageId: string | null;
  publicReleaseAtUtc: string | null;
  endpointAvailableAtUtc: string;
  availabilityDate: string | null;
  availabilityBasis: string;
  retrievalCapability: string;
  availabilityPrecision: string;
  eligibilityPolicy: string;
  availabilityTimezone: string;
  availabilityEvidenceArtifactId: string | null;
  availabilityRuleVersion: string;
  availabilityConfidence: string;
  promotionEligibleAvailabilityBases: string[];
  minimumAvailabilityConfidence: string | null;
  exceptionCalendarVersion: string | null;
  eligibilityCalendarVersion: string | null;
  eligibleFromWeekOpenUtc: string | null;
  exceptionOrDelayFlag: boolean;
  coverage: Record<string, unknown>;
  flags: Record<string, unknown>;
};

export type MacroWeeklyCurrencySnapshot = {
  snapshotId?: string | null;
  promotionManifestId?: string | null;
  contractManifestHash?: string | null;
  macroWeekId?: string | null;
  freezeVersion?: string | null;
  snapshotHash?: string | null;
  snapshotState?: MacroSnapshotState | null;
  sealedAtUtc?: string | null;
  weekOpenUtc: string;
  sourceFamily: MacroSourceFamily;
  sourceId: string;
  currency: string;
  instrument: string;
  asOfUtc: string;
  sourceObservationDate: string | null;
  effectiveAtUtc: string | null;
  availableAtUtc: string | null;
  rawValue: Record<string, unknown>;
  normalizedValue: Record<string, unknown>;
  coverage: Record<string, unknown>;
  flags: Record<string, unknown>;
};

export type MacroWeeklySnapshotManifest = {
  promotionManifestId: string;
  featureBundleManifestId?: string | null;
  activationScope?: MacroActivationScope | string | null;
  approvedRootPromotionManifestId?: string | null;
  approvedRootPromotionManifestHash?: string | null;
  parentPromotionProofReceiptHash?: string | null;
  contractManifestHash: string;
  macroWeekId: string;
  freezeVersion: string;
  snapshotId: string;
  snapshotHash: string;
  snapshotState: MacroSnapshotState;
  sealedAtUtc: string;
  settlementDeadlineUtc: string | null;
  settlementCompletedAtUtc: string | null;
  verifiedAtUtc: string | null;
  activatedAtUtc: string | null;
  effectiveFromUtc: string | null;
  effectiveToUtc: string | null;
  revokedAtUtc: string | null;
  revocationReason: string | null;
  supersedesSnapshotId: string | null;
  supersededBySnapshotId: string | null;
  rowSnapshotCount: number;
  coverage: Record<string, unknown>;
  flags: Record<string, unknown>;
};

export type MacroSnapshotTransitionInput = {
  regimeDatasetId: string;
  snapshotId: string;
  expectedSnapshotHash: string;
  fromState: MacroSnapshotState;
  toState: MacroSnapshotState;
  transitionedAtUtc: string;
  transitionRunId: string;
  reason: string;
  actorOrServiceVersion: string;
  featureBundleManifestId?: string | null;
  activationScope?: MacroActivationScope | string | null;
  effectiveFromUtc?: string | null;
  effectiveToUtc?: string | null;
  revocationReason?: string | null;
  supersededBySnapshotId?: string | null;
  approvedRootPromotionManifestId?: string | null;
  approvedRootPromotionManifestHash?: string | null;
  parentPromotionProofReceiptHash?: string | null;
};

export type MacroSnapshotPromotionControlBindingInput = {
  regimeDatasetId: string;
  snapshotId: string;
  expectedSnapshotHash: string;
  transitionedAtUtc: string;
  transitionRunId: string;
  reason: string;
  actorOrServiceVersion: string;
  featureBundleManifestId: string;
  activationScope: MacroActivationScope | string;
  approvedRootPromotionManifestId: string;
  approvedRootPromotionManifestHash: string;
  parentPromotionProofReceiptHash: string;
};

export type MacroRegimePersistCounts = {
  artifacts: number;
  availabilityEvents: number;
  observations: number;
  weeklySnapshotManifests: number;
  weeklySnapshots: number;
};

export const MACRO_REGIME_WAREHOUSE_SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS research_macro_regime_datasets (
  regime_dataset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_version TEXT NOT NULL,
  dataset_hash TEXT NOT NULL UNIQUE,
  asset_class TEXT NOT NULL DEFAULT 'fx',
  from_week_open_utc TIMESTAMPTZ NOT NULL,
  to_week_open_utc TIMESTAMPTZ NOT NULL,
  currencies JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_versions JSONB NOT NULL DEFAULT '{}'::jsonb,
  coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'building',
  promotion_manifest_id TEXT,
  contract_manifest_hash TEXT,
  snapshot_state TEXT NOT NULL DEFAULT 'BUILDING',
  settlement_deadline_utc TIMESTAMPTZ,
  settlement_completed_at_utc TIMESTAMPTZ,
  sealed_at_utc TIMESTAMPTZ,
  verified_at_utc TIMESTAMPTZ,
  activated_at_utc TIMESTAMPTZ,
  effective_from_utc TIMESTAMPTZ,
  effective_to_utc TIMESTAMPTZ,
  revoked_at_utc TIMESTAMPTZ,
  revocation_reason TEXT,
  supersedes_snapshot_id TEXT,
  superseded_by_snapshot_id TEXT,
  verification_run_id TEXT,
  supersedes_regime_dataset_id UUID,
  reconstruction_mode TEXT,
  calendar_version TEXT,
  selector_version TEXT,
  validation_contract_version TEXT,
  build_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE research_macro_regime_datasets
  ADD COLUMN IF NOT EXISTS promotion_manifest_id TEXT,
  ADD COLUMN IF NOT EXISTS contract_manifest_hash TEXT,
  ADD COLUMN IF NOT EXISTS snapshot_state TEXT NOT NULL DEFAULT 'BUILDING',
  ADD COLUMN IF NOT EXISTS settlement_deadline_utc TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS settlement_completed_at_utc TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sealed_at_utc TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_at_utc TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activated_at_utc TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS effective_from_utc TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS effective_to_utc TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_at_utc TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revocation_reason TEXT,
  ADD COLUMN IF NOT EXISTS supersedes_snapshot_id TEXT,
  ADD COLUMN IF NOT EXISTS superseded_by_snapshot_id TEXT,
  ADD COLUMN IF NOT EXISTS verification_run_id TEXT,
  ADD COLUMN IF NOT EXISTS supersedes_regime_dataset_id UUID,
  ADD COLUMN IF NOT EXISTS reconstruction_mode TEXT,
  ADD COLUMN IF NOT EXISTS calendar_version TEXT,
  ADD COLUMN IF NOT EXISTS selector_version TEXT,
  ADD COLUMN IF NOT EXISTS validation_contract_version TEXT,
  ADD COLUMN IF NOT EXISTS build_version TEXT;

CREATE INDEX IF NOT EXISTS idx_research_macro_regime_datasets_range
  ON research_macro_regime_datasets (asset_class, from_week_open_utc, to_week_open_utc);

CREATE TABLE IF NOT EXISTS research_macro_source_artifacts (
  regime_dataset_id UUID NOT NULL REFERENCES research_macro_regime_datasets(regime_dataset_id) ON DELETE CASCADE,
  artifact_id TEXT NOT NULL,
  source_family TEXT NOT NULL,
  source_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  endpoint_id TEXT NOT NULL,
  endpoint_url TEXT NOT NULL,
  fetched_at_utc TIMESTAMPTZ NOT NULL,
  http_status INTEGER,
  response_headers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  sanitized_request_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_content_type TEXT,
  raw_payload_sha256 TEXT NOT NULL,
  raw_payload_size_bytes INTEGER NOT NULL,
  raw_payload_text TEXT,
  coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
  flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (regime_dataset_id, artifact_id)
);

CREATE INDEX IF NOT EXISTS idx_research_macro_source_artifacts_source
  ON research_macro_source_artifacts (
    regime_dataset_id,
    source_family,
    source_id,
    currency,
    endpoint_id
  );

CREATE INDEX IF NOT EXISTS idx_research_macro_source_artifacts_payload_hash
  ON research_macro_source_artifacts (regime_dataset_id, raw_payload_sha256);

CREATE TABLE IF NOT EXISTS research_macro_source_artifact_byte_archives (
  raw_payload_sha256 TEXT PRIMARY KEY,
  raw_payload_size_bytes INTEGER NOT NULL,
  raw_content_type TEXT,
  raw_payload_base64 TEXT NOT NULL,
  archive_origin TEXT NOT NULL,
  archive_written_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  original_artifact_record_mutated BOOLEAN NOT NULL DEFAULT FALSE,
  coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
  flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT research_macro_source_artifact_byte_archives_hash_format
    CHECK (raw_payload_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT research_macro_source_artifact_byte_archives_not_mutated
    CHECK (original_artifact_record_mutated = FALSE)
);

CREATE INDEX IF NOT EXISTS idx_research_macro_source_artifact_byte_archives_size
  ON research_macro_source_artifact_byte_archives (raw_payload_size_bytes);

CREATE TABLE IF NOT EXISTS research_macro_availability_events (
  regime_dataset_id UUID NOT NULL REFERENCES research_macro_regime_datasets(regime_dataset_id) ON DELETE CASCADE,
  availability_event_id TEXT NOT NULL,
  source_family TEXT NOT NULL,
  source_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  instrument TEXT NOT NULL,
  observation_date DATE NOT NULL,
  release_or_vintage_id TEXT,
  public_release_at_utc TIMESTAMPTZ,
  endpoint_available_at_utc TIMESTAMPTZ NOT NULL,
  availability_date DATE,
  availability_basis TEXT NOT NULL,
  retrieval_capability TEXT NOT NULL,
  availability_precision TEXT NOT NULL,
  eligibility_policy TEXT NOT NULL,
  availability_timezone TEXT NOT NULL,
  availability_evidence_artifact_id TEXT,
  availability_rule_version TEXT NOT NULL,
  availability_confidence TEXT NOT NULL,
  promotion_eligible_availability_bases JSONB NOT NULL DEFAULT '[]'::jsonb,
  minimum_availability_confidence TEXT,
  exception_calendar_version TEXT,
  eligibility_calendar_version TEXT,
  eligible_from_week_open_utc TIMESTAMPTZ,
  exception_or_delay_flag BOOLEAN NOT NULL DEFAULT FALSE,
  coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
  flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (regime_dataset_id, availability_event_id)
);

ALTER TABLE research_macro_availability_events
  ADD COLUMN IF NOT EXISTS retrieval_capability TEXT NOT NULL DEFAULT 'capture_before_freeze_required',
  ADD COLUMN IF NOT EXISTS eligibility_policy TEXT NOT NULL DEFAULT 'capture_must_precede_freeze',
  ADD COLUMN IF NOT EXISTS promotion_eligible_availability_bases JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS minimum_availability_confidence TEXT,
  ADD COLUMN IF NOT EXISTS exception_calendar_version TEXT,
  ADD COLUMN IF NOT EXISTS eligibility_calendar_version TEXT;

CREATE INDEX IF NOT EXISTS idx_research_macro_availability_events_lookup
  ON research_macro_availability_events (
    regime_dataset_id,
    source_family,
    source_id,
    currency,
    endpoint_available_at_utc
  );

CREATE INDEX IF NOT EXISTS idx_research_macro_availability_events_eligible
  ON research_macro_availability_events (regime_dataset_id, eligible_from_week_open_utc);

CREATE TABLE IF NOT EXISTS research_macro_weekly_snapshot_manifests (
  regime_dataset_id UUID NOT NULL REFERENCES research_macro_regime_datasets(regime_dataset_id) ON DELETE CASCADE,
  promotion_manifest_id TEXT NOT NULL,
  feature_bundle_manifest_id TEXT,
  activation_scope TEXT,
  approved_root_promotion_manifest_id TEXT,
  approved_root_promotion_manifest_hash TEXT,
  parent_promotion_proof_receipt_hash TEXT,
  contract_manifest_hash TEXT NOT NULL,
  macro_week_id TEXT NOT NULL,
  freeze_version TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  snapshot_state TEXT NOT NULL DEFAULT 'SEALED',
  sealed_at_utc TIMESTAMPTZ NOT NULL,
  settlement_deadline_utc TIMESTAMPTZ,
  settlement_completed_at_utc TIMESTAMPTZ,
  verified_at_utc TIMESTAMPTZ,
  activated_at_utc TIMESTAMPTZ,
  effective_from_utc TIMESTAMPTZ,
  effective_to_utc TIMESTAMPTZ,
  revoked_at_utc TIMESTAMPTZ,
  revocation_reason TEXT,
  supersedes_snapshot_id TEXT,
  superseded_by_snapshot_id TEXT,
  row_snapshot_count INTEGER NOT NULL,
  coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
  flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (regime_dataset_id, snapshot_id)
);

ALTER TABLE research_macro_weekly_snapshot_manifests
  ADD COLUMN IF NOT EXISTS feature_bundle_manifest_id TEXT,
  ADD COLUMN IF NOT EXISTS activation_scope TEXT,
  ADD COLUMN IF NOT EXISTS approved_root_promotion_manifest_id TEXT,
  ADD COLUMN IF NOT EXISTS approved_root_promotion_manifest_hash TEXT,
  ADD COLUMN IF NOT EXISTS parent_promotion_proof_receipt_hash TEXT;

DROP INDEX IF EXISTS idx_research_macro_weekly_snapshot_manifests_week;

CREATE INDEX IF NOT EXISTS idx_research_macro_weekly_snapshot_manifests_week
  ON research_macro_weekly_snapshot_manifests (
    regime_dataset_id,
    promotion_manifest_id,
    feature_bundle_manifest_id,
    macro_week_id,
    freeze_version
  );

DROP INDEX IF EXISTS idx_research_macro_weekly_snapshot_manifests_one_active;

CREATE UNIQUE INDEX IF NOT EXISTS idx_research_macro_weekly_snapshot_manifests_one_active
  ON research_macro_weekly_snapshot_manifests (
    promotion_manifest_id,
    COALESCE(feature_bundle_manifest_id, '${MACRO_ACTIVE_FEATURE_BUNDLE_FALLBACK}'),
    macro_week_id,
    freeze_version,
    COALESCE(activation_scope, '${MACRO_ACTIVE_SCOPE_FALLBACK}')
  )
  WHERE snapshot_state = 'ACTIVE';

CREATE TABLE IF NOT EXISTS research_macro_snapshot_state_transitions (
  regime_dataset_id UUID NOT NULL REFERENCES research_macro_regime_datasets(regime_dataset_id) ON DELETE CASCADE,
  snapshot_id TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  promotion_manifest_id TEXT,
  feature_bundle_manifest_id TEXT,
  activation_scope TEXT,
  contract_manifest_hash TEXT,
  approved_root_promotion_manifest_id TEXT,
  approved_root_promotion_manifest_hash TEXT,
  parent_promotion_proof_receipt_hash TEXT,
  from_state TEXT,
  to_state TEXT NOT NULL,
  transitioned_at_utc TIMESTAMPTZ NOT NULL,
  transition_run_id TEXT,
  reason TEXT,
  actor_or_service_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_macro_snapshot_state_transitions_snapshot
  ON research_macro_snapshot_state_transitions (regime_dataset_id, snapshot_id, transitioned_at_utc);

ALTER TABLE research_macro_snapshot_state_transitions
  ADD COLUMN IF NOT EXISTS snapshot_hash TEXT,
  ADD COLUMN IF NOT EXISTS promotion_manifest_id TEXT,
  ADD COLUMN IF NOT EXISTS feature_bundle_manifest_id TEXT,
  ADD COLUMN IF NOT EXISTS activation_scope TEXT,
  ADD COLUMN IF NOT EXISTS contract_manifest_hash TEXT,
  ADD COLUMN IF NOT EXISTS approved_root_promotion_manifest_id TEXT,
  ADD COLUMN IF NOT EXISTS approved_root_promotion_manifest_hash TEXT,
  ADD COLUMN IF NOT EXISTS parent_promotion_proof_receipt_hash TEXT;

CREATE TABLE IF NOT EXISTS research_macro_execution_receipts (
  regime_dataset_id UUID NOT NULL REFERENCES research_macro_regime_datasets(regime_dataset_id) ON DELETE CASCADE,
  execution_run_id TEXT NOT NULL,
  decision_at_utc TIMESTAMPTZ NOT NULL,
  macro_week_id TEXT NOT NULL,
  promotion_manifest_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  snapshot_state_observed TEXT NOT NULL,
  snapshot_read_at_utc TIMESTAMPTZ NOT NULL,
  coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
  flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (regime_dataset_id, execution_run_id, macro_week_id, promotion_manifest_id)
);

CREATE INDEX IF NOT EXISTS idx_research_macro_execution_receipts_snapshot
  ON research_macro_execution_receipts (promotion_manifest_id, macro_week_id, snapshot_id);

CREATE OR REPLACE FUNCTION research_macro_reject_non_identical_update()
RETURNS trigger AS $$
BEGIN
  IF (to_jsonb(NEW) - 'created_at' - 'completed_at') IS DISTINCT FROM (to_jsonb(OLD) - 'created_at' - 'completed_at') THEN
    RAISE EXCEPTION 'research macro immutable row conflict on %.%', TG_TABLE_SCHEMA, TG_TABLE_NAME
      USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION research_macro_reject_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'research macro append-only row mutation rejected on %.%', TG_TABLE_SCHEMA, TG_TABLE_NAME
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION research_macro_snapshot_transition_allowed(from_state TEXT, to_state TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN CASE from_state
    WHEN 'BUILDING' THEN to_state IN ('VALIDATED', 'REJECTED', 'SETTLEMENT_FAILED')
    WHEN 'VALIDATED' THEN to_state IN ('SEALED', 'REJECTED', 'SETTLEMENT_FAILED')
    WHEN 'SEALED' THEN to_state IN ('VERIFIED', 'REVOKED', 'QUARANTINED', 'VERIFICATION_FAILED')
    WHEN 'VERIFIED' THEN to_state IN ('ACTIVE', 'REVOKED', 'QUARANTINED')
    WHEN 'ACTIVE' THEN to_state IN ('REVOKED', 'QUARANTINED')
    ELSE FALSE
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION research_macro_guard_weekly_manifest_insert()
RETURNS trigger AS $$
BEGIN
  IF NEW.snapshot_state IN ('VERIFIED', 'ACTIVE', 'REVOKED', 'QUARANTINED') THEN
    RAISE EXCEPTION 'research macro manifest direct insert into lifecycle state % rejected', NEW.snapshot_state
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION research_macro_guard_weekly_manifest_update()
RETURNS trigger AS $$
DECLARE
  transition_service_enabled BOOLEAN;
  matching_transition_count INTEGER;
BEGIN
  transition_service_enabled := COALESCE(current_setting('limni.macro_transition_service', true), '') = 'on';

  IF transition_service_enabled THEN
    IF (to_jsonb(NEW)
        - 'snapshot_state'
        - 'verified_at_utc'
        - 'activated_at_utc'
        - 'effective_from_utc'
        - 'effective_to_utc'
        - 'revoked_at_utc'
        - 'revocation_reason'
        - 'superseded_by_snapshot_id'
        - 'feature_bundle_manifest_id'
        - 'activation_scope'
        - 'approved_root_promotion_manifest_id'
        - 'approved_root_promotion_manifest_hash'
        - 'parent_promotion_proof_receipt_hash'
        - 'created_at')
       IS DISTINCT FROM
       (to_jsonb(OLD)
        - 'snapshot_state'
        - 'verified_at_utc'
        - 'activated_at_utc'
        - 'effective_from_utc'
        - 'effective_to_utc'
        - 'revoked_at_utc'
        - 'revocation_reason'
        - 'superseded_by_snapshot_id'
        - 'feature_bundle_manifest_id'
        - 'activation_scope'
        - 'approved_root_promotion_manifest_id'
        - 'approved_root_promotion_manifest_hash'
        - 'parent_promotion_proof_receipt_hash'
        - 'created_at') THEN
      RAISE EXCEPTION 'research macro manifest content update rejected on %.%', TG_TABLE_SCHEMA, TG_TABLE_NAME
        USING ERRCODE = '23514';
    END IF;

    IF OLD.feature_bundle_manifest_id IS NOT NULL
       AND NEW.feature_bundle_manifest_id IS DISTINCT FROM OLD.feature_bundle_manifest_id THEN
      RAISE EXCEPTION 'research macro manifest feature bundle rebinding rejected on %.%', TG_TABLE_SCHEMA, TG_TABLE_NAME
        USING ERRCODE = '23514';
    END IF;
    IF OLD.activation_scope IS NOT NULL
       AND NEW.activation_scope IS DISTINCT FROM OLD.activation_scope THEN
      RAISE EXCEPTION 'research macro manifest activation scope rebinding rejected on %.%', TG_TABLE_SCHEMA, TG_TABLE_NAME
        USING ERRCODE = '23514';
    END IF;
    IF OLD.approved_root_promotion_manifest_id IS NOT NULL
       AND NEW.approved_root_promotion_manifest_id IS DISTINCT FROM OLD.approved_root_promotion_manifest_id THEN
      RAISE EXCEPTION 'research macro manifest root promotion id rebinding rejected on %.%', TG_TABLE_SCHEMA, TG_TABLE_NAME
        USING ERRCODE = '23514';
    END IF;
    IF OLD.approved_root_promotion_manifest_hash IS NOT NULL
       AND NEW.approved_root_promotion_manifest_hash IS DISTINCT FROM OLD.approved_root_promotion_manifest_hash THEN
      RAISE EXCEPTION 'research macro manifest root promotion hash rebinding rejected on %.%', TG_TABLE_SCHEMA, TG_TABLE_NAME
        USING ERRCODE = '23514';
    END IF;
    IF OLD.parent_promotion_proof_receipt_hash IS NOT NULL
       AND NEW.parent_promotion_proof_receipt_hash IS DISTINCT FROM OLD.parent_promotion_proof_receipt_hash THEN
      RAISE EXCEPTION 'research macro manifest parent proof hash rebinding rejected on %.%', TG_TABLE_SCHEMA, TG_TABLE_NAME
        USING ERRCODE = '23514';
    END IF;

    IF NEW.snapshot_state IS DISTINCT FROM OLD.snapshot_state THEN
      IF NOT research_macro_snapshot_transition_allowed(OLD.snapshot_state, NEW.snapshot_state) THEN
        RAISE EXCEPTION 'research macro illegal manifest transition % -> % rejected', OLD.snapshot_state, NEW.snapshot_state
          USING ERRCODE = '23514';
      END IF;

      SELECT COUNT(*) INTO matching_transition_count
      FROM research_macro_snapshot_state_transitions
      WHERE regime_dataset_id = NEW.regime_dataset_id
        AND snapshot_id = NEW.snapshot_id
        AND snapshot_hash = NEW.snapshot_hash
        AND from_state = OLD.snapshot_state
        AND to_state = NEW.snapshot_state;

      IF matching_transition_count = 0 THEN
        RAISE EXCEPTION 'research macro manifest transition % -> % missing append-only ledger row', OLD.snapshot_state, NEW.snapshot_state
        USING ERRCODE = '23514';
      END IF;
    ELSIF NEW.feature_bundle_manifest_id IS DISTINCT FROM OLD.feature_bundle_manifest_id
       OR NEW.activation_scope IS DISTINCT FROM OLD.activation_scope
       OR NEW.approved_root_promotion_manifest_id IS DISTINCT FROM OLD.approved_root_promotion_manifest_id
       OR NEW.approved_root_promotion_manifest_hash IS DISTINCT FROM OLD.approved_root_promotion_manifest_hash
       OR NEW.parent_promotion_proof_receipt_hash IS DISTINCT FROM OLD.parent_promotion_proof_receipt_hash THEN
      SELECT COUNT(*) INTO matching_transition_count
      FROM research_macro_snapshot_state_transitions
      WHERE regime_dataset_id = NEW.regime_dataset_id
        AND snapshot_id = NEW.snapshot_id
        AND snapshot_hash = NEW.snapshot_hash
        AND from_state = OLD.snapshot_state
        AND to_state = NEW.snapshot_state;

      IF matching_transition_count = 0 THEN
        RAISE EXCEPTION 'research macro manifest promotion-control binding missing append-only ledger row'
          USING ERRCODE = '23514';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW) - 'created_at') IS DISTINCT FROM (to_jsonb(OLD) - 'created_at') THEN
    RAISE EXCEPTION 'research macro manifest update must use transition service on %.%', TG_TABLE_SCHEMA, TG_TABLE_NAME
      USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_research_macro_regime_datasets_immutable
  ON research_macro_regime_datasets;
CREATE TRIGGER trg_research_macro_regime_datasets_immutable
  BEFORE UPDATE ON research_macro_regime_datasets
  FOR EACH ROW EXECUTE FUNCTION research_macro_reject_non_identical_update();

DROP TRIGGER IF EXISTS trg_research_macro_source_artifacts_immutable
  ON research_macro_source_artifacts;
CREATE TRIGGER trg_research_macro_source_artifacts_immutable
  BEFORE UPDATE ON research_macro_source_artifacts
  FOR EACH ROW EXECUTE FUNCTION research_macro_reject_non_identical_update();

DROP TRIGGER IF EXISTS trg_research_macro_availability_events_immutable
  ON research_macro_availability_events;
CREATE TRIGGER trg_research_macro_availability_events_immutable
  BEFORE UPDATE ON research_macro_availability_events
  FOR EACH ROW EXECUTE FUNCTION research_macro_reject_non_identical_update();

DROP TRIGGER IF EXISTS trg_research_macro_weekly_snapshot_manifests_guard
  ON research_macro_weekly_snapshot_manifests;
CREATE TRIGGER trg_research_macro_weekly_snapshot_manifests_guard
  BEFORE UPDATE ON research_macro_weekly_snapshot_manifests
  FOR EACH ROW EXECUTE FUNCTION research_macro_guard_weekly_manifest_update();

DROP TRIGGER IF EXISTS trg_research_macro_weekly_snapshot_manifests_insert_guard
  ON research_macro_weekly_snapshot_manifests;
CREATE TRIGGER trg_research_macro_weekly_snapshot_manifests_insert_guard
  BEFORE INSERT ON research_macro_weekly_snapshot_manifests
  FOR EACH ROW EXECUTE FUNCTION research_macro_guard_weekly_manifest_insert();

DROP TRIGGER IF EXISTS trg_research_macro_snapshot_state_transitions_append_only
  ON research_macro_snapshot_state_transitions;
CREATE TRIGGER trg_research_macro_snapshot_state_transitions_append_only
  BEFORE UPDATE OR DELETE ON research_macro_snapshot_state_transitions
  FOR EACH ROW EXECUTE FUNCTION research_macro_reject_mutation();

DROP TRIGGER IF EXISTS trg_research_macro_execution_receipts_immutable
  ON research_macro_execution_receipts;
CREATE TRIGGER trg_research_macro_execution_receipts_immutable
  BEFORE UPDATE ON research_macro_execution_receipts
  FOR EACH ROW EXECUTE FUNCTION research_macro_reject_non_identical_update();

CREATE TABLE IF NOT EXISTS research_macro_source_observations (
  regime_dataset_id UUID NOT NULL REFERENCES research_macro_regime_datasets(regime_dataset_id) ON DELETE CASCADE,
  source_family TEXT NOT NULL,
  source_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  instrument TEXT NOT NULL,
  source_observation_id TEXT NOT NULL,
  observation_date DATE NOT NULL,
  effective_at_utc TIMESTAMPTZ NOT NULL,
  available_at_utc TIMESTAMPTZ NOT NULL,
  fetched_at_utc TIMESTAMPTZ NOT NULL,
  source_url TEXT NOT NULL,
  source_hash TEXT,
  raw_value_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  normalized_value_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
  flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (
    regime_dataset_id,
    source_family,
    source_id,
    currency,
    instrument,
    source_observation_id
  )
);

ALTER TABLE research_macro_source_observations
  ADD COLUMN IF NOT EXISTS source_observation_id TEXT;

UPDATE research_macro_source_observations
SET source_observation_id = COALESCE(
  coverage->>'rawObservationId',
  md5(
    regime_dataset_id::text || '|' ||
    source_family || '|' ||
    source_id || '|' ||
    currency || '|' ||
    instrument || '|' ||
    observation_date::text || '|' ||
    available_at_utc::text || '|' ||
    COALESCE(raw_value_json->>'realtimeStart', '') || '|' ||
    COALESCE(raw_value_json->>'realtimeEnd', '')
  )
)
WHERE source_observation_id IS NULL;

ALTER TABLE research_macro_source_observations
  ALTER COLUMN source_observation_id SET NOT NULL;

ALTER TABLE research_macro_source_observations
  DROP CONSTRAINT IF EXISTS research_macro_source_observations_pkey;

ALTER TABLE research_macro_source_observations
  ADD PRIMARY KEY (
    regime_dataset_id,
    source_family,
    source_id,
    currency,
    instrument,
    source_observation_id
  );

CREATE INDEX IF NOT EXISTS idx_research_macro_source_observations_lookup
  ON research_macro_source_observations (
    regime_dataset_id,
    source_family,
    source_id,
    currency,
    observation_date
  );

CREATE INDEX IF NOT EXISTS idx_research_macro_source_observations_available
  ON research_macro_source_observations (
    regime_dataset_id,
    source_family,
    source_id,
    currency,
    available_at_utc
  );

CREATE TABLE IF NOT EXISTS research_macro_weekly_currency_snapshots (
  regime_dataset_id UUID NOT NULL REFERENCES research_macro_regime_datasets(regime_dataset_id) ON DELETE CASCADE,
  snapshot_id TEXT,
  promotion_manifest_id TEXT,
  contract_manifest_hash TEXT,
  macro_week_id TEXT,
  freeze_version TEXT,
  snapshot_hash TEXT,
  snapshot_state TEXT NOT NULL DEFAULT 'SEALED',
  sealed_at_utc TIMESTAMPTZ,
  week_open_utc TIMESTAMPTZ NOT NULL,
  source_family TEXT NOT NULL,
  source_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  instrument TEXT NOT NULL,
  as_of_utc TIMESTAMPTZ NOT NULL,
  source_observation_date DATE,
  effective_at_utc TIMESTAMPTZ,
  available_at_utc TIMESTAMPTZ,
  raw_value_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  normalized_value_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
  flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (
    regime_dataset_id,
    week_open_utc,
    source_family,
    source_id,
    currency,
    instrument
  )
);

ALTER TABLE research_macro_weekly_currency_snapshots
  ADD COLUMN IF NOT EXISTS snapshot_id TEXT,
  ADD COLUMN IF NOT EXISTS promotion_manifest_id TEXT,
  ADD COLUMN IF NOT EXISTS contract_manifest_hash TEXT,
  ADD COLUMN IF NOT EXISTS macro_week_id TEXT,
  ADD COLUMN IF NOT EXISTS freeze_version TEXT,
  ADD COLUMN IF NOT EXISTS snapshot_hash TEXT,
  ADD COLUMN IF NOT EXISTS snapshot_state TEXT NOT NULL DEFAULT 'SEALED',
  ADD COLUMN IF NOT EXISTS sealed_at_utc TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_research_macro_weekly_currency_snapshots_week
  ON research_macro_weekly_currency_snapshots (regime_dataset_id, week_open_utc, currency);

CREATE UNIQUE INDEX IF NOT EXISTS idx_research_macro_weekly_currency_snapshots_snapshot_id
  ON research_macro_weekly_currency_snapshots (regime_dataset_id, snapshot_id)
  WHERE snapshot_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_research_macro_weekly_currency_snapshots_source
  ON research_macro_weekly_currency_snapshots (
    regime_dataset_id,
    source_family,
    source_id,
    currency,
    week_open_utc
  );

DROP TRIGGER IF EXISTS trg_research_macro_source_observations_immutable
  ON research_macro_source_observations;
CREATE TRIGGER trg_research_macro_source_observations_immutable
  BEFORE UPDATE ON research_macro_source_observations
  FOR EACH ROW EXECUTE FUNCTION research_macro_reject_non_identical_update();

DROP TRIGGER IF EXISTS trg_research_macro_weekly_currency_snapshots_immutable
  ON research_macro_weekly_currency_snapshots;
CREATE TRIGGER trg_research_macro_weekly_currency_snapshots_immutable
  BEFORE UPDATE ON research_macro_weekly_currency_snapshots
  FOR EACH ROW EXECUTE FUNCTION research_macro_reject_non_identical_update();
`;

const BULK_JSON_CHUNK_SIZE = 1_000;

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, innerValue]) => [key, stableJsonValue(innerValue)]),
    );
  }
  return value;
}

function chunkRows<T>(rows: T[], chunkSize = BULK_JSON_CHUNK_SIZE) {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize));
  }
  return chunks;
}

function bulkJsonPayload(rows: unknown[]) {
  return JSON.stringify(rows);
}

export function hashMacroRegimePayload(payload: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(stableJsonValue(payload)))
    .digest("hex");
}

export async function ensureMacroRegimeWarehouseSchema() {
  await query(MACRO_REGIME_WAREHOUSE_SCHEMA_SQL);
}

export async function transitionMacroWeeklySnapshotManifestState(
  input: MacroSnapshotTransitionInput,
) {
  await transaction(async (client) => {
    const rows = await client.query<{
      promotion_manifest_id: string;
      feature_bundle_manifest_id: string | null;
      activation_scope: string | null;
      contract_manifest_hash: string;
      snapshot_hash: string;
      snapshot_state: MacroSnapshotState;
      approved_root_promotion_manifest_id: string | null;
      approved_root_promotion_manifest_hash: string | null;
      parent_promotion_proof_receipt_hash: string | null;
    }>(
      `
        SELECT
          promotion_manifest_id,
          feature_bundle_manifest_id,
          activation_scope,
          contract_manifest_hash,
          snapshot_hash,
          snapshot_state,
          approved_root_promotion_manifest_id,
          approved_root_promotion_manifest_hash,
          parent_promotion_proof_receipt_hash
        FROM research_macro_weekly_snapshot_manifests
        WHERE regime_dataset_id = $1::uuid
          AND snapshot_id = $2
        FOR UPDATE
      `,
      [input.regimeDatasetId, input.snapshotId],
    );
    const row = rows.rows[0];
    if (!row) {
      throw new Error(`Macro snapshot manifest not found for transition: ${input.snapshotId}`);
    }
    if (row.snapshot_hash !== input.expectedSnapshotHash) {
      throw new Error(`Macro snapshot hash mismatch for transition: ${input.snapshotId}`);
    }
    if (row.snapshot_state !== input.fromState) {
      throw new Error(
        `Macro snapshot state mismatch for transition ${input.snapshotId}: expected ${input.fromState}, found ${row.snapshot_state}`,
      );
    }
    if (!isMacroSnapshotStateTransitionAllowed(input.fromState, input.toState)) {
      throw new Error(`Illegal macro snapshot transition rejected: ${input.fromState} -> ${input.toState}`);
    }

    await client.query(
      "SELECT set_config('limni.macro_transition_service', 'on', true)",
    );
    await client.query(
      `
        INSERT INTO research_macro_snapshot_state_transitions (
          regime_dataset_id,
          snapshot_id,
          snapshot_hash,
          promotion_manifest_id,
          feature_bundle_manifest_id,
          activation_scope,
          contract_manifest_hash,
          approved_root_promotion_manifest_id,
          approved_root_promotion_manifest_hash,
          parent_promotion_proof_receipt_hash,
          from_state,
          to_state,
          transitioned_at_utc,
          transition_run_id,
          reason,
          actor_or_service_version
        ) VALUES (
          $1::uuid,
          $2,
          $3,
          $4,
          COALESCE($5, $6),
          COALESCE($7, $8),
          $9,
          COALESCE($10, $11),
          COALESCE($12, $13),
          COALESCE($14, $15),
          $16,
          $17,
          $18::timestamptz,
          $19,
          $20,
          $21
        )
      `,
      [
        input.regimeDatasetId,
        input.snapshotId,
        row.snapshot_hash,
        row.promotion_manifest_id,
        input.featureBundleManifestId ?? null,
        row.feature_bundle_manifest_id,
        input.activationScope ?? null,
        row.activation_scope,
        row.contract_manifest_hash,
        input.approvedRootPromotionManifestId ?? null,
        row.approved_root_promotion_manifest_id,
        input.approvedRootPromotionManifestHash ?? null,
        row.approved_root_promotion_manifest_hash,
        input.parentPromotionProofReceiptHash ?? null,
        row.parent_promotion_proof_receipt_hash,
        input.fromState,
        input.toState,
        input.transitionedAtUtc,
        input.transitionRunId,
        input.reason,
        input.actorOrServiceVersion,
      ],
    );
    await client.query(
      `
        UPDATE research_macro_weekly_snapshot_manifests
        SET snapshot_state = $3,
            feature_bundle_manifest_id = COALESCE($4, feature_bundle_manifest_id),
            activation_scope = COALESCE($5, activation_scope),
            verified_at_utc = CASE
              WHEN $3 = 'VERIFIED' THEN $6::timestamptz
              ELSE verified_at_utc
            END,
            activated_at_utc = CASE
              WHEN $3 = 'ACTIVE' THEN $6::timestamptz
              ELSE activated_at_utc
            END,
            effective_from_utc = CASE
              WHEN $3 = 'ACTIVE' THEN COALESCE($7::timestamptz, effective_from_utc)
              ELSE effective_from_utc
            END,
            effective_to_utc = COALESCE($8::timestamptz, effective_to_utc),
            revoked_at_utc = CASE
              WHEN $3 = 'REVOKED' THEN $6::timestamptz
              ELSE revoked_at_utc
            END,
            revocation_reason = CASE
              WHEN $3 = 'REVOKED' THEN COALESCE($9, revocation_reason)
              ELSE revocation_reason
            END,
            superseded_by_snapshot_id = COALESCE($10, superseded_by_snapshot_id),
            approved_root_promotion_manifest_id = COALESCE($11, approved_root_promotion_manifest_id),
            approved_root_promotion_manifest_hash = COALESCE($12, approved_root_promotion_manifest_hash),
            parent_promotion_proof_receipt_hash = COALESCE($13, parent_promotion_proof_receipt_hash)
        WHERE regime_dataset_id = $1::uuid
          AND snapshot_id = $2
      `,
      [
        input.regimeDatasetId,
        input.snapshotId,
        input.toState,
        input.featureBundleManifestId ?? null,
        input.activationScope ?? null,
        input.transitionedAtUtc,
        input.effectiveFromUtc ?? null,
        input.effectiveToUtc ?? null,
        input.revocationReason ?? null,
        input.supersededBySnapshotId ?? null,
        input.approvedRootPromotionManifestId ?? null,
        input.approvedRootPromotionManifestHash ?? null,
        input.parentPromotionProofReceiptHash ?? null,
      ],
    );
  });
}

export async function bindMacroWeeklySnapshotManifestPromotionControls(
  input: MacroSnapshotPromotionControlBindingInput,
) {
  await transaction(async (client) => {
    const rows = await client.query<{
      promotion_manifest_id: string;
      feature_bundle_manifest_id: string | null;
      activation_scope: string | null;
      contract_manifest_hash: string;
      snapshot_hash: string;
      snapshot_state: MacroSnapshotState;
      approved_root_promotion_manifest_id: string | null;
      approved_root_promotion_manifest_hash: string | null;
      parent_promotion_proof_receipt_hash: string | null;
    }>(
      `
        SELECT
          promotion_manifest_id,
          feature_bundle_manifest_id,
          activation_scope,
          contract_manifest_hash,
          snapshot_hash,
          snapshot_state,
          approved_root_promotion_manifest_id,
          approved_root_promotion_manifest_hash,
          parent_promotion_proof_receipt_hash
        FROM research_macro_weekly_snapshot_manifests
        WHERE regime_dataset_id = $1::uuid
          AND snapshot_id = $2
        FOR UPDATE
      `,
      [input.regimeDatasetId, input.snapshotId],
    );
    const row = rows.rows[0];
    if (!row) {
      throw new Error(`Macro snapshot manifest not found for promotion-control binding: ${input.snapshotId}`);
    }
    if (row.snapshot_hash !== input.expectedSnapshotHash) {
      throw new Error(`Macro snapshot hash mismatch for promotion-control binding: ${input.snapshotId}`);
    }

    await client.query(
      "SELECT set_config('limni.macro_transition_service', 'on', true)",
    );
    await client.query(
      `
        INSERT INTO research_macro_snapshot_state_transitions (
          regime_dataset_id,
          snapshot_id,
          snapshot_hash,
          promotion_manifest_id,
          feature_bundle_manifest_id,
          activation_scope,
          contract_manifest_hash,
          approved_root_promotion_manifest_id,
          approved_root_promotion_manifest_hash,
          parent_promotion_proof_receipt_hash,
          from_state,
          to_state,
          transitioned_at_utc,
          transition_run_id,
          reason,
          actor_or_service_version
        ) VALUES (
          $1::uuid,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $11,
          $12::timestamptz,
          $13,
          $14,
          $15
        )
      `,
      [
        input.regimeDatasetId,
        input.snapshotId,
        row.snapshot_hash,
        row.promotion_manifest_id,
        input.featureBundleManifestId,
        input.activationScope,
        row.contract_manifest_hash,
        input.approvedRootPromotionManifestId,
        input.approvedRootPromotionManifestHash,
        input.parentPromotionProofReceiptHash,
        row.snapshot_state,
        input.transitionedAtUtc,
        input.transitionRunId,
        input.reason,
        input.actorOrServiceVersion,
      ],
    );
    await client.query(
      `
        UPDATE research_macro_weekly_snapshot_manifests
        SET feature_bundle_manifest_id = $3,
            activation_scope = $4,
            approved_root_promotion_manifest_id = $5,
            approved_root_promotion_manifest_hash = $6,
            parent_promotion_proof_receipt_hash = $7
        WHERE regime_dataset_id = $1::uuid
          AND snapshot_id = $2
      `,
      [
        input.regimeDatasetId,
        input.snapshotId,
        input.featureBundleManifestId,
        input.activationScope,
        input.approvedRootPromotionManifestId,
        input.approvedRootPromotionManifestHash,
        input.parentPromotionProofReceiptHash,
      ],
    );
  });
}

export async function upsertMacroRegimeDataset(
  input: MacroRegimeDatasetInput,
): Promise<MacroRegimeDatasetRecord> {
  const rows = await query<{
    regime_dataset_id: string;
    dataset_hash: string;
  }>(
    `
      INSERT INTO research_macro_regime_datasets (
        dataset_version,
        dataset_hash,
        asset_class,
        from_week_open_utc,
        to_week_open_utc,
        currencies,
        source_versions,
        coverage,
        notes,
        status,
        promotion_manifest_id,
        contract_manifest_hash,
        snapshot_state,
        settlement_deadline_utc,
        settlement_completed_at_utc,
        sealed_at_utc,
        verified_at_utc,
        activated_at_utc,
        effective_from_utc,
        effective_to_utc,
        revoked_at_utc,
        revocation_reason,
        supersedes_snapshot_id,
        superseded_by_snapshot_id,
        verification_run_id,
        supersedes_regime_dataset_id,
        reconstruction_mode,
        calendar_version,
        selector_version,
        validation_contract_version,
        build_version,
        completed_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6::jsonb,
        $7::jsonb,
        $8::jsonb,
        $9::text[],
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16,
        $17,
        $18,
        $19,
        $20,
        $21,
        $22,
        $23,
        $24,
        $25,
        $26::uuid,
        $27,
        $28,
        $29,
        $30,
        $31,
        CASE WHEN $10 = 'complete' THEN NOW() ELSE NULL END
      )
      ON CONFLICT (dataset_hash)
      DO UPDATE SET
        dataset_version = EXCLUDED.dataset_version,
        asset_class = EXCLUDED.asset_class,
        from_week_open_utc = EXCLUDED.from_week_open_utc,
        to_week_open_utc = EXCLUDED.to_week_open_utc,
        currencies = EXCLUDED.currencies,
        source_versions = EXCLUDED.source_versions,
        coverage = EXCLUDED.coverage,
        notes = EXCLUDED.notes,
        status = EXCLUDED.status,
        promotion_manifest_id = EXCLUDED.promotion_manifest_id,
        contract_manifest_hash = EXCLUDED.contract_manifest_hash,
        snapshot_state = EXCLUDED.snapshot_state,
        settlement_deadline_utc = EXCLUDED.settlement_deadline_utc,
        settlement_completed_at_utc = EXCLUDED.settlement_completed_at_utc,
        sealed_at_utc = EXCLUDED.sealed_at_utc,
        verified_at_utc = EXCLUDED.verified_at_utc,
        activated_at_utc = EXCLUDED.activated_at_utc,
        effective_from_utc = EXCLUDED.effective_from_utc,
        effective_to_utc = EXCLUDED.effective_to_utc,
        revoked_at_utc = EXCLUDED.revoked_at_utc,
        revocation_reason = EXCLUDED.revocation_reason,
        supersedes_snapshot_id = EXCLUDED.supersedes_snapshot_id,
        superseded_by_snapshot_id = EXCLUDED.superseded_by_snapshot_id,
        verification_run_id = EXCLUDED.verification_run_id,
        supersedes_regime_dataset_id = EXCLUDED.supersedes_regime_dataset_id,
        reconstruction_mode = EXCLUDED.reconstruction_mode,
        calendar_version = EXCLUDED.calendar_version,
        selector_version = EXCLUDED.selector_version,
        validation_contract_version = EXCLUDED.validation_contract_version,
        build_version = EXCLUDED.build_version,
        completed_at = EXCLUDED.completed_at
      RETURNING regime_dataset_id, dataset_hash
    `,
    [
      input.datasetVersion,
      input.datasetHash,
      input.assetClass,
      input.fromWeekOpenUtc,
      input.toWeekOpenUtc,
      JSON.stringify(input.currencies),
      JSON.stringify(input.sourceVersions ?? {}),
      JSON.stringify(input.coverage ?? {}),
      input.notes ?? [],
      input.status ?? "building",
      input.promotionManifestId ?? null,
      input.contractManifestHash ?? null,
      input.snapshotState ?? "BUILDING",
      input.settlementDeadlineUtc ?? null,
      input.settlementCompletedAtUtc ?? null,
      input.sealedAtUtc ?? null,
      input.verifiedAtUtc ?? null,
      input.activatedAtUtc ?? null,
      input.effectiveFromUtc ?? null,
      input.effectiveToUtc ?? null,
      input.revokedAtUtc ?? null,
      input.revocationReason ?? null,
      input.supersedesSnapshotId ?? null,
      input.supersededBySnapshotId ?? null,
      input.verificationRunId ?? null,
      input.supersedesRegimeDatasetId ?? null,
      input.reconstructionMode ?? null,
      input.calendarVersion ?? null,
      input.selectorVersion ?? null,
      input.validationContractVersion ?? null,
      input.buildVersion ?? null,
    ],
  );
  const row = rows[0];
  if (!row) {
    throw new Error("Macro regime dataset upsert did not return a row.");
  }
  return {
    regimeDatasetId: row.regime_dataset_id,
    datasetHash: row.dataset_hash,
  };
}

export async function persistMacroSourceArtifacts(options: {
  regimeDatasetId: string;
  rows: MacroSourceArtifact[];
}) {
  if (options.rows.length === 0) return 0;

  let written = 0;
  await transaction(async (client) => {
    for (const chunk of chunkRows(options.rows, 1)) {
      const payload = bulkJsonPayload(chunk.map((row) => ({
        artifact_id: row.artifactId,
        source_family: row.sourceFamily,
        source_id: row.sourceId,
        currency: row.currency.toUpperCase(),
        endpoint_id: row.endpointId,
        endpoint_url: row.endpointUrl,
        fetched_at_utc: row.fetchedAtUtc,
        http_status: row.httpStatus,
        response_headers_json: row.responseHeaders ?? {},
        sanitized_request_json: row.sanitizedRequest ?? {},
        raw_content_type: row.rawContentType,
        raw_payload_sha256: row.rawPayloadSha256,
        raw_payload_size_bytes: row.rawPayloadSizeBytes,
        raw_payload_text: row.rawPayloadText,
        raw_payload_bytes_base64: row.rawPayloadBytesBase64 ?? null,
        coverage: row.coverage ?? {},
        flags: row.flags ?? {},
      })));
      const result = await client.query(
        `
          WITH incoming AS (
            SELECT *
            FROM jsonb_to_recordset($2::jsonb) AS row(
              artifact_id TEXT,
              source_family TEXT,
              source_id TEXT,
              currency TEXT,
              endpoint_id TEXT,
              endpoint_url TEXT,
              fetched_at_utc TIMESTAMPTZ,
              http_status INTEGER,
              response_headers_json JSONB,
              sanitized_request_json JSONB,
              raw_content_type TEXT,
              raw_payload_sha256 TEXT,
              raw_payload_size_bytes INTEGER,
              raw_payload_text TEXT,
              raw_payload_bytes_base64 TEXT,
              coverage JSONB,
              flags JSONB
            )
          )
          INSERT INTO research_macro_source_artifacts (
            regime_dataset_id,
            artifact_id,
            source_family,
            source_id,
            currency,
            endpoint_id,
            endpoint_url,
            fetched_at_utc,
            http_status,
            response_headers_json,
            sanitized_request_json,
            raw_content_type,
            raw_payload_sha256,
            raw_payload_size_bytes,
            raw_payload_text,
            coverage,
            flags
          )
          SELECT
            $1::uuid,
            artifact_id,
            source_family,
            source_id,
            currency,
            endpoint_id,
            endpoint_url,
            fetched_at_utc,
            http_status,
            COALESCE(response_headers_json, '{}'::jsonb),
            COALESCE(sanitized_request_json, '{}'::jsonb),
            raw_content_type,
            raw_payload_sha256,
            raw_payload_size_bytes,
            raw_payload_text,
            COALESCE(coverage, '{}'::jsonb),
            COALESCE(flags, '{}'::jsonb)
          FROM incoming
          ON CONFLICT (regime_dataset_id, artifact_id)
          DO UPDATE SET
            source_family = EXCLUDED.source_family,
            source_id = EXCLUDED.source_id,
            currency = EXCLUDED.currency,
            endpoint_id = EXCLUDED.endpoint_id,
            endpoint_url = EXCLUDED.endpoint_url,
            fetched_at_utc = EXCLUDED.fetched_at_utc,
            http_status = EXCLUDED.http_status,
            response_headers_json = EXCLUDED.response_headers_json,
            sanitized_request_json = EXCLUDED.sanitized_request_json,
            raw_content_type = EXCLUDED.raw_content_type,
            raw_payload_sha256 = EXCLUDED.raw_payload_sha256,
            raw_payload_size_bytes = EXCLUDED.raw_payload_size_bytes,
            raw_payload_text = EXCLUDED.raw_payload_text,
            coverage = EXCLUDED.coverage,
            flags = EXCLUDED.flags
        `,
        [options.regimeDatasetId, payload],
      );
      written += result.rowCount ?? 0;
      await client.query(
        `
          WITH incoming AS (
            SELECT *
            FROM jsonb_to_recordset($1::jsonb) AS row(
              raw_payload_sha256 TEXT,
              raw_payload_size_bytes INTEGER,
              raw_content_type TEXT,
              raw_payload_bytes_base64 TEXT,
              coverage JSONB,
              flags JSONB
            )
          )
          INSERT INTO research_macro_source_artifact_byte_archives (
            raw_payload_sha256,
            raw_payload_size_bytes,
            raw_content_type,
            raw_payload_base64,
            archive_origin,
            original_artifact_record_mutated,
            coverage,
            flags
          )
          SELECT
            raw_payload_sha256,
            raw_payload_size_bytes,
            raw_content_type,
            raw_payload_bytes_base64,
            'materializer_binary_payload_archive_v1',
            FALSE,
            COALESCE(coverage, '{}'::jsonb),
            COALESCE(flags, '{}'::jsonb)
          FROM incoming
          WHERE raw_payload_bytes_base64 IS NOT NULL
          ON CONFLICT (raw_payload_sha256) DO NOTHING
        `,
        [payload],
      );
    }
  });

  return written;
}

export async function persistMacroAvailabilityEvents(options: {
  regimeDatasetId: string;
  rows: MacroAvailabilityEvent[];
}) {
  if (options.rows.length === 0) return 0;

  let written = 0;
  await transaction(async (client) => {
    for (const chunk of chunkRows(options.rows)) {
      const payload = bulkJsonPayload(chunk.map((row) => ({
        availability_event_id: row.availabilityEventId,
        source_family: row.sourceFamily,
        source_id: row.sourceId,
        currency: row.currency.toUpperCase(),
        instrument: row.instrument,
        observation_date: row.observationDate,
        release_or_vintage_id: row.releaseOrVintageId,
        public_release_at_utc: row.publicReleaseAtUtc,
        endpoint_available_at_utc: row.endpointAvailableAtUtc,
        availability_date: row.availabilityDate,
        availability_basis: row.availabilityBasis,
        retrieval_capability: row.retrievalCapability,
        availability_precision: row.availabilityPrecision,
        eligibility_policy: row.eligibilityPolicy,
        availability_timezone: row.availabilityTimezone,
        availability_evidence_artifact_id: row.availabilityEvidenceArtifactId,
        availability_rule_version: row.availabilityRuleVersion,
        availability_confidence: row.availabilityConfidence,
        promotion_eligible_availability_bases: row.promotionEligibleAvailabilityBases ?? [],
        minimum_availability_confidence: row.minimumAvailabilityConfidence,
        exception_calendar_version: row.exceptionCalendarVersion,
        eligibility_calendar_version: row.eligibilityCalendarVersion,
        eligible_from_week_open_utc: row.eligibleFromWeekOpenUtc,
        exception_or_delay_flag: row.exceptionOrDelayFlag,
        coverage: row.coverage ?? {},
        flags: row.flags ?? {},
      })));
      const result = await client.query(
        `
          WITH incoming AS (
            SELECT *
            FROM jsonb_to_recordset($2::jsonb) AS row(
              availability_event_id TEXT,
              source_family TEXT,
              source_id TEXT,
              currency TEXT,
              instrument TEXT,
              observation_date DATE,
              release_or_vintage_id TEXT,
              public_release_at_utc TIMESTAMPTZ,
              endpoint_available_at_utc TIMESTAMPTZ,
              availability_date DATE,
              availability_basis TEXT,
              retrieval_capability TEXT,
              availability_precision TEXT,
              eligibility_policy TEXT,
              availability_timezone TEXT,
              availability_evidence_artifact_id TEXT,
              availability_rule_version TEXT,
              availability_confidence TEXT,
              promotion_eligible_availability_bases JSONB,
              minimum_availability_confidence TEXT,
              exception_calendar_version TEXT,
              eligibility_calendar_version TEXT,
              eligible_from_week_open_utc TIMESTAMPTZ,
              exception_or_delay_flag BOOLEAN,
              coverage JSONB,
              flags JSONB
            )
          )
          INSERT INTO research_macro_availability_events (
            regime_dataset_id,
            availability_event_id,
            source_family,
            source_id,
            currency,
            instrument,
            observation_date,
            release_or_vintage_id,
            public_release_at_utc,
            endpoint_available_at_utc,
            availability_date,
            availability_basis,
            retrieval_capability,
            availability_precision,
            eligibility_policy,
            availability_timezone,
            availability_evidence_artifact_id,
            availability_rule_version,
            availability_confidence,
            promotion_eligible_availability_bases,
            minimum_availability_confidence,
            exception_calendar_version,
            eligibility_calendar_version,
            eligible_from_week_open_utc,
            exception_or_delay_flag,
            coverage,
            flags
          )
          SELECT
            $1::uuid,
            availability_event_id,
            source_family,
            source_id,
            currency,
            instrument,
            observation_date,
            release_or_vintage_id,
            public_release_at_utc,
            endpoint_available_at_utc,
            availability_date,
            availability_basis,
            retrieval_capability,
            availability_precision,
            eligibility_policy,
            availability_timezone,
            availability_evidence_artifact_id,
            availability_rule_version,
            availability_confidence,
            COALESCE(promotion_eligible_availability_bases, '[]'::jsonb),
            minimum_availability_confidence,
            exception_calendar_version,
            eligibility_calendar_version,
            eligible_from_week_open_utc,
            COALESCE(exception_or_delay_flag, false),
            COALESCE(coverage, '{}'::jsonb),
            COALESCE(flags, '{}'::jsonb)
          FROM incoming
          ON CONFLICT (regime_dataset_id, availability_event_id)
          DO UPDATE SET
            source_family = EXCLUDED.source_family,
            source_id = EXCLUDED.source_id,
            currency = EXCLUDED.currency,
            instrument = EXCLUDED.instrument,
            observation_date = EXCLUDED.observation_date,
            release_or_vintage_id = EXCLUDED.release_or_vintage_id,
            public_release_at_utc = EXCLUDED.public_release_at_utc,
            endpoint_available_at_utc = EXCLUDED.endpoint_available_at_utc,
            availability_date = EXCLUDED.availability_date,
            availability_basis = EXCLUDED.availability_basis,
            retrieval_capability = EXCLUDED.retrieval_capability,
            availability_precision = EXCLUDED.availability_precision,
            eligibility_policy = EXCLUDED.eligibility_policy,
            availability_timezone = EXCLUDED.availability_timezone,
            availability_evidence_artifact_id = EXCLUDED.availability_evidence_artifact_id,
            availability_rule_version = EXCLUDED.availability_rule_version,
            availability_confidence = EXCLUDED.availability_confidence,
            promotion_eligible_availability_bases = EXCLUDED.promotion_eligible_availability_bases,
            minimum_availability_confidence = EXCLUDED.minimum_availability_confidence,
            exception_calendar_version = EXCLUDED.exception_calendar_version,
            eligibility_calendar_version = EXCLUDED.eligibility_calendar_version,
            eligible_from_week_open_utc = EXCLUDED.eligible_from_week_open_utc,
            exception_or_delay_flag = EXCLUDED.exception_or_delay_flag,
            coverage = EXCLUDED.coverage,
            flags = EXCLUDED.flags
        `,
        [options.regimeDatasetId, payload],
      );
      written += result.rowCount ?? 0;
    }
  });

  return written;
}

export async function persistMacroSourceObservations(options: {
  regimeDatasetId: string;
  rows: MacroSourceObservation[];
}) {
  if (options.rows.length === 0) return 0;

  let written = 0;
  await transaction(async (client) => {
    for (const chunk of chunkRows(options.rows)) {
      const payload = bulkJsonPayload(chunk.map((row) => ({
        source_family: row.sourceFamily,
        source_id: row.sourceId,
        currency: row.currency.toUpperCase(),
        instrument: row.instrument,
        source_observation_id: typeof row.coverage.rawObservationId === "string"
          ? row.coverage.rawObservationId
          : hashMacroRegimePayload({
            sourceFamily: row.sourceFamily,
            sourceId: row.sourceId,
            currency: row.currency.toUpperCase(),
            instrument: row.instrument,
            observationDate: row.observationDate,
            effectiveAtUtc: row.effectiveAtUtc,
            availableAtUtc: row.availableAtUtc,
            rawValue: row.rawValue,
            normalizedValue: row.normalizedValue,
          }),
        observation_date: row.observationDate,
        effective_at_utc: row.effectiveAtUtc,
        available_at_utc: row.availableAtUtc,
        fetched_at_utc: row.fetchedAtUtc,
        source_url: row.sourceUrl,
        source_hash: row.sourceHash,
        raw_value_json: row.rawValue ?? {},
        normalized_value_json: row.normalizedValue ?? {},
        coverage: row.coverage ?? {},
        flags: row.flags ?? {},
      })));
      const result = await client.query(
        `
          WITH incoming AS (
            SELECT *
            FROM jsonb_to_recordset($2::jsonb) AS row(
              source_family TEXT,
              source_id TEXT,
              currency TEXT,
              instrument TEXT,
              source_observation_id TEXT,
              observation_date DATE,
              effective_at_utc TIMESTAMPTZ,
              available_at_utc TIMESTAMPTZ,
              fetched_at_utc TIMESTAMPTZ,
              source_url TEXT,
              source_hash TEXT,
              raw_value_json JSONB,
              normalized_value_json JSONB,
              coverage JSONB,
              flags JSONB
            )
          )
          INSERT INTO research_macro_source_observations (
            regime_dataset_id,
            source_family,
            source_id,
            currency,
            instrument,
            source_observation_id,
            observation_date,
            effective_at_utc,
            available_at_utc,
            fetched_at_utc,
            source_url,
            source_hash,
            raw_value_json,
            normalized_value_json,
            coverage,
            flags
          )
          SELECT
            $1::uuid,
            source_family,
            source_id,
            currency,
            instrument,
            source_observation_id,
            observation_date,
            effective_at_utc,
            available_at_utc,
            fetched_at_utc,
            source_url,
            source_hash,
            COALESCE(raw_value_json, '{}'::jsonb),
            COALESCE(normalized_value_json, '{}'::jsonb),
            COALESCE(coverage, '{}'::jsonb),
            COALESCE(flags, '{}'::jsonb)
          FROM incoming
          ON CONFLICT (
            regime_dataset_id,
            source_family,
            source_id,
            currency,
            instrument,
            source_observation_id
          )
          DO UPDATE SET
            effective_at_utc = EXCLUDED.effective_at_utc,
            available_at_utc = EXCLUDED.available_at_utc,
            fetched_at_utc = EXCLUDED.fetched_at_utc,
            source_url = EXCLUDED.source_url,
            source_hash = EXCLUDED.source_hash,
            raw_value_json = EXCLUDED.raw_value_json,
            normalized_value_json = EXCLUDED.normalized_value_json,
            coverage = EXCLUDED.coverage,
            flags = EXCLUDED.flags
        `,
        [options.regimeDatasetId, payload],
      );
      written += result.rowCount ?? 0;
    }
  });

  return written;
}

export async function persistMacroWeeklyCurrencySnapshots(options: {
  regimeDatasetId: string;
  rows: MacroWeeklyCurrencySnapshot[];
}) {
  if (options.rows.length === 0) return 0;

  let written = 0;
  await transaction(async (client) => {
    for (const chunk of chunkRows(options.rows)) {
      const payload = bulkJsonPayload(chunk.map((row) => ({
        snapshot_id: row.snapshotId,
        promotion_manifest_id: row.promotionManifestId,
        contract_manifest_hash: row.contractManifestHash,
        macro_week_id: row.macroWeekId,
        freeze_version: row.freezeVersion,
        snapshot_hash: row.snapshotHash,
        snapshot_state: row.snapshotState,
        sealed_at_utc: row.sealedAtUtc,
        week_open_utc: row.weekOpenUtc,
        source_family: row.sourceFamily,
        source_id: row.sourceId,
        currency: row.currency.toUpperCase(),
        instrument: row.instrument,
        as_of_utc: row.asOfUtc,
        source_observation_date: row.sourceObservationDate,
        effective_at_utc: row.effectiveAtUtc,
        available_at_utc: row.availableAtUtc,
        raw_value_json: row.rawValue ?? {},
        normalized_value_json: row.normalizedValue ?? {},
        coverage: row.coverage ?? {},
        flags: row.flags ?? {},
      })));
      const result = await client.query(
        `
          WITH incoming AS (
            SELECT *
            FROM jsonb_to_recordset($2::jsonb) AS row(
              snapshot_id TEXT,
              promotion_manifest_id TEXT,
              contract_manifest_hash TEXT,
              macro_week_id TEXT,
              freeze_version TEXT,
              snapshot_hash TEXT,
              snapshot_state TEXT,
              sealed_at_utc TIMESTAMPTZ,
              week_open_utc TIMESTAMPTZ,
              source_family TEXT,
              source_id TEXT,
              currency TEXT,
              instrument TEXT,
              as_of_utc TIMESTAMPTZ,
              source_observation_date DATE,
              effective_at_utc TIMESTAMPTZ,
              available_at_utc TIMESTAMPTZ,
              raw_value_json JSONB,
              normalized_value_json JSONB,
              coverage JSONB,
              flags JSONB
            )
          ),
          enriched AS (
            SELECT
              snapshot_id,
              promotion_manifest_id,
              contract_manifest_hash,
              macro_week_id,
              freeze_version,
              snapshot_hash,
              COALESCE(snapshot_state, 'SEALED') AS snapshot_state,
              sealed_at_utc,
              week_open_utc,
              source_family,
              source_id,
              currency,
              instrument,
              as_of_utc,
              source_observation_date,
              effective_at_utc,
              available_at_utc,
              raw_value_json,
              normalized_value_json,
              coverage,
              flags
            FROM incoming
          )
          INSERT INTO research_macro_weekly_currency_snapshots (
            regime_dataset_id,
            snapshot_id,
            promotion_manifest_id,
            contract_manifest_hash,
            macro_week_id,
            freeze_version,
            snapshot_hash,
            snapshot_state,
            sealed_at_utc,
            week_open_utc,
            source_family,
            source_id,
            currency,
            instrument,
            as_of_utc,
            source_observation_date,
            effective_at_utc,
            available_at_utc,
            raw_value_json,
            normalized_value_json,
            coverage,
            flags
          )
          SELECT
            $1::uuid,
            snapshot_id,
            promotion_manifest_id,
            contract_manifest_hash,
            macro_week_id,
            freeze_version,
            snapshot_hash,
            snapshot_state,
            sealed_at_utc,
            week_open_utc,
            source_family,
            source_id,
            currency,
            instrument,
            as_of_utc,
            source_observation_date,
            effective_at_utc,
            available_at_utc,
            COALESCE(raw_value_json, '{}'::jsonb),
            COALESCE(normalized_value_json, '{}'::jsonb),
            COALESCE(coverage, '{}'::jsonb),
            COALESCE(flags, '{}'::jsonb)
          FROM enriched
          ON CONFLICT (
            regime_dataset_id,
            week_open_utc,
            source_family,
            source_id,
            currency,
            instrument
          )
          DO UPDATE SET
            snapshot_id = EXCLUDED.snapshot_id,
            promotion_manifest_id = EXCLUDED.promotion_manifest_id,
            contract_manifest_hash = EXCLUDED.contract_manifest_hash,
            macro_week_id = EXCLUDED.macro_week_id,
            freeze_version = EXCLUDED.freeze_version,
            snapshot_hash = EXCLUDED.snapshot_hash,
            snapshot_state = EXCLUDED.snapshot_state,
            sealed_at_utc = EXCLUDED.sealed_at_utc,
            as_of_utc = EXCLUDED.as_of_utc,
            source_observation_date = EXCLUDED.source_observation_date,
            effective_at_utc = EXCLUDED.effective_at_utc,
            available_at_utc = EXCLUDED.available_at_utc,
            raw_value_json = EXCLUDED.raw_value_json,
            normalized_value_json = EXCLUDED.normalized_value_json,
            coverage = EXCLUDED.coverage,
            flags = EXCLUDED.flags
        `,
        [options.regimeDatasetId, payload],
      );
      written += result.rowCount ?? 0;
    }
  });

  return written;
}

export async function persistMacroWeeklySnapshotManifests(options: {
  regimeDatasetId: string;
  rows: MacroWeeklySnapshotManifest[];
}) {
  if (options.rows.length === 0) return 0;

  let written = 0;
  await transaction(async (client) => {
    for (const chunk of chunkRows(options.rows)) {
      const payload = bulkJsonPayload(chunk.map((row) => ({
        promotion_manifest_id: row.promotionManifestId,
        feature_bundle_manifest_id: row.featureBundleManifestId ?? null,
        activation_scope: row.activationScope ?? null,
        approved_root_promotion_manifest_id: row.approvedRootPromotionManifestId ?? null,
        approved_root_promotion_manifest_hash: row.approvedRootPromotionManifestHash ?? null,
        parent_promotion_proof_receipt_hash: row.parentPromotionProofReceiptHash ?? null,
        contract_manifest_hash: row.contractManifestHash,
        macro_week_id: row.macroWeekId,
        freeze_version: row.freezeVersion,
        snapshot_id: row.snapshotId,
        snapshot_hash: row.snapshotHash,
        snapshot_state: row.snapshotState,
        sealed_at_utc: row.sealedAtUtc,
        settlement_deadline_utc: row.settlementDeadlineUtc,
        settlement_completed_at_utc: row.settlementCompletedAtUtc,
        verified_at_utc: row.verifiedAtUtc,
        activated_at_utc: row.activatedAtUtc,
        effective_from_utc: row.effectiveFromUtc,
        effective_to_utc: row.effectiveToUtc,
        revoked_at_utc: row.revokedAtUtc,
        revocation_reason: row.revocationReason,
        supersedes_snapshot_id: row.supersedesSnapshotId,
        superseded_by_snapshot_id: row.supersededBySnapshotId,
        row_snapshot_count: row.rowSnapshotCount,
        coverage: row.coverage ?? {},
        flags: row.flags ?? {},
      })));
      const result = await client.query(
        `
          WITH incoming AS (
            SELECT *
            FROM jsonb_to_recordset($2::jsonb) AS row(
              promotion_manifest_id TEXT,
              feature_bundle_manifest_id TEXT,
              activation_scope TEXT,
              approved_root_promotion_manifest_id TEXT,
              approved_root_promotion_manifest_hash TEXT,
              parent_promotion_proof_receipt_hash TEXT,
              contract_manifest_hash TEXT,
              macro_week_id TEXT,
              freeze_version TEXT,
              snapshot_id TEXT,
              snapshot_hash TEXT,
              snapshot_state TEXT,
              sealed_at_utc TIMESTAMPTZ,
              settlement_deadline_utc TIMESTAMPTZ,
              settlement_completed_at_utc TIMESTAMPTZ,
              verified_at_utc TIMESTAMPTZ,
              activated_at_utc TIMESTAMPTZ,
              effective_from_utc TIMESTAMPTZ,
              effective_to_utc TIMESTAMPTZ,
              revoked_at_utc TIMESTAMPTZ,
              revocation_reason TEXT,
              supersedes_snapshot_id TEXT,
              superseded_by_snapshot_id TEXT,
              row_snapshot_count INTEGER,
              coverage JSONB,
              flags JSONB
            )
          )
          INSERT INTO research_macro_weekly_snapshot_manifests (
            regime_dataset_id,
            promotion_manifest_id,
            feature_bundle_manifest_id,
            activation_scope,
            approved_root_promotion_manifest_id,
            approved_root_promotion_manifest_hash,
            parent_promotion_proof_receipt_hash,
            contract_manifest_hash,
            macro_week_id,
            freeze_version,
            snapshot_id,
            snapshot_hash,
            snapshot_state,
            sealed_at_utc,
            settlement_deadline_utc,
            settlement_completed_at_utc,
            verified_at_utc,
            activated_at_utc,
            effective_from_utc,
            effective_to_utc,
            revoked_at_utc,
            revocation_reason,
            supersedes_snapshot_id,
            superseded_by_snapshot_id,
            row_snapshot_count,
            coverage,
            flags
          )
          SELECT
            $1::uuid,
            promotion_manifest_id,
            feature_bundle_manifest_id,
            activation_scope,
            approved_root_promotion_manifest_id,
            approved_root_promotion_manifest_hash,
            parent_promotion_proof_receipt_hash,
            contract_manifest_hash,
            macro_week_id,
            freeze_version,
            snapshot_id,
            snapshot_hash,
            COALESCE(snapshot_state, 'SEALED'),
            sealed_at_utc,
            settlement_deadline_utc,
            settlement_completed_at_utc,
            verified_at_utc,
            activated_at_utc,
            effective_from_utc,
            effective_to_utc,
            revoked_at_utc,
            revocation_reason,
            supersedes_snapshot_id,
            superseded_by_snapshot_id,
            COALESCE(row_snapshot_count, 0),
            COALESCE(coverage, '{}'::jsonb),
            COALESCE(flags, '{}'::jsonb)
          FROM incoming
          ON CONFLICT (regime_dataset_id, snapshot_id)
          DO UPDATE SET
            promotion_manifest_id = EXCLUDED.promotion_manifest_id,
            feature_bundle_manifest_id = EXCLUDED.feature_bundle_manifest_id,
            activation_scope = EXCLUDED.activation_scope,
            approved_root_promotion_manifest_id = EXCLUDED.approved_root_promotion_manifest_id,
            approved_root_promotion_manifest_hash = EXCLUDED.approved_root_promotion_manifest_hash,
            parent_promotion_proof_receipt_hash = EXCLUDED.parent_promotion_proof_receipt_hash,
            contract_manifest_hash = EXCLUDED.contract_manifest_hash,
            macro_week_id = EXCLUDED.macro_week_id,
            freeze_version = EXCLUDED.freeze_version,
            snapshot_hash = EXCLUDED.snapshot_hash,
            snapshot_state = EXCLUDED.snapshot_state,
            sealed_at_utc = EXCLUDED.sealed_at_utc,
            settlement_deadline_utc = EXCLUDED.settlement_deadline_utc,
            settlement_completed_at_utc = EXCLUDED.settlement_completed_at_utc,
            verified_at_utc = EXCLUDED.verified_at_utc,
            activated_at_utc = EXCLUDED.activated_at_utc,
            effective_from_utc = EXCLUDED.effective_from_utc,
            effective_to_utc = EXCLUDED.effective_to_utc,
            revoked_at_utc = EXCLUDED.revoked_at_utc,
            revocation_reason = EXCLUDED.revocation_reason,
            supersedes_snapshot_id = EXCLUDED.supersedes_snapshot_id,
            superseded_by_snapshot_id = EXCLUDED.superseded_by_snapshot_id,
            row_snapshot_count = EXCLUDED.row_snapshot_count,
            coverage = EXCLUDED.coverage,
            flags = EXCLUDED.flags
        `,
        [options.regimeDatasetId, payload],
      );
      written += result.rowCount ?? 0;
    }
  });

  return written;
}

export async function markMacroRegimeDatasetComplete(regimeDatasetId: string) {
  await query(
    `
      UPDATE research_macro_regime_datasets
      SET status = 'complete',
          completed_at = NOW()
      WHERE regime_dataset_id = $1::uuid
    `,
    [regimeDatasetId],
  );
}

export async function readMacroRegimePersistCounts(
  regimeDatasetId: string,
): Promise<MacroRegimePersistCounts> {
  const rows = await query<{
    artifacts: string | number;
    availability_events: string | number;
    observations: string | number;
    weekly_snapshot_manifests: string | number;
    weekly_snapshots: string | number;
  }>(
    `
      SELECT
        (
          SELECT COUNT(*)
          FROM research_macro_source_artifacts
          WHERE regime_dataset_id = $1::uuid
        ) AS artifacts,
        (
          SELECT COUNT(*)
          FROM research_macro_availability_events
          WHERE regime_dataset_id = $1::uuid
        ) AS availability_events,
        (
          SELECT COUNT(*)
          FROM research_macro_source_observations
          WHERE regime_dataset_id = $1::uuid
        ) AS observations,
        (
          SELECT COUNT(*)
          FROM research_macro_weekly_snapshot_manifests
          WHERE regime_dataset_id = $1::uuid
        ) AS weekly_snapshot_manifests,
        (
          SELECT COUNT(*)
          FROM research_macro_weekly_currency_snapshots
          WHERE regime_dataset_id = $1::uuid
        ) AS weekly_snapshots
    `,
    [regimeDatasetId],
  );
  const row = rows[0];
  return {
    artifacts: Number(row?.artifacts ?? 0),
    availabilityEvents: Number(row?.availability_events ?? 0),
    observations: Number(row?.observations ?? 0),
    weeklySnapshotManifests: Number(row?.weekly_snapshot_manifests ?? 0),
    weeklySnapshots: Number(row?.weekly_snapshots ?? 0),
  };
}
