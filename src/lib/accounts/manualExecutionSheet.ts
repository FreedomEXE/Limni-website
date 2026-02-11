type PlannedLeg = {
  model?: string;
  direction?: string;
};

type PlannedPair = {
  symbol: string;
  net: number;
  entryPrice?: number | null;
  legs?: PlannedLeg[];
};

export type ManualRiskProfile = "god" | "normal" | "low";

export type ManualExecutionRow = {
  symbol: string;
  side: "BUY" | "SELL";
  agreementCount: number;
  models: string[];
  entryPrice: number | null;
  baseOneToOneLot: number;
  lots: number;
};

const FX_CONTRACT_SIZE = 100000;

export function manualRiskMultiplier(profile: ManualRiskProfile) {
  if (profile === "god") return 1.0;
  if (profile === "low") return 0.1;
  return 0.25;
}

export function resolveManualRiskProfile(rawRiskMode: string | null | undefined): ManualRiskProfile {
  const mode = String(rawRiskMode ?? "").trim().toLowerCase();
  if (!mode) return "normal";
  if (["god", "high", "high_legacy", "1:1", "aggressive"].includes(mode)) return "god";
  if (["low", "0.1:1", "0.10:1", "reduced_low"].includes(mode)) return "low";
  if (["reduced", "normal", "0.25:1"].includes(mode)) return "normal";
  return "normal";
}

function floorToLotStep(value: number, step = 0.01, minLot = 0.01) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const floored = Math.floor(value / step) * step;
  return Number(Math.max(minLot, floored).toFixed(2));
}

function oneToOneFxLot(equity: number, price: number | null) {
  if (!Number.isFinite(equity) || equity <= 0) return 0;
  if (!Number.isFinite(price) || (price ?? 0) <= 0) return 0;
  return equity / ((price as number) * FX_CONTRACT_SIZE);
}

function normalizeModels(legs: PlannedLeg[] | undefined) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const leg of legs ?? []) {
    const raw = String(leg.model ?? "").trim().toUpperCase();
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
  }
  return out;
}

export function buildManualExecutionRows(options: {
  plannedPairs: PlannedPair[];
  equity: number;
  riskProfile: ManualRiskProfile;
}) {
  const { plannedPairs, equity, riskProfile } = options;
  const multiplier = manualRiskMultiplier(riskProfile);

  return plannedPairs
    .filter((pair) => Number(pair.net ?? 0) !== 0)
    .map((pair) => {
      const net = Number(pair.net ?? 0);
      const agreementCount = Math.max(1, Math.abs(net));
      const side: "BUY" | "SELL" = net > 0 ? "BUY" : "SELL";
      const entryPrice = Number.isFinite(Number(pair.entryPrice)) ? Number(pair.entryPrice) : null;
      const baseOneToOneLot = oneToOneFxLot(equity, entryPrice);
      const lots = floorToLotStep(baseOneToOneLot * multiplier * agreementCount);
      return {
        symbol: String(pair.symbol ?? "").toUpperCase(),
        side,
        agreementCount,
        models: normalizeModels(pair.legs),
        entryPrice,
        baseOneToOneLot,
        lots,
      } as ManualExecutionRow;
    })
    .filter((row) => row.symbol && row.lots > 0)
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export function renderManualExecutionText(options: {
  accountLabel: string;
  currency: string;
  equity: number;
  riskProfile: ManualRiskProfile;
  weekLabel: string;
  rows: ManualExecutionRow[];
}) {
  const { accountLabel, currency, equity, riskProfile, weekLabel, rows } = options;
  const riskLabel = riskProfile.toUpperCase();
  const header = [
    "=== LIMNI MANUAL EXECUTION SHEET ===",
    `Account: ${accountLabel}`,
    `Risk Mode: ${riskLabel}`,
    `Week: ${weekLabel}`,
    `Base Equity: ${currency}${equity.toFixed(2)}`,
    "",
  ];
  const lines = rows.map((row) => {
    const modelsText = row.models.length > 0 ? row.models.join(",") : "N/A";
    return `${row.symbol}\t${row.side}\t${row.lots.toFixed(2)} lots\t(${row.agreementCount} models: ${modelsText})`;
  });
  return [...header, ...lines].join("\n");
}

export function renderManualExecutionCsv(rows: ManualExecutionRow[]) {
  const header = "Symbol,Side,Lots,AgreementCount,Models";
  const lines = rows.map((row) => {
    const models = row.models.join("|");
    return `${row.symbol},${row.side},${row.lots.toFixed(2)},${row.agreementCount},\"${models}\"`;
  });
  return [header, ...lines].join("\n");
}
