import fs from "node:fs/promises";
import path from "node:path";

export type PairPerformance = {
  open: number;
  current: number;
  percent: number;
  pips: number;
  open_time_utc: string;
  current_time_utc: string;
};

export type MarketSnapshot = {
  week_open_utc: string;
  last_refresh_utc: string;
  pairs: Record<string, PairPerformance | null>;
};

const SNAPSHOT_PATH = path.join(process.cwd(), "data", "market_snapshot.json");

async function ensureDataDir() {
  const dir = path.dirname(SNAPSHOT_PATH);
  await fs.mkdir(dir, { recursive: true });
}

export async function readMarketSnapshot(): Promise<MarketSnapshot | null> {
  try {
    const raw = await fs.readFile(SNAPSHOT_PATH, "utf-8");
    return JSON.parse(raw) as MarketSnapshot;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function writeMarketSnapshot(
  snapshot: MarketSnapshot,
): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), "utf-8");
}
