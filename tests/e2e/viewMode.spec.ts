import { expect, test, type Page } from "@playwright/test";

const WEEK_BUTTON = /MAY 11 2026/i;
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

async function waitForViewModeControls(page: Page) {
  await page.getByRole("button", { name: /ADR/i }).first().waitFor({ state: "visible", timeout: 120_000 });
  await page.getByRole("button", { name: /Raw/i }).first().waitFor({ state: "visible", timeout: 120_000 });
}

async function selectMay11(page: Page) {
  const button = page.getByRole("button", { name: WEEK_BUTTON }).first();
  await button.waitFor({ state: "visible", timeout: 120_000 });
  await button.click();
  await page.waitForTimeout(1_000);
}

async function waitForAudcad(page: Page) {
  await expect(page.locator("body")).toContainText("AUDCAD", { timeout: 120_000 });
}

async function bodyText(page: Page) {
  return page.locator("body").innerText();
}

function snippetNearSymbol(text: string, symbol: string) {
  const index = text.indexOf(symbol);
  expect(index, `${symbol} should appear on page`).toBeGreaterThanOrEqual(0);
  return text.slice(Math.max(0, index - 250), index + 500);
}

async function expectNearText(page: Page, symbol: string, expected: string) {
  await expect.poll(async () => snippetNearSymbol(await bodyText(page), symbol), {
    timeout: 120_000,
  }).toContain(expected);
}

function summaryCard(page: Page, label: string) {
  return page.locator(`[data-testid="performance-summary-card"][data-performance-label="${label}"]`).first();
}

async function summaryCardReturn(page: Page, label: string) {
  return (await summaryCard(page, label).getByTestId("performance-card-return").innerText()).trim();
}

