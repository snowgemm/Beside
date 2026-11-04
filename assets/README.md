# Besidevalley assets

Optional local assets live in this folder. The checked-in `models/` and `sfx/` directories currently contain only placeholders; missing files use procedural or synthesized fallbacks.

## Models

Place local binary glTF files at `assets/models/<name>.glb`. `js/assets.js` defines the names and target heights in its manifest. Models are auto-fitted to the configured height, centered on X/Z and placed with their feet at Y=0.

- The active runtime uses Three.js r128 and its matching `GLTFLoader`.
- Keep the GLB's PBR material and texture data. The loader currently keeps Standard materials, raises roughness to at least 0.82 and sets metalness to 0.
- Environment props are static. The current character and creature animation system is procedural; imported skeletal clips are not automatically applied.
- Optional named node: `lid` on a chest model, if it should animate when opened.
- Characters imported through the current manifest should face +Z before the manifest's configured rotation is applied.
- Keep source scale and orientation documented. Never add a model only because it is available; check silhouette, visual fit and device cost first.

## Sounds

Place one file for each manifest event at `assets/sfx/<name>.ogg`, `.mp3` or `.wav`. The loader tries those formats in that order. Audio is decoded after a user gesture creates the AudioContext. If no file is present or decoding fails, the generated Web Audio sound remains the fallback.

Current optional event names are: `door`, `chest`, `boss`, `hit`, `swing`, `death`, `pickup`, `equip`, `place` and `break`. Do not add an audio file until its source, license, duration, peak level and actual in-game mix have been checked.

## Ownership and cleanup

`Game.assets.model(name)` returns a scene instance that borrows geometry/material from the cached GLB template. Do not dispose those borrowed resources when removing an instance. Use `Game.assets.disposeInstance(root)`; it skips borrowed GLB mesh resources and disposes local mesh geometry/material owned by the removed object.

Textures referenced by shared GLB materials remain owned by the asset cache. Do not dispose them from a scene instance.


## Remote environment model sources

The runtime references optional remote environment GLBs by immutable source commit URLs. Exact source revisions, pack-specific CC0 evidence, Git blob IDs and transfer sizes are recorded in `ASSETS.md`. If an earlier IndexedDB entry uses a mutable branch URL, it is migrated only after its bytes pass the expected Git blob SHA-1 check. If network loading or validation fails, the procedural environment remains available.

The unused `potion` model has been removed from the runtime manifest because no current code path requests it.
