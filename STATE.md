# Besidevalley: Dungeons — STATE

Files: index.html, css/style.css, js/{save,world,player,input,combat,enemies,items,inventory,main}.js

APIs (global `Game`):
- world: getHeight, getBlock, solid, seed, chunk hooks
- player: equip, recalc(), weapon, dr, crit, speedMult
- input: attackQ/dodgeQ/invToggle
- combat: attack, dodge, hurtPlayer (armor mitigation), number; audio.play(name); events
- enemies: TYPES, list, hurt
- items: generate, valid, STAT/RARITIES; loot: roll(level, source, seed), spawnDrop, levelAt, sources
- inventory: slots, add, equip, drop; toast(text,color)
- save: register(key, ser, des), request, saveNow, newGame

Done: stages 1–3. Three enemy types, melee combat, critical hits, armor mitigation, rarity-based equipment, loot drops, inventory/equipment UI, touch controls and local save. Inventory overlay pauses simulation.

Next: stage 4 room dungeons; chests should call loot.roll and dungeon state should be registered with save.
