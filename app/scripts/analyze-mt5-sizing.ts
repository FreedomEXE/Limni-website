import { readMt5Accounts } from "../src/lib/mt5Store";

type ContractSizeRule = {
  match: (symbol: string) => boolean;
  size: number;
  label: string;
};

const CONTRACT_SIZES: ContractSizeRule[] = [
  { match: (s) => /^(XAUUSD|XAUUSD\.?)/i.test(s), size: 100, label: "XAU (100 oz)" },
  { match: (s) => /^(XAGUSD|XAGUSD\.?)/i.test(s), size: 5000, label: "XAG (5,000 oz)" },
  { match: (s) => /^(WTIUSD|USOUSD|WTI|USO)/i.test(s), size: 1000, label: "WTI (1,000 bbl)" },
  { match: (s) => /^(SPXUSD|SPX500|US500|SPX)/i.test(s), size: 1, label: "SPX (1 contract)" },
  { match: (s) => /^(NDXUSD|NDX100|NAS100|US100|NDX)/i.test(s), size: 1, label: "NDX (1 contract)" },
  { match: (s) => /^(NIKKEIUSD|JPN225|JP225|NIKKEI)/i.test(s), size: 1, label: "Nikkei (1 contract)" },
  { match: (s) => /^(BTCUSD|BTCUSDT|BTC)/i.test(s), size: 1, label: "BTC (1 coin)" },
  { match: (s) => /^(ETHUSD|ETHUSDT|ETH)/i.test(s), size: 1, label: "ETH (1 coin)" },
  { match: (s) => /^[A-Z]{6}$/i.test(s), size: 100000, label: "FX (100,000 units)" },
];

function findContractSize(symbol: string) {
  const rule = CONTRACT_SIZES.find((r) => r.match(symbol));
  return rule ?? { size: 100000, label: "FX (100,000 units)" };
}

async function analyzeSizing() {
  const accounts = await readMt5Accounts();
  const account = accounts.find((a) => a.label?.toLowerCase().includes("tyrell"));

  if (!account) {
    console.log("Account not found. Update the label filter in scripts/analyze-mt5-sizing.ts.");
    return;
  }

  const baseEquity =
    Number.isFinite(account.baseline_equity) && account.baseline_equity > 0
      ? account.baseline_equity
      : Number.isFinite(account.balance) && account.balance > 0
        ? account.balance
        : account.equity;
  const targetEquity = 100;
  const scale = baseEquity > 0 ? targetEquity / baseEquity : 0;

  console.log("MT5 sizing snapshot");
  console.log(`Account: ${account.label} (${account.broker} - ${account.server})`);
  console.log(`Base equity: ${baseEquity.toFixed(2)} ${account.currency}`);
  console.log(`Target equity: ${targetEquity.toFixed(2)} ${account.currency}`);
  console.log(`Scale factor: ${scale.toFixed(6)}`);
  console.log("");

  if (!account.positions || account.positions.length === 0) {
    console.log("No open positions in MT5 snapshot. Sizing output is empty.");
    return;
  }

  const rows = account.positions.map((pos) => {
    const contract = findContractSize(pos.symbol);
    const scaledLots = pos.lots * scale;
    const units = scaledLots * contract.size;
    return {
      symbol: pos.symbol,
      lots: pos.lots,
      scaledLots,
      units,
      rule: contract.label,
    };
  });

  for (const row of rows) {
    console.log(
      `${row.symbol}: ${row.lots.toFixed(4)} lots -> ${row.scaledLots.toFixed(6)} lots | approx units: ${Math.round(
        row.units,
      )} (${row.rule})`,
    );
  }
}

analyzeSizing().catch((error) => {
  console.error("Sizing analysis failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
