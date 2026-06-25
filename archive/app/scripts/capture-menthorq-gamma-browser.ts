/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: capture-menthorq-gamma-browser.ts
 *
 * Browser-assisted MenthorQ capture flow (no API key required):
 * - manual login in headed browser
 * - persistent browser profile reuse (no repeated credential entry)
 * - capture gamma condition + key metrics from visible page text
 * - append rows to CSV for backtest ingestion
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { DateTime } from "luxon";
import { loadEnvConfig } from "@next/env";

type CliConfig = {
  date: string;
  symbols: string[];
  outCsv: string;
  outDir: string;
  appUrl: string;
  loginUrl: string;
  userDataDir: string;
  headed: boolean;
  urlTemplate: string | null;
  urlMapFile: string;
  useUrlMap: boolean;
  assumeLoggedIn: boolean;
  continueOnAuthFailure: boolean;
  allowUnknown: boolean;
  parseRetries: number;
  parseRetryDelayMs: number;
  gammaReadyTimeoutMs: number;
};

type CaptureRow = {
  date: string;
  symbol_input: string;
  page_symbol: string;
  gamma_condition: string;
  net_gex: string;
  total_gex: string;
  timestamp_text: string;
  source_url: string;
  captured_at_utc: string;
  parse_confidence: "HIGH" | "MEDIUM" | "LOW";
  notes: string;
};

type ParsedMetrics = {
  pageSymbol: string;
  gammaCondition: string;
  netGex: string;
  totalGex: string;
  timestampText: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
};

const EXPECTED_TICKER_PREFIXES: Record<string, string[]> = {
  "6E": ["6e"],
  "6B": ["6b"],
  "6J": ["6j"],
  "6A": ["6a"],
  "6S": ["6s"],
  "6C": ["6c"],
  "6CZ": ["6c"],
  "6N": ["6n"],
  ES: ["es"],
  NQ: ["nq"],
  GC: ["gc"],
  SI: ["si"],
  CL: ["cl"],
  DX: ["dx"],
};

function detectAuthOrLandingPage(bodyText: string): string | null {
  const text = bodyText.toLowerCase();
  if (text.includes("you are unauthorized to view this page")) {
    return "UNAUTHORIZED_PAGE";
  }
  const looksLikeLogin =
    text.includes("email") &&
    text.includes("password") &&
    text.includes("remember me") &&
    text.includes("forgot password");
  if (looksLikeLogin) {
    return "LOGIN_PAGE";
  }
  const looksLikeMarketingLanding =
    text.includes("the quant engine for modern traders") &&
    text.includes("start free") &&
    text.includes("features");
  if (looksLikeMarketingLanding) {
    return "MARKETING_LANDING_PAGE";
  }
  return null;
}

