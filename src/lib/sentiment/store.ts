import fs from "node:fs/promises";
import path from "node:path";
import type {
  ProviderSentiment,
  SentimentAggregate,
  SourceHealth,
} from "./types";

const SNAPSHOTS_PATH = path.join(
  process.cwd(),
  "data",
  "sentiment_snapshots.json",
);
const AGGREGATES_PATH = path.join(
  process.cwd(),
  "data",
  "sentiment_aggregates.json",
);
const SOURCES_PATH = path.join(
  process.cwd(),
  "data",
  "sentiment_sources.json",
);

async function ensureDataDir() {
  const dir = path.join(process.cwd(), "data");
  await fs.mkdir(dir, { recursive: true });
}

export async function readSnapshots(): Promise<ProviderSentiment[]> {
  try {
    const raw = await fs.readFile(SNAPSHOTS_PATH, "utf-8");
    return JSON.parse(raw) as ProviderSentiment[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function writeSnapshots(
  snapshots: ProviderSentiment[],
): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(SNAPSHOTS_PATH, JSON.stringify(snapshots, null, 2), "utf-8");
}

export async function appendSnapshots(
  newSnapshots: ProviderSentiment[],
): Promise<void> {
  const existing = await readSnapshots();
  const maxAge = Date.now() - 24 * 60 * 60 * 1000;

  const filtered = existing.filter((s) => {
    const timestamp = new Date(s.timestamp_utc).getTime();
    return timestamp > maxAge;
  });

  const combined = [...filtered, ...newSnapshots];
  await writeSnapshots(combined);
}

export async function readAggregates(): Promise<SentimentAggregate[]> {
  try {
    const raw = await fs.readFile(AGGREGATES_PATH, "utf-8");
    return JSON.parse(raw) as SentimentAggregate[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function writeAggregates(
  aggregates: SentimentAggregate[],
): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(
    AGGREGATES_PATH,
    JSON.stringify(aggregates, null, 2),
    "utf-8",
  );
}

export async function appendAggregates(
  newAggregates: SentimentAggregate[],
): Promise<void> {
  const existing = await readAggregates();
  const maxAge = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const filtered = existing.filter((a) => {
    const timestamp = new Date(a.timestamp_utc).getTime();
    return timestamp > maxAge;
  });

  const combined = [...filtered, ...newAggregates];
  await writeAggregates(combined);
}

export async function getLatestAggregates(): Promise<SentimentAggregate[]> {
  const all = await readAggregates();
  if (all.length === 0) {
    return [];
  }

  const bySymbol = new Map<string, SentimentAggregate>();

  for (const agg of all) {
    const existing = bySymbol.get(agg.symbol);
    if (!existing || new Date(agg.timestamp_utc) > new Date(existing.timestamp_utc)) {
      bySymbol.set(agg.symbol, agg);
    }
  }

  return Array.from(bySymbol.values());
}

export async function readSourceHealth(): Promise<SourceHealth[]> {
  try {
    const raw = await fs.readFile(SOURCES_PATH, "utf-8");
    return JSON.parse(raw) as SourceHealth[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function writeSourceHealth(
  sources: SourceHealth[],
): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(SOURCES_PATH, JSON.stringify(sources, null, 2), "utf-8");
}

export async function updateSourceHealth(
  name: string,
  success: boolean,
  error?: string,
): Promise<void> {
  const sources = await readSourceHealth();
  const index = sources.findIndex((s) => s.name === name);

  const now = new Date().toISOString();

  if (index >= 0) {
    if (success) {
      sources[index] = {
        ...sources[index],
        status: "HEALTHY",
        last_success_at: now,
        last_error: "",
        consecutive_failures: 0,
      };
    } else {
      const failures = sources[index]!.consecutive_failures + 1;
      sources[index] = {
        ...sources[index],
        status: failures >= 3 ? "DOWN" : "DEGRADED",
        last_error: error || "Unknown error",
        consecutive_failures: failures,
      };
    }
  } else {
    sources.push({
      name: name as never,
      status: success ? "HEALTHY" : "DEGRADED",
      last_success_at: success ? now : "",
      last_error: error || "",
      consecutive_failures: success ? 0 : 1,
    });
  }

  await writeSourceHealth(sources);
}
