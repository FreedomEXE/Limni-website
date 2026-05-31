import { expect, test, type Page } from "@playwright/test";

const MAY_11_WEEK = "2026-05-10T23:00:00.000Z";

async function gotoBasket(page: Page, params: Record<string, string>) {
  const search = new URLSearchParams({ view: "basket", ...params });
  await page.goto(`/performance?${search.toString()}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await expect(page.getByTestId("basket-containment-notice")).toBeVisible({ timeout: 120_000 });
}

async function expectContained(page: Page) {
  await expect(page.getByTestId("basket-containment-notice")).toContainText(
    "Basket view is being rebuilt for v2.0.0",
  );
  await expect(page.getByTestId("basket-hierarchy")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Loading basket history");
}

test.describe("Basket hierarchy containment", () => {
  test("all-time Basket shows containment notice instead of v3 hierarchy", async ({ page }) => {
    await gotoBasket(page, { strategy: "tandem", f1: "adr_grid", f2: "pair_fill_cap" });
    await expectContained(page);
  });

  test("specific-week Basket shows containment notice instead of v3 hierarchy", async ({ page }) => {
    await gotoBasket(page, {
      strategy: "agree_3of4",
      f1: "weekly_hold",
      f2: "none",
      week: MAY_11_WEEK,
    });
    await expectContained(page);
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
