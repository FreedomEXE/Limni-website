import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import type {
  BaseBasketModel,
  CanonicalBasketSignal,
} from "@/lib/performance/basketSource";

export type ReleaseWindow = {
  from: string;
  to: string;
  description: string;
  expectedWeeks: string[];
};

export type SourceIncident = {
  pair?: string;
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  metadata?: Record<string, unknown>;
};

export type SourceReadinessStatus =
  | "ready"
  | "completion_failed"
  | "missing_source"
  | "stale_or_late_source"
  | "fallback_used"
  | "untrusted";

export type SourceReadinessAuditRow = {
  weekOpenUtc: string;
  source: BaseBasketModel;
  resolvedDirectional: number;
  expectedPairs: number;
  completion: string;
  readiness: SourceReadinessStatus;
  trusted: boolean;
  incidents: SourceIncident[];
  metadata?: Record<string, unknown>;
};

export type SourceCompletionAuditScopeArgs = {
  week: string | null;
  from: string | null;
  to: string | null;
  releaseWindow: string | null;
  weeks: number;
};

const EXPECTED_PAIRS = Object.values(PAIRS_BY_ASSET_CLASS)
  .flat()
  .map((pair) => pair.pair.toUpperCase())
  .sort();
const EXPECTED_PAIR_SET = new Set(EXPECTED_PAIRS);

function metadataReason(row: CanonicalBasketSignal) {
  const reason = row.metadata?.reason;
  return typeof reason === "string" ? reason : null;
}

function isDirectional(row: CanonicalBasketSignal | null) {
  return row?.direction === "LONG" || row?.direction === "SHORT";
}

function formatSignal(row: CanonicalBasketSignal | null, pair: string) {
  if (!row) return `${pair}:missing_row`;
  const reason = metadataReason(row);
  const reportDate = row.sourceReportDate ? ` report=${row.sourceReportDate}` : "";
  const reasonText = reason ? ` reason=${reason}` : "";
  return `${pair}:${row.direction}${reasonText}${reportDate}`;
}

function blockingIncidents(incidents: SourceIncident[]) {
  return incidents.filter((incident) => incident.severity !== "info");
}

function summarizeReadiness(incidents: SourceIncident[]): SourceReadinessStatus {
  const blocking = blockingIncidents(incidents);
  if (blocking.length === 0) return "ready";
  if (blocking.some((incident) =>
    incident.code === "missing_source_row" ||
    incident.code === "unresolved_direction" ||
    incident.code === "unexpected_pair"
  )) {
    return "completion_failed";
  }
  if (blocking.some((incident) => incident.code.includes("missing"))) return "missing_source";
  if (blocking.some((incident) => incident.code.includes("stale") || incident.code.includes("late"))) {
    return "stale_or_late_source";
  }
  if (blocking.some((incident) =>
    incident.code.includes("fallback") ||
    incident.code.includes("backfill") ||
    incident.code.includes("branch")
  )) {
    return "fallback_used";
  }
  return "untrusted";
}

export function collectCompletionIncidents(rows: CanonicalBasketSignal[]): SourceIncident[] {
  const byPair = new Map(rows.map((row) => [row.symbol.toUpperCase(), row] as const));
  const incidents: SourceIncident[] = [];

  for (const pair of EXPECTED_PAIRS) {
    const row = byPair.get(pair) ?? null;
    if (!isDirectional(row)) {
      incidents.push({
        pair,
        severity: "error",
        code: row ? "unresolved_direction" : "missing_source_row",
        message: formatSignal(row, pair),
        metadata: row
          ? {
              direction: row.direction,
              reason: metadataReason(row),
              sourceReportDate: row.sourceReportDate ?? null,
            }
          : undefined,
      });
    }
  }

  for (const row of rows) {
    const pair = row.symbol.toUpperCase();
    if (!EXPECTED_PAIR_SET.has(pair)) {
      incidents.push({
        pair,
        severity: "error",
        code: "unexpected_pair",
        message: `${pair}:unexpected_pair`,
        metadata: { direction: row.direction, model: row.model },
      });
    }
  }

  return incidents;
}

export function collectModelIssues(rows: CanonicalBasketSignal[]) {
  return collectCompletionIncidents(rows).map((incident) => incident.message);
}

export function buildSourceReadinessAuditRow(options: {
  weekOpenUtc: string;
  source: BaseBasketModel;
  rows: CanonicalBasketSignal[];
  incidents?: SourceIncident[];
  metadata?: Record<string, unknown>;
}): SourceReadinessAuditRow {
  const completionIncidents = collectCompletionIncidents(options.rows);
  const incidents = [...completionIncidents, ...(options.incidents ?? [])];
  const resolvedDirectional = options.rows.filter(isDirectional).length;
  const trusted = blockingIncidents(incidents).length === 0;

  return {
    weekOpenUtc: options.weekOpenUtc,
    source: options.source,
    resolvedDirectional,
    expectedPairs: EXPECTED_PAIRS.length,
    completion: `${resolvedDirectional}/${EXPECTED_PAIRS.length}`,
    readiness: summarizeReadiness(incidents),
    trusted,
    incidents,
    metadata: options.metadata,
  };
}

export function validateResolvedWeeks(input: {
  weeks: string[];
  releaseWindowName?: string | null;
  releaseWindow?: ReleaseWindow | null;
  from?: string | null;
  to?: string | null;
}) {
  const { weeks, releaseWindowName, releaseWindow, from, to } = input;

  if (weeks.length === 0) {
    const scope = releaseWindowName
      ? `release window "${releaseWindowName}"`
      : `range from ${from ?? "start"} to ${to ?? "end"}`;
    throw new Error(`Source readiness audit selected zero weeks for ${scope}. Refusing to pass an empty audit.`);
  }

  if (!releaseWindow) return;

  const selected = new Set(weeks);
  const expected = releaseWindow.expectedWeeks;
  const expectedSet = new Set(expected);
  const missing = expected.filter((week) => !selected.has(week));
  const extra = weeks.filter((week) => !expectedSet.has(week));

  if (missing.length > 0 || extra.length > 0 || weeks.length !== expected.length) {
    const detail = [
      `expected ${expected.length} week(s)`,
      `selected ${weeks.length}`,
      missing.length > 0 ? `missing: ${missing.join(", ")}` : null,
      extra.length > 0 ? `extra: ${extra.join(", ")}` : null,
    ].filter(Boolean).join("; ");
    throw new Error(`Release window "${releaseWindowName}" resolved to the wrong week set (${detail}).`);
  }
}

export function describeAuditScope(args: SourceCompletionAuditScopeArgs) {
  if (args.releaseWindow) {
    const releaseGate = args.releaseWindow === "v2.0.3";
    return {
      label: `release-window:${args.releaseWindow}`,
      releaseGate,
      warning: releaseGate ? null : `Named source window "${args.releaseWindow}" is a probe only. For release approval use --release-window=v2.0.3.`,
    };
  }

  if (args.week) {
    return {
      label: `single-week:${args.week}`,
      releaseGate: false,
      warning: "Single-week source probe only. Do not cite as release approval.",
    };
  }

  if (args.from || args.to) {
    return {
      label: `explicit-range:${args.from ?? "start"}..${args.to ?? "end"}`,
      releaseGate: false,
      warning: "Explicit-range source probe only unless tied to a named release window. Do not cite as release approval.",
    };
  }

  return {
    label: `latest-${args.weeks}-closed-weeks`,
    releaseGate: false,
    warning: `Latest-${args.weeks} closed-week source probe only. For release approval use --release-window=v2.0.3.`,
  };
}
