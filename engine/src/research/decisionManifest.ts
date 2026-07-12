import { sha256Stable, stableValue } from "@engine/research/hash";

export const RESEARCH_DECISION_MANIFEST_VERSION = "research_decision_manifest_v1";

export type ResearchDecisionSide = "LONG" | "SHORT";
export type ResearchDecisionAssetClass = "fx" | "indices" | "commodities" | "crypto";

export type ResearchDecisionManifestUniverse = {
  asset_class: ResearchDecisionAssetClass;
  symbols: string[];
};

export type ResearchDecisionManifestWeekRange = {
  from_week_open_utc: string;
  to_week_open_utc: string;
};

export type ResearchDecisionRow = {
  row_id?: string;
  week_open_utc: string;
  symbol: string;
  side: ResearchDecisionSide;
  decision_timestamp_utc: string;
  source_metadata?: Record<string, unknown>;
  signal_scores?: Record<string, number | null>;
  bucket_id?: string | null;
  regime_id?: string | null;
};

export type ResearchDecisionManifest = {
  manifest_id: string;
  manifest_version: typeof RESEARCH_DECISION_MANIFEST_VERSION | string;
  gate_id: string;
  hypothesis_id: string;
  signal_id: string;
  signal_version: string;
  decision_scope: string;
  price_bundle_id: string;
  feature_bundle_id?: string | null;
  source_context_ids?: string[];
  universe: ResearchDecisionManifestUniverse;
  week_range: ResearchDecisionManifestWeekRange;
  created_at_utc?: string;
  source_metadata?: Record<string, unknown>;
  config_hash: string;
  decisions: ResearchDecisionRow[];
  manifest_hash?: string;
};

export type ResearchDecisionManifestIdentity = {
  manifest_id: string;
  manifest_version: string;
  gate_id: string;
  hypothesis_id: string;
  signal_id: string;
  signal_version: string;
  decision_scope: string;
  price_bundle_id: string;
  feature_bundle_id: string | null;
  source_context_ids: string[];
  config_hash: string;
  manifest_hash: string;
};

function assertStringField(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`ResearchDecisionManifest missing ${field}.`);
  }
}

function normalizeIso(value: string, field: string) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`ResearchDecisionManifest invalid ${field}: ${value}`);
  return new Date(ms).toISOString();
}

function normalizeSymbols(symbols: string[]) {
  return Array.from(new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))).sort();
}

function normalizeDecision(row: ResearchDecisionRow, index: number): ResearchDecisionRow {
  assertStringField(row.week_open_utc, `decisions[${index}].week_open_utc`);
  assertStringField(row.symbol, `decisions[${index}].symbol`);
  assertStringField(row.decision_timestamp_utc, `decisions[${index}].decision_timestamp_utc`);
  if (row.side !== "LONG" && row.side !== "SHORT") {
    throw new Error(`ResearchDecisionManifest invalid decisions[${index}].side: ${String(row.side)}`);
  }
  return {
    ...row,
    row_id: row.row_id?.trim() || undefined,
    week_open_utc: normalizeIso(row.week_open_utc, `decisions[${index}].week_open_utc`),
    symbol: row.symbol.trim().toUpperCase(),
    decision_timestamp_utc: normalizeIso(row.decision_timestamp_utc, `decisions[${index}].decision_timestamp_utc`),
    bucket_id: row.bucket_id ?? null,
    regime_id: row.regime_id ?? null,
  };
}

