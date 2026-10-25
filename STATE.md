# Besidevalley: Dungeons — STATE

## Current architecture
- Browser game: Three.js r128, vanilla JavaScript, mobile-first touch controls.
- Entry point loads assets, save, overworld, player/input/combat/enemies/items/inventory, dungeon rooms, dungeon generator, boss, minimap, build mode, settings menu and main loop.
- Global API is namespaced under `window.Game`; avoid introducing duplicate global state.

## Systems in this build
- Procedural overworld with chunk loading, player movement, camera modes, combat and enemy AI.
- Equipment, item rarity/affixes, loot, 24-slot inventory, save/load.
- Dungeon room templates, connected rooms, doors, treasure chests, boss encounter and exit portal.
- Optional overworld block editing with placement/breaking restrictions.
- Settings menu, pause, audio volume, draw distance, minimap toggle and save reset.
- Optional GLB/SFX assets; missing assets should fall back to primitive meshes/synthesized sounds.

## Key APIs
- `world`: getHeight, getBlock, solid, seed, chunk hooks, setColumn, serializeEdits/loadEdits, useProvider/hold.
- `player`: equip, recalc, weapon, armor mitigation, critical chance and movement modifiers.
- `input`: attackQ, dodgeQ, invToggle, interactQ, buildMode.
- `combat`: attack, dodge, hurtPlayer; audio.play/setVolume; events.
- `enemies`: spawn, list, hurt, swap, clear.
- `items/loot`: generate, valid, STAT/RARITIES, roll, spawnDrop, levelAt.
- `inventory`: slots, add, equip, drop; toast notifications.
- `save`: register, request, saveNow, newGame.
- `rooms/dungeon`: templates, run, gateItems, isCleared, visuals, update, respawnPoint, afterLoad.
- `boss`: spawn, cleanup.
- `minimap`: update, setEnabled.
- `build`: setMode, breakBlock, placeBlock, raycast, update.
- `menu`: settings and pause handling.

## Validation status
- 2026-10-26: all 16 JavaScript files in `js/` passed syntax parsing.
- 2026-10-26: headless camera/input tests using a minimal mock Three.js passed 8/8 checks: wheel zoom in/out, zoom limits (2.5–12), input gating, first-person isolation, and camera shortening before a mock terrain wall.
- Reproducible test: `node tests/headless-camera-smoke.cjs`. GitHub Actions runs it on pushes, pull requests and manual dispatch.
- Not verified on a real browser/device: camera feel, visual clipping from all angles, mouse-wheel behavior with actual pointer lock, touch layout, GLB loading, audio decoding and boss combat. The mocked test is a regression check, not a substitute for a WebGL playtest.
- Dungeon progression, save/reload, build edits and settings tests described in the source archive have not been independently rerun against the live repository.

## Caution
Treat the uploaded ZIP as a reference, not proof of current runtime correctness. When syncing, compare files rather than assuming the repository is byte-identical to the archive. Do not claim real-browser validation based on syntax checks or mocked tests alone.
