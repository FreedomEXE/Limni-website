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
import rawManifest from "../../../release-manifest.json";

export const releaseManifestSchema = z.object({
  releaseLine: z.string().regex(/^v\d+$/),
  displayVersion: z.string().regex(/^v\d+$/),
  appVersion: z.string().regex(/^v\d+(?:\.\d+){0,2}$/),
  semanticVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  canonVersion: z.string().regex(/^v\d+(?:\.\d+){0,2}$/),
  cacheNamespace: z.string().min(1),
  preparedAt: z.string().min(1),
  releasedAt: z.string().min(1).nullable(),
  anchorCommit: z.string().min(1),
  previousVersion: z.object({
    appVersion: z.string().regex(/^v\d+(?:\.\d+){0,2}$/),
    semanticVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  }).nullable(),
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
});

export type ReleaseManifest = z.infer<typeof releaseManifestSchema>;
export type ReleaseCanonVariant = ReleaseManifest["canon"]["variants"][number];

export const releaseManifest: ReleaseManifest = releaseManifestSchema.parse(rawManifest);