test.describe("ViewMode parity", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.removeItem("limni-viewmode"));
  });

  test("Performance AUDCAD May 11 uses execution anchor and flips normalization", async ({ page }) => {
    await page.goto("/performance?strategy=agree_3of4&f1=weekly_hold&f2=none&view=basket", {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await waitForViewModeControls(page);
    await expect(page.getByText("Returns measured from execution open", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: /Market truth/i })).toHaveCount(0);
    await selectMay11(page);
    await page.getByText(/^BASKET$/i).first().click();
    await waitForAudcad(page);

    await page.getByRole("button", { name: /ADR/i }).first().click();
    await expectNearText(page, "AUDCAD", "-0.94%");

    await page.getByRole("button", { name: /Raw/i }).first().click();
    await expectNearText(page, "AUDCAD", "-0.71%");
  });

  test("Performance raw mode resolves simulation, sidebar, rolling, and asset totals from one path", async ({ page }) => {
    await page.goto("/performance?strategy=tandem&f1=adr_grid&f2=pair_fill_cap&view=simulation&scope=fx", {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await waitForViewModeControls(page);

    await page.getByRole("button", { name: /Raw/i }).first().click();

    await expect(page.getByTestId("sim-return")).toHaveText("+384.06%", { timeout: 120_000 });
    await expect(page.getByTestId("sidebar-return")).toHaveText("+384.06%", { timeout: 120_000 });
    await expect(page.getByTestId("sim-maxdd")).toHaveText("6.40%", { timeout: 120_000 });
    await expect(page.getByTestId("sidebar-maxdd")).toHaveText("6.40%", { timeout: 120_000 });
    await expect(page.locator("body")).toContainText(/Asset Contribution/i);
    await expect(page.locator("body")).toContainText(/FX\s*\+384\.06%/);
    await expect(page.locator("body")).not.toContainText(/Max DD\s*0\.00%/i);
  });

  test("Performance all-time summary cards reflect raw vs ADR-normalized return", async ({ page }) => {
    await page.goto("/performance?strategy=agree_3of4&f1=weekly_hold&f2=none&view=summary&scope=crypto", {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await waitForViewModeControls(page);

    await expect(summaryCard(page, "Crypto")).toBeVisible({ timeout: 120_000 });
    const adrReturn = await summaryCardReturn(page, "Crypto");
    await expect(page.getByTestId("sidebar-return")).toHaveText(adrReturn, { timeout: 120_000 });

    await page.getByRole("button", { name: /Raw/i }).first().click();
    await expect.poll(async () => summaryCardReturn(page, "Crypto"), {
      timeout: 120_000,
    }).not.toBe(adrReturn);
    const rawReturn = await summaryCardReturn(page, "Crypto");
    await expect(page.getByTestId("sidebar-return")).toHaveText(rawReturn, { timeout: 120_000 });
  });

  test("Performance weekly Crypto scope hides inactive summary cards", async ({ page }) => {
    await page.goto("/performance?strategy=agree_3of4&f1=weekly_hold&f2=none&view=summary&scope=crypto&week=2026-05-10T23%3A00%3A00.000Z", {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await waitForViewModeControls(page);

    await expect(summaryCard(page, "Crypto")).toBeVisible({ timeout: 120_000 });
    await expect(page.getByTestId("performance-summary-card")).toHaveCount(1);
    await expect(summaryCard(page, "FX")).toHaveCount(0);
    await expect(summaryCard(page, "Commodities & Indices")).toHaveCount(0);
  });

  test("Data AUDCAD May 11 supports canonical/execution and raw/ADR-normalized", async ({ page }) => {
    await page.goto("/dashboard?asset=fx&report=2026-05-12&bias=dealer&view=heatmap", {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await waitForViewModeControls(page);
    await selectMay11(page);
    await waitForAudcad(page);

    await page.getByRole("button", { name: /Execution/i }).first().click();
    await page.getByRole("button", { name: /Raw/i }).first().click();
    await expectNearText(page, "AUDCAD", "-0.71%");

    await page.getByRole("button", { name: /Market truth/i }).first().click();
    await expectNearText(page, "AUDCAD", "-0.58%");

    await page.getByRole("button", { name: /ADR/i }).first().click();
    await expectNearText(page, "AUDCAD", "-0.78%");

    await page.getByRole("button", { name: /Execution/i }).first().click();
    await expectNearText(page, "AUDCAD", "-0.94%");
  });

  test("Matrix AUDCAD May 11 supports canonical/execution and raw/ADR-normalized", async ({ page }) => {
    await page.goto("/matrix?strategy=agree_3of4&f1=weekly_hold&f2=none&tab=cfd&week=2026-05-10T23%3A00%3A00.000Z", {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await waitForViewModeControls(page);
    await waitForAudcad(page);

    await page.getByRole("button", { name: /ADR/i }).first().click();
    await expectNearText(page, "AUDCAD", "-0.94%");

    await page.getByRole("button", { name: /Raw/i }).first().click();
    await expectNearText(page, "AUDCAD", "-0.71%");

    await page.getByRole("button", { name: /Market truth/i }).first().click();
    await expectNearText(page, "AUDCAD", "-0.58%");

    await page.getByRole("button", { name: /ADR/i }).first().click();
    await expectNearText(page, "AUDCAD", "-0.78%");
  });

  test("Data ViewMode persists across Performance navigation and hard reload", async ({ page }) => {
    await page.goto("/dashboard?asset=fx&report=2026-05-12&bias=dealer&view=heatmap", {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await waitForViewModeControls(page);
    await page.getByRole("button", { name: /Market truth/i }).first().click();
    await page.getByRole("button", { name: /ADR/i }).first().click();

    await page.goto("/performance?strategy=agree_3of4&f1=weekly_hold&f2=none&view=basket", {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await waitForViewModeControls(page);

    await page.goto("/dashboard?asset=fx&report=2026-05-12&bias=dealer&view=heatmap", {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await waitForViewModeControls(page);
    await expect(page.getByRole("button", { name: /Market truth/i }).first()).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /ADR/i }).first()).toHaveAttribute("aria-pressed", "true");

    await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
    await waitForViewModeControls(page);
    await expect(page.getByRole("button", { name: /Market truth/i }).first()).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /ADR/i }).first()).toHaveAttribute("aria-pressed", "true");
  });

  test("Data execution gaps render as missing return cells", async ({ page }) => {
    await page.goto("/dashboard?asset=commodities&bias=dealer&view=heatmap", {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await waitForViewModeControls(page);
    await page.getByRole("button", { name: /Execution/i }).first().click();
    await page.getByRole("button", { name: /Raw/i }).first().click();
    await page.getByRole("button", { name: /MAR 30 2026/i }).first().click();
    await page.locator("body").getByText("XAUUSD").first().waitFor({ state: "visible", timeout: 120_000 });

    await expect(page.getByLabel("Execution data unavailable: incomplete close bar").first()).toBeVisible();
    await expectNearText(page, "XAUUSD", "—");
  });

  test("Trade drilldown opens from Performance Basket with execution ledger identity", async ({ page }) => {
    await page.goto("/performance?strategy=agree_3of4&f1=weekly_hold&f2=none&view=basket", {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await waitForViewModeControls(page);
    await selectMay11(page);
    await waitForAudcad(page);

    await page.locator('[title="Open ledger drilldown"]').filter({ hasText: "AUDCAD" }).first().click();

    const modal = page.getByRole("dialog");
    const tradeRow = modal.getByTestId("trade-row").first();
    await expect(modal).toContainText("Trade Drilldown", { timeout: 120_000 });
    await expect(tradeRow.getByTestId("trade-id-badge")).toHaveAttribute("title", UUID_PATTERN, { timeout: 120_000 });
    await expect(tradeRow.getByTestId("trade-direction")).toContainText("LONG", { timeout: 120_000 });
    await expect(tradeRow.getByTestId("trade-raw-pct")).toContainText("-0.7082%", { timeout: 120_000 });
    await expect(tradeRow.getByTestId("trade-adr-norm-pct")).toContainText("-0.9411%", { timeout: 120_000 });
    await page.screenshot({ path: "reports/playwright/trade-drilldown-performance.png", fullPage: true });
  });

  test("Trade drilldown opens from Matrix with canonical anchor identity", async ({ page }) => {
    await page.goto("/matrix?strategy=agree_3of4&f1=weekly_hold&f2=none&tab=cfd&week=2026-05-10T23%3A00%3A00.000Z", {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await waitForViewModeControls(page);
    await page.getByRole("button", { name: /Market truth/i }).first().click();
    await waitForAudcad(page);

    await page.locator("tr").filter({ hasText: "AUDCAD" }).first().getByRole("button", { name: /Inspect trade/i }).click();

    const modal = page.getByRole("dialog");
    const tradeRow = modal.getByTestId("trade-row").first();
    await expect(modal).toContainText("Trade Drilldown", { timeout: 120_000 });
    await expect(tradeRow.getByTestId("trade-id-badge")).toHaveAttribute("title", UUID_PATTERN, { timeout: 120_000 });
    await expect(tradeRow.getByTestId("trade-direction")).toContainText("LONG", { timeout: 120_000 });
    await expect(tradeRow.getByTestId("trade-raw-pct")).toContainText("-0.5836%", { timeout: 120_000 });
    await expect(tradeRow.getByTestId("trade-adr-norm-pct")).toContainText("-0.7756%", { timeout: 120_000 });
    await page.screenshot({ path: "reports/playwright/trade-drilldown-matrix.png", fullPage: true });
  });

  test("Trade drilldown shows ADR Grid parent and fill rows", async ({ page }) => {
    await page.goto("/performance?strategy=agree_3of4&f1=adr_grid&f2=pair_fill_cap&view=basket", {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await waitForViewModeControls(page);
    await selectMay11(page);
    await waitForAudcad(page);

    await page.locator('[title="Open ledger drilldown"]').filter({ hasText: "AUDCAD" }).first().click();

    const modal = page.getByRole("dialog");
    const tradeRow = modal.getByTestId("trade-row").first();
    const firstFillRow = modal.getByTestId("fills-table").getByTestId("fill-row").first();
    await expect(tradeRow.getByTestId("trade-id-badge")).toHaveAttribute("title", UUID_PATTERN, { timeout: 120_000 });
    await expect(tradeRow.getByTestId("trade-raw-pct")).toContainText("0.2023%", { timeout: 120_000 });
    await expect(tradeRow.getByTestId("trade-adr-norm-pct")).toContainText("0.2688%", { timeout: 120_000 });
    await expect(modal).toContainText("Fills", { timeout: 120_000 });
    await expect(modal).toContainText("0 violations", { timeout: 120_000 });
    await expect(firstFillRow.getByTestId("fill-seq")).toContainText("1", { timeout: 120_000 });
    await expect(firstFillRow.getByTestId("fill-raw-pct")).toContainText("0.0301%", { timeout: 120_000 });
    await expect(firstFillRow.getByTestId("fill-adr-norm-pct")).toContainText("0.0400%", { timeout: 120_000 });
    await expect(firstFillRow.getByTestId("trade-id-badge")).toHaveAttribute("title", UUID_PATTERN, { timeout: 120_000 });
  });

  test("Trade drilldown shows all Tandem source groups for a pair", async ({ page }) => {
    await page.goto("/performance?strategy=tandem&f1=weekly_hold&f2=none&view=basket", {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await waitForViewModeControls(page);
    await selectMay11(page);
    await waitForAudcad(page);

    await page.locator('[title="Open ledger drilldown"]').filter({ hasText: "AUDCAD" }).first().click();

    await expect(page.getByRole("dialog")).toContainText("Source commercial", { timeout: 120_000 });
    await expect(page.getByRole("dialog")).toContainText("Source dealer", { timeout: 120_000 });
    await expect(page.getByRole("dialog")).toContainText("Source sentiment", { timeout: 120_000 });
    await expect(page.getByRole("dialog")).toContainText("Source strength", { timeout: 120_000 });
  });
});
