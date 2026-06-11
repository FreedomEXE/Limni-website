import { existsSync } from "node:fs";
import path from "node:path";

let cachedRepoRoot: string | null = null;

export function getRepoRoot() {
  if (cachedRepoRoot) return cachedRepoRoot;

  const cwd = process.cwd();
  const candidates = [cwd, path.resolve(cwd, "..")];
  for (const candidate of candidates) {
    if (
      existsSync(path.join(candidate, "release-manifest.json"))
      && existsSync(path.join(candidate, "app"))
    ) {
      cachedRepoRoot = candidate;
      return candidate;
    }
  }

  cachedRepoRoot = cwd;
  return cwd;
}

export function repoPath(...segments: string[]) {
  return path.join(getRepoRoot(), ...segments);
}

export function appPath(...segments: string[]) {
  return repoPath("app", ...segments);
}

export function databasePath(...segments: string[]) {
  return repoPath("database", ...segments);
}
