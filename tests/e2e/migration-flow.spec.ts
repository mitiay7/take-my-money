import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("completes an eligible migration and exposes its sanitized audit", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Rebase a subscription." })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Active subscription/ })).toBeChecked();

  await page.getByRole("button", { name: /Read receipt with GPT-5.6/ }).click();
  await expect(page.getByRole("heading", { name: "Evidence extracted" })).toBeVisible();
  await expect(page.getByText("TMM-ACTIVE-001", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /Verify with source provider/ }).click();
  await expect(page.getByRole("heading", { name: "Choose the new direct plan" })).toBeVisible();
  await page.getByRole("button", { name: /Create migration quote/ }).click();

  await expect(
    page.getByRole("heading", { name: "Keep the value of every unused day." }),
  ).toBeVisible();
  await expect(page.getByText("−€15.32", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("€213.68", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Explained from verified calculation data")).toBeVisible();

  await page.getByRole("button", { name: /Continue to consent/ }).click();
  const checkboxes = page.getByRole("checkbox");
  await expect(checkboxes).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) await checkboxes.nth(index).check();
  await page.getByRole("button", { name: /Rebase and start the new plan/ }).click();

  await expect(page).toHaveURL(/\/operation\/op_/);
  await expect(page.getByRole("heading", { name: "You are upgraded." })).toBeVisible();
  await expect(page.getByText("€15.32", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: /View system audit/ }).click();
  await expect(page.getByRole("heading", { name: "Every decision has a trace." })).toBeVisible();
  await expect(page.getByText("CREDIT_COMMITTED", { exact: true })).toBeVisible();
  await expect(page.getByText("19/31", { exact: true })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("blocks an already consumed source without producing a quote", async ({ page }) => {
  await page.goto("/demo");
  const scenario = page.getByRole("radio", { name: /Already migrated/ });
  await expect(scenario).toBeVisible();
  await scenario.click();
  await page.getByRole("button", { name: /Read receipt with GPT-5.6/ }).click();
  await page.getByRole("button", { name: /Verify with source provider/ }).click();

  await expect(
    page.getByRole("heading", { name: "This source cannot create a credit." }),
  ).toBeVisible();
  await expect(page.getByText("SOURCE_ALREADY_CONSUMED", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Create migration quote/ })).toHaveCount(0);
});
