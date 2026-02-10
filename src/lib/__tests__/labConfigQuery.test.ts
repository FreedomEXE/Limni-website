import { describe, expect, it } from "vitest";
import {
  defaultResearchConfig,
  parseResearchConfigFromParams,
  serializeResearchConfigToParams,
  validateResearchConfig,
} from "@/lib/research/labConfigQuery";

describe("research/labConfigQuery", () => {
  it("round-trips config through URL params", () => {
    const config = {
      ...defaultResearchConfig(),
      mode: "as_traded_replay" as const,
      accountKey: "oanda:001-test",
      provider: "oanda" as const,
      models: ["dealer", "sentiment"] as const,
      universe: {
        assetClasses: ["fx", "indices"] as const,
        symbols: ["EURUSD", "GBPUSD"],
      },
      execution: {
        legMode: "full_legs" as const,
        includeNeutral: true,
        order: "leg_sequence" as const,
      },
      risk: {
        marginBuffer: 0.12,
        leverage: 30,
        sizing: "fixed_risk" as const,
        stopLoss: { type: "pct" as const, value: 0.02 },
        trailing: { startPct: 0.2, offsetPct: 0.08 },
      },
      realism: {
        slippageBps: 1.5,
        commissionBps: 0.5,
        allowPartialFills: false,
      },
    };

    const params = serializeResearchConfigToParams(config);
    const parsed = parseResearchConfigFromParams(params, defaultResearchConfig());

    expect(parsed.mode).toBe(config.mode);
    expect(parsed.provider).toBe(config.provider);
    expect(parsed.accountKey).toBe(config.accountKey);
    expect(parsed.models).toEqual(config.models);
    expect(parsed.universe.assetClasses).toEqual(config.universe.assetClasses);
    expect(parsed.universe.symbols).toEqual(config.universe.symbols);
    expect(parsed.execution).toEqual(config.execution);
    expect(parsed.risk.marginBuffer).toBe(config.risk.marginBuffer);
    expect(parsed.risk.leverage).toBe(config.risk.leverage);
    expect(parsed.risk.sizing).toBe(config.risk.sizing);
    expect(parsed.risk.stopLoss).toEqual(config.risk.stopLoss);
    expect(parsed.risk.trailing).toEqual(config.risk.trailing);
    expect(parsed.realism.allowPartialFills).toBe(config.realism.allowPartialFills);
  });

  it("defaults unknown query values safely", () => {
    const params = new URLSearchParams();
    params.set("mode", "bad-mode");
    params.set("provider", "bad-provider");
    params.set("models", "bad-model,sentiment");
    params.set("assets", "bad-asset,fx");
    params.set("from", "not-a-date");
    params.set("to", "still-not-a-date");

    const base = defaultResearchConfig();
    const parsed = parseResearchConfigFromParams(params, base);

    expect(parsed.mode).toBe(base.mode);
    expect(parsed.provider).toBe(base.provider);
    expect(parsed.models).toEqual(["sentiment"]);
    expect(parsed.universe.assetClasses).toEqual(["fx"]);
    expect(parsed.dateRange).toEqual(base.dateRange);
  });

  it("validates invalid configs", () => {
    const invalid = {
      ...defaultResearchConfig(),
      models: [],
      universe: { assetClasses: [], symbols: [] },
      dateRange: { from: "2026-01-10T00:00:00.000Z", to: "2026-01-01T00:00:00.000Z" },
      risk: {
        ...defaultResearchConfig().risk,
        marginBuffer: 2,
        leverage: 0,
        stopLoss: { type: "pct" as const, value: 2 },
      },
    };

    const errors = validateResearchConfig(invalid);
    expect(errors.length).toBeGreaterThanOrEqual(5);
  });
});
