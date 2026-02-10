import { describe, expect, it } from "vitest";
import { runBacktest } from "@/lib/research/backtestEngine";
import type { ResearchConfig } from "@/lib/research/types";

function sampleConfig(overrides: Partial<ResearchConfig> = {}): ResearchConfig {
  return {
    mode: "hypothetical_sim",
    provider: "oanda",
    dateRange: { from: "2025-01-06T00:00:00.000Z", to: "2025-06-30T00:00:00.000Z" },
    universe: { assetClasses: ["fx"] },
    models: ["sentiment", "dealer"],
    execution: {
      legMode: "net_only",
      includeNeutral: false,
      order: "grouped_by_symbol",
    },
    risk: {
      marginBuffer: 0.1,
      leverage: 50,
      sizing: "broker_native",
    },
    realism: {
      allowPartialFills: true,
      slippageBps: 2,
      commissionBps: 1,
    },
    ...overrides,
  };
}

describe("research backtest engine", () => {
  it("is deterministic for the same config", async () => {
    const config = sampleConfig();
    const a = await runBacktest(config);
    const b = await runBacktest(config);

    expect(a.configHash).toBe(b.configHash);
    expect(a.runId).toBe(b.runId);
    expect(a.weekly).toEqual(b.weekly);
    expect(a.equityCurve).toEqual(b.equityCurve);
    expect(a.byModel).toEqual(b.byModel);
    expect(a.bySymbol).toEqual(b.bySymbol);
  });

  it("changes result when config changes", async () => {
    const a = await runBacktest(sampleConfig({ execution: { legMode: "net_only", includeNeutral: false, order: "grouped_by_symbol" } }));
    const b = await runBacktest(sampleConfig({ execution: { legMode: "full_legs", includeNeutral: true, order: "leg_sequence" } }));
    expect(a.configHash).not.toBe(b.configHash);
    expect(a.headline.totalReturnPct).not.toBe(b.headline.totalReturnPct);
  });

  it("returns contract-complete response", async () => {
    const result = await runBacktest(sampleConfig({ mode: "as_traded_replay", accountKey: "oanda:test" }));
    expect(result.runId.length).toBeGreaterThan(5);
    expect(result.weekly.length).toBeGreaterThan(0);
    expect(result.equityCurve.length).toBe(result.weekly.length);
    expect(result.byModel.length).toBeGreaterThan(0);
    expect(result.bySymbol.length).toBeGreaterThan(0);
    expect(result.headline.pricedTrades).toBeLessThanOrEqual(result.headline.trades);
    expect(result.risk.fillRatePct).toBeGreaterThanOrEqual(0);
    expect(result.risk.fillRatePct).toBeLessThanOrEqual(100);
  });
});
