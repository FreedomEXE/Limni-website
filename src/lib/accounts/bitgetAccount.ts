import crypto from "crypto";
import { loadConnectedAccountSecretsByKey } from "@/lib/connectedAccounts";

export async function fetchBitgetUsdtEquity(accountKey: string): Promise<number | null> {
  const record = await loadConnectedAccountSecretsByKey(accountKey);
  const secrets = record?.secrets as Record<string, unknown> | undefined;
  const apiKey = typeof secrets?.apiKey === "string" ? (secrets.apiKey as string) : "";
  const apiSecret = typeof secrets?.apiSecret === "string" ? (secrets.apiSecret as string) : "";
  const apiPassphrase =
    typeof secrets?.apiPassphrase === "string" ? (secrets.apiPassphrase as string) : "";

  if (!apiKey || !apiSecret || !apiPassphrase) {
    return null;
  }

  const productType = process.env.BITGET_PRODUCT_TYPE ?? "USDT-FUTURES";
  const path = "/api/v2/mix/account/accounts";
  const params = new URLSearchParams({ productType });
  const query = `?${params.toString()}`;
  const body = "";
  const timestamp = Date.now().toString();
  const prehash = `${timestamp}GET${path}${query}${body}`;
  const signature = crypto.createHmac("sha256", apiSecret).update(prehash).digest("base64");

  const response = await fetch(`https://api.bitget.com${path}${query}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "ACCESS-KEY": apiKey,
      "ACCESS-SIGN": signature,
      "ACCESS-TIMESTAMP": timestamp,
      "ACCESS-PASSPHRASE": apiPassphrase,
      locale: "en-US",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Bitget equity fetch failed:", response.status, text);
    return null;
  }

  const payload = (await response.json()) as {
    code?: string;
    msg?: string;
    data?: Array<{ marginCoin?: string; equity?: string; usdtEquity?: string }>;
  };

  if (payload.code && payload.code !== "00000") {
    console.error("Bitget equity API error:", payload.code, payload.msg);
    return null;
  }

  const list = Array.isArray(payload.data) ? payload.data : [];
  const row =
    list.find((item) => String(item.marginCoin ?? "").toUpperCase() === "USDT") ?? list[0];
  const equity = Number(row?.usdtEquity ?? row?.equity);
  return Number.isFinite(equity) && equity > 0 ? equity : null;
}
