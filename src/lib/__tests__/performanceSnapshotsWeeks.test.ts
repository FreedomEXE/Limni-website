import { beforeEach, describe, expect, test, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  query: queryMock,
}));

import { listPerformanceWeeks, readPerformanceSnapshotsByWeek } from "@/lib/performanceSnapshots";

describe("performanceSnapshots week handling", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  test("listPerformanceWeeks deduplicates logical weeks before limit", async () => {
    queryMock.mockResolvedValueOnce([
      { week_open_utc: new Date("2026-02-16T00:00:00.000Z") },
      { week_open_utc: new Date("2026-02-09T05:00:00.000Z") }, // legacy
      { week_open_utc: new Date("2026-02-09T00:00:00.000Z") }, // canonical
      { week_open_utc: new Date("2026-02-02T00:00:00.000Z") },
      { week_open_utc: new Date("2026-01-26T00:00:00.000Z") },
    ]);

    const weeks = await listPerformanceWeeks(4);

    expect(weeks).toEqual([
      "2026-02-16T00:00:00.000Z",
      "2026-02-09T00:00:00.000Z",
      "2026-02-02T00:00:00.000Z",
      "2026-01-26T00:00:00.000Z",
    ]);
  });

  test("readPerformanceSnapshotsByWeek reads equivalent keys and returns best row", async () => {
    queryMock.mockResolvedValueOnce([
      {
        week_open_utc: new Date("2026-02-09T05:00:00.000Z"),
        asset_class: "fx",
        model: "blended",
        report_date: new Date("2026-02-14T00:00:00.000Z"),
        percent: "1.1",
        priced: 30,
        total: 36,
        note: "legacy",
        returns: [],
        pair_details: [],
        stats: {},
      },
      {
        week_open_utc: new Date("2026-02-09T00:00:00.000Z"),
        asset_class: "fx",
        model: "blended",
        report_date: new Date("2026-02-14T00:00:00.000Z"),
        percent: "1.4",
        priced: 35,
        total: 36,
        note: "canonical",
        returns: [],
        pair_details: [],
        stats: {},
      },
      {
        week_open_utc: new Date("2026-02-09T00:00:00.000Z"),
        asset_class: "fx",
        model: "dealer",
        report_date: new Date("2026-02-14T00:00:00.000Z"),
        percent: "0.8",
        priced: 33,
        total: 36,
        note: "dealer",
        returns: [],
        pair_details: [],
        stats: {},
      },
    ]);

    const rows = await readPerformanceSnapshotsByWeek("2026-02-09T00:00:00.000Z");

    const params = queryMock.mock.calls[0]?.[1]?.[0] as string[];
    expect(params).toContain("2026-02-09T00:00:00.000Z");
    expect(params).toContain("2026-02-09T05:00:00.000Z");
    expect(rows).toHaveLength(2);

    const blended = rows.find((row) => row.model === "blended");
    expect(blended?.percent).toBe(1.4);
    expect(blended?.week_open_utc).toBe("2026-02-09T00:00:00.000Z");
  });
});
