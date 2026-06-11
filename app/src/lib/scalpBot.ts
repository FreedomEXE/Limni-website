import { promises as fs } from "fs";
import { appPath, repoPath } from "@/lib/server/repoPaths";

export type ScalpBotSummary = {
  generated_at: string;
  overall: {
    trades: number;
    net_r: number;
    profit_factor: number;
    max_drawdown_r: number;
    win_rate: number;
    avg_r: number;
    max_consecutive_losses: number;
  };
  by_pair: Array<{ pair: string; count: number; sum: number; mean: number }>;
  by_month: Array<{ month: string; count: number; sum: number; mean: number }>;
};

export type DailyBiasSummary = {
  generated_at: string;
  mode?: string;
  overall: {
    trades: number;
    net_pips: number;
    avg_pips: number;
    win_rate: number;
  };
  daily: Array<{ day: string; pnl_pips: number }>;
  by_pair: Array<{ pair: string; count: number; sum: number; mean: number }>;
  by_month: Array<{ month: string; count: number; sum: number; mean: number }>;
  by_week: Array<{ week: string; count: number; sum: number; mean: number }>;
};

const SUMMARY_PATHS = [
  appPath("public", "scalp-bot", "summary.json"),
  repoPath("Local Environment", "data", "scalp_bot", "summary.json"),
  appPath("research", "scalp_bot", "output", "summary.json"),
];

const STAGE3_PATHS = [
  appPath("public", "scalp-bot", "stage3_best", "summary.json"),
  appPath("research", "scalp_bot", "output_stage3", "best", "summary.json"),
];

export async function loadScalpBotSummary(): Promise<ScalpBotSummary | null> {
  for (const filePath of SUMMARY_PATHS) {
    try {
      const data = await fs.readFile(filePath, "utf8");
      return JSON.parse(data) as ScalpBotSummary;
    } catch (error) {
      continue;
    }
  }
  return null;
}

const DAILY_BIAS_PATHS: Record<string, string[]> = {
  single: [
    appPath("public", "scalp-bot", "daily_bias_single", "summary.json"),
    appPath("research", "scalp_bot", "output_daily_bias_single", "summary.json"),
  ],
  hourly: [
    appPath("public", "scalp-bot", "daily_bias_hourly", "summary.json"),
    appPath("research", "scalp_bot", "output_daily_bias_hourly", "summary.json"),
  ],
  weekly: [
    appPath("public", "scalp-bot", "daily_bias_weekly", "summary.json"),
    appPath("research", "scalp_bot", "output_daily_bias_weekly", "summary.json"),
  ],
};

export async function loadDailyBiasSummary(
  mode: "single" | "hourly" | "weekly" = "hourly",
): Promise<DailyBiasSummary | null> {
  const paths = DAILY_BIAS_PATHS[mode] ?? [];
  for (const filePath of paths) {
    try {
      const data = await fs.readFile(filePath, "utf8");
      return JSON.parse(data) as DailyBiasSummary;
    } catch (error) {
      continue;
    }
  }
  return null;
}

export async function loadScalpBotStage3Summary(): Promise<ScalpBotSummary | null> {
  for (const filePath of STAGE3_PATHS) {
    try {
      const data = await fs.readFile(filePath, "utf8");
      return JSON.parse(data) as ScalpBotSummary;
    } catch (error) {
      continue;
    }
  }
  return null;
}
