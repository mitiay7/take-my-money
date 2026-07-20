import { readFileSync, rmSync } from "node:fs";
import { artifactPaths, ensureArtifactDirectories, runBinary } from "./demo-files";
import type { DemoTimeline } from "./demo-types";

/** Generates an original, non-melodic ambient bed. No third-party recording is used. */
export function generateBackgroundMusic(): void {
  ensureArtifactDirectories();
  const timeline = JSON.parse(readFileSync(artifactPaths.timeline, "utf8")) as DemoTimeline;
  const durationSeconds = timeline.totalDurationMs / 1000;
  const duration = durationSeconds.toFixed(3);
  const fadeOutStart = Math.max(0, durationSeconds - 0.8).toFixed(3);
  const expression = [
    "0.025*sin(2*PI*(110+0.18*sin(2*PI*0.037*t))*t)",
    "0.018*sin(2*PI*(138.59+0.12*sin(2*PI*0.029*t))*t)",
    "0.014*sin(2*PI*(164.81+0.10*sin(2*PI*0.023*t))*t)",
    "0.010*sin(2*PI*220*t)",
  ].join("+");
  rmSync(artifactPaths.backgroundMusic, { force: true });
  runBinary("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    `aevalsrc=exprs=${expression}|${expression}:s=48000:d=${duration}`,
    "-af",
    `highpass=f=70,lowpass=f=850,tremolo=f=0.12:d=0.16,afade=t=in:st=0:d=0.3,afade=t=out:st=${fadeOutStart}:d=0.8,alimiter=limit=0.8`,
    "-ar",
    "48000",
    "-ac",
    "2",
    "-c:a",
    "pcm_s16le",
    artifactPaths.backgroundMusic,
  ]);
  console.log(`Original ambient bed: ${artifactPaths.backgroundMusic}`);
}

if (import.meta.url === `file://${process.argv[1]}`) generateBackgroundMusic();
