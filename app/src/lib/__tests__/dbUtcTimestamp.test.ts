import { describe, expect, it } from "vitest";

import {
  dbTimestampValueToIsoUtc,
  parseUtcSqlTimestamp,
  utcSqlTimestampTextToIso,
} from "@/lib/dbUtcTimestamp";

describe("UTC SQL timestamp parsing", () => {
  it("treats timestamp-without-time-zone text from UTC-named DB columns as UTC literals", () => {
    expect(utcSqlTimestampTextToIso("2026-02-22 23:10:08.687")).toBe(
      "2026-02-22T23:10:08.687Z",
    );
  });

  it("does not reinterpret SQL timestamp text as local machine time", () => {
    const parsed = parseUtcSqlTimestamp("2026-02-22 23:10:08.687");

    expect(parsed?.offset).toBe(0);
    expect(parsed?.toISO()).toBe("2026-02-22T23:10:08.687Z");
  });

  it("keeps timestamptz Date values as already-normalized instants", () => {
    expect(dbTimestampValueToIsoUtc(new Date("2026-02-23T04:10:08.687Z"))).toBe(
      "2026-02-23T04:10:08.687Z",
    );
  });
});
