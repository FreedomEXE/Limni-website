/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: releaseManifest.ts
 *
 * Description:
 * Runtime schema and validated accessors for the active app release manifest.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { z } from "zod";
import rawManifest from "../../../../release-manifest.json";

const runtimeVersionSchema = z.string().regex(/^v\d+(?:\.\d+){0,2}$/);

function semanticVersionFrom(version: string) {
  return version.replace(/^v/, "");
}

const releaseManifestRawSchema = z.object({
  releaseLine: z.string().regex(/^v\d+$/),
  displayVersion: z.string().regex(/^v\d+$/),
  liveVersion: runtimeVersionSchema,
  devVersion: runtimeVersionSchema.nullable().optional(),
  canonVersion: runtimeVersionSchema,
  cacheNamespace: z.string().min(1),
  preparedAt: z.string().min(1),
  releasedAt: z.string().min(1).nullable(),
  anchorCommit: z.string().min(1),
  previousVersion: z.object({
    liveVersion: runtimeVersionSchema,
  }).strict().nullable(),
  components: z.object({
    engineVersion: z.string().min(1),
    assemblyVersion: z.string().min(1).optional(),
    selectorEngineVersion: z.string().min(1).optional(),
    anchorVersion: z.string().min(1),
    canonicalAnchorVersion: z.string().min(1),
    tradeLedgerVersion: z.string().min(1),
    preloadCacheVersion: z.string().min(1),
    canonicalDerivationVersion: z.string().min(1),
    executionDerivationVersion: z.string().min(1),
  }),
  canon: z.object({
    artifactStatus: z.enum(["valid", "stale_pending_regeneration"]).default("valid"),
    validForEngineVersion: z.string().min(1).optional(),
    requiresEngineVersion: z.string().min(1).optional(),
    generatedAt: z.string().min(1),
    sourceLedgerRowCount: z.number().int().nonnegative(),
    sourceHash: z.string().regex(/^sha256:[a-z0-9]+$/),
    variants: z.array(z.object({
      strategyVariant: z.string().min(1),
      file: z.string().min(1),
      rowCount: z.number().int().nonnegative(),
      sha256: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    })),
  }),
  changes: z.array(z.string().min(1)).min(1),
  versionHistory: z.array(z.object({
    appVersion: z.string().regex(/^v\d+(?:\.\d+){0,2}$/),
    date: z.string().min(1),
    type: z.enum(["major", "minor", "patch"]),
    summary: z.string().min(1),
    file: z.string().min(1),
  })).optional(),
  changelogMarkdown: z.string().nullable().optional(),
}).strict();

export const releaseManifestSchema = releaseManifestRawSchema.transform((manifest) => ({
  ...manifest,
  semanticVersion: semanticVersionFrom(manifest.liveVersion),
}));

export type ReleaseManifest = z.output<typeof releaseManifestSchema>;
export type ReleaseCanonVariant = ReleaseManifest["canon"]["variants"][number];

export const releaseManifest: ReleaseManifest = releaseManifestSchema.parse(rawManifest);
