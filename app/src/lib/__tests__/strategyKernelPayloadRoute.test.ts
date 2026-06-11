import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const loadStrategyPageData = vi.fn(async () => ({
  artifactMeta: {
    status: "hit",
    selectionKey: "tandem-adr_grid-pair_fill_cap",
    cachedAtUtc: null,
    refreshedWeeks: [],
    removedWeeks: [],
    missingWeeks: [],
  },
}));

const toStrategyClientPayload = vi.fn(() => ({
  engineWeekMap: {},
  engineSimMap: {},
  engineWeekResults: {},
  sidebarStats: null,
  weekOptions: ["all"],
  currentWeekOpenUtc: "2026-06-07T23:00:00.000Z",
  artifactMeta: {
    status: "hit",
    selectionKey: "tandem-adr_grid-pair_fill_cap",
    cachedAtUtc: null,
    refreshedWeeks: [],
    removedWeeks: [],
    missingWeeks: [],
    historyWindow: "active-baseline",
    expectedWeeks: 15,
  },
}));

function request(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

describe("strategy kernel payload route", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/performance/strategyPageData");
    vi.doUnmock("@/lib/performance/strategyClientPayload");
    vi.resetModules();
    loadStrategyPageData.mockClear();
    toStrategyClientPayload.mockClear();
  });

  async function importRoute() {
    vi.doMock("@/lib/performance/strategyPageData", () => ({
      loadStrategyPageData,
    }));
    vi.doMock("@/lib/performance/strategyClientPayload", () => ({
      toStrategyClientPayload,
    }));
    return import("@/app/api/performance/strategy-kernel-payload/route");
  }

  it("uses active-baseline history by default", async () => {
    const { GET } = await importRoute();

    const response = await GET(request("/api/performance/strategy-kernel-payload?strategy=tandem&f1=adr_grid&f2=pair_fill_cap"));

    expect(response.status).toBe(200);
    expect(loadStrategyPageData).toHaveBeenCalledWith(
      {
        strategyId: "tandem",
        f1: "adr_grid",
        f2: "pair_fill_cap",
      },
      expect.objectContaining({
        includeCurrentWeek: false,
        historyWindow: "active-baseline",
      }),
    );
  }, 15_000);

  it("keeps the seed window explicit instead of default", async () => {
    const { GET } = await importRoute();

    const response = await GET(request("/api/performance/strategy-kernel-payload?strategy=tandem&f1=adr_grid&f2=pair_fill_cap&history=seed-window"));

    expect(response.status).toBe(200);
    expect(loadStrategyPageData).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        historyWindow: "seed-window",
      }),
    );
  }, 15_000);

  it("accepts the old clean14 URL as a seed-window compatibility alias", async () => {
    const { GET } = await importRoute();

    const response = await GET(request("/api/performance/strategy-kernel-payload?strategy=tandem&f1=adr_grid&f2=pair_fill_cap&history=clean14"));

    expect(response.status).toBe(200);
    expect(loadStrategyPageData).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        historyWindow: "seed-window",
      }),
    );
  }, 15_000);
});
