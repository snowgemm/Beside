# Besidevalley — Quality Upgrade Roadmap

Last reviewed: 2026-11-04  
Baseline: `main` at `1651effc794f493f557ff6899f9732783fd179b3`  
Runtime: plain JavaScript + Three.js r128, mobile-first controls, static Vercel hosting and offline shell.

## Quality target

A cohesive smooth-toon adventure game that is readable, responsive and stable on mid-range Android devices, while remaining good on desktop. Improve the systems already present before adding breadth. Avoid unnecessary dependencies, decorative UI complexity, unverified asset imports and expensive effects without a measured benefit.

## Current baseline

**Already implemented**
- Smooth heightmap terrain with biome/elevation colour variation, stylized lighting, water and capped vegetation batches.
- Procedural player and creature rigs with idle, movement, attack, hit, jump, landing and death states.
- Dungeon rooms, deterministic loot generation, inventory, minimap, save data and an offline shell.
- Optional GLB model loading with IndexedDB caching and procedural fallback.
- Optional audio files decoded into reusable AudioBuffers, plus generated Web Audio fallbacks.
- Adaptive render resolution, graphics quality presets, mobile touch controls and a model/palette/asset-budget gallery.
- Lifecycle fixes for held touch/keyboard input on page blur, hidden-tab and pagehide; WebGL context-loss recovery.

**Evidence limits**
- Stage 15 branch CI passed 26 JavaScript syntax checks and 66 headless camera/input checks, including borrowed-resource cleanup, idempotency, reduced-motion and cache-version regressions.
- The checked-in `assets/models/` and `assets/sfx/` folders currently contain only `.gitkeep` placeholders.
- Headless tests do not prove correct GPU rendering, visual quality, sound mix, heat, battery use or real Android touch behavior.
- The Game Development Studio `game-dev` CLI is not installed in the current environment. No provider generation, Blender normalization, package build or package vendoring has been run.

## Priority and workstreams

### P0 — Resource ownership and runtime correctness

**Stage 15: shared GLB cleanup safety**
- Asset-manager GLB clones share geometry and material with cached templates. Mark these references as borrowed.
- Dispose only resources owned by the removed instance; preserve shared GLB resources.
- Make cleanup idempotent and deduplicate repeated geometry/material references.
- Use the same cleanup path for dungeon objects and gallery previews.
- Respect reduced-motion preferences for DOM feedback while keeping timed game feedback visible.

**Next resource audit**
- Inspect every create/remove path for geometry, material, texture, render target, object URL, AudioBuffer, timer and event listener ownership.
- Use `renderer.info.memory.geometries` and `textures` around repeated identical dungeon/streaming cycles after warm-up. Interpret trends, not a single absolute count: renderer internals and intentionally cached assets can remain allocated.
- Do not dispose a resource merely because one mesh using it is removed. Establish ownership or reference counting first.

**Acceptance**
- Removing one GLB clone cannot invalidate another clone or the cached template.
- Repeated identical dungeon enter/leave and chunk refresh cycles do not show unbounded resource growth.
- Repeated cleanup is safe.

### P1 — Page lifecycle, save and audio

- On a hidden page, stop unnecessary game simulation/render work, clear transient inputs, save once and suspend audio when appropriate.
- On return, reset frame clocks; do not simulate a large catch-up step.
- Resume Web Audio only after a valid user gesture when the browser keeps the context suspended.
- Preserve old save compatibility and keep WebGL loss/recovery handling independent from ordinary page visibility.

**Acceptance:** switching away and returning does not leave movement/jump stuck, advance the world invisibly or play duplicate sound.

### P2 — UI/UX and interface architecture

- Keep a compact hierarchy: health, area/encounter, nearby interaction and essential controls.
- Review portrait 360×640 and landscape 844×390, safe areas, browser chrome, thumb reach and touch targets.
- Simplify settings into a few useful groups; do not add cosmetic switches without a testable purpose.
- Standardize panel, border, spacing, typography and contrast tokens. Prefer solid surfaces and restrained borders over decorative gradients.
- Keep keyboard and touch interactions immediate; do not animate high-frequency actions.
- Verify menu open/close, pause/resume, inventory and map transitions can be interrupted without leaving stale pause/input state.
- Maintain readable contrast over bright snow, sand, water and dark dungeon backgrounds.

**Acceptance:** no overlap of essential controls, menu state is consistent, important HUD values remain legible, and layouts work in portrait and landscape.

### P3 — Animation and game feel

- Audit every CSS keyframe, transition and procedural rig state by purpose, frequency, timing, easing, interruption, performance and accessibility.
- Use motion to communicate state: hit confirmation, pickup, landing, encounter start/clear and navigation.
- Prefer opacity/transform for DOM transitions; use JavaScript only where motion is driven by live game state.
- Use animation timing that does not delay input or affect game simulation. CSS completion events must never determine gameplay progression.
- Respect `prefers-reduced-motion`; keep essential state feedback visible without large scaling or repeated pulsing.
- Preserve deterministic animation timing where it affects reproducible gameplay tests.

**Acceptance:** animation reinforces feedback, remains coherent across the UI and does not cause a performance regression on phones. Subjective feel still needs a human playtest.

### P4 — Models and character presentation

- Keep procedural rigs as the reliable fallback and current animation source.
- Before importing a GLB, verify source, exact license version, immutable source revision, node hierarchy, scale, facing, bounds, triangle count, material count and texture memory.
- Prefer models that match the smooth-toon environment and chunky character proportions; avoid mixing unrelated art styles.
- Keep distance-aware detail or merged geometry when the visual benefit remains visible at phone resolution.
- Do not apply arbitrary skeletal clips to incompatible procedural rigs. A future skeletal pipeline needs a compatible rig, retarget plan and fallback.
- Use the gallery for inspection and budgets, then validate actual in-game rendering on a mobile GPU.

