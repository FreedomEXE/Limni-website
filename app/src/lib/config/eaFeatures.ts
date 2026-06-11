function parseCsvEnv(value: string | undefined): Set<string> {
  const set = new Set<string>();
  for (const item of (value ?? "").split(",")) {
    const trimmed = item.trim();
    if (trimmed) set.add(trimmed);
  }
  return set;
}

export function isReconstructionEnabledForAccount(accountKey: string): boolean {
  const globalEnabled = String(process.env.EA_RECONSTRUCTION_ENABLED ?? "false").toLowerCase() === "true";
  if (!globalEnabled) return false;

  const allowlist = parseCsvEnv(process.env.EA_RECONSTRUCTION_ENABLED_ACCOUNTS);
  if (allowlist.size === 0) return true;
  return allowlist.has(accountKey);
}

export function useEaPlanningDiagnostics(): boolean {
  const raw = String(process.env.MT5_USE_EA_PLANNING_DIAGNOSTICS ?? "true").toLowerCase();
  return raw !== "false";
}
