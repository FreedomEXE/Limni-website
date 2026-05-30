import { expect, test, type Page } from "@playwright/test";

const ROUTE = "/performance?strategy=agree_3of4&f1=weekly_hold&f2=none&view=basket";
const MAY_11_WEEK = "2026-05-10T23:00:00.000Z";
const CURRENT_EMPTY_WEEK = "2026-05-24T23:00:00.000Z";
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

async function openBasketAllTime(
  page: Page,
  viewMode = { anchor: "execution", normalization: "adr_normalized" },
) {
  await page.addInitScript((mode) => {
    window.localStorage.setItem("limni-performance-basket-mode", JSON.stringify("all_time"));
    window.localStorage.setItem("limni-viewmode", JSON.stringify({ performance: mode }));
  }, viewMode);
  await page.goto(ROUTE, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await expect(page.getByTestId("basket-all-time-browser")).toBeVisible({ timeout: 120_000 });
}

async function expandMay11(page: Page) {
  const week = page.locator(`[data-testid="basket-week-row"][data-week-open-utc="${MAY_11_WEEK}"]`);
  await expect(week).toBeVisible({ timeout: 120_000 });
  await week.click();
  await expect(page.getByTestId("basket-week-detail")).toBeVisible({ timeout: 120_000 });
}

async function pairSymbols(page: Page) {
  return page.getByTestId("basket-pair-row").evaluateAll((rows) =>
    rows.map((row) => row.getAttribute("data-symbol") ?? ""),
  );
}

function audcadPairRow(page: Page) {
  return page.locator('[data-testid="basket-pair-row"][data-symbol="AUDCAD"]').first();
}

test.describe("Basket all-time browser", () => {
  test("loads 8 most-recent non-empty weeks newest first", async ({ page }) => {
    await openBasketAllTime(page);

    await expect(page.getByTestId("basket-week-row")).toHaveCount(8, { timeout: 120_000 });
    const weeks = await page.getByTestId("basket-week-row").evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("data-week-open-utc") ?? ""),
    );

    expect(weeks).toEqual([...weeks].sort((left, right) => right.localeCompare(left)));
  });

  test("scrolling near the bottom lazy-loads 4 more weeks", async ({ page }) => {
    await openBasketAllTime(page);
    await expect(page.getByTestId("basket-week-row")).toHaveCount(8, { timeout: 120_000 });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByTestId("basket-week-row")).toHaveCount(12, { timeout: 120_000 });
  });

  test("expands a week with pairs sorted alphabetically", async ({ page }) => {
    await openBasketAllTime(page);
    await expandMay11(page);

    await expect(audcadPairRow(page)).toBeVisible({ timeout: 120_000 });
    const symbols = await pairSymbols(page);
    expect(symbols[0]).toBe("AUDCAD");
    expect(symbols).toEqual([...symbols].sort((left, right) => left.localeCompare(right)));
  });

  test("opens the Phase 1 trade drilldown modal from a pair row", async ({ page }) => {
    await openBasketAllTime(page);
    await expandMay11(page);

    await audcadPairRow(page).click();
    await expect(page.getByRole("dialog")).toContainText("AUDCAD", { timeout: 120_000 });
    await expect(page.getByTestId("trade-id-badge").first()).toHaveAttribute("title", UUID_PATTERN);
    await expect(page.getByTestId("trade-adr-norm-pct").first()).toContainText("-0.9411");
  });

  test("hides empty current weeks from the all-time tree", async ({ page }) => {
    await openBasketAllTime(page);

    await expect(page.locator(`[data-testid="basket-week-row"][data-week-open-utc="${CURRENT_EMPTY_WEEK}"]`)).toHaveCount(0);
  });

  test("normalization toggle updates the hierarchy values", async ({ page }) => {
    await openBasketAllTime(page);
    await expandMay11(page);

    await expect(audcadPairRow(page)).toContainText("-0.94", { timeout: 120_000 });
    await page.getByRole("button", { name: /Raw/i }).first().click();
    await expect(audcadPairRow(page)).toContainText("-0.71", { timeout: 120_000 });
  });

  test("programmatic anchor change updates the hierarchy values", async ({ page, context }) => {
    await openBasketAllTime(page);
    await expandMay11(page);
    await expect(audcadPairRow(page)).toContainText("-0.94", { timeout: 120_000 });

    const canonicalPage = await context.newPage();
    await openBasketAllTime(canonicalPage, { anchor: "canonical", normalization: "adr_normalized" });
    await expandMay11(canonicalPage);
    await expect(audcadPairRow(canonicalPage)).toContainText("-0.78", { timeout: 120_000 });
    await canonicalPage.close();
  });
});
