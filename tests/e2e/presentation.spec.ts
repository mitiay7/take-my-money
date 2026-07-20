import { expect, test } from "@playwright/test";

test("presentation route exposes accurate synthetic and portability scenes", async ({ page }) => {
  await page.goto("/presentation?recording=true&scene=01");
  await expect(page.getByTestId("presentation-hook")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Switch plans without paying twice." }),
  ).toBeVisible();

  await page.goto("/presentation?recording=true&scene=02");
  await expect(page.getByTestId("current-subscription")).toBeVisible();
  await expect(page.getByTestId("source-provider")).toHaveText("Apple sandbox adapter");
  await expect(page.getByText("100% synthetic", { exact: true })).toBeVisible();

  await page.goto("/presentation?recording=true&scene=03");
  await expect(page.getByTestId("target-plan")).toContainText("Direct Pro");
  await expect(page.getByText("Credit bridge, not cash movement")).toBeVisible();
});

test("build evidence preserves the AI boundary and ending card", async ({ page }) => {
  await page.goto("/presentation?recording=true&scene=08&phase=evidence");
  await expect(page.getByTestId("codex-build-log")).toBeVisible();
  await expect(page.getByTestId("gpt-usage")).toContainText("deterministic fallback");
  await expect(page.getByText(/AI never authorizes eligibility/)).toBeVisible();

  await page.goto("/presentation?recording=true&scene=08&phase=ending");
  await expect(page.getByTestId("ending-card")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Upgrade now. Keep every paid day." }),
  ).toBeVisible();
});
