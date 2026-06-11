import { describe, expect, it } from "vitest";

import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import type { CanonicalBasketSignal } from "@/lib/performance/basketSource";
import { derivePriorStrengthWeekOpenUtcs } from "@/lib/strength/canonicalDirection";
import {
  buildSourceReadinessAuditRow,
  collectCompletionIncidents,
  collectModelIssues,
  describeAuditScope,
  type SourceIncident,
  validateResolvedWeeks,
} from "../../../scripts/verify-source-completion";

function directionalRows(): CanonicalBasketSignal[] {
  return Object.entries(PAIRS_BY_ASSET_CLASS).flatMap(([assetClass, pairs]) =>
    pairs.map((pairDef, index) => ({
      weekOpenUtc: "2026-05-24T23:00:00.000Z",
      model: "strength" as const,
      symbol: pairDef.pair,
      assetClass,
      direction: index % 2 === 0 ? "LONG" as const : "SHORT" as const,
    })),
  );
}

describe("source completion audit", () => {
  it("labels default latest-week audits as probes, not release gates", () => {
    expect(describeAuditScope({
      week: null,
      from: null,
      to: null,
      releaseWindow: null,
      weeks: 12,
    })).toEqual({
      label: "latest-12-closed-weeks",
      releaseGate: false,
      warning: "Latest-12 closed-week source probe only. For release approval use --release-window=v2.0.3.",
    });
  });

  it("labels the pinned v2.0.3 audit as the release gate", () => {
    expect(describeAuditScope({
      week: null,
      from: null,
      to: null,
      releaseWindow: "v2.0.3",
      weeks: 12,
    })).toEqual({
      label: "release-window:v2.0.3",
      releaseGate: true,
      warning: null,
    });
  });

  it("labels the trusted 12-week window as a probe, not release approval", () => {
    expect(describeAuditScope({
      week: null,
      from: null,
      to: null,
      releaseWindow: "v2.0.3-trusted-12w",
      weeks: 12,
    })).toEqual({
      label: "release-window:v2.0.3-trusted-12w",
      releaseGate: false,
      warning: "Named source window \"v2.0.3-trusted-12w\" is a probe only. For release approval use --release-window=v2.0.3.",
    });
  });

  it("labels the clean 14-week window as a probe, not release approval", () => {
    expect(describeAuditScope({
      week: null,
      from: null,
      to: null,
      releaseWindow: "v2.0.3-clean-14w",
      weeks: 12,
    })).toEqual({
      label: "release-window:v2.0.3-clean-14w",
      releaseGate: false,
      warning: "Named source window \"v2.0.3-clean-14w\" is a probe only. For release approval use --release-window=v2.0.3.",
    });
  });

  it("refuses to pass an empty source-readiness window", () => {
    expect(() => validateResolvedWeeks({
      weeks: [],
      from: "2099-01-01",
      to: "2099-02-01",
    })).toThrow(/selected zero weeks/);
  });

  it("refuses a pinned release window with missing expected weeks", () => {
    expect(() => validateResolvedWeeks({
      weeks: ["2026-03-08T23:00:00.000Z"],
      releaseWindowName: "test-window",
      releaseWindow: {
        from: "2026-01-19T00:00:00.000Z",
        to: "2026-03-08T23:00:00.000Z",
        description: "test",
        expectedWeeks: [
          "2026-01-19T00:00:00.000Z",
          "2026-03-08T23:00:00.000Z",
        ],
      },
    })).toThrow(/wrong week set/);
  });

  it("derives strength prior weeks across DST using New York week anchors", () => {
    expect(derivePriorStrengthWeekOpenUtcs("2026-03-08T23:00:00.000Z")).toEqual([
      "2026-03-02T00:00:00.000Z",
      "2026-02-23T00:00:00.000Z",
      "2026-02-16T00:00:00.000Z",
      "2026-02-09T00:00:00.000Z",
    ]);
  });

  it("passes when the canonical 36-pair universe is directional", () => {
    expect(collectModelIssues(directionalRows())).toEqual([]);
    expect(collectCompletionIncidents(directionalRows())).toEqual([]);
  });

  it("reports neutral, missing, and unexpected source rows", () => {
    const rows = directionalRows()
      .filter((row) => row.symbol !== "EURUSD")
      .map((row) => row.symbol === "GBPUSD"
        ? { ...row, direction: "NEUTRAL" as const, metadata: { reason: "strength_error" } }
        : row);
    rows.push({
      weekOpenUtc: "2026-05-24T23:00:00.000Z",
      model: "strength",
      symbol: "FAKEPAIR",
      assetClass: "fx",
      direction: "LONG",
    });

    const issues = collectModelIssues(rows);

    expect(issues).toContain("EURUSD:missing_row");
    expect(issues).toContain("GBPUSD:NEUTRAL reason=strength_error");
    expect(issues).toContain("FAKEPAIR:unexpected_pair");
  });

  it("marks readiness trusted when completion passes and only info incidents exist", () => {
    const row = buildSourceReadinessAuditRow({
      weekOpenUtc: "2026-05-24T23:00:00.000Z",
      source: "strength",
      rows: directionalRows(),
      incidents: [
        {
          severity: "info",
          code: "strength_resolution_branches",
          message: "branch summary",
        },
      ],
    });

    expect(row.completion).toBe("36/36");
    expect(row.readiness).toBe("ready");
    expect(row.trusted).toBe(true);
  });

  it("marks readiness untrusted when source fallback warnings exist", () => {
    const incidents: SourceIncident[] = [
      {
        pair: "EURUSD",
        severity: "warning",
        code: "sentiment_backfill_used",
        message: "EURUSD sentiment was backfilled",
      },
    ];

    const row = buildSourceReadinessAuditRow({
      weekOpenUtc: "2026-05-24T23:00:00.000Z",
      source: "sentiment",
      rows: directionalRows().map((signal) => ({ ...signal, model: "sentiment" as const })),
      incidents,
    });

    expect(row.completion).toBe("36/36");
    expect(row.readiness).toBe("fallback_used");
    expect(row.trusted).toBe(false);
    expect(row.incidents).toEqual(incidents);
  });
});
