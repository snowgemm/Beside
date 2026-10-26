# Besidevalley: Dungeons — STATE

Files: index.html, css/style.css, assets/ (README.md, models/, sfx/), js/{assets,save,world,player,input,combat,enemies,items,inventory,rooms,dungeon,boss,minimap,main}.js

APIs (global `Game`):
- world: getHeight, getBlock, solid, seed, chunk hooks
- player: equip, recalc(), weapon, dr, crit, speedMult
- input: attackQ/dodgeQ/invToggle
- combat: attack, dodge, hurtPlayer(dr applied), number; audio.play(name); events
- enemies: TYPES, list, hurt
- items: generate, valid, STAT/RARITIES; loot: roll(level, source, seed), spawnDrop, levelAt, sources
- inventory: slots, add, equip, drop; toast(text,color)
- save: register(key, ser, des), request, saveNow, newGame

- world: ow (overworld getters), useProvider(p|null) swaps getHeight/getBlock/solid, hold(on) hides overworld + pauses streaming
- enemies: spawn(name,x,y,z,def?), swap(prev)→old, clear(); an enemy with `.update(e,dt,dx,dz,d,px,py,pz)` skips default AI
- input: interactQ (E / #btn-interact)
- rooms: templates/byKind (ASCII, legend in rooms.js); dungeon: active, visuals{palette,gate,setCleared,door,chest,portal,level}, update, respawnPoint, afterLoad; boss: spawn, cleanup, DEF.parts
- audio names added by dungeon.js: door, chest, boss (placeholder synth)
- save key `dungeon`: {runs, cleared, inside}; reload inside → player placed at entrance outside; death → entrance outside

Stage 5 additions:
- assets (js/assets.js): `manifest` {models{name:{file,height,rotY}}, sounds{name:[files]}}; load() (async, never blocks, called from main after inits), model(name)→clone|null, has(name), sound(name)→bool. Wraps audio.play (loaded sound overrides synth). Names: models gate door chest portal boss slime goblin archer; sounds door chest boss hit swing death pickup equip. Filenames/heights: assets/README.md. GLB materials converted to unlit MeshBasic. Chest node "lid" animated if present. Needs GLTFLoader r128 CDN tag.
- enemies.spawn uses assets.model(name) (boss too); meshes collected for flash/telegraph. dungeon.visuals factories use models, else primitives.
- minimap (js/minimap.js): canvas #minimap, update(dt) throttled to 10 Hz. dungeon exposes run(), gateItems(), isCleared(key).
- Fixes: afterLoad falls back to spawn if entrance missing; chest lid guarded.

Done: stages 1–5. Game.paused freezes the sim.

VERIFIED (headless Chromium, THREE replaced by a no-render stub, scripted): overworld→gate→7 rooms cleared→doors→chests→boss→portal appears; save+reload inside → placed outside; death inside → respawn outside, no JS errors.
UNVERIFIED (needs real GPU browser): any rendering/visuals, GLB load/fit/rotY, sound decode, minimap look/placement on phone, boss attack feel, portal-out click.

Stage 6 (block editing + polish):
- world edit layer: sparse Map column(x,z)->height over the heightmap; `getHeight` (and getBlock/solid/ow.*) read it, clamp 1..48; `topType(h)` colours the top. `W.baseHeight(x,z)` = unedited noise (used by findSpawn and dungeon gate placement - never use the edited one there). API: setColumn(x,z,h)→'ok'|'same'|'cap' (rebuilds only that chunk + the neighbour on a border), editCount, serializeEdits, loadEdits(arr), clearEdits, EDIT_MAX=20000. A column set back to its base height is removed from the layer.
- save key `edits`: flat array [x,z,h,x,z,h,...] (max 20000 columns; toast "Đã đạt giới hạn chỉnh sửa"). Loaded by S.load before first chunk build. Old saves without it load fine.
- js/build.js (G.build): setMode(on), breakBlock(), placeBlock(), raycast(ox,oy,oz,dx,dy,dz,reach), update() (wireframe highlight, build mode only). Reach 6 from the eye (both views). Break = column -1, highlight shows the column's top block (what Phá removes); place = raises the column of the empty cell in front of the hit face by +1 (refused if it would overlap the player). No edits inside dungeons, within 8 blocks of any gate (D.gateItems) or of player.spawnPos. Input: B key / #btn-build (touch only); PC left click = break, right click = place (pointer-locked); touch #btn-break "Phá" / #btn-place "Đặt" shown in build mode. `input.buildMode`: left click no longer attacks while true (J still does).
- audio names `place`, `break` (synth in combat.js; assets manifest sounds place/break). `audio.setVolume(0..1)` scales master (base 0.35).
- js/menu.js (G.menu): button #btn-menu (⚙) + Esc (or losing pointer lock on PC) opens settings; sets G.paused. Save key `settings`: {vol 0..100 (default 100), dd 3..7 or null (= device default), map bool}. Items: Âm lượng, Tầm nhìn, Bản đồ nhỏ (minimap.setEnabled), Xóa chỉnh sửa (confirm), Chơi mới (confirm → save.newGame).
- main.js auto quality replaces the old governor: touch only, avg frame >28 ms for 5 s (not paused/in dungeon) → draw distance -1 (min 3), max twice per session, toast, persisted via menu.noteDrawDistance.

Camera (Cube World style): third-person orbit by default (`player.third=true`, `player.camDist` 6.5, wheel 2.5..12 when pointer-locked); V / Góc nhìn toggles first person. Build raycast from the head along the view dir = the screen-centre line in both views.

VERIFIED (headless Chromium + no-render THREE stub): break/place/clamp/cap/border rebuild/forbidden zone near spawn, save+reload with edits, old save without edits/settings, menu pause, clear edits; no JS errors. Vietnamese strings reviewed (no changes needed).
UNVERIFIED: rendering (wireframe, rebuilt chunks, button layout on phones), sound, pointer lock/right click, auto-quality trigger on a real slow device.

Stage 7 (Cube World style creatures, all in code):
- js/rig.js (loaded before player/enemies/boss): `Game.rig.build(spec, seed?)` → rig `{group, parts{name→joint Group}, play(state,opts), update(dt,speed), flash(t), tint(hex|0), dispose()}`; extras: `air` (0..1 while hopping, -1 grounded; slime), `tiltX` (extra pitch, used by player dodge roll), `dead`.
  play: 'idle' | 'walk' {speed} | 'attack' {dur, windup=fraction of dur before the strike (default .35)} | 'hurt' (flinch + white flash) | 'death' {onDone, keep} (0.6 s: tip over, shrink; keep=no shrink, used by player). Idle/walk normally come from `update(dt, speed)` (speed smoothed; >0.3 = walk). `tint(hex)` = flat warning colour (telegraph), flash beats tint.
  Rig = group → root (bob/lunge/scale) → pitch (tilt/death about the body centre) → body → joints. Shared unit BoxGeometry with vertex colours (top 1, sides .87/.74, bottom .5) and MeshBasicMaterial cache by final colour (per-part ±7% variation from hash(name+seed)); no per-frame allocation.
- Spec format: `{height, center?, scale?, lunge?, atk?:['armR'], gait?:{hop|quad|fly:{h,amp,rate}|crawl}, parts:[...]}`; part via `Game.rig.part(name, parentName|null, size[w,h,d], pivot[x,y,z] (box centre relative to joint), pos[x,y,z] (joint relative to parent joint), color, extra)`; extra: color2 (trim band on lower 30%, +1 mesh), rot[x,y,z] rest rotation, flat (unshaded, eyes), role (animation role, default = name), ph (phase), size=null (joint only). Forward is -z. Anim roles: head torso armL armR legL legR legFL legFR legBL legBR tail jaw wingL wingR wingL2 wingR2 leg (crawl, uses ph). Keep ≤16 meshes per creature (trim bands count).
- enemies.TYPES now carry `spec` (and optional `ai`: 'slime'|'goblin'|'archer' = which existing AI to use, default = type name; `proj` = projectile colour). New: wolf (quad, fast), skeleton (sword, ai goblin), bat (fly, ai goblin), spider (crawl, ai goblin), mushroom (ranged, purple spores, ai archer). loot.sources has entries for them; minimap/dungeon/save use names generically (enemies are not saved). No XP system exists in the project.
- enemies: rig enemies use rig.play/flash/tint; death = rig death anim, then the enemy is removed and `enemyDied` is emitted (loot, boss portal) when it finishes (e.dead is true immediately, so room clearing and targeting are unchanged). Rigs update only inside AI_RANGE. A GLB from assets.model(name) still wins (then e.rig=null and the old flat-colour flash/shrink path runs).
- boss: boss.js DEF.spec (also `Game.boss.spec`), glowing eyes, heavy fists; slam/fan telegraphs call rig attack (windup = telegraph time).
- player: `Game.player.makeSpec(weaponItem|null)`; rig rebuilt when `equip.weapon` changes; weapon kind from base name (Kiếm→sword, Rìu→axe, Dao→dagger, Giáo→spear), blade/head/tip colour = rarity hex. Swing anim triggered by P.swingT rising (combat.js untouched), hurt by health drop, death/respawn by P.dead, roll = tiltX flip.
- viewer.html: open next to index.html (needs the same folder; static host or file://) to see all creatures + player rotating with buttons Đứng yên/Đi/Đánh/Bị đau/Chết.
VERIFIED (node + hand-written minimal THREE stub, scripted): all specs build with ≤16 meshes, all play states run, death callback fires, enemies spawn/hurt/die/loot event for every type, boss attack/death, player equip rebuild; no JS errors.
UNVERIFIED: any actual rendering (looks, proportions, joint directions, weapon orientation, animation feel), viewer.html in a browser, perf on phones.

Stage 8 (Cube World look, all in code):
- world.js `build()`: per-vertex AO on tops (neighbour columns taller than this one), face shading, cliff bases darker, soil block + 3-high strata bands on cliffs, grain texture (16x16 canvas, one tile per block; UV top = world x,z, sides = horizontal world coord + y; mag NearestFilter, min NearestMipmapLinear to avoid shimmer). One material per world (`material`, colour = day tint). getHeight/edit layer untouched; `topType` still drives getBlock only (visual colours come from biome + height rules).
- Biome API: `Game.world.biome(x,z)` → 'meadow'|'forest'|'desert'|'snow'|'autumn' (two low-freq noises, temperature+moisture, scale ~250 blocks). Colours blend by soft weights per column. `Game.world.topColor(x,z)` → 0xRRGGBB (overworld only; used for particles). `world.tint(r,g,b)` multiplies terrain, decor, water. `world.chunkMesh(cx,cz)`.
- Height rules over biome colours: stone from ~20, snow from ~25 (jittered per column), sand at h<=SEA+1, underwater floor tinted blue by depth (shallow stays light).
- Water: ripple canvas texture (32x32) world-anchored + scrolling, colour pulse, tinted by day cycle.
- Decor (`decorMesh`, child of the chunk mesh as `mesh.decor`, rebuilt/disposed with it, own vertex-colour material): oak (meadow/forest), pine (snow), cactus + dead tree (desert), orange/red/yellow oak (autumn), bushes, flowers, rocks. Deterministic hash(x,z,seed); tree sites >=3 blocks apart (pure function so chunk borders agree). Skipped: h<=SEA+1, slope >1 (trees) / >2 (others), columns in the edit layer, within 8 of spawn (`player.spawnPos`) or of a gate (`dungeon.gatesNear`), trees above h 24. Cap 40 items (18 trees) per chunk. Visual only, no collision.
- js/sky.js (`Game.sky`, loaded after fx.js): `init(scene,camera)`, `update(dt)` (called every frame from main, dt 0 when paused), `t` 0..1 (0 midnight, .25 sunrise, .5 noon, .75 sunset), `night` 0..1. Cycle = 600 s. Save key `daytime` (number; missing in old saves → starts at .3). Dome vertex-colour gradient (fog off), box sun/moon, 160 stars, merged voxel clouds (drift, tile 400, wrap invisible), fog + background colour and terrain tint interpolate dawn/day/dusk/night; tint never below ~.5. Fully off while `Game.dungeon.active` (does not touch the dungeon fog/background); restored on exit.
- js/fx.js (`Game.fx`): one THREE.Points, 300 slots (36 ambient + 264 pooled). `burst(x,y,z,kind,color?,scale?)` kinds hit | death (colour = 0xRRGGBB, `fx.colorOf(enemy)`; scale>1 for bosses) | pickup | dust | blockbreak | blockplace; `update(dt,px,py,pz)`. Ambient: pollen by day (half the slots), fireflies at night (blink), off in dungeons. Hooks: enemies.hurt (hit, death; also covers bosses), items pickup, build break/place, player.js dust (landing, running, rolling).
- dungeon.js: added `D.gatesNear(x0,z0,x1,z1)` (decor exclusion only). index.html: fx.js and sky.js after world.js.
VERIFIED (node, hand-written minimal THREE stub, scripted): all scripts load, 400+300 frames, chunk build with decor (avg ~4, max 19 items/chunk, ~1.4k terrain verts/chunk), biome distribution, 600 s cycle wraps, sky/fx on/off with dungeon.active, save collects `daytime`; no JS errors.
UNVERIFIED: any actual rendering (colours, AO look, grain, water, sky/sun/cloud look, particle size, fireflies), real chunk build time on phones, material.color tint look.


Stage 9 (camera polish — 2026-10-26):
- Third-person camera collision now samples the camera boom more closely and refines the first terrain collision with binary search, reducing terrain clipping.
- Camera distance contracts immediately when blocked and eases outward when space clears, avoiding abrupt outward snaps while preserving obstruction safety.
- Mouse-wheel zoom now works while the game canvas is hovered or pointer-locked, prevents page scrolling over the game, and scales zoom steps to wheel input.
- Validation: `node --check` passed for every JavaScript file. Real-device camera feel and GPU rendering remain unverified.
