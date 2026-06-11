import { expect, test, type Page } from "@playwright/test";

const MAY_11_WEEK = "2026-05-10T23:00:00.000Z";

async function gotoBasket(page: Page, params: Record<string, string>) {
  const search = new URLSearchParams({ view: "basket", ...params });
  await page.goto(`/performance?${search.toString()}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await expect(page.getByTestId("basket-hierarchy")).toBeVisible({ timeout: 120_000 });
}

async function expectActiveCanonBasket(page: Page) {
  await expect(page.getByTestId("basket-containment-notice")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Loading basket history");
  await expect(page.locator("body")).not.toContainText("Canon ready");
}

test.describe("Basket canon hierarchy", () => {
  test("all-time Basket renders the canon-backed hierarchy", async ({ page }) => {
    await gotoBasket(page, { strategy: "tandem", f1: "adr_grid", f2: "pair_fill_cap" });
    await expectActiveCanonBasket(page);
    await expect(page.getByTestId("basket-hierarchy")).toContainText("All closed weeks");
    await expect(page.getByTestId("basket-hierarchy")).toContainText("18 weeks");
    await expect(page.getByTestId("basket-hierarchy")).toContainText("fills");
  });

  test("specific-week Basket renders visible row counts", async ({ page }) => {
    await gotoBasket(page, {
      strategy: "tandem",
      f1: "adr_grid",
      f2: "pair_fill_cap",
      week: "2026-05-17T23:00:00.000Z",
    });
    await expectActiveCanonBasket(page);
    await expect(page.getByTestId("basket-hierarchy")).toContainText("4 portfolios");
    await expect(page.getByTestId("basket-hierarchy")).toContainText("144 grids");
    await expect(page.getByTestId("basket-hierarchy")).toContainText("1243 fills");
  });

  test("closed-history data layer remains available with both anchors", async ({ page }) => {
    const response = await page.request.get(
      "/api/basket/closed-history?strategyVariant=agree_3of4-weekly_hold-none&scope=all",
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
