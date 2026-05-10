import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const STRATEGIES = ["tandem", "tiered_4w", "agree_3of4", "agree_3plus", "selector"];
const ENTRY_STYLES = ["weekly_hold", "adr_pullback", "adr_grid"];
const OVERLAYS = ["none", "exposure_cap"];

type SurfaceMetrics = {
  return: string | null;
  maxDD: string | null;
  winRate: string | null;
  trades: string | null;
};

type AuditResult = {
  strategy: string;
  f1: string;
  f2: string;
  sidebar: SurfaceMetrics;
  flagship: SurfaceMetrics;
  comparison: SurfaceMetrics;
  simCard: { return: string | null; maxDD: string | null; trades: string | null };
  equityCurveReturn: string | null;
  consistent: boolean;
  issues: string[];
};

const BASE_URL = process.env.AUDIT_BASE_URL ?? "http://localhost:3000";

function parsePercent(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[%,+]/g, "").trim();
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

function parseNumber(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[,%+]/g, "").trim();
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

function isClose(a: number | null, b: number | null, tolerance = 0.1): boolean {
  if (a === null || b === null) return true;
  return Math.abs(a - b) <= tolerance;
}

function checkPair(
  issues: string[],
  label: string,
  nameA: string,
  valA: string | null,
  nameB: string,
  valB: string | null,
  tolerance = 0.1,
) {
  const a = parsePercent(valA);
  const b = parsePercent(valB);
  if (!isClose(a, b, tolerance)) {
    issues.push(`${label} mismatch: ${nameA}=${valA} vs ${nameB}=${valB}`);
  }
}

function requireMetric(issues: string[], label: string, value: string | null) {
  if (value === null || value.trim().length === 0) {
    issues.push(`Missing ${label}`);
  }
}

function checkNumberPair(
  issues: string[],
  label: string,
  nameA: string,
  valA: string | null,
  nameB: string,
  valB: string | null,
  tolerance = 0,
) {
  const a = parseNumber(valA);
  const b = parseNumber(valB);
  if (a === null || b === null) return;
  if (Math.abs(a - b) > tolerance) {
    issues.push(`${label} mismatch: ${nameA}=${valA} vs ${nameB}=${valB}`);
  }
}

async function safeText(page: Page, testId: string): Promise<string | null> {
  const locator = page.locator(`[data-testid="${testId}"]`).first();
  try {
    await locator.waitFor({ state: "attached", timeout: 5000 });
    return await locator.textContent();
  } catch {
    return null;
  }
}

