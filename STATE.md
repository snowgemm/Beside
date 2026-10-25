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
The source archive describes headless tests for dungeon progression, save/reload, build edits and settings. Those tests have not been independently rerun against the live repository in this session. Browser rendering, real-device touch layout, GLB loading, audio decoding and boss combat still require live-browser verification.

## Caution
Treat the uploaded ZIP as the source of truth. When syncing, replace same-path files, add new paths, and retain repository files not present in the archive. Do not claim runtime validation based on syntax checks alone.
