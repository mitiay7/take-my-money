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

test("protected operation pages recover safely without a session", async ({ page }) => {
  await page.goto("/operation/not-a-real-operation");
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByRole("heading", { name: "Rebase a subscription." })).toBeVisible();

  await page.goto("/operation/not-a-real-operation/system");
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByRole("heading", { name: "Rebase a subscription." })).toBeVisible();
});
