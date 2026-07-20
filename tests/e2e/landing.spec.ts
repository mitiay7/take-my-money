import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("landing explains the product and passes an accessibility scan", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Switch plans without paying twice." }),
  ).toBeVisible();
  await expect(page.getByText("€213.68")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
