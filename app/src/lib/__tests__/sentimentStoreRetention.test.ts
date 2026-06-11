import { afterEach, describe, expect, it, vi } from "vitest";

import { getRawRetentionDays, getSnapshotReadHours } from "@/lib/sentiment/store";

describe("sentiment store retention policy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps the operational read window at 24 hours by default", () => {
    vi.stubEnv("SENTIMENT_SNAPSHOT_READ_HOURS", "");
    vi.stubEnv("SENTIMENT_SNAPSHOT_RETENTION_HOURS", "");

    expect(getSnapshotReadHours()).toBe(24);
  });

  it("keeps raw provider snapshots for seven years by default", () => {
    vi.stubEnv("SENTIMENT_RAW_RETENTION_DAYS", "");

    expect(getRawRetentionDays()).toBe(2555);
  });

  it("does not use legacy 24-hour snapshot retention as the raw deletion window", () => {
    vi.stubEnv("SENTIMENT_SNAPSHOT_RETENTION_HOURS", "24");
    vi.stubEnv("SENTIMENT_RAW_RETENTION_DAYS", "");

    expect(getSnapshotReadHours()).toBe(24);
    expect(getRawRetentionDays()).toBe(2555);
  });
});
