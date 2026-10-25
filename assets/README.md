# Optional game assets

The game works without downloaded assets: it falls back to primitive meshes and synthesized sounds.

## 3D models
Place optional GLB files in `assets/models/`:

| File | Purpose | Target height |
|---|---|---:|
| `gate.glb` | Overworld dungeon gate | 6 |
| `door.glb` | Dungeon doors | 5 |
| `chest.glb` | Treasure chest; optional node named `lid` | 0.9 |
| `portal.glb` | Exit portal | 3 |
| `boss.glb` | Dungeon boss | 3.4 |
| `slime.glb` | Slime enemy | 0.9 |
| `goblin.glb` | Goblin enemy | 1.5 |
| `archer.glb` | Archer enemy | 1.6 |

Models are auto-scaled to the target height and centred on X/Z with their feet at Y=0. Character models receive a 180° yaw correction by default; door models receive 90°.

## Sound effects
Optional `ogg`, `mp3`, or `wav` files belong in `assets/sfx/`: `door`, `chest`, `boss`, `hit`, `swing`, `death`, `pickup`, `equip`, `place`, and `break`. The first file that loads for each sound is used. Audio decoding starts after the browser's first user gesture.

## Notes
- Keep filenames exactly as listed in `js/assets.js`.
- Do not commit copyrighted models or audio unless their license permits redistribution.
- Missing or invalid files are ignored; fallback visuals and synthesized sounds remain available.