function parseArgs(): CliConfig {
  const byKey = new Map<string, string>();
  for (const raw of process.argv.slice(2)) {
    if (!raw.startsWith("--")) continue;
    const [key, ...rest] = raw.slice(2).split("=");
    byKey.set(key.trim(), rest.join("="));
  }

  const today = DateTime.now().toFormat("yyyy-LL-dd");
  const date = byKey.get("date")?.trim() || today;
  const symbols = parseCsv(byKey.get("symbols") || process.env.MENTHORQ_GAMMA_SYMBOLS || "6E,6B,6J,DX,NQ,ES");
  const outCsv = byKey.get("out-csv")?.trim() || "app/reports/bias-gate/menthorq-gamma-daily.csv";
  const outDir = byKey.get("out-dir")?.trim() || "app/reports/bias-gate/menthorq-captures";
  const appUrl = byKey.get("app-url")?.trim() || process.env.MENTHORQ_APP_URL || "https://menthorq.com";
  const loginUrl = byKey.get("login-url")?.trim() || process.env.MENTHORQ_LOGIN_URL || `${appUrl.replace(/\/+$/, "")}/login`;
  const userDataDir = byKey.get("user-data-dir")?.trim() || "Local Environment/.cache/playwright-menthorq";
  const urlTemplate = byKey.get("url-template")?.trim() || process.env.MENTHORQ_FUTURES_URL_TEMPLATE || null;
  const urlMapFile =
    byKey.get("url-map-file")?.trim() ||
    process.env.MENTHORQ_SYMBOL_URL_MAP ||
    "app/reports/bias-gate/menthorq-symbol-url-map.json";
  const useUrlMapRaw = String(byKey.get("use-url-map") ?? "true").trim().toLowerCase();
  const useUrlMap = useUrlMapRaw !== "0" && useUrlMapRaw !== "false" && useUrlMapRaw !== "no" && useUrlMapRaw !== "off";
  const assumeLoggedInRaw = String(byKey.get("assume-logged-in") ?? "false").trim().toLowerCase();
  const assumeLoggedIn =
    assumeLoggedInRaw === "1" || assumeLoggedInRaw === "true" || assumeLoggedInRaw === "yes" || assumeLoggedInRaw === "on";
  const continueOnAuthFailureRaw = String(byKey.get("continue-on-auth-failure") ?? "true")
    .trim()
    .toLowerCase();
  const continueOnAuthFailure =
    continueOnAuthFailureRaw !== "0" &&
    continueOnAuthFailureRaw !== "false" &&
    continueOnAuthFailureRaw !== "no" &&
    continueOnAuthFailureRaw !== "off";
  const allowUnknownRaw = String(byKey.get("allow-unknown") ?? "false").trim().toLowerCase();
  const allowUnknown =
    allowUnknownRaw === "1" || allowUnknownRaw === "true" || allowUnknownRaw === "yes" || allowUnknownRaw === "on";
  const parseRetriesRaw = Number(byKey.get("parse-retries") ?? "2");
  const parseRetryDelayMsRaw = Number(byKey.get("parse-retry-delay-ms") ?? "1500");
  const gammaReadyTimeoutMsRaw = Number(byKey.get("gamma-ready-timeout-ms") ?? "12000");
  const parseRetries = Number.isFinite(parseRetriesRaw) ? Math.max(0, Math.trunc(parseRetriesRaw)) : 2;
  const parseRetryDelayMs = Number.isFinite(parseRetryDelayMsRaw) ? Math.max(250, Math.trunc(parseRetryDelayMsRaw)) : 1500;
  const gammaReadyTimeoutMs = Number.isFinite(gammaReadyTimeoutMsRaw)
    ? Math.max(1000, Math.trunc(gammaReadyTimeoutMsRaw))
    : 12000;
  const headedRaw = String(byKey.get("headed") ?? "true").trim().toLowerCase();
  const headed = headedRaw !== "0" && headedRaw !== "false" && headedRaw !== "no" && headedRaw !== "off";

  return {
    date,
    symbols,
    outCsv,
    outDir,
    appUrl: appUrl.replace(/\/+$/, ""),
    loginUrl,
    userDataDir,
    headed,
    urlTemplate,
    urlMapFile,
    useUrlMap,
    assumeLoggedIn,
    continueOnAuthFailure,
    allowUnknown,
    parseRetries,
    parseRetryDelayMs,
    gammaReadyTimeoutMs,
  };
}

function parseCsv(raw: string): string[] {
  return raw
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => value.length > 0);
}

