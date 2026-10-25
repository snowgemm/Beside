# Besidevalley: Dungeons — STATE

Files: index.html, css/style.css, js/world.js, js/player.js, js/input.js, js/main.js

APIs (global `Game`):
- world: init(scene), getHeight(x,z), getBlock(x,y,z), solid(x,y,z), update(px,pz,ms), preload, setDrawDistance, findSpawn, chunkCount
- player: init(scene,cam,spawn), update(dt), pos/vel/yaw/pitch/third, respawn
- input: init(canvas), poll(), moveX/moveZ/jump/lookDX/lookDY/viewToggle, isTouch
- main: renderer, loop, HUD, adaptive draw distance

Done: stage 1 (terrain streaming, player, camera, input, HUD).

Next: stage 2 combat/enemies as new files (enemies.js, combat.js); hook into main loop; reuse world.getBlock/solid for collisions.