# Besidevalley: Dungeons — Art Bible

## Visual direction

**Current direction:** a hybrid stylized-toon world with chunky, hand-built characters and props. The overworld is a smooth heightmap with biome/height/slope vertex colours, restrained surface detail, stylized water and low-poly vegetation. Characters and several dungeon props retain readable block-built silhouettes. Imported environment GLBs keep their source PBR maps and are tuned toward rough, non-metallic surfaces so they sit closer to the game's soft lighting.

Do not describe the current world as a pure voxel terrain renderer. The active terrain module is `js/legacy-world.js`; the retired block renderer is not loaded by `index.html`.

**Design goals:** readable silhouettes, calm colour grouping, consistent scale, deliberate animation, low visual noise, and stable performance on Android phones. Add detail only when it improves navigation, feedback or recognition.

## World and material rules

- Terrain: smooth heightmap, shared edge normals, biome and elevation colour ramps, soft painted variation, gentle shoreline foam and water movement.
- Lighting: built-in Three.js lighting and toon materials; keep material response stable through the day/night cycle.
- Environment models: static GLB props may preserve base-colour/normal/roughness texture data. The loader currently raises roughness to at least 0.82, sets metalness to 0 and uses a restrained environment intensity.
- Vegetation: capped instance batches and distance-aware detail. Avoid thin high-frequency detail that becomes noisy or flickers at phone resolutions.
- Character rigs: chunky box-part construction with seeded colour variation and shared geometry/material caches. Use a small, consistent palette rather than arbitrary new colours.
- Textures: do not add high-resolution maps by default. Every map needs a visible purpose, a size budget and a compatible fallback.

## Scale and silhouette

1 world unit is one terrain block.

| Category | Scale guidance |
|---|---|
| Terrain and dungeon structures | Existing world-unit grid and room dimensions |
| Props | Snap major dimensions to 0.25 units where practical |
| Characters and creatures | Player height 1.7; large head and short, readable limbs |
| Collectibles | Readable at the default camera distance; use a simple silhouette and rarity cue |
| Item icons | Existing 12×12 pixel grid in `Game.icons.GRID` |

Character proportions should remain consistent: head around one-third of player height, torso and legs around 30% each, with thick enough limbs to remain readable on mobile. Forward is -Z for the procedural rigs; imported models are normalized to the manifest's facing convention.

## Performance budgets

One procedural box contributes 12 triangles. Existing runtime budgets are defined in `Game.assets.budgets` and surfaced by `gallery.html`.

| Category | Max boxes | Max triangles |
|---|---:|---:|
| Character rig | 24 | 288 |
| Small creature | 16 | 192 |
| Medium creature | 20 | 240 |
| Large creature | 28 | 336 |
| Small prop | 40 | 480 |
| Large prop | 120 | 1440 |
| Item icon | 96 filled cells | — |

Scene guide from the current project: keep active creature and prop counts bounded, share cached geometry/materials, and avoid per-frame object allocation. Re-check budgets after adding models; GLB budgets must include imported triangles and texture memory, not only procedural boxes.

## Colour system

Use `Game.palette` ramps for new procedural assets. Keep rarity colours consistent with `Game.palette.rarity` and the existing icon renderer. Do not silently recolour imported source assets; report off-palette differences in the asset gallery and decide them intentionally.

## Interface direction

- Keep the HUD compact and legible over bright and dark terrain.
- Preserve safe-area spacing, large touch controls and the existing portrait/landscape layouts.
- Keep menus short and grouped by task; avoid adding settings that users cannot understand or verify.
- Prefer solid surfaces and restrained borders over decorative gradients.
- Motion should communicate state: hit confirmation, pickup, screen transition and important encounter changes. Avoid animation that delays input or competes with combat readability.
- Respect `prefers-reduced-motion`; gameplay simulation and timing must not depend on CSS animation events.

## Audio direction

- Every sound event needs a clear gameplay purpose and a restrained mix level.
- Preserve the generated-sound fallback when optional audio files are missing or decoding fails.
- Load/decode an effect once, reuse its AudioBuffer, and create a new source node for each playback.
- Unlock audio only from a user gesture, respect the user's volume setting, and pause/suspend appropriately when the page is hidden.

## Adding or changing an asset

1. Identify its gameplay purpose and whether it is actually missing.
2. Verify source, exact license version, provenance and redistribution constraints before downloading.
3. Define scale, silhouette, topology, material and texture budgets, plus a fallback.
4. Inspect and validate the GLB/audio/texture bytes before integration. Do not rely on a filename or a mirror's description as license proof.
5. Keep imported model resources owned by the asset cache; instances borrow their geometry/material. Use `Game.assets.disposeInstance()` when removing scene-owned objects.
6. Check the asset in `gallery.html`, run `Game.assets.validate()`, then test its actual in-game appearance on a phone.
7. Update `ASSETS.md`, `assets/README.md` and `STATE.md` with source and verification evidence.
