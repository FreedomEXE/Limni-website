import { promises as fs } from "fs";
import path from "path";

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

const SUMMARY_PATHS = [
  path.join(process.cwd(), "public", "scalp-bot", "summary.json"),
  path.join(process.cwd(), "data", "scalp_bot", "summary.json"),
  path.join(process.cwd(), "research", "scalp_bot", "output", "summary.json"),
];

const STAGE3_PATHS = [
  path.join(process.cwd(), "public", "scalp-bot", "stage3_best", "summary.json"),
  path.join(process.cwd(), "research", "scalp_bot", "output_stage3", "best", "summary.json"),
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
