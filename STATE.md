# Besidevalley: Dungeons — STATE

Files: index.html, css/style.css, js/{world,player,input,combat,enemies,main}.js

APIs (global `Game`):
- world: getHeight, getBlock, solid, update, preload, setDrawDistance, findSpawn, onChunkLoad/onChunkUnload hooks
- player: init, update, respawn; health, weapon{damage,reach,cooldown}, rollT, kb, shake
- input: poll(); moveX/moveZ/jump/look*/viewToggle/attackQ/dodgeQ
- combat: attack, dodge, hurtPlayer, number, update; Game.audio.play; Game.events
- enemies: list, types, hurt(e,dmg,kx,kz), update

Completed: terrain generation and chunk streaming; first/third-person player movement; touch controls; melee attacks, dodge roll, generated sound effects, health UI, damage numbers, respawn; three enemy types (slime, goblin, archer), enemy AI, telegraphed attacks, archer projectiles, health bars and enemyDied event.

Next: loot/inventory/save — listen to `enemyDied`, add drops and weapon upgrades, then persist player progress.
