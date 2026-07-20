import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { calculateTimeline } from "@/scripts/demo/build-timeline";
import { expectedAudioFileNames } from "@/scripts/demo/demo-scenes";
import { inspectAudioPath, validateAudioFileNames } from "@/scripts/demo/inspect-audio";
import type { AudioInspection } from "@/scripts/demo/demo-types";
import { backgroundMusicSource } from "@/scripts/demo/demo-files";

describe("automated demo video", () => {
  test("includes the licensed CC0 background track", () => {
    expect(existsSync(backgroundMusicSource)).toBe(true);
    const probe = inspectAudioPath(backgroundMusicSource, "demo/music/one-cool-minute.mp3", 0);
    expect(probe.codec).toBe("mp3");
    expect(probe.durationSeconds).toBeGreaterThan(190);
    expect(probe.channels).toBe(2);
  });

  test("uses the eight authoritative narration files in numeric order", () => {
    expect(expectedAudioFileNames).toEqual([
      "01.mp3",
      "02.mp3",
      "03.mp3",
      "04.mp3",
      "05.mp3",
      "06.mp3",
      "07.mp3",
      "08.mp3",
    ]);
    expect(() => validateAudioFileNames(expectedAudioFileNames)).not.toThrow();
    expect(() => validateAudioFileNames(expectedAudioFileNames.slice(0, -1))).toThrow(/Expected/);
    expect(() => validateAudioFileNames([...expectedAudioFileNames].reverse())).toThrow(/Expected/);
  });

  test("rejects missing, empty, and invalid audio", () => {
    const directory = mkdtempSync(join(tmpdir(), "tmm-demo-audio-"));
    const missing = join(directory, "missing.mp3");
    expect(() => inspectAudioPath(missing, "missing.mp3", 1)).toThrow();

    const empty = join(directory, "empty.mp3");
    writeFileSync(empty, "");
    expect(() => inspectAudioPath(empty, "empty.mp3", 1)).toThrow(/empty/);

    const invalid = join(directory, "invalid.mp3");
    writeFileSync(invalid, "not an mp3");
    expect(() => inspectAudioPath(invalid, "invalid.mp3", 1)).toThrow();
  });

  test("extracts exact duration and stream metadata with ffprobe", () => {
    const inspected = inspectAudioPath(
      join(process.cwd(), "demo/voiceover/01.mp3"),
      "demo/voiceover/01.mp3",
      1,
    );
    expect(inspected.codec).toBe("mp3");
    expect(inspected.durationSeconds).toBeCloseTo(6.922438, 5);
    expect(inspected.sampleRate).toBe(44_100);
    expect(inspected.channels).toBe(1);
  });

  test("builds sequential non-overlapping scenes and extends for long narration", () => {
    const inspection = fixtureInspection();
    inspection.audioFiles[0]!.durationMs = 10_000;
    const timeline = calculateTimeline(inspection);
    expect(timeline.scenes[0]!.contentDurationMs).toBe(10_000);
    for (let index = 1; index < timeline.scenes.length; index += 1) {
      expect(timeline.scenes[index]!.startMs).toBe(timeline.scenes[index - 1]!.endMs);
      expect(timeline.scenes[index - 1]!.audioEndMs).toBeLessThanOrEqual(
        timeline.scenes[index]!.audioStartMs,
      );
    }
  });

  test("rejects a timeline at or above the strict 160-second contest limit", () => {
    const inspection = fixtureInspection();
    for (const file of inspection.audioFiles) file.durationMs = 20_000;
    expect(() => calculateTimeline(inspection)).toThrow(/160s competition limit/);
  });
});

function fixtureInspection(): AudioInspection {
  return {
    version: 1,
    audioFiles: expectedAudioFileNames.map((fileName, index) => ({
      index: index + 1,
      fileName,
      relativePath: `demo/voiceover/${fileName}`,
      durationSeconds: 5,
      durationMs: 5_000,
      codec: "mp3",
      sampleRate: 44_100,
      channels: 1,
      bitRate: 128_000,
      sizeBytes: 1,
    })),
    totalNarrationDurationMs: 40_000,
  };
}
