import { query, queryOne } from "@/lib/db";

export type RegimeLabel = "hot" | "neutral" | "cold" | "unknown";

export type RegimeInput = {
  dayUtc: string;
  solPrice?: number | null;
  solChange24h?: number | null;
  solChange7d?: number | null;
  memeVolume1h?: number | null;
  memeChange1h?: number | null;
  memeChange6h?: number | null;
  memeMcapMedian?: number | null;
  memeHoldersMedian?: number | null;
  sampleTokens?: number | null;
};

export type RegimeRecord = RegimeInput & {
  label: RegimeLabel;
  score: number;
};

function scoreMetric(value: number | null | undefined, up: number, down: number): number {
  if (value == null || Number.isNaN(value)) {
    return 0;
  }
  if (value >= up) {
    return 1;
  }
  if (value <= down) {
    return -1;
  }
  return 0;
}

export function classifyRegime(input: RegimeInput): { label: RegimeLabel; score: number } {
  const metrics: Array<number | null | undefined> = [
    input.solChange24h,
    input.solChange7d,
    input.memeChange1h,
    input.memeChange6h,
    input.memeVolume1h,
  ];
  const available = metrics.filter((value) => value != null && !Number.isNaN(value)).length;
  if (available < 3) {
    return { label: "unknown", score: 0 };
  }

  let score = 0;
  score += scoreMetric(input.solChange24h, 1, -3);
  score += scoreMetric(input.solChange7d, 3, -7);
  score += scoreMetric(input.memeChange1h, 1, -3);
  score += scoreMetric(input.memeChange6h, 1, -3);

  if (input.memeVolume1h != null && !Number.isNaN(input.memeVolume1h)) {
    if (input.memeVolume1h >= 200_000) {
      score += 1;
    } else if (input.memeVolume1h <= 50_000) {
      score -= 1;
    }
  }

  if (score >= 2) {
    return { label: "hot", score };
  }
  if (score <= -2) {
    return { label: "cold", score };
  }
  return { label: "neutral", score };
}

export async function upsertRegimeDay(input: RegimeInput): Promise<RegimeRecord> {
  const { label, score } = classifyRegime(input);
  const record: RegimeRecord = {
    ...input,
    label,
    score,
  };
  await query(
    `
    INSERT INTO solana_meme_regime_daily (
      day_utc, sol_price, sol_change_24h, sol_change_7d,
      meme_volume_1h, meme_change_1h, meme_change_6h,
      meme_mcap_median, meme_holders_median, sample_tokens,
      label, score, updated_at
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7,
      $8, $9, $10,
      $11, $12, NOW()
    )
    ON CONFLICT (day_utc) DO UPDATE SET
      sol_price = EXCLUDED.sol_price,
      sol_change_24h = EXCLUDED.sol_change_24h,
      sol_change_7d = EXCLUDED.sol_change_7d,
      meme_volume_1h = EXCLUDED.meme_volume_1h,
      meme_change_1h = EXCLUDED.meme_change_1h,
      meme_change_6h = EXCLUDED.meme_change_6h,
      meme_mcap_median = EXCLUDED.meme_mcap_median,
      meme_holders_median = EXCLUDED.meme_holders_median,
      sample_tokens = EXCLUDED.sample_tokens,
      label = EXCLUDED.label,
      score = EXCLUDED.score,
      updated_at = NOW()
    `,
    [
      input.dayUtc,
      input.solPrice ?? null,
      input.solChange24h ?? null,
      input.solChange7d ?? null,
      input.memeVolume1h ?? null,
      input.memeChange1h ?? null,
      input.memeChange6h ?? null,
      input.memeMcapMedian ?? null,
      input.memeHoldersMedian ?? null,
      input.sampleTokens ?? 0,
      label,
      score,
    ],
  );
  return record;
}

export async function getRecentRegimeDays(limit = 14): Promise<RegimeRecord[]> {
  const rows = await query<RegimeRecord>(
    `
    SELECT day_utc as "dayUtc",
           sol_price as "solPrice",
           sol_change_24h as "solChange24h",
           sol_change_7d as "solChange7d",
           meme_volume_1h as "memeVolume1h",
           meme_change_1h as "memeChange1h",
           meme_change_6h as "memeChange6h",
           meme_mcap_median as "memeMcapMedian",
           meme_holders_median as "memeHoldersMedian",
           sample_tokens as "sampleTokens",
           label,
           score
    FROM solana_meme_regime_daily
    ORDER BY day_utc DESC
    LIMIT $1
    `,
    [limit],
  );
  return rows;
}

export async function getTodayRegime(dayUtc: string): Promise<RegimeRecord | null> {
  return await queryOne<RegimeRecord>(
    `
    SELECT day_utc as "dayUtc",
           sol_price as "solPrice",
           sol_change_24h as "solChange24h",
           sol_change_7d as "solChange7d",
           meme_volume_1h as "memeVolume1h",
           meme_change_1h as "memeChange1h",
           meme_change_6h as "memeChange6h",
           meme_mcap_median as "memeMcapMedian",
           meme_holders_median as "memeHoldersMedian",
           sample_tokens as "sampleTokens",
           label,
           score
    FROM solana_meme_regime_daily
    WHERE day_utc = $1
    `,
    [dayUtc],
  );
}