function escapeCsv(value: string): string {
  const clean = String(value ?? "");
  if (/[",\n]/.test(clean)) {
    return `"${clean.replaceAll('"', '""')}"`;
  }
  return clean;
}

function ensureCsvHeader(filePath: string, header: string[]) {
  const resolved = path.resolve(process.cwd(), filePath);
  const dir = path.dirname(resolved);
  mkdirSync(dir, { recursive: true });
  if (!existsSync(resolved)) {
    writeFileSync(resolved, `${header.join(",")}\n`, "utf8");
  }
}

function appendCsvRow(filePath: string, row: CaptureRow) {
  const resolved = path.resolve(process.cwd(), filePath);
  const values = [
    row.date,
    row.symbol_input,
    row.page_symbol,
    row.gamma_condition,
    row.net_gex,
    row.total_gex,
    row.timestamp_text,
    row.source_url,
    row.captured_at_utc,
    row.parse_confidence,
    row.notes,
  ].map(escapeCsv);
  writeFileSync(resolved, `${values.join(",")}\n`, { encoding: "utf8", flag: "a" });
}

function sanitizeFilePart(value: string) {
  return value.replace(/[^A-Za-z0-9._-]/g, "_");
}

function regexFirst(text: string, regex: RegExp): string {
  const match = text.match(regex);
  if (!match) return "";
  return String(match[1] ?? "").trim();
}

function firstNonEmptyLineAfter(lines: string[], markerRegex: RegExp): string {
  const index = lines.findIndex((line) => markerRegex.test(line));
  if (index < 0) return "";
  for (let i = index + 1; i < Math.min(lines.length, index + 8); i += 1) {
    const candidate = lines[i].trim();
    if (candidate.length > 0) return candidate;
  }
  return "";
}

function parseMetricsFromText(text: string): ParsedMetrics {
  const compact = text.replace(/\r/g, "");
  const lines = compact
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const pageSymbol =
    regexFirst(compact, /\b([A-Z0-9]{1,4}[A-Z]\d{4})\b/) ||
    regexFirst(compact, /\b([A-Z]{1,4}\d{2,4})\b/) ||
    "";

  const gammaFromRegex =
    regexFirst(compact, /Gamma Condition\s*[:\-]?\s*(Positive|Negative|Neutral)/i) ||
    regexFirst(compact, /\bGamma\s*(Positive|Negative|Neutral)\b/i) ||
    regexFirst(compact, /GAMMA CONDITION[\s:.\-]*\n?\s*(POSITIVE|NEGATIVE|NEUTRAL)/i) ||
    regexFirst(compact, /\b(POSITIVE|NEGATIVE|NEUTRAL)\s+GAMMA\b/i);
  const gammaFromLineScanRaw = firstNonEmptyLineAfter(lines, /gamma condition/i);
  const gammaFromLineScan =
    /positive/i.test(gammaFromLineScanRaw) ? "Positive" :
      /negative/i.test(gammaFromLineScanRaw) ? "Negative" :
        /neutral/i.test(gammaFromLineScanRaw) ? "Neutral" : "";
  const gammaCondition = gammaFromRegex || gammaFromLineScan || "";

  const netGex =
    regexFirst(compact, /Net GEX\s*[:\-]?\s*([+\-]?\d[\d,]*(?:\.\d+)?\s*[KMB]?(?:M|B)?)/i) ||
    "";
  const totalGex =
    regexFirst(compact, /Total GEX\s*[:\-]?\s*([+\-]?\d[\d,]*(?:\.\d+)?\s*[KMB]?(?:M|B)?)/i) ||
    "";
  const timestampText = regexFirst(compact, /Timestamp\s*[:\-]?\s*([^\n]+)/i) || "";

  const hits = [gammaCondition, netGex, totalGex, timestampText].filter((value) => value.length > 0).length;
  const confidence: "HIGH" | "MEDIUM" | "LOW" = hits >= 3 ? "HIGH" : hits >= 2 ? "MEDIUM" : "LOW";

  return {
    pageSymbol,
    gammaCondition: gammaCondition.toUpperCase(),
    netGex,
    totalGex,
    timestampText,
    confidence,
  };
}

function readUrlMap(filePath: string): Record<string, string> {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!existsSync(resolved)) return {};
  try {
    const raw = JSON.parse(readFileSync(resolved, "utf8")) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === "string" && value.trim().length > 0) {
        out[key.toUpperCase()] = value.trim();
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeUrlMap(filePath: string, map: Record<string, string>) {
  const resolved = path.resolve(process.cwd(), filePath);
  mkdirSync(path.dirname(resolved), { recursive: true });
  writeFileSync(resolved, JSON.stringify(map, null, 2), "utf8");
}

function withCaptureDate(rawUrl: string, date: string): string {
  try {
    const url = new URL(rawUrl);
    url.searchParams.set("date", date);
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function tickerFromUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    return String(url.searchParams.get("ticker") ?? "").trim().toLowerCase();
  } catch {
    return "";
  }
}

function tickerLooksExpected(symbol: string, rawUrl: string): boolean {
  const ticker = tickerFromUrl(rawUrl);
  if (!ticker) return true;
  const expected = EXPECTED_TICKER_PREFIXES[symbol] ?? [symbol.toLowerCase()];
  return expected.some((prefix) => ticker.startsWith(prefix));
}

async function main() {
  loadEnvConfig(process.cwd());
  const config = parseArgs();
  const interactive = Boolean(input.isTTY && output.isTTY);
  const rl = interactive ? readline.createInterface({ input, output }) : null;
  const waitForContinue = async (message: string) => {
    console.log(message);
    if (!interactive || !rl) {
      console.log("Non-interactive mode: continuing without pause.");
      return;
    }
    await rl.question("");
  };

  let chromium: any;

  try {
    const mod = await import("playwright");
    chromium = mod.chromium;
  } catch {
    console.error("Playwright is not installed. Run: npm i -D playwright");
    process.exit(1);
    return;
  }

  const captureDir = path.resolve(process.cwd(), config.outDir, sanitizeFilePart(config.date));
  mkdirSync(captureDir, { recursive: true });
  const symbolUrlMap = config.useUrlMap ? readUrlMap(config.urlMapFile) : {};

  ensureCsvHeader(config.outCsv, [
    "date",
    "symbol_input",
    "page_symbol",
    "gamma_condition",
    "net_gex",
    "total_gex",
    "timestamp_text",
    "source_url",
    "captured_at_utc",
    "parse_confidence",
    "notes",
  ]);

  const context = await chromium.launchPersistentContext(path.resolve(process.cwd(), config.userDataDir), {
    headless: !config.headed,
    viewport: { width: 1720, height: 1000 },
  });

  let page = context.pages()[0];
  if (!page) {
    page = await context.newPage();
  }

  console.log(`Opening app URL: ${config.appUrl}`);
  try {
    await page.goto(config.appUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.log(`Initial navigation failed: ${reason}`);
    console.log(`Proceed manually in browser to your MenthorQ page, then continue.`);
  }

  if (!config.assumeLoggedIn) {
    await waitForContinue([
      "Manual login step:",
      `1. If not already logged in, go to ${config.loginUrl} in the opened browser.`,
      "2. Login manually (you keep credentials private).",
      "3. Open the first instrument page you want to capture.",
      "4. Return here and press Enter.",
    ].join("\n"));
  } else {
    console.log("assume-logged-in enabled: skipping login pause.");
  }

  const manifest: Array<Record<string, unknown>> = [];
  let hadAuthFailure = false;

  for (const symbol of config.symbols) {
    const mappedUrl = symbolUrlMap[symbol] ? withCaptureDate(symbolUrlMap[symbol], config.date) : "";
    const navigateAndSettle = async (url: string, label: string) => {
      console.log(`Navigating ${label} for ${symbol}: ${url}`);
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1200);
    };

    // URL map has priority over template to avoid bad template forcing wrong tickers.
    if (config.useUrlMap && mappedUrl) {
      console.log(`Navigating from saved URL map for ${symbol}: ${mappedUrl}`);
      await navigateAndSettle(mappedUrl, "via URL map");
    } else if (config.urlTemplate) {
      const url = config.urlTemplate.replaceAll("{symbol}", encodeURIComponent(symbol));
      await navigateAndSettle(url, "via URL template");
    } else {
      if (!interactive) {
        manifest.push({
          date: config.date,
          symbol_input: symbol,
          skipped: "missing_symbol_url_mapping_non_interactive",
        });
        console.error(`[${symbol}] skipped: no URL map/template in non-interactive mode.`);
        continue;
      }
      await waitForContinue(`Navigate manually to symbol ${symbol} in the browser, then press Enter.`);
      await page.waitForTimeout(800);
    }

    let activeUrl = page.url();
    if (!tickerLooksExpected(symbol, activeUrl)) {
      const observedTicker = tickerFromUrl(activeUrl) || "unknown";
      console.log(`[${symbol}] ticker mismatch after initial navigation (observed=${observedTicker}).`);
      if (config.useUrlMap && mappedUrl && activeUrl !== mappedUrl) {
        await navigateAndSettle(mappedUrl, "via URL map retry");
        activeUrl = page.url();
      }
    }

    const landingText = await page.evaluate(() => document.body?.innerText ?? "");
    const authPageReason = detectAuthOrLandingPage(landingText);
    if (authPageReason) {
      const safeSymbol = sanitizeFilePart(symbol);
      const shotPath = path.join(captureDir, `${safeSymbol}.png`);
      const htmlPath = path.join(captureDir, `${safeSymbol}.html`);
      const textPath = path.join(captureDir, `${safeSymbol}.txt`);
      await page.screenshot({ path: shotPath, fullPage: true });
      writeFileSync(htmlPath, await page.content(), "utf8");
      writeFileSync(textPath, landingText, "utf8");
      console.error(
        `[${symbol}] capture aborted: detected ${authPageReason}. ` +
          `Login to MenthorQ in the persistent browser profile and rerun.`,
      );
      hadAuthFailure = true;
      if (config.continueOnAuthFailure) {
        manifest.push({
          date: config.date,
          symbol_input: symbol,
          source_url: page.url(),
          auth_failure: authPageReason,
          screenshot_path: shotPath,
          html_path: htmlPath,
          text_path: textPath,
        });
        console.error(`[${symbol}] continuing to next symbol because continue-on-auth-failure=true`);
        continue;
      }
      break;
    }

    try {
      await page.waitForFunction(
        () => {
          const text = (document.body?.innerText ?? "").toLowerCase();
          const hasGammaLabel = text.includes("gamma condition");
          const hasGammaValue =
            text.includes("positive") || text.includes("negative") || text.includes("neutral");
          return hasGammaLabel && hasGammaValue;
        },
        { timeout: config.gammaReadyTimeoutMs },
      );
    } catch {
      // Continue with retries below even if gamma readiness wait times out.
    }

    let renderedText = await page.evaluate(() => document.body?.innerText ?? "");
    let parsed = parseMetricsFromText(renderedText);
    for (let attempt = 0; attempt < config.parseRetries && parsed.gammaCondition === ""; attempt += 1) {
      await page.waitForTimeout(config.parseRetryDelayMs);
      renderedText = await page.evaluate(() => document.body?.innerText ?? "");
      parsed = parseMetricsFromText(renderedText);
      if (parsed.gammaCondition !== "") {
        break;
      }
    }
    const capturedAtUtc = new Date().toISOString();
    const safeSymbol = sanitizeFilePart(symbol);
    const shotPath = path.join(captureDir, `${safeSymbol}.png`);
    const htmlPath = path.join(captureDir, `${safeSymbol}.html`);
    const textPath = path.join(captureDir, `${safeSymbol}.txt`);

    await page.screenshot({ path: shotPath, fullPage: true });
    writeFileSync(htmlPath, await page.content(), "utf8");
    writeFileSync(textPath, renderedText, "utf8");

    const noteParts: string[] = [];
    if (parsed.confidence === "LOW") {
      noteParts.push("Parser confidence low. Verify manually from screenshot/text.");
    }
    if (!tickerLooksExpected(symbol, page.url())) {
      noteParts.push(`Ticker mismatch in URL: observed=${tickerFromUrl(page.url()) || "unknown"}`);
    }

    if (parsed.gammaCondition === "" && !config.allowUnknown) {
      manifest.push({
        date: config.date,
        symbol_input: symbol,
        source_url: page.url(),
        parse_confidence: parsed.confidence,
        parse_failed: "gamma_condition_missing",
        screenshot_path: shotPath,
        html_path: htmlPath,
        text_path: textPath,
      });
      console.error(`[${symbol}] skipped write: gamma condition unavailable after retries.`);
      continue;
    }

    const row: CaptureRow = {
      date: config.date,
      symbol_input: symbol,
      page_symbol: parsed.pageSymbol || symbol,
      gamma_condition: parsed.gammaCondition || "UNKNOWN",
      net_gex: parsed.netGex || "",
      total_gex: parsed.totalGex || "",
      timestamp_text: parsed.timestampText || "",
      source_url: page.url(),
      captured_at_utc: capturedAtUtc,
      parse_confidence: parsed.confidence,
      notes: noteParts.join(" | "),
    };

    appendCsvRow(config.outCsv, row);
    if (
      config.useUrlMap &&
      row.source_url &&
      row.source_url.startsWith("http") &&
      tickerLooksExpected(symbol, row.source_url)
    ) {
      symbolUrlMap[symbol] = row.source_url;
      writeUrlMap(config.urlMapFile, symbolUrlMap);
    }
    manifest.push({
      ...row,
      screenshot_path: shotPath,
      html_path: htmlPath,
      text_path: textPath,
    });
    console.log(
      `[${symbol}] gamma=${row.gamma_condition} net_gex=${row.net_gex || "-"} total_gex=${row.total_gex || "-"} confidence=${row.parse_confidence}`,
    );
  }

  const manifestPath = path.join(captureDir, "_manifest.json");
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        generated_utc: new Date().toISOString(),
        date: config.date,
        symbols: config.symbols,
        csv_path: path.resolve(process.cwd(), config.outCsv),
        rows: manifest,
      },
      null,
      2,
    ),
    "utf8",
  );

  if (hadAuthFailure) {
    console.error(
      config.continueOnAuthFailure
        ? "Capture completed with one or more auth/landing-page failures. Successful symbols were still written."
        : "Capture aborted due to authentication/landing-page detection. No new CSV rows were written for failed symbols.",
    );
  } else {
    console.log(`Capture complete. CSV: ${path.resolve(process.cwd(), config.outCsv)}`);
    console.log(`Artifacts: ${captureDir}`);
    if (config.useUrlMap) {
      console.log(`Symbol URL map: ${path.resolve(process.cwd(), config.urlMapFile)}`);
    }
  }

  await context.close();
  await rl?.close();

  if (hadAuthFailure) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error("capture-menthorq-gamma-browser failed:", error);
  process.exit(1);
});
