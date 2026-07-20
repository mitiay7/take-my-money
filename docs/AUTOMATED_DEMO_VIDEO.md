# Automated demo video

The repository contains a deterministic production pipeline for the contest demo. It measures the supplied narration, derives one shared timeline, records the real deployed flow, assembles voice and licensed background audio, renders a YouTube-ready MP4, and validates the result.

## Corrections to the original draft

- The supplied narration is **eight** authoritative files, `01.mp3` through `08.mp3`. The draft invented a ninth file. Scene 08 combines Codex/GPT-5.6 evidence, impact, and the ending card.
- The official rules require a video shorter than three minutes. This project deliberately enforces a stricter **2:40 / 160-second** production ceiling for a safe submission margin. Timeline generation and final validation both reject `>= 160 seconds`.
- Production has the GPT-5.6 Responses integration but no deployer API key. The recording therefore labels receipt/explanation behavior as **deterministic fallback** and never claims that a live model call occurred.
- The source is a synthetic `Plus — mobile billed demo` record behind an `AppleSandboxSubscriptionProvider`; it is not presented as a real ChatGPT account or real App Store receipt.
- The portability value is a simulated one-time target credit, never an Apple refund or cash transfer.
- Background music is **One Cool Minute** by Loyalty Freak Music, released under CC0 1.0. Its committed checksum and provenance are verified before every render.

## Requirements

- Node.js 22
- pnpm 11.15.1
- Playwright Chromium (`pnpm exec playwright install chromium`)
- FFmpeg and ffprobe 8+
- Network access to the public demo, unless `DEMO_BASE_URL` points to a local build

macOS:

```bash
brew install ffmpeg
```

Ubuntu/Debian:

```bash
sudo apt-get install ffmpeg
```

## Narration

Place these unmodified files in `demo/voiceover/`:

```text
01.mp3  02.mp3  03.mp3  04.mp3
05.mp3  06.mp3  07.mp3  08.mp3
```

The source MP3 files are never overwritten. Generated 48 kHz stereo PCM intermediates live under `artifacts/video/audio-normalized/`.

## Commands

```bash
pnpm demo:inspect-audio  # validate streams and measure exact ffprobe durations
pnpm demo:timeline       # generate the shared audio/browser timeline
pnpm demo:record         # record the deployed application at 1920×1080
pnpm demo:render         # narration + verified CC0 music + H.264/AAC MP4
pnpm demo:validate       # codec, duration, dimensions, state and asset checks
pnpm demo:video          # complete pipeline
```

The default recording target is `https://take-my-money-psi.vercel.app`. Override it for a production local build:

```bash
DEMO_BASE_URL=http://127.0.0.1:3000 pnpm demo:video
```

## Output

The deliverable is:

```text
artifacts/video/take-my-money-demo.mp4
```

Generated reports:

```text
artifacts/video/audio-inspection.json
artifacts/video/demo-timeline.json
artifacts/video/timing-report.json
artifacts/video/recording-report.json
artifacts/video/validation.json
```

The video is 1920×1080, 30 fps, H.264 High, yuv420p, AAC 192 kbps, with `faststart` enabled. The CC0 track is ducked under speech, smoothly raised during the opening and closing four seconds, and fades out with the ending card. See [`demo/music/LICENSE.md`](../demo/music/LICENSE.md) for provenance.

## Captions

Captions are optional. Supply `demo/voiceover/captions.srt`, then run:

```bash
pnpm demo:video --captions
```

Without that file, the default is no burned-in captions:

```bash
pnpm demo:video --no-captions
```

## Reliability and debugging

- Every visual hold is derived from `demo-timeline.json`; narration is never trimmed or time-stretched.
- The full monetary flow calls the deployed APIs and reaches a real persisted `COMPLETED` sandbox operation.
- Scene 07 checks the audit, ledger, source consumption, idempotency evidence, and a rejected duplicate source.
- Playwright trace, failure screenshot, browser console, API status log, FFmpeg command, and FFmpeg log are preserved under `artifacts/video/debug/`.
- Re-running replaces generated artifacts but preserves source narration.
- `pnpm demo:timeline` stops before recording if expected duration is at or above 160 seconds.

Inspect a failed browser run with:

```bash
pnpm exec playwright show-trace artifacts/video/debug/trace.zip
```
