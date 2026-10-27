# Besidevalley assets (all optional)

Drop files here; missing files fall back to built-in primitives / synth sounds. No code changes needed.
Models: binary glTF (`.glb`) in `assets/models/`. Models are auto-fitted (centred on x/z, feet at y=0, scaled to the height below).
Sounds: any ONE of `.ogg` / `.mp3` / `.wav` in `assets/sfx/` (tried in that order).
Optional node names inside a model: `lid` (chest lid, rotated open). Characters should face +Z (glTF default). Materials are converted to unlit.
Pack names are suggestions from memory; check the pack still exists and is CC0 before downloading (kenney.nl, quaternius.com).

## Models (`assets/models/<file>`)
| Name | File | Height | Suggested CC0 pack |
|---|---|---|---|
| gate | gate.glb | 6 | Kenney Castle Kit (gate/archway) |
| door | door.glb | 5 | Kenney Castle Kit / Quaternius modular dungeon (door; width along its X axis) |
| chest | chest.glb | 0.9 | Quaternius Ultimate Fantasy RPG / Kenney Pirate Kit (chest) |
| portal | portal.glb | 3 | Quaternius Ultimate Fantasy RPG (portal/obelisk) or Kenney Graveyard Kit |
| boss | boss.glb | 3.4 | Quaternius Ultimate Monsters (golem/ogre) |
| slime | slime.glb | 0.9 | Quaternius Ultimate Monsters (blob) |
| goblin | goblin.glb | 1.5 | Quaternius Ultimate Monsters (goblin) |
| archer | archer.glb | 1.6 | Quaternius Ultimate Modular Men / Kenney Blocky Characters |

Static meshes only (no skeletal animation).

## Sounds (`assets/sfx/<name>.ogg|mp3|wav`)
| Name | Played when | Suggested CC0 pack |
|---|---|---|
| door | room door opens/closes | Kenney Impact Sounds / RPG Audio |
| chest | chest opens | Kenney RPG Audio |
| boss | boss spawns | Kenney Sci-fi Sounds / Impact Sounds (low rumble) |
| hit | enemy hit | Kenney Impact Sounds |
| swing | weapon swing, arrows | Kenney RPG Audio |
| death | enemy/player death | Kenney Digital Audio / Impact Sounds |
| pickup | loot picked up | Kenney Interface Sounds |
| equip | item equipped | Kenney RPG Audio |

Stage 7 mobs (optional GLB overrides, same rules as above): wolf.glb (height 1), skeleton.glb (1.7), bat.glb (0.9), spider.glb (0.8), mushroom.glb (1.3). Without a file the code-built rig is used.
