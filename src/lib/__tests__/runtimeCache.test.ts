import { beforeEach, describe, expect, it } from "vitest";
import {
  clearRuntimeCacheAll,
  getOrSetRuntimeCache,
} from "@/lib/runtimeCache";

describe("runtimeCache", () => {
  beforeEach(() => {
    clearRuntimeCacheAll();
  });

  it("deduplicates concurrent cache misses by sharing the same pending promise", async () => {
    let loaderCalls = 0;
    let resolveLoader: ((value: string) => void) | null = null;

    const loader = () => {
      loaderCalls += 1;
      return new Promise<string>((resolve) => {
        resolveLoader = resolve;
      });
    };

    const pending = Promise.all([
      getOrSetRuntimeCache("runtime-cache:test", 1_000, loader),
      getOrSetRuntimeCache("runtime-cache:test", 1_000, loader),
      getOrSetRuntimeCache("runtime-cache:test", 1_000, loader),
    ]);

    expect(loaderCalls).toBe(1);

    resolveLoader?.("shared-result");

    await expect(pending).resolves.toEqual([
      "shared-result",
      "shared-result",
      "shared-result",
    ]);
  });
});
