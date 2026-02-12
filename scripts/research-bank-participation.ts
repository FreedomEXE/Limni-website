import { mkdirSync, writeFileSync } from "fs";
import { DateTime } from "luxon";
import type { AssetClass } from "@/lib/cotMarkets";
import { computeBankComparison } from "@/lib/research/bankComparison";

type CliOptions = {
  weeks: number;
  months: number;
  assets: AssetClass[];
  output: string;
  reportType: "f" | "o";
};

function parseArgValue(args: string[], key: string): string | null {
  const direct = args.find((item) => item.startsWith(`${key}=`));
  if (direct) {
    return direct.slice(key.length + 1);
  }
  const idx = args.findIndex((item) => item === key);
  if (idx >= 0 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return null;
}

function parseCli(): CliOptions {
  const args = process.argv.slice(2);
  const weeksRaw = parseArgValue(args, "--weeks");
  const monthsRaw = parseArgValue(args, "--months");
  const assetsRaw = parseArgValue(args, "--assets");
  const outputRaw = parseArgValue(args, "--output");
  const reportTypeRaw = parseArgValue(args, "--report-type");

  const weeks = Math.max(8, Number(weeksRaw ?? 104) || 104);
  const months = Math.max(3, Number(monthsRaw ?? 24) || 24);
  const parsedAssets = (assetsRaw ?? "fx,indices,crypto,commodities")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is AssetClass =>
      value === "fx" || value === "indices" || value === "crypto" || value === "commodities",
    );

  return {
    weeks,
    months,
    assets: parsedAssets.length > 0 ? parsedAssets : ["fx", "indices", "crypto", "commodities"],
    output: outputRaw ?? "research/output/bank-participation-comparison.json",
    reportType: reportTypeRaw === "o" ? "o" : "f",
  };
}

async function main() {
  const options = parseCli();
  const payload = await computeBankComparison({
    weeks: options.weeks,
    months: options.months,
    assets: options.assets,
    reportType: options.reportType,
  });

  const outDir = options.output.includes("/")
    ? options.output.slice(0, options.output.lastIndexOf("/"))
    : ".";
  if (outDir && outDir !== ".") {
    mkdirSync(outDir, { recursive: true });
  }
  writeFileSync(options.output, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`[research-bank-participation] Wrote ${payload.rows.length} rows to ${options.output} at ${DateTime.utc().toISO()}`);
}

main().catch((error) => {
  console.error("[research-bank-participation] Failed:", error);
  process.exitCode = 1;
});