**Acceptance:** each shipped model has provenance, license evidence, budget, fallback and a real-device visual check.

### P5 — Materials, textures and environment

- Keep terrain vertex colours as the lightweight baseline.
- Add texture maps only where they improve recognition or material readability at normal gameplay distance.
- Record resolution, format, colour space, mipmap policy, alpha/transparency needs and approximate GPU memory for each texture set.
- Do not migrate to KTX2/Basis or Draco just because loaders support them. First confirm exact Three.js r128 compatibility, matching decoder assets, offline behavior, target Android GPU support and a procedural/uncompressed fallback.
- Keep water, vegetation, fog, outlines and day/night effects within explicit per-quality budgets.
- Check chunk seams, normals, texture filtering, colour-space consistency and transparent sorting.

**Acceptance:** no visible biome seams or texture-space mismatch; Low/Medium remain usable on the target device; High adds visible quality rather than just more noise.

### P6 — Audio and sound design

- Keep generated effects as a reliable fallback; optional files should improve clarity and identity rather than merely replace the synth layer.
- Use one AudioContext, decode each file once, create a fresh BufferSource for each playback and route through the master gain.
- Audit loudness, duration, repeat frequency, simultaneous effects and clipping; prevent repeated effects from becoming noisy.
- Respect mute/volume settings and browser autoplay policies. AudioContext creation/resume must follow user-gesture rules.
- Handle hidden-page suspension and return without duplicate or stuck audio.
- Track source, exact license, format and provenance for every shipped sound.

**Acceptance:** important actions have a distinct, non-intrusive cue or deliberate silence; first-gesture unlock works; volume and background lifecycle remain correct.

### P7 — Items, inventory and progression data

- Keep item definitions data-driven and separate from UI rendering.
- Every collectible needs a stable ID, display name, icon, rarity mapping, valid slot/stat schema and save behavior.
- Keep item presentation consistent across drops, HUD, inventory and gallery.
- Test full inventory, duplicate pickup, invalid or missing icon data, old saves, empty slots and repeated equip/unequip.
- Avoid introducing new currencies, crafting or menu layers until the core loop demonstrates a need.

**Acceptance:** item data survives save/reload and every capacity/empty/error state has clear feedback.

### P8 — Gameplay systems and encounter lifecycle

- Audit dungeon enter/leave, room progression, encounter cleanup, enemy range/LOD, collision, camera obstruction, death/respawn and save transitions.
- Preserve deterministic seeds and backward-compatible save keys.
- Test repeated entry/exit, restart, death, portal exit, missing optional models, slow asset loading and hidden-tab transitions.
- Tune movement/combat/animation from real playtests rather than guessing based only on source code.

**Acceptance:** a full dungeon cycle and extended overworld session complete without errors, stuck states or unbounded scene growth.

### P9 — Performance, accessibility and release gates

- CI: JavaScript syntax, deterministic logic tests, resource ownership regressions, input lifecycle tests and asset-policy validation.
- Manual Android QA: portrait/landscape, Low/Medium/High, offline cold start, audio unlock, app switch/resume, WebGL recovery and a sustained play session.
- Record device/browser, build SHA, scenario, console errors, FPS range, heat/battery observations and renderer memory snapshots.
- Do not claim visual, sound or hardware improvements as verified until they have been observed on the target device.

## References and skills

### Interface and motion
- [Emil Kowalski — design engineering skills](https://github.com/emilkowalski/skills): motion audit, animation review and practical UI craft. The `improve-animations` skill is read-only planning; `review-animations` focuses on reviewing a diff.
- [MDN — prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion): respect the operating-system motion preference.
- [MDN — CSS animation performance](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Animation_performance_and_frame_rate): choose animation properties carefully and avoid layout-heavy motion.

### Runtime, audio and assets
- [Three.js — disposal guide](https://threejs.org/manual/pages/how-to-dispose-of-objects.html) and [cleanup guide](https://threejs.org/manual/pages/cleanup.html): geometry, material and texture ownership.
- [Three.js — GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html) and [KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html): format support. Match all decoder files to the project's pinned Three.js revision before use.
- [Three.js — WebGLRenderer.info](https://threejs.org/docs/pages/WebGLRenderer.html): renderer memory/render counters for repeatable diagnostics.
- [MDN — Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices): autoplay, AudioContext state and short sample decoding.
- [Kenney support and license](https://kenney.nl/support): asset-page releases are CC0; retain the exact pack's license file.
- [Quaternius QAL v1.0](https://github.com/Quaternius/quaternius.github.io/blob/main/license.html): check the current terms and the exact original pack license.
- [Poly Haven license](https://polyhaven.com/license): CC0 models, HDRIs and textures.
- [ambientCG](https://ambientcg.com/): material source; verify the exact downloaded asset and license.

## Execution rules

1. Inspect current code, runtime behavior and exact asset source/license before changing them.
2. Keep each PR focused on one workstream; do not redesign unrelated systems in the same change.
3. Do not add a dependency or asset without a concrete purpose and compatibility evidence.
4. Preserve procedural/offline/audio fallbacks.
5. Read changed files again, run the relevant tests, inspect CI logs and verify the deployed commit before reporting completion.
6. Mark GPU, visual, sound-mix and phone checks as manual until they have been performed on a real device.
