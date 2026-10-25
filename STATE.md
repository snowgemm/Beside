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
- 2026-10-26: all JavaScript files in `js/` pass syntax parsing in the latest successful headless workflow.
- 2026-10-26: headless camera/input regression checks passed 8/8 with a minimal Three.js mock: wheel zoom in/out, zoom bounds (2.5–12), first-person isolation, pointer-lock gating, and camera shortening before a mock terrain wall.
- Reproducible command: `node tests/headless-camera-smoke.cjs`. GitHub Actions runs it on pushes, pull requests and manual dispatch.
- Player now uses the procedural rig (`js/rig.js`), with a default third-person camera distance of 6.5 units and finer terrain-obstruction sampling. `viewer.html` is a standalone rig-animation preview using the modules currently in this repository.
- Not verified on a real browser/device: camera feel, visual clipping from all angles, mouse-wheel behavior with actual pointer lock, WebGL rendering, touch layout, GLB loading, audio decoding and boss combat. Mocked tests are regression checks, not a substitute for a WebGL playtest.
- Dungeon progression, save/reload, build edits and settings tests described in the uploaded archive have not been independently rerun against the live repository. This update selectively integrated the rig/player and viewer changes; it is not a byte-for-byte replacement of every ZIP file.

## Caution
Treat the uploaded ZIP as a reference, not proof of current runtime correctness. When syncing, compare files rather than assuming the repository is byte-identical to the archive. Do not claim real-browser validation based on syntax checks or mocked tests alone.
