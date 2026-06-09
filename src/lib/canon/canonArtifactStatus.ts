import type { ReleaseManifest } from "@/lib/version/releaseManifest";

export function isCanonArtifactStale(manifest: ReleaseManifest) {
  return manifest.canon.artifactStatus === "stale_pending_regeneration";
}

export function staleCanonErrorMessage(manifest: ReleaseManifest) {
  return [
    "Performance canon stale: v33 regeneration required.",
    "Release canon artifacts are stale pending regeneration.",
    `validFor=${manifest.canon.validForEngineVersion ?? "unknown"}`,
    `requires=${manifest.canon.requiresEngineVersion ?? manifest.components.engineVersion}`,
  ].join(" ");
}

export function canonArtifactCacheControl(manifest: ReleaseManifest, validCacheControl: string) {
  return isCanonArtifactStale(manifest) ? "no-store" : validCacheControl;
}

export function canonArtifactStatusHeaders(manifest: ReleaseManifest) {
  return {
    "X-Limni-Canon-Artifact-Status": manifest.canon.artifactStatus,
    "X-Limni-Canon-Valid-For-Engine": manifest.canon.validForEngineVersion ?? "",
    "X-Limni-Canon-Requires-Engine": manifest.canon.requiresEngineVersion ?? manifest.components.engineVersion,
  };
}
