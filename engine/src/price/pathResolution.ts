/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: pathResolution.ts
 *
 * Description:
 * Single source of truth for the canonical path resolution used by
 * the basket path engine and path-derived performance metrics.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

export const CANONICAL_PATH_RESOLUTION =
  process.env.CANONICAL_PATH_RESOLUTION?.trim() || "1h";
