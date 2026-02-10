import type { ResearchAssetClass, ResearchConfig, ResearchModel, ResearchProvider } from "@/lib/research/types";

const ALL_MODELS: ResearchModel[] = [
  "antikythera",
  "blended",
  "dealer",
  "commercial",
  "sentiment",
];

const ALL_ASSET_CLASSES: ResearchAssetClass[] = ["fx", "indices", "commodities", "crypto"];
const ALL_PROVIDERS: ResearchProvider[] = ["oanda", "bitget", "mt5"];

const DEFAULT_FROM = "2025-01-06T00:00:00.000Z";
const DEFAULT_TO = "2026-02-09T05:00:00.000Z";

function dedupe<T extends string>(items: T[]) {
  return [...new Set(items)];
}

function splitCsv(value: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toBoolean(value: string | null, fallback: boolean) {
  if (value === null) return fallback;
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return fallback;
}

function toNumber(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toIsoOrFallback(value: string | null, fallback: string) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : fallback;
}

export function defaultResearchConfig(): ResearchConfig {
  return {
    mode: "hypothetical_sim",
    provider: "oanda",
    dateRange: { from: DEFAULT_FROM, to: DEFAULT_TO },
    universe: { assetClasses: ["fx"], symbols: [] },
    models: ["sentiment"],
    execution: { legMode: "net_only", includeNeutral: false, order: "grouped_by_symbol" },
    risk: { marginBuffer: 0.1, leverage: 50, sizing: "broker_native" },
    realism: { slippageBps: 2, commissionBps: 1, allowPartialFills: true },
  };
}

export function parseResearchConfigFromParams(
  params: URLSearchParams,
  base: ResearchConfig = defaultResearchConfig(),
): ResearchConfig {
  const mode = params.get("mode") === "as_traded_replay" ? "as_traded_replay" : base.mode;
  const providerCandidate = params.get("provider") as ResearchProvider | null;
  const provider = ALL_PROVIDERS.includes(providerCandidate as ResearchProvider)
    ? (providerCandidate as ResearchProvider)
    : base.provider;

  const models = dedupe(
    splitCsv(params.get("models")).filter((value): value is ResearchModel =>
      ALL_MODELS.includes(value as ResearchModel),
    ),
  );
  const assetClasses = dedupe(
    splitCsv(params.get("assets")).filter((value): value is ResearchAssetClass =>
      ALL_ASSET_CLASSES.includes(value as ResearchAssetClass),
    ),
  );
  const symbols = splitCsv(params.get("symbols")).map((s) => s.toUpperCase());

  const withStop = toBoolean(params.get("stop_enabled"), Boolean(base.risk.stopLoss));
  const withTrailing = toBoolean(params.get("trail_enabled"), Boolean(base.risk.trailing));

  return {
    ...base,
    mode,
    provider,
    accountKey: params.get("accountKey") ?? base.accountKey,
    dateRange: {
      from: toIsoOrFallback(params.get("from"), base.dateRange.from),
      to: toIsoOrFallback(params.get("to"), base.dateRange.to),
    },
    universe: {
      assetClasses: assetClasses.length > 0 ? assetClasses : base.universe.assetClasses,
      symbols,
    },
    models: models.length > 0 ? models : base.models,
    execution: {
      legMode: params.get("legMode") === "full_legs" ? "full_legs" : base.execution.legMode,
      includeNeutral: toBoolean(params.get("includeNeutral"), base.execution.includeNeutral),
      order: params.get("order") === "leg_sequence" ? "leg_sequence" : base.execution.order,
    },
    risk: {
      marginBuffer: toNumber(params.get("marginBuffer"), base.risk.marginBuffer),
      leverage: toNumber(params.get("leverage"), base.risk.leverage ?? 50),
      sizing: params.get("sizing") === "fixed_risk" ? "fixed_risk" : base.risk.sizing,
      stopLoss: withStop
        ? {
            type: "pct",
            value: toNumber(params.get("stopPct"), base.risk.stopLoss?.value ?? 0.01),
          }
        : undefined,
      trailing: withTrailing
        ? {
            startPct: toNumber(params.get("trailStartPct"), base.risk.trailing?.startPct ?? 0.2),
            offsetPct: toNumber(params.get("trailOffsetPct"), base.risk.trailing?.offsetPct ?? 0.1),
          }
        : undefined,
    },
    realism: {
      slippageBps: toNumber(params.get("slippageBps"), base.realism.slippageBps ?? 2),
      commissionBps: toNumber(params.get("commissionBps"), base.realism.commissionBps ?? 1),
      allowPartialFills: toBoolean(params.get("allowPartialFills"), base.realism.allowPartialFills),
    },
  };
}

export function serializeResearchConfigToParams(config: ResearchConfig): URLSearchParams {
  const params = new URLSearchParams();

  params.set("mode", config.mode);
  params.set("provider", config.provider);
  if (config.accountKey) params.set("accountKey", config.accountKey);
  params.set("from", config.dateRange.from);
  params.set("to", config.dateRange.to);
  params.set("models", config.models.join(","));
  params.set("assets", config.universe.assetClasses.join(","));
  if (config.universe.symbols && config.universe.symbols.length > 0) {
    params.set("symbols", config.universe.symbols.join(","));
  }
  params.set("legMode", config.execution.legMode);
  params.set("includeNeutral", config.execution.includeNeutral ? "1" : "0");
  params.set("order", config.execution.order);
  params.set("marginBuffer", String(config.risk.marginBuffer));
  if (typeof config.risk.leverage === "number") params.set("leverage", String(config.risk.leverage));
  params.set("sizing", config.risk.sizing);
  params.set("stop_enabled", config.risk.stopLoss ? "1" : "0");
  if (config.risk.stopLoss) {
    params.set("stopPct", String(config.risk.stopLoss.value));
  }
  params.set("trail_enabled", config.risk.trailing ? "1" : "0");
  if (config.risk.trailing) {
    params.set("trailStartPct", String(config.risk.trailing.startPct));
    params.set("trailOffsetPct", String(config.risk.trailing.offsetPct));
  }
  if (typeof config.realism.slippageBps === "number") params.set("slippageBps", String(config.realism.slippageBps));
  if (typeof config.realism.commissionBps === "number") {
    params.set("commissionBps", String(config.realism.commissionBps));
  }
  params.set("allowPartialFills", config.realism.allowPartialFills ? "1" : "0");

  return params;
}

export function validateResearchConfig(config: ResearchConfig): string[] {
  const errors: string[] = [];

  if (config.models.length === 0) errors.push("Select at least one model.");
  if (config.universe.assetClasses.length === 0) errors.push("Select at least one asset class.");
  const from = new Date(config.dateRange.from).getTime();
  const to = new Date(config.dateRange.to).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) errors.push("Date range must be valid ISO dates.");
  if (Number.isFinite(from) && Number.isFinite(to) && from > to) errors.push("Date range 'from' must be before 'to'.");
  if (config.risk.marginBuffer < 0 || config.risk.marginBuffer >= 1) {
    errors.push("Margin buffer must be between 0 and 1.");
  }
  if ((config.risk.leverage ?? 1) <= 0) errors.push("Leverage must be greater than 0.");
  if (config.risk.stopLoss && (config.risk.stopLoss.value <= 0 || config.risk.stopLoss.value >= 1)) {
    errors.push("Stop loss percent must be between 0 and 1.");
  }
  if (
    config.risk.trailing &&
    (config.risk.trailing.startPct <= 0 ||
      config.risk.trailing.startPct >= 1 ||
      config.risk.trailing.offsetPct <= 0 ||
      config.risk.trailing.offsetPct >= 1)
  ) {
    errors.push("Trailing values must be between 0 and 1.");
  }

  return errors;
}
