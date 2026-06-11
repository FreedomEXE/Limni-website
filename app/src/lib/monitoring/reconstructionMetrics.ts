type ReconstructionEvent = {
  accountId: string;
  status: string;
  dataSource: string;
  windowStartUtc?: string;
  windowEndUtc?: string;
};

export function emitReconstructionEvent(event: ReconstructionEvent) {
  const status = String(event.status || "none").toLowerCase();
  const dataSource = String(event.dataSource || "realtime").toLowerCase();

  if (dataSource !== "reconstructed") return;

  const payload = {
    metric: "mt5_reconstruction_event",
    account_id: event.accountId,
    status,
    data_source: dataSource,
    window_start_utc: event.windowStartUtc ?? null,
    window_end_utc: event.windowEndUtc ?? null,
    ts: new Date().toISOString(),
  };

  if (status === "failed") {
    console.error("[ReconstructionAlert] failed", payload);
  } else if (status === "partial") {
    console.warn("[ReconstructionWarn] partial", payload);
  } else {
    console.info("[ReconstructionInfo] complete", payload);
  }
}

