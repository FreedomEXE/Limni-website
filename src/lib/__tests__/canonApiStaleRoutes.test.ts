import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { releaseManifest } from "@/lib/version/releaseManifest";

function request(url: string) {
  return new NextRequest(url);
}

function context() {
  return { params: Promise.resolve({ version: releaseManifest.canonVersion }) };
}

describe("stale canon API behavior", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/canon/canonWeekShard.server");
    vi.resetModules();
  });

  it("refuses monolithic historical canon while release canon is stale", async () => {
    const { GET } = await import("@/app/api/canon/[version]/historical/route");

    const response = await GET(
      request(`http://localhost/api/canon/${releaseManifest.canonVersion}/historical?strategyVariant=tandem-weekly_hold-none`),
      context(),
    );
    const body = await response.json() as { error?: string };

    expect(response.status).toBe(409);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Limni-Canon-Artifact-Status")).toBe("stale_pending_regeneration");
    expect(body.error).toContain("stale pending regeneration");
  });

  it("refuses stale baseline release-canon week shards", async () => {
    const { GET } = await import("@/app/api/canon/[version]/week/route");

    const response = await GET(
      request(
        `http://localhost/api/canon/${releaseManifest.canonVersion}/week?strategyVariant=tandem-weekly_hold-none&weekOpenUtc=2026-05-24T00:00:00.000Z`,
      ),
      context(),
    );
    const body = await response.json() as { error?: string };

    expect(response.status).toBe(409);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Limni-Canon-Artifact-Status")).toBe("stale_pending_regeneration");
    expect(body.error).toContain("stale pending regeneration");
  });

  it("refuses stale ADR-grid correction shards before expensive shard repair work", async () => {
    const buildStrategyArtifactCorrectionShard = vi.fn(async () => ({
      metadata: {
        canonVersion: releaseManifest.canonVersion,
        strategyVariant: "tandem-adr_grid-pair_fill_cap",
        weekOpenUtc: "2026-05-24T00:00:00.000Z",
        source: "strategy-artifact-correction",
        schemaVersion: "canon-week-shard-v1",
        payloadHash: "sha256:test",
        generatedAtUtc: "2026-06-05T00:00:00.000Z",
      },
      payload: { closedHistoryRows: [] },
    }));
    const readReleaseCanonArtifact = vi.fn(async () => {
      throw new Error("release canon should not be read while release canon is stale");
    });

    vi.doMock("@/lib/canon/canonWeekShard.server", () => ({
      buildStrategyArtifactCorrectionShard,
      readReleaseCanonArtifact,
      buildCanonWeekShard: vi.fn(),
      buildClosedWeekDeltaShard: vi.fn(),
    }));
    const { GET } = await import("@/app/api/canon/[version]/week/route");

    const response = await GET(
      request(
        `http://localhost/api/canon/${releaseManifest.canonVersion}/week?strategyVariant=tandem-adr_grid-pair_fill_cap&weekOpenUtc=2026-05-24T00:00:00.000Z`,
      ),
      context(),
    );
    const body = await response.json() as { error?: string };

    expect(response.status).toBe(409);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Limni-Canon-Artifact-Status")).toBe("stale_pending_regeneration");
    expect(response.headers.get("X-Limni-Canon-Shard-Source")).toBeNull();
    expect(body.error).toContain("Performance canon stale");
    expect(buildStrategyArtifactCorrectionShard).not.toHaveBeenCalled();
    expect(readReleaseCanonArtifact).not.toHaveBeenCalled();
  });
});
