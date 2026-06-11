export function statusTone(status: string) {
  if (status === "LIVE") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "DEMO") {
    return "bg-[var(--panel-border)]/50 text-[var(--foreground)]/70";
  }
  if (status === "READY") {
    return "bg-sky-100 text-sky-700";
  }
  if (status === "WAITING") {
    return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";
  }
  return "bg-rose-100 text-rose-700";
}

export function basketTone(state: string) {
  if (state === "ACTIVE") {
    return "text-emerald-700";
  }
  if (state === "READY") {
    return "text-[var(--foreground)]/70";
  }
  if (state === "PAUSED") {
    return "text-rose-700";
  }
  if (state === "WAITING") {
    return "text-amber-700 dark:text-amber-300";
  }
  return "text-[color:var(--muted)]";
}
