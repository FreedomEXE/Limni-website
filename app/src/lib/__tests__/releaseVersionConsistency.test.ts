import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { appPath } from "@/lib/server/repoPaths";

import {
  canonArtifactCacheControl,
  isCanonArtifactStale,
} from "@/lib/canon/canonArtifactStatus";
import { EXECUTION_ANCHOR_VERSION } from "@/lib/executionPriceWindows";
import { EXECUTION_WEEKLY_RETURN_DERIVATION_VERSION } from "@/lib/executionWeeklyReturns";
import { GLOBAL_PRELOAD_CACHE_VERSION } from "@/lib/preload/preloadContract";
import { SELECTOR_ENGINE_VERSION } from "@/lib/performance/selectorEngine";
import {
  STRATEGY_ASSEMBLY_VERSION,
  STRATEGY_SHARD_ENGINE_VERSION,
} from "@/lib/performance/strategyArtifactVersions";
import { releaseManifest } from "@/lib/version/releaseManifest";

function readReleaseLineManifest() {
  const manifestPath = appPath("releases", "v2", "manifest.json");
  return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as typeof releaseManifest;
}

function readCanonMetadata(file: string) {
  const canonPath = appPath("releases", "v2", "canon", file);
  const fd = fs.openSync(canonPath, "r");
  try {
    const buffer = Buffer.alloc(4096);
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
    const header = buffer.toString("utf8", 0, bytesRead);
    return {
      appVersion: /"appVersion"\s*:\s*"([^"]+)"/.exec(header)?.[1],
      canonGeneratedAt: /"canonGeneratedAt"\s*:\s*"([^"]+)"/.exec(header)?.[1],
    };
  } finally {
    fs.closeSync(fd);
  }
}

describe("release version consistency", () => {
  it("keeps runtime version constants, preload stamp, and release manifests aligned", () => {
    const releaseLineManifest = readReleaseLineManifest();

    for (const manifest of [releaseManifest, releaseLineManifest]) {
      expect(manifest.components.engineVersion).toBe(STRATEGY_SHARD_ENGINE_VERSION);
      expect(manifest.components.assemblyVersion).toBe(STRATEGY_ASSEMBLY_VERSION);
      expect(manifest.components.selectorEngineVersion).toBe(SELECTOR_ENGINE_VERSION);
      expect(manifest.components.anchorVersion).toBe(EXECUTION_ANCHOR_VERSION);
      expect(manifest.components.preloadCacheVersion).toBe(GLOBAL_PRELOAD_CACHE_VERSION);
      expect(manifest.components.executionDerivationVersion).toBe(EXECUTION_WEEKLY_RETURN_DERIVATION_VERSION);
      expect(manifest.cacheNamespace).toContain("v2.0.3");
    }
  });

  it("does not present stale canon artifacts as valid for the pending engine", () => {
    const releaseLineManifest = readReleaseLineManifest();

    for (const manifest of [releaseManifest, releaseLineManifest]) {
      expect(manifest.canon.requiresEngineVersion).toBe(STRATEGY_SHARD_ENGINE_VERSION);

      if (manifest.canon.artifactStatus === "valid") {
        expect(manifest.canon.validForEngineVersion).toBe(STRATEGY_SHARD_ENGINE_VERSION);
      } else {
        expect(manifest.canon.artifactStatus).toBe("stale_pending_regeneration");
        expect(manifest.canon.validForEngineVersion).not.toBe(STRATEGY_SHARD_ENGINE_VERSION);
      }

      expect(manifest.canon.variants.length).toBeGreaterThan(0);
      for (const canonVariant of manifest.canon.variants) {
        const canonMetadata = readCanonMetadata(canonVariant.file);
        expect(canonMetadata.appVersion).toBeTruthy();
        expect(canonMetadata.canonGeneratedAt).toBeTruthy();

        if (manifest.pendingRelease && canonMetadata.appVersion !== manifest.pendingRelease.appVersion) {
          expect(manifest.canon.artifactStatus).toBe("stale_pending_regeneration");
        }
      }
    }
  });

  it("makes stale canon actionable in cache policy", () => {
    expect(isCanonArtifactStale(releaseManifest)).toBe(true);
    expect(canonArtifactCacheControl(releaseManifest, "public, max-age=31536000, immutable")).toBe("no-store");
  });
});
