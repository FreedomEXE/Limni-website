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
    COALESCE(feature_bundle_manifest_id, '__missing_feature_bundle__'),
    macro_week_id,
    freeze_version,
    COALESCE(activation_scope, '__missing_activation_scope__')
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
  IF (to_jsonb(NEW) - 'created_at') IS DISTINCT FROM (to_jsonb(OLD) - 'created_at') THEN
    RAISE EXCEPTION 'research macro immutable row conflict on %.%', TG_TABLE_SCHEMA, TG_TABLE_NAME
      USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION research_macro_guard_weekly_manifest_update()
RETURNS trigger AS $$
DECLARE
  transition_service_enabled BOOLEAN;
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
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW) - 'created_at') IS DISTINCT FROM (to_jsonb(OLD) - 'created_at') THEN
    RAISE EXCEPTION 'research macro manifest update must use transition service on %.%', TG_TABLE_SCHEMA, TG_TABLE_NAME
      USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

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
