export type DemoSceneDefinition = {
  id: string;
  audioFile: string;
  description: string;
  leadInMs: number;
  trailingHoldMs: number;
  minimumVisualDurationMs: number;
  execute:
    | "showHook"
    | "showCurrentSubscription"
    | "showSolution"
    | "showVerification"
    | "showCalculation"
    | "showExecution"
    | "showTechnicalView"
    | "showBuildEvidenceThenEnding";
};

/**
 * The user supplied eight authoritative narration clips. The original draft invented a ninth.
 * Impact and the ending card are therefore part of scene 08's visual sequence.
 */
export const demoScenes: readonly DemoSceneDefinition[] = [
  {
    id: "01-hook",
    audioFile: "demo/voiceover/01.mp3",
    description: "Opening hook and duplicate-payment problem",
    leadInMs: 500,
    trailingHoldMs: 900,
    minimumVisualDurationMs: 4_000,
    execute: "showHook",
  },
  {
    id: "02-problem",
    audioFile: "demo/voiceover/02.mp3",
    description: "Synthetic mobile-billed source subscription",
    leadInMs: 400,
    trailingHoldMs: 1_100,
    minimumVisualDurationMs: 5_000,
    execute: "showCurrentSubscription",
  },
  {
    id: "03-solution",
    audioFile: "demo/voiceover/03.mp3",
    description: "Provider-neutral one-time migration credit",
    leadInMs: 400,
    trailingHoldMs: 1_100,
    minimumVisualDurationMs: 5_000,
    execute: "showSolution",
  },
  {
    id: "04-verification",
    audioFile: "demo/voiceover/04.mp3",
    description: "Receipt evidence and authoritative provider verification",
    leadInMs: 400,
    trailingHoldMs: 1_300,
    minimumVisualDurationMs: 7_000,
    execute: "showVerification",
  },
  {
    id: "05-calculation",
    audioFile: "demo/voiceover/05.mp3",
    description: "Real deterministic unused-value calculation",
    leadInMs: 400,
    trailingHoldMs: 1_500,
    minimumVisualDurationMs: 7_000,
    execute: "showCalculation",
  },
  {
    id: "06-execution",
    audioFile: "demo/voiceover/06.mp3",
    description: "Consent, exactly-once saga, and completed result",
    leadInMs: 400,
    trailingHoldMs: 1_300,
    minimumVisualDurationMs: 7_000,
    execute: "showExecution",
  },
  {
    id: "07-technical",
    audioFile: "demo/voiceover/07.mp3",
    description: "Sanitized audit, ledger, idempotency, and duplicate protection",
    leadInMs: 400,
    trailingHoldMs: 1_500,
    minimumVisualDurationMs: 8_000,
    execute: "showTechnicalView",
  },
  {
    id: "08-build-impact-ending",
    audioFile: "demo/voiceover/08.mp3",
    description: "Codex and GPT-5.6 boundaries, product impact, and ending card",
    leadInMs: 400,
    trailingHoldMs: 2_400,
    minimumVisualDurationMs: 6_000,
    execute: "showBuildEvidenceThenEnding",
  },
] as const;

export const competitionLimitMs = 160_000;
export const warningThresholdMs = 155_000;

export const expectedAudioFileNames = demoScenes.map((scene) =>
  scene.audioFile.split("/").at(-1),
) as string[];