async function gotoPerformanceView(page: Page, params: URLSearchParams, requiredTestId: string) {
  const url = `${BASE_URL}/performance?${params.toString()}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator(`[data-testid="${requiredTestId}"]`).first().waitFor({
    state: "attached",
    timeout: 120_000,
  });
}

test.describe("Performance Numbers Audit", () => {
  const results: AuditResult[] = [];

  for (const strategy of STRATEGIES) {
    for (const f1 of ENTRY_STYLES) {
      for (const f2 of OVERLAYS) {
        test(`${strategy} / ${f1} / ${f2}`, async ({ page }) => {
          const summaryParams = new URLSearchParams({
            strategy,
            f1,
            f2,
            view: "summary",
          });
          await gotoPerformanceView(page, summaryParams, "sidebar-return");

          const sidebar: SurfaceMetrics = {
            return: await safeText(page, "sidebar-return"),
            maxDD: await safeText(page, "sidebar-maxdd"),
            winRate: await safeText(page, "sidebar-winrate"),
            trades: await safeText(page, "sidebar-trades"),
          };

          const flagship: SurfaceMetrics = {
            return: await safeText(page, "flagship-return"),
            maxDD: await safeText(page, "flagship-maxdd"),
            winRate: await safeText(page, "flagship-winrate"),
            trades: await safeText(page, "flagship-trades"),
          };

          const comparison: SurfaceMetrics = {
            return: await safeText(page, "comparison-return"),
            maxDD: await safeText(page, "comparison-maxdd"),
            winRate: await safeText(page, "comparison-winrate"),
            trades: await safeText(page, "comparison-trades"),
          };

          const simulationParams = new URLSearchParams({
            strategy,
            f1,
            f2,
            view: "simulation",
          });
          await gotoPerformanceView(page, simulationParams, "sim-return");
          await page.locator('[data-testid="equity-curve-return"]').first().waitFor({
            state: "attached",
            timeout: 60_000,
          });

          const simCard = {
            return: await safeText(page, "sim-return"),
            maxDD: await safeText(page, "sim-maxdd"),
            trades: await safeText(page, "sim-trades"),
          };

          const equityCurveReturn = await safeText(page, "equity-curve-return");
          const issues: string[] = [];

          requireMetric(issues, "sidebar return", sidebar.return);
          requireMetric(issues, "sidebar max DD", sidebar.maxDD);
          requireMetric(issues, "sidebar win rate", sidebar.winRate);
          requireMetric(issues, "sidebar trades", sidebar.trades);
          requireMetric(issues, "simulation return", simCard.return);
          requireMetric(issues, "simulation max DD", simCard.maxDD);
          requireMetric(issues, "simulation trades", simCard.trades);
          requireMetric(issues, "equity curve return", equityCurveReturn);

          checkPair(issues, "DD", "sidebar", sidebar.maxDD, "flagship", flagship.maxDD);
          checkPair(issues, "DD", "sidebar", sidebar.maxDD, "comparison", comparison.maxDD);
          checkPair(issues, "DD", "sidebar", sidebar.maxDD, "sim-card", simCard.maxDD);
          checkPair(issues, "DD", "flagship", flagship.maxDD, "sim-card", simCard.maxDD);

          checkPair(issues, "Return", "sidebar", sidebar.return, "flagship", flagship.return, 0.5);
          checkPair(issues, "Return", "sidebar", sidebar.return, "comparison", comparison.return, 0.5);
          checkPair(issues, "Return", "sidebar", sidebar.return, "sim-card", simCard.return, 0.5);
          checkPair(issues, "Return", "sidebar", sidebar.return, "equity-curve", equityCurveReturn, 0.5);
          checkPair(issues, "Return", "sim-card", simCard.return, "equity-curve", equityCurveReturn, 0.1);

          checkPair(issues, "Win rate", "sidebar", sidebar.winRate, "flagship", flagship.winRate, 0.5);

          checkNumberPair(issues, "Trades", "sidebar", sidebar.trades, "flagship", flagship.trades);
          checkNumberPair(issues, "Trades", "sidebar", sidebar.trades, "sim-card", simCard.trades);

          const ddValues = [sidebar.maxDD, flagship.maxDD, comparison.maxDD, simCard.maxDD];
          for (const [idx, raw] of ddValues.entries()) {
            const parsed = parsePercent(raw);
            if (parsed !== null && parsed < 0) {
              const names = ["sidebar", "flagship", "comparison", "sim-card"];
              issues.push(`Negative DD on ${names[idx]}: ${raw}`);
            }
          }

          const result: AuditResult = {
            strategy,
            f1,
            f2,
            sidebar,
            flagship,
            comparison,
            simCard,
            equityCurveReturn,
            consistent: issues.length === 0,
            issues,
          };
          results.push(result);

          if (issues.length > 0) {
            console.warn(`[AUDIT] ${strategy}/${f1}/${f2}: ${issues.join("; ")}`);
          }

          expect(issues, `${strategy}/${f1}/${f2} metric surfaces should agree`).toEqual([]);
        });
      }
    }
  }

  test.afterAll(async () => {
    console.log("\n=== PERFORMANCE NUMBERS AUDIT SUMMARY ===\n");
    console.log(
      "Strategy     | Entry         | Overlay       | DD(side) | DD(flag) | DD(comp) | DD(sim)  | Ret(side) | Ret(curve) | Status",
    );
    console.log("-".repeat(140));
    for (const r of results) {
      const pad = (s: string | null, w: number) => (s ?? "-").padEnd(w);
      const status = r.consistent ? "PASS" : `FAIL: ${r.issues.join("; ")}`;
      console.log(
        `${r.strategy.padEnd(12)} | ${r.f1.padEnd(13)} | ${r.f2.padEnd(13)} | ${pad(r.sidebar.maxDD, 8)} | ${pad(r.flagship.maxDD, 8)} | ${pad(r.comparison.maxDD, 8)} | ${pad(r.simCard.maxDD, 8)} | ${pad(r.sidebar.return, 9)} | ${pad(r.equityCurveReturn, 10)} | ${status}`,
      );
    }
    const passCount = results.filter((r) => r.consistent).length;
    const failCount = results.filter((r) => !r.consistent).length;
    console.log(`\nTotal: ${results.length} | Pass: ${passCount} | Fail: ${failCount}`);
  });
});
