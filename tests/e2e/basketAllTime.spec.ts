import { expect, test, type Page } from "@playwright/test";

const MAY_11_WEEK = "2026-05-10T23:00:00.000Z";
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

async function gotoBasket(
  page: Page,
  params: Record<string, string>,
  viewMode = { anchor: "execution", normalization: "adr_normalized" },
) {
  await page.addInitScript((mode) => {
    window.localStorage.removeItem("limni-performance-basket-mode");
    window.localStorage.setItem(
      "limni-viewmode",
      JSON.stringify({ performance: mode }),
    );
  }, viewMode);
  const search = new URLSearchParams({ view: "basket", ...params });
  await page.goto(`/performance?${search.toString()}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await expect(page.getByTestId("basket-hierarchy")).toBeVisible({ timeout: 120_000 });
}

function node(page: Page, testId: string, nodeId: string) {
  return page.locator(`[data-testid="${testId}"][data-node-id="${nodeId}"]`).first();
}

async function expandNode(page: Page, testId: string, nodeId: string) {
  const row = node(page, testId, nodeId);
  await expect(row).toBeVisible({ timeout: 120_000 });
  await row.getByRole("button", { name: /Expand/i }).click();
}

async function weekIds(page: Page) {
  return page.getByTestId("basket-week-row").evaluateAll((rows) =>
    rows.map((row) => (row.getAttribute("data-node-id") ?? "").replace(/^week\|/, "")),
  );
}

async function symbolIds(page: Page) {
  return page.getByTestId("basket-symbol-row").evaluateAll((rows) =>
    rows.map((row) => (row.getAttribute("data-node-id") ?? "").split("|symbol|").pop() ?? ""),
  );
}

test.describe("Basket hierarchy", () => {
  test("Agreement weekly hold uses Week -> Symbol -> Trade with newest weeks first", async ({ page }) => {
    await gotoBasket(page, { strategy: "agree_3of4", f1: "weekly_hold", f2: "none" });
    await expect(page.getByTestId("basket-week-row").first()).toBeVisible({ timeout: 120_000 });

    const weeks = await weekIds(page);
    expect(weeks.length).toBeGreaterThan(8);
    expect(weeks).toEqual([...weeks].sort((left, right) => right.localeCompare(left)));

    await expandNode(page, "basket-week-row", `week|${MAY_11_WEEK}`);
    await expect(page.getByTestId("basket-portfolio-row")).toHaveCount(0);
    await expect(page.getByTestId("basket-tier-row")).toHaveCount(0);
    await expect(page.getByTestId("basket-symbol-row").first()).toBeVisible({ timeout: 120_000 });
    const symbols = await symbolIds(page);
    expect(symbols[0]).toBe("AUDCAD");
    expect(symbols).toEqual([...symbols].sort((left, right) => left.localeCompare(right)));
  });

  test("Tandem ADR Grid exposes Portfolio -> Symbol -> Grid -> Fills and parent modal", async ({ page }) => {
    await gotoBasket(page, { strategy: "tandem", f1: "adr_grid", f2: "pair_fill_cap" });
    await expandNode(page, "basket-week-row", `week|${MAY_11_WEEK}`);

    await expect(page.getByTestId("basket-portfolio-row")).toHaveCount(4, { timeout: 120_000 });
    const portfolioLabels = await page.getByTestId("basket-portfolio-row").evaluateAll((rows) =>
      rows.map((row) => row.textContent ?? ""),
    );
    expect(portfolioLabels.join(" ")).toMatch(/Commercial/);
    expect(portfolioLabels.join(" ")).toMatch(/Dealer/);
    expect(portfolioLabels.join(" ")).toMatch(/Sentiment/);
    expect(portfolioLabels.join(" ")).toMatch(/Strength/);

    for (const portfolio of await page.getByTestId("basket-portfolio-row").all()) {
      await portfolio.getByRole("button", { name: /Expand/i }).click();
    }
    const audcad = page.locator('[data-testid="basket-symbol-row"][data-node-id$="|symbol|AUDCAD"]').first();
    await expect(audcad).toBeVisible({ timeout: 120_000 });
    await expect(audcad).toContainText("FX");
    await audcad.getByRole("button", { name: /Expand AUDCAD/i }).click();

    const grid = page.getByTestId("basket-grid-row").first();
    await expect(grid).toBeVisible({ timeout: 120_000 });
    await grid.click();
    const modal = page.getByRole("dialog");
    await expect(modal).toContainText("AUDCAD", { timeout: 120_000 });
    await expect(modal.getByTestId("trade-id-badge").first()).toHaveAttribute("title", UUID_PATTERN);
    await expect(modal.getByTestId("fills-table")).toBeVisible({ timeout: 120_000 });
    await page.keyboard.press("Escape");

    await grid.getByRole("button", { name: /Expand Grid/i }).click();
    const fills = page.getByTestId("basket-fill-row");
    await expect(fills.first()).toBeVisible({ timeout: 120_000 });
    const fillSeqs = await fills.evaluateAll((rows) =>
      rows.map((row) => Number((row.textContent ?? "").match(/#?(\d+)/)?.[1] ?? "0")),
    );
    expect(fillSeqs).toEqual([...fillSeqs].sort((left, right) => left - right));
  });

  test("Tiered strategies render Tier level, and specific week skips Week level", async ({ page }) => {
    await gotoBasket(page, {
      strategy: "tiered_4w",
      f1: "weekly_hold",
      f2: "none",
      week: MAY_11_WEEK,
    });

    await expect(page.getByTestId("basket-week-row")).toHaveCount(0);
    await expect(page.getByTestId("basket-tier-row").first()).toBeVisible({ timeout: 120_000 });
    await expect(page.getByTestId("basket-tier-row").first()).toContainText(/Tier \d+/);
  });

  test("scope filter is honored and symbol rows keep asset badges", async ({ page }) => {
    await gotoBasket(page, {
      strategy: "agree_3of4",
      f1: "weekly_hold",
      f2: "none",
      week: MAY_11_WEEK,
      scope: "crypto",
    });

    await expect(page.getByTestId("basket-symbol-row")).toHaveCount(2, { timeout: 120_000 });
    const text = await page.getByTestId("basket-symbol-row").allTextContents();
    expect(text.every((row) => row.includes("Crypto"))).toBe(true);
  });

  test("normalization flips reuse the bundle and both anchors are present in the payload", async ({ page }) => {
    let bundleRequests = 0;
    await page.route("**/api/basket/closed-history?**", async (route) => {
      bundleRequests += 1;
      await route.continue();
    });
    await gotoBasket(page, {
      strategy: "agree_3of4",
      f1: "weekly_hold",
      f2: "none",
      week: MAY_11_WEEK,
    });

    const audcad = page.locator('[data-testid="basket-symbol-row"][data-node-id$="|symbol|AUDCAD"]').first();
    await expect(audcad).toContainText("-0.94", { timeout: 120_000 });
    await page.getByRole("button", { name: /Raw/i }).first().click();
    await expect(audcad).toContainText("-0.71", { timeout: 120_000 });
    expect(bundleRequests).toBe(1);

    const response = await page.request.get(
      `/api/basket/closed-history?strategyVariant=agree_3of4-weekly_hold-none&scope=all`,
    );
    expect(response.ok()).toBe(true);
    const json = await response.json();
    const audcadPayloadRow = json.bundle.rows.find((row: {
      rowKind: string;
      symbol: string;
      weekOpenUtc: string;
      returnMatrix: {
        canonical: { rawPct: number } | null;
        execution: { rawPct: number } | null;
      };
    }) => row.rowKind === "trade" && row.symbol === "AUDCAD" && row.weekOpenUtc === MAY_11_WEEK);
    expect(audcadPayloadRow.returnMatrix.canonical.rawPct).toBeCloseTo(-0.5836, 4);
    expect(audcadPayloadRow.returnMatrix.execution.rawPct).toBeCloseTo(-0.7082, 4);
  });
});