export function normalizeResearchDecisionManifest(input: ResearchDecisionManifest): ResearchDecisionManifest {
  assertStringField(input.manifest_id, "manifest_id");
  assertStringField(input.manifest_version, "manifest_version");
  assertStringField(input.gate_id, "gate_id");
  assertStringField(input.hypothesis_id, "hypothesis_id");
  assertStringField(input.signal_id, "signal_id");
  assertStringField(input.signal_version, "signal_version");
  assertStringField(input.decision_scope, "decision_scope");
  assertStringField(input.price_bundle_id, "price_bundle_id");
  assertStringField(input.config_hash, "config_hash");
  if (!input.universe || !Array.isArray(input.universe.symbols) || input.universe.symbols.length === 0) {
    throw new Error("ResearchDecisionManifest missing universe.symbols.");
  }
  if (
    input.universe.asset_class !== "fx" &&
    input.universe.asset_class !== "indices" &&
    input.universe.asset_class !== "commodities" &&
    input.universe.asset_class !== "crypto"
  ) {
    throw new Error(`ResearchDecisionManifest invalid universe.asset_class: ${String(input.universe.asset_class)}`);
  }
  if (!Array.isArray(input.decisions) || input.decisions.length === 0) {
    throw new Error("ResearchDecisionManifest requires at least one decision row.");
  }

  const decisions = input.decisions
    .map(normalizeDecision)
    .sort((left, right) => {
      const week = left.week_open_utc.localeCompare(right.week_open_utc);
      if (week !== 0) return week;
      const symbol = left.symbol.localeCompare(right.symbol);
      if (symbol !== 0) return symbol;
      return (left.row_id ?? "").localeCompare(right.row_id ?? "");
    });

  const universeSymbols = normalizeSymbols(input.universe.symbols);
  const decisionSymbols = normalizeSymbols(decisions.map((row) => row.symbol));
  for (const symbol of decisionSymbols) {
    if (!universeSymbols.includes(symbol)) {
      throw new Error(`ResearchDecisionManifest decision symbol ${symbol} is not in universe.symbols.`);
    }
  }

  const weekRange = {
    from_week_open_utc: normalizeIso(input.week_range.from_week_open_utc, "week_range.from_week_open_utc"),
    to_week_open_utc: normalizeIso(input.week_range.to_week_open_utc, "week_range.to_week_open_utc"),
  };

  return {
    ...input,
    manifest_id: input.manifest_id.trim(),
    manifest_version: input.manifest_version.trim(),
    gate_id: input.gate_id.trim(),
    hypothesis_id: input.hypothesis_id.trim(),
    signal_id: input.signal_id.trim(),
    signal_version: input.signal_version.trim(),
    decision_scope: input.decision_scope.trim(),
    price_bundle_id: input.price_bundle_id.trim(),
    feature_bundle_id: input.feature_bundle_id?.trim() || null,
    source_context_ids: [...new Set(input.source_context_ids ?? [])].sort(),
    universe: {
      asset_class: input.universe.asset_class,
      symbols: universeSymbols,
    },
    week_range: weekRange,
    created_at_utc: input.created_at_utc ? normalizeIso(input.created_at_utc, "created_at_utc") : undefined,
    decisions,
  };
}

export function normalizeManifestForHash(manifest: ResearchDecisionManifest) {
  const normalized = normalizeResearchDecisionManifest(manifest);
  const { manifest_hash: _manifestHash, ...withoutHash } = normalized;
  return stableValue(withoutHash);
}

export function hashResearchDecisionManifest(manifest: ResearchDecisionManifest) {
  return sha256Stable(normalizeManifestForHash(manifest));
}

export function attachResearchDecisionManifestHash(manifest: ResearchDecisionManifest): ResearchDecisionManifest {
  const normalized = normalizeResearchDecisionManifest(manifest);
  return {
    ...normalized,
    manifest_hash: hashResearchDecisionManifest(normalized),
  };
}

export function assertResearchDecisionManifestHash(manifest: ResearchDecisionManifest) {
  const computed = hashResearchDecisionManifest(manifest);
  if (manifest.manifest_hash && manifest.manifest_hash.toUpperCase() !== computed) {
    throw new Error(`ResearchDecisionManifest hash mismatch: expected ${manifest.manifest_hash}, computed ${computed}`);
  }
  return computed;
}

export function getResearchDecisionManifestIdentity(
  manifest: ResearchDecisionManifest,
): ResearchDecisionManifestIdentity {
  const normalized = attachResearchDecisionManifestHash(manifest);
  return {
    manifest_id: normalized.manifest_id,
    manifest_version: normalized.manifest_version,
    gate_id: normalized.gate_id,
    hypothesis_id: normalized.hypothesis_id,
    signal_id: normalized.signal_id,
    signal_version: normalized.signal_version,
    decision_scope: normalized.decision_scope,
    price_bundle_id: normalized.price_bundle_id,
    feature_bundle_id: normalized.feature_bundle_id ?? null,
    source_context_ids: normalized.source_context_ids ?? [],
    config_hash: normalized.config_hash,
    manifest_hash: normalized.manifest_hash ?? hashResearchDecisionManifest(normalized),
  };
}
