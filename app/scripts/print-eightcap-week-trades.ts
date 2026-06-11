import fs from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";

type ClosedPosition = {
  symbol: string;
  type: "BUY" | "SELL";
  lots: number;
  open_price: number;
  close_price: number;
  profit: number;
  swap: number;
  commission: number;
  open_time: string;
  close_time: string;
  comment: string;
};

function loadDotEnv() {
  const cwd = process.cwd();
  for (const filename of [".env.local", ".env"]) {
    const filePath = path.join(cwd, filename);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const idx = line.indexOf("=");
      if (idx <= 0) continue;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if (!key) continue;
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

async function main() {
  loadDotEnv();

  const baseUrl =
    (process.env.LIMNI_API_BASE ?? "").trim() || "https://limni-website-nine.vercel.app";
  const accountId = process.env.MT5_EIGHTCAP_ACCOUNT_ID?.trim() || "7935823";
  const weekOpenUtc = process.env.WEEK_OPEN_UTC?.trim() || "2026-02-02T05:00:00.000Z";

  const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  if (!weekOpen.isValid) {
    throw new Error(`Invalid WEEK_OPEN_UTC: ${weekOpenUtc}`);
  }
  const weekEnd = weekOpen.plus({ days: 7 });

  const url = new URL(`/api/mt5/closed-positions/${encodeURIComponent(accountId)}`, baseUrl);
  url.searchParams.set("limit", "5000");

  const res = await fetch(url.toString(), { headers: { "cache-control": "no-store" } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { positions?: ClosedPosition[] };
  const positions = data.positions ?? [];
  const inWindow = positions
    .filter((t) => {
      const ct = DateTime.fromISO(t.close_time, { zone: "utc" });
      return ct.isValid && ct >= weekOpen && ct < weekEnd;
    })
    .map((t) => ({
      ...t,
      direction: t.type === "BUY" ? ("LONG" as const) : ("SHORT" as const),
      net: (t.profit ?? 0) + (t.swap ?? 0) + (t.commission ?? 0),
    }))
    .sort(
      (a, b) =>
        DateTime.fromISO(a.close_time, { zone: "utc" }).toMillis() -
        DateTime.fromISO(b.close_time, { zone: "utc" }).toMillis(),
    );

  // Tab-separated so you can paste into Sheets easily.
  console.log(
    [
      "symbol",
      "direction",
      "lots",
      "open_time_utc",
      "close_time_utc",
      "open_price",
      "close_price",
      "net_usd",
      "comment",
    ].join("\t"),
  );
  for (const t of inWindow) {
    console.log(
      [
        t.symbol,
        t.direction,
        Number(t.lots).toFixed(2),
        t.open_time,
        t.close_time,
        Number(t.open_price).toString(),
        Number(t.close_price).toString(),
        Number(t.net).toFixed(2),
        (t.comment ?? "").replace(/\s+/g, " ").trim(),
      ].join("\t"),
    );
  }
  console.error(`count=${inWindow.length}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});

