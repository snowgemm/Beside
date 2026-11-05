# Android runtime profiling — Besidevalley

## Purpose

Collect comparable runtime samples on the actual Android browser without desktop DevTools. This is an opt-in diagnostic mode, not a gameplay feature.

## Start a capture session

1. Open the current deployment with `?profile=1`, for example `https://besidevalley.vercel.app/?profile=1`.
2. Keep the same browser, orientation, graphics preset and draw distance for the samples being compared.
3. Load into the overworld and wait about 45–60 seconds for initial chunk streaming and optional models to settle.
4. Keep the camera aimed at a repeatable scene. Tap **Chụp mẫu** five times, leaving about 10 seconds between captures. Do not move during this static sample.
5. Repeat the capture sequence while traversing the same short route at a steady pace.
6. For lifecycle testing, capture once before entering a dungeon, once after the room has settled, and once after exiting. Repeat the same enter/leave cycle three times.
7. Tap **Xuất JSON**. The browser downloads a local `besidevalley-profile-*.json` file. Review it before sharing. **Xóa** clears the in-memory history for a new run.

The capture controls are only visible when `profile=1` is present. The panel is hidden during normal gameplay. It records a sample only when **Chụp mẫu** is tapped; there is no timer or continuous sampling.

## What each sample contains

- Main-loop FPS estimate, pixel ratio, quality preset, adaptive resolution scale and draw distance.
- Loaded chunk count, player world coordinates and overworld/dungeon state.
- Three.js render calls, triangles, points and lines for the most recent render.
- Three.js geometry/texture object counts and program count.

The export also contains the build ID, viewport/screen dimensions, device pixel ratio and touch capability. It does not include the full URL, cookies, account details or location, and it does not upload the file.

## Interpret the counters correctly

- The HUD's `Vùng` is `Game.world.chunkCount()`: the number of currently loaded chunks.
- FPS is calculated from the observed animation-loop cadence. It is not a direct measurement of GPU execution time and may be affected by display refresh, browser scheduling and frame pacing.
- `renderer.info.render.calls/triangles/points/lines` are per-render counters. Compare the same scene and build.
- `renderer.info.memory.geometries/textures` and `programs` are object counts, not byte totals or authoritative VRAM measurements. Compare trends after warm-up; internal renderer caches may persist.
- A single FPS sample cannot establish sustained performance, thermal throttling or battery cost.

Three.js documents `WebGLRenderer.info` as rendering/memory statistics and notes the default reset behavior around render calls: [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html).

## Initial user-supplied observation

| Field | Observation |
|---|---:|
| Date/time displayed | 2026-11-05 18:16 |
| Browser / device | Android browser, landscape; exact model/version not recorded |
| FPS HUD | 47 |
| Draw distance | 7 |
| Loaded chunks (`Vùng`) | 185 |
| Player position | X 54.3 · Y 11.4 · Z -11.0 |
| Battery indicator | 49% |

The scene is a third-person forest/coast overworld view. This is a single user screenshot, not a measured time series. At 47 FPS the reciprocal is approximately 21.3 ms per frame, but this is only a cadence equivalent, not GPU render time.

## Comparison rules

- Keep the device plugged in or unplugged consistently across runs; record the choice separately. Avoid comparing a cold run with a thermally saturated run.
- Keep screen brightness, browser, orientation, refresh-rate setting, scene, draw distance and quality preset unchanged.
- Compare medians and ranges across several samples, not the highest FPS.
- Compare chunk/dungeon lifecycle memory counts only after warm-up and across repeated identical cycles.
- Do not infer GPU bottlenecks from renderer counters alone. Use a browser performance trace or device GPU profiler before changing shaders, shadows, geometry or resolution.
- Preserve the exported JSON alongside the exact build SHA and the test scenario.

## Versioning

This runbook was added with build token `20261105-android-profile-capture-v27`. The opt-in panel has no effect when the query parameter is absent.
