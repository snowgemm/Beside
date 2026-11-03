# Besidevalley: Dungeons — STATE

Files: index.html, css/style.css, assets/ (README.md, models/, sfx/), js/{assets,palette,toon,save,legacy-world,sky,player,input,phys,combat,enemies,items,inventory,rooms,dungeon,boss,minimap,menu,main}.js, plus the existing UI/support scripts. js/world.js and js/blocks.js are retained but not loaded.

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
- audio names jump, land, landhard, splash, splashbig, bounce, hitwall (stage 10b); `place`, `break` (synth in combat.js; assets manifest sounds place/break). `audio.setVolume(0..1)` scales master (base 0.35).
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

Stage 9 (UI restyle, plain DOM/CSS/canvas, no downloads):
- Data that really exists: HP, equipped weapon/armor/trinket (item level, 4 rarities), dodge cooldown (1 s), room x/y + foes left, boss HP (phase at 50%). NOT in the game, so not shown: player level, XP, gold, stamina, consumables, materials, legendary rarity (icons/CSS support index 4 anyway). `ui.levelUp(n)` exists but nothing calls it.
- CSS tokens (css/style.css :root): --r0..--r4 rarity (grey/green/blue/purple/orange), --bg --panel --panel2 --edge --inner --hi --accent --good --bad --px --font --tout (text outline) --stepped (stepped pixel border box-shadow: edge ring + inner light edge + bottom shade). Overlays (#inv #menu #title #death) fade via opacity+visibility (.open). Safe-area via env().
- js/icons.js `Game.icons`: get(item,size)→NEW canvas (blit from cache keyed kind|rarity|size; rare+ get a glow); ui(name,size) button icons; kindOf(item) (by base name prefix, else slot); COL rarity colours; GRID pixel tables (12x12 letter grids). Item kinds: sword axe dagger spear leather chain plate ring amulet medal (+cube fallback).
- js/ui.js `Game.ui`: banner(title, sub, kind 'entry'|'clear'|'boss'|'level'|'info') queued, 2.6 s; dungeonName(seed); setRoom(room, foes); setWeapon(item); showDeath(on); titleOpen/hasDeath flags; init() (called last in main.js: decorates touch buttons with icons, death button, title screen). `G.toast(text, color, item?)` now lives here (max 4, item icon).
- combat.js: damage numbers = pool of 12 (`number(x,y,z,v,color,kind)` kind hit|crit|hurt|heal; CSS animates), HP ghost trail + `.low` pulse (<30%), weapon icon refresh on change, dodge sweep via `--cd` on #btn-dodge (quantised, only while cooling), `haptic()` (navigator.vibrate(30) unless settings.vib===false), `respawn()` = old respawn code; with the new UI the death screen waits for the "Hồi sinh" button (or Enter) instead of the 1.6 s auto-respawn.
- menu.js: settings gain `vib` (Rung, default true; old saves fine); pause menu has Tiếp tục / Về màn hình chính. Title screen (Tiếp tục only if `Game.save.has()`, Chơi mới, Cài đặt); new game skips the title once after reload (sessionStorage `bvd-skip`). `G.paused` is kept true while the title is open.
- inventory.js: paper-doll (weapon | hero | trinket, armor below), icon grid with rarity borders, detail sheet with green/red comparison, Trang bị / Vứt bỏ / Tháo, hover preview on desktop, Esc or tap outside closes. Save data unchanged.
- Touch layout (360x640 and 844x390, checked by rect overlap in headless Chromium): top-right row menu/view/bag 48 px, minimap keeps top 152 rule (smaller under 520 px height), bottom-right row attack 80 / jump 64 / dodge 52, interact above (landscape: left of dodge), build break/place 52 px; FPS chip lifted on touch.
VERIFIED (headless Chromium, THREE replaced by a Proxy stub, scripted, 0 page errors): title/continue/new, icons for all kinds×5 rarities, toast cap 4, damage pool 12, inventory open/select/equip/Esc, HP+ghost+low, death screen + respawn button, dodge sweep value, dungeon entry banner, room hud foes, room-cleared and boss-defeated banners, pause menu, no touch-target overlaps and all ≥48 px at both sizes.
UNVERIFIED: real rendering (pixel icon looks, glow, CSS animations, conic sweep, safe areas on real notches, haptics), WebGL scene.

Stage 10 (physics, js/phys.js loaded after rig.js, before player.js; `Game.phys.init()` called from main.js after combat.init):
- Constants (Game.phys): GRAV 28, TERM 35 (terminal fall speed), STEP 1, FALL_V 19 (~7 blocks), FALL_DMG 3 (dmg = (speed-19)*3), DRAG_V 3 / DRAG_H 1.5 (water), BUOY 1.4 (equilibrium ~71% submerged), SWIM_UP 16, DT_MAX 1/20, JUMP_V 9, CELL 2.
- `phys.move(body, dt)`: body {x,y(feet),z,vx,vy,vz,r(half width),h,onGround,inWater,mass, autoStep?, fly?, swimUp?}. Gravity/buoyancy inside; dt clamped, substeps ≤0.45 blocks (max 8); axis-separated (x, z, blockers, y) against `world.solid` (dungeon provider too). autoStep = instant 1-block step-up (player only; adds to `stepDy`). Outputs: wasGround, landV (impact speed this call), splash, wet (0..1 submerged), hitX/hitZ, stepOk (a 1-block step was possible: creatures jump), stepDy. Unsticks one block up. Resting bodies do one support check.
- `phys.nudge(b,dx,dz)` wall-safe displacement; `phys.separate(list, playerBody|null)`: one spatial-hash pass per frame (cell 2, 256 buckets, max 64 bodies), bodies need sr + imass (boss imass 0 = only pushes; creature must have `act` = inside AI range); `phys.blockedAt(x,y,z)` (terrain or decor blocker; used by camera).
- `world.decorBlockers(cx,cz)` → Float32Array stride 5 (x,z,r,y0,y1) or null: trunks r .32 (2.5 high, trees + cactus + dead trees), rocks r .5 (.55 high); built with each chunk, ignored inside dungeons.
- Events: 'landed' {speed} (player, speed>3), 'splash' {x,y,z,speed} (any body entering water, speed>2.5). phys.init listens: dust, 'splash' particles (fx kind 'splash'), audio names 'land'/'splash'; player calls audio 'jump'. Synth recipes in combat.js A.play: jump, land (speed<=14), landhard, splash, splashbig (speed>12), bounce (event 'bounce' {x,z,speed} from items.js, heard within 20 blocks), hitwall (event 'hitwall' {speed} from player, horizontal speed>6, 0.3 s cooldown). No surface-dependent land (no footstep surface lookup exists).
- Player: P.pos IS the body (extra fields vx,vy,vz,...); P.vel = accessors onto it (dungeon.js/menu.js still work). Coyote 0.1 s, jump buffer 0.1 s (held jump still auto-repeats on ground). Fall damage never leaves <1 HP, none in water. Swimming: jump swims up when >45% submerged. `P.knock(ix,iy,iz)` = impulse + 0.22 s reduced control (combat.hurtPlayer uses it; P.kb unused). Camera: critically damped pivot spring (20 / 14), ray against terrain + decor + dungeon walls, instant pull-in, smooth restore, min 0.5, rig hidden under 0.8.
- Creatures (enemies.js): enemy object is the body (e.r = radius*.75, boss .9; e.mass; e.fly for bats = hover, wall collision only). AI `step()` now sets walking velocity (e.wx/e.wz); `drive()` blends it, jumps 1-block steps (8.4) when blocked, flyers follow terrain height. Never walks from land into deep water; wander/idle hops avoid water and drops >2. Knockback = impulse /mass (+pop), `kbT` reduces control; death = bigger impulse, corpse keeps falling until the rig anim ends. Ledge falls: E.hurt with the fall formula (can kill creatures). Slime hop = vy 7.1 impulse. Boss moves through the body (free() still blocks cliffs).
- Projectiles: enemy arrows/spores ballistic (speed 16, gravity 12, low-arc solution, lead 0.55 of player velocity), stick 1 s then shrink; damage/cooldown unchanged. Boss fan shots stay straight (flat telegraph). The player has no projectile weapon (melee only), so nothing to change there.
- Items: `loot.spawnDrop(item,x,z,delay,y?)` pops with impulse (1.2-3 out, 4-6 up), 2 bounces (0.5 damping), settles with bob; floats in water; chest/boss/enemy drops pass a start y.
- fx: `chips(x,y,z,colour,n=24)` InstancedMesh pool of 24 cubes, gravity+bounce, 0.8 s (build break/place use it instead of the points burst); burst kind 'splash'.
VERIFIED (node, Proxy THREE stub, throwaway script not shipped): landing, 15-block fall damage, never-lethal, no damage 4-block, step-up (player and goblin), ledge fall damage, wander avoids cliff, knockback + mass order (slime>goblin>boss), death impulse + removal, slime hop arc, bat hover, splash + float + swim up, floating and bouncing drops, soft separation, coyote jump, arrows; no NaN; full dungeon run (7 rooms + boss, drops) and 1000+ overworld frames with 0 errors.
UNVERIFIED: feel (not tested by hand), rendering of chips/InstancedMesh colours, camera feel, phone perf, audio (no jump/land/splash recipes). Dungeon rooms kept working first: creatures use r=.75*radius so corridors stay passable; no dungeon changes except spawnDrop start y.

Stage 11 (art bible, palette, gallery, validation) — DONE:
- ART.md (English, one page): art direction (flat per-voxel palette colours, 3-6% jitter, no textures), voxel units per category, proportions (head ~1/3), mob size classes S/M/L, budgets, rarity colours, naming, steps to add an asset. Read it before adding any model/item/mob.
- js/palette.js (`Game.palette`, loaded right after assets.js in index.html): ramps are `[shadow, dark, base, light, highlight]` as 0xRRGGBB (base = exact source colour). Groups: skin[6], hair[8], cloth{red orange yellow lime green teal sky blue purple pink brown gray}, metal{iron copper gold steel mythril}, wood, stone, grass{forest plains desert snow swamp jungle}, leaves{same}, water, fire, magic, rarity{common white .. legendary orange}. Helpers: `shade(color|ramp, step 0..4|'shadow'..'highlight')`, `jitter(color, seed)` (deterministic ±3-6% lightness), `list()` (flat entries id/group/ramp/hex), `nearest(color)`, `isOn(color, tol=30)`, `STEP`. Existing game colours were NOT changed (legacy common rarity is still grey #b8b8b8 in UI).
- js/assets.js additions (data formats unchanged): `budgets` {character mob_s mob_m mob_l prop_s prop_l item: {voxels, tris}}; `registry()` → [{id, cat model|mob|prop|item, name, make()→{obj,rig,dispose}, spec?, item?}] read live from player.makeSpec, enemies.types, boss.spec, dungeon.visuals (no-arg functions = props), items.BASES; `stats(entry)` → {voxels, tris, height, width, cls, colors}; `validate()` → {total, counts, missing[], overBudget[], offPalette[], errors[], issues}. Report only, never recolors. items.js now also exports `G.items.BASES` (read-only use).
- Budgets: voxel = one box = 12 tris. character 24/288, mob S 16/192, M 20/240, L 28/336, prop small 40/480, prop large 120/1440, item icon 96 filled cells.
- gallery.html + gallery.js (open next to index.html; static host or file://; loads three + assets, palette, rig, items, icons, player, enemies, boss, dungeon only, not the game): tabs Mô hình / Mob / Prop / Vật phẩm / Bảng màu / Kiểm tra. Tap a card = show it + copy its id; drag = turntable yaw/pitch (auto-spin resumes after 1.5 s; wheel zooms); ☀/🌙 = day/night (sky + multiply tint); "Tỉ lệ" = scale reference (real player rig 1.7 blocks + 1x1x1 wireframe block); ⚠ on cards and info bar when over budget; items show the icon with rarity 1-5 buttons; palette tab: tap a swatch to copy hex; validate tab shows the report (badge = issues).
VERIFIED (node, hand-written THREE stub): all scripts load; registry lists player, 9 mobs + boss, 4 props, 10 items; validate() runs with 0 missing ids, 0 errors; palette helpers; syntax of gallery.js.
UNVERIFIED: gallery rendering/touch/clipboard on real phones, real triangle counts of props (stub geometry), day/night look, index.html game still loads (only a script tag added).

Current rendering direction (2026-10-27; supersedes the earlier Stage 8 block-faced terrain renderer):
- Terrain source: js/legacy-world.js is the only active terrain module. Game.config.legacyTerrain defaults to true. index.html loads js/toon.js and js/legacy-world.js and does not load js/blocks.js or js/world.js; those files were not modified. Existing heightmap, column-edit save key edits, getHeight, getBlock, solid, setColumn, biome and chunk APIs remain available. Added aliases: surfaceHeight(x,z), isSolid(x,y,z), setViewDistance(n), and decorBlockers(cx,cz) (null; legacy vegetation remains visual-only).
- Art direction: smooth stylized 3D heightmap surface, shared edge normals, biome/height/slope vertex colours, sand by the sea, dirt/rock on steep slopes, snow at high elevation, and low-frequency painted variation. Character and mob meshes are unchanged.
- Game.toon (js/toon.js): makeMaterial(color,opts) uses MeshToonMaterial with one shared four-step DataTexture gradient; addOutline(mesh,thickness,color) creates a back-face inverted hull; blobShadow(radius) returns a soft transparent disc. No custom toon shader.
- Sky/light (js/sky.js): gradient dome, sun/moon discs, four drifting cloud sprites and stars; hemisphere light and one directional light. The existing 600-second day cycle warms dawn/dusk and cools night; fog and terrain tint track the cycle. Shadows are off by default; Cao quality enables one 1024 directional map.
- Water (js/legacy-world.js): one semi-transparent local 112 m plane with shallow/deep vertex colours, heightmap-derived shoreline foam, gentle waves and reused geometry/arrays; no render-to-texture or refraction.
- Grass/flowers (js/legacy-world.js): capped InstancedMesh batches (Thấp 300/36, Vừa 650/80, Cao 1050/135), recycled in roughly a 25 m radius and sampled only from grassy flat heightmap columns. The small onBeforeCompile wind hook is skipped in safe mode.
- Quality (js/main.js, js/menu.js, css/style.css): Chất lượng đồ họa offers Thấp/Vừa/Cao and persists in the existing settings save slot. Pixel ratio caps are 1/1.5/2. Phones default to Vừa; old saves without this option use the device default.
- Safe mode: open with ?safe=1. Game.toon.safeMode and Game.safeMode disable the grass wind shader injection, leaving heightmap terrain, water and built-in Three.js materials available.

Owner real-device checklist (five):
1. Terrain colours and smooth chunk seams on meadows, steep hills, beaches, snow/high ground and across biomes.
2. Walk and wade along the water edge; confirm foam follows the shoreline without gaps, visible land flooding or distracting waves.
3. Observe dawn, noon, dusk and night; verify sky, sun/moon, fog, light colour and night visibility transition smoothly.
4. Compare Thấp, Vừa and Cao on the same phone; record FPS, hitching and heat, including the trade-off from High shadows.
5. Load ?safe=1; confirm no injected-shader errors and that terrain, water and gameplay load with static grass.

Stage 12 (offline asset cache correctness; 2026-11-04):
- Service worker cache v12 preserves the `?v=` asset version in cache keys. A changed asset version therefore misses the old cache entry and fetches the new file instead of receiving stale JavaScript/CSS under the same path.
- Successful versioned fetches refresh both the version-specific entry and the canonical unversioned shell entry. If the network is unavailable, the version-specific entry or precached canonical shell remains the offline fallback.
- `index.html` local assets use `20261104-offline-v12`; bump this token when shipping a new local asset set. CDN Three.js remains pinned to r128; do not jump directly to a modern major release without staged migration and browser/GPU regression coverage.


Stage 13 (WebGL context-loss gameplay safety; 2026-11-04):
- The app now listens for `webglcontextlost` on the renderer canvas. It saves the current game state when possible, shows a blocking recovery notice, and skips gameplay updates while the context is unavailable.
- On `webglcontextrestored`, Three.js r128 has already rebuilt its renderer internals; the app resets its frame-time accumulators, hides the notice, and resumes the existing game state. It does not create a second renderer or duplicate the scene.
- The regression suite checks the loss/restore contract and the offline shell cache was bumped to v13 with asset token `20261104-webgl-recovery-v13`.
- Verified in CI: JavaScript parse checks and the repository's headless camera/input suite. Real GPU loss/restore on Android and desktop remains a manual device/browser check.


Stage 14 (input safety on focus loss; 2026-11-04):
- Touch and keyboard controls now clear held movement, jump, look deltas and queued actions when the window blurs, the page is hidden, or pagehide fires. The virtual joystick is visually reset and active touch identifiers are discarded.
- This prevents a missed touchend/touchcancel during app switching from leaving movement or jump stuck when the player returns.
- Regression coverage drives keyboard, joystick and jump input, then verifies blur/visibility reset and queued-action clearing.
- Browser lifecycle behavior follows the Page Visibility API; real-device app-switch testing remains recommended.


Stage 15 (asset ownership and visual-quality foundation; 2026-11-04):
- GLB clones mark mesh geometry/material as borrowed from the cached model template.
- `Game.assets.disposeInstance(root)` skips borrowed GLB resources, disposes only local mesh geometry/material, deduplicates shared local references and is idempotent.
- Dungeon cleanup and gallery prop previews use the shared-safe disposer.
- Bumped service-worker shell cache and versioned local assets to v15 after runtime/style changes.
- UI CSS respects `prefers-reduced-motion` while keeping timed toast/banner feedback visible.
- Refreshed `ART.md` for the current smooth-toon heightmap world with chunky procedural rigs; corrected stale PBR/material guidance in `assets/README.md`.
- Corrected the asset source notes: Quaternius publishes QAL v1.0 (updated 2026-08-28); mirror attribution is not sufficient evidence to label the exact assets CC0. Verify the original package license before shipping.
- Added `QUALITY_ROADMAP.md` spanning UI/UX, animation, models, textures, sound, items, gameplay systems, performance and release QA.
- Verified in GitHub Actions: 26 JavaScript files parsed and 66/66 headless camera/input checks passed. Real GPU-memory trends, visual appearance, audio mix and Android interactions remain manual device checks.


Stage 16 (hidden-page simulation and audio lifecycle; 2026-11-04):
- The render loop now skips simulation and rendering while the document is hidden or in pagehide, and resets frame/FPS/adaptive-quality accumulators on visibility return and pageshow.
- Web Audio suspends when the document becomes hidden/pagehide. On visibility/pageshow return, gesture-unlock listeners are reattached; AudioContext resumes only from a fresh keyboard/mouse/touch/click user gesture, not automatically on foreground.
- Existing save and held-input handlers continue to own their respective visibilitychange/pagehide behavior; no duplicate save timer was introduced.
- Added regression assertions for hidden-loop gating, frame-clock reset, audio suspend/resume policy, BFCache gesture reattachment and v16 offline-cache versioning.
- Real background/foreground behavior, Android Chrome audio policy and BFCache transitions remain manual device/browser checks.


## Stage 17: remove cone-like grass and square particle artifacts
- Root cause from the supplied Android screenshot: the active renderer is `js/legacy-world.js`; ground tufts were five-sided `ConeGeometry` instances, and the grass scan stopped after the first target count while traversing one direction, biasing vegetation to one side.
- Replaced each cone with a three-blade low-poly tuft, changed flower accents to small round buds seated just above the terrain, reduced instance budgets, and sampled the complete nearby grid with a deterministic spatial hash. Grass instance colours now use the meadow/plains or forest palette instead of one bright plains green everywhere.
- `js/fx.js`: added a radial-alpha sprite for point particles so ambient fireflies and gameplay particles render as soft round dots rather than square quads.
- Updated JavaScript regression guards and bumped the offline shell/local asset cache to v17.
- Verification boundary: source-contract checks and CI are required; real GPU appearance still needs a browser/Android playtest. No claim of visual-device verification is made.
