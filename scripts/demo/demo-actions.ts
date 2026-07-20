import type { Page } from "@playwright/test";
import type { DemoTimelineScene } from "./demo-types";

type SceneContext = {
  page: Page;
  baseUrl: string;
  timelineStartedAt: number;
  scene: DemoTimelineScene;
};

export type RecordingState = {
  finalStateReached: boolean;
  endingCardShown: boolean;
  operationUrl: string | null;
};

export async function executeScene(
  execute: DemoTimelineScene["execute"],
  context: SceneContext,
  state: RecordingState,
): Promise<void> {
  const actions: Record<string, () => Promise<void>> = {
    showHook: () => showHook(context),
    showCurrentSubscription: () => showCurrentSubscription(context),
    showSolution: () => showSolution(context),
    showVerification: () => showVerification(context),
    showCalculation: () => showCalculation(context),
    showExecution: () => showExecution(context, state),
    showTechnicalView: () => showTechnicalView(context, state),
    showBuildEvidenceThenEnding: () => showBuildEvidenceThenEnding(context, state),
  };
  const action = actions[execute];
  if (!action) throw new Error(`Unknown demo action: ${execute}`);
  await action();
}

export async function waitUntilTimelineMs(
  timelineStartedAt: number,
  targetMs: number,
): Promise<void> {
  const remainingMs = timelineStartedAt + targetMs - Date.now();
  if (remainingMs > 0) await new Promise((resolve) => setTimeout(resolve, remainingMs));
}

async function showHook({ page }: SceneContext): Promise<void> {
  await visible(page, "presentation-hook");
}

async function showCurrentSubscription(context: SceneContext): Promise<void> {
  await context.page.goto(url(context, "/presentation?recording=true&scene=02"));
  await settleVisuals(context.page);
  await visible(context.page, "current-subscription");
  await visible(context.page, "synthetic-receipt");
}

async function showSolution(context: SceneContext): Promise<void> {
  await context.page.goto(url(context, "/presentation?recording=true&scene=03"));
  await settleVisuals(context.page);
  await visible(context.page, "target-plan");
}

async function showVerification(context: SceneContext): Promise<void> {
  const { page, scene, timelineStartedAt } = context;
  await page.goto(url(context, "/demo?recording=true"));
  await settleVisuals(page);
  await page.getByRole("heading", { name: "Rebase a subscription." }).waitFor();
  await page.getByRole("radio", { name: /Active subscription/ }).waitFor();
  await page.getByRole("button", { name: /Read receipt with GPT-5.6/ }).click();
  await visible(page, "gpt-extraction");
  await visible(page, "extraction-status");

  await waitUntilTimelineMs(timelineStartedAt, contentPoint(scene, 0.53));
  await page.getByRole("button", { name: /Verify with source provider/ }).click();
  await visible(page, "verified-subscription");
  await visible(page, "target-plan");
}

async function showCalculation(context: SceneContext): Promise<void> {
  const { page, scene, timelineStartedAt } = context;
  await page.getByRole("button", { name: /Create migration quote/ }).click();
  await visible(page, "paid-period-timeline");
  await visible(page, "migration-credit");
  await visible(page, "amount-due");
  await page.getByTestId("paid-period-timeline").scrollIntoViewIfNeeded();

  await waitUntilTimelineMs(timelineStartedAt, contentPoint(scene, 0.62));
  await visible(page, "gpt-explanation");
  await page.getByTestId("gpt-explanation").scrollIntoViewIfNeeded();
}

async function showExecution(context: SceneContext, state: RecordingState): Promise<void> {
  const { page, scene, timelineStartedAt } = context;
  await page.getByRole("button", { name: /Continue to consent/ }).click();
  await page.getByRole("heading", { name: "Confirm the simulated rebase" }).waitFor();
  const consents = page.getByRole("checkbox");
  for (let index = 0; index < 3; index += 1) await consents.nth(index).check();

  await waitUntilTimelineMs(timelineStartedAt, contentPoint(scene, 0.38));
  await page.getByTestId("confirm-rebase").click();
  await page.waitForURL(/\/operation\/op_/);
  await visible(page, "success-screen");
  await page.getByTestId("operation-status").waitFor();
  if ((await page.getByTestId("operation-status").textContent())?.trim() !== "COMPLETED") {
    throw new Error("The recorded migration did not reach COMPLETED");
  }
  state.finalStateReached = true;
  state.operationUrl = page.url();
}

async function showTechnicalView(context: SceneContext, state: RecordingState): Promise<void> {
  const { page, scene, timelineStartedAt } = context;
  if (!state.operationUrl) throw new Error("Technical scene requires a completed operation");
  await page.getByRole("link", { name: /View system audit/ }).click();
  await page.getByRole("heading", { name: "Every decision has a trace." }).waitFor();
  await visible(page, "state-machine");

  await waitUntilTimelineMs(timelineStartedAt, contentPoint(scene, 0.28));
  await page.getByTestId("audit-trail").scrollIntoViewIfNeeded();
  await page.getByText("CREDIT_COMMITTED", { exact: true }).waitFor();

  await waitUntilTimelineMs(timelineStartedAt, contentPoint(scene, 0.48));
  await page.getByTestId("credit-ledger").scrollIntoViewIfNeeded();

  await waitUntilTimelineMs(timelineStartedAt, contentPoint(scene, 0.66));
  await page.goto(url(context, "/demo?recording=true"));
  await settleVisuals(page);
  await page.getByRole("heading", { name: "Rebase a subscription." }).waitFor();
  await page.getByRole("button", { name: /Reset demo/ }).click();
  const duplicate = page.getByRole("radio", { name: /Already migrated/ });
  await duplicate.click();
  await page.getByRole("button", { name: /Read receipt with GPT-5.6/ }).click();
  await page.getByRole("button", { name: /Verify with source provider/ }).click();
  await page.getByRole("heading", { name: "This source cannot create a credit." }).waitFor();
  await page.getByText("SOURCE_ALREADY_CONSUMED", { exact: true }).waitFor();
  await page.locator("[data-testid='gpt-extraction']").count();
}

async function showBuildEvidenceThenEnding(
  context: SceneContext,
  state: RecordingState,
): Promise<void> {
  const { page, scene, timelineStartedAt } = context;
  await page.goto(url(context, "/presentation?recording=true&scene=08&phase=evidence"));
  await settleVisuals(page);
  await visible(page, "codex-build-log");
  await visible(page, "gpt-usage");

  await waitUntilTimelineMs(timelineStartedAt, contentPoint(scene, 0.69));
  await page.goto(url(context, "/presentation?recording=true&scene=08&phase=ending"));
  await settleVisuals(page);
  await visible(page, "ending-card");
  state.endingCardShown = true;
}

function contentPoint(scene: DemoTimelineScene, fraction: number): number {
  return scene.startMs + scene.leadInMs + Math.round(scene.contentDurationMs * fraction);
}

function url(context: SceneContext, path: string): string {
  return new URL(path, context.baseUrl).toString();
}

async function visible(page: Page, testId: string): Promise<void> {
  await page.getByTestId(testId).waitFor({ state: "visible", timeout: 15_000 });
}

export async function settleVisuals(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}
