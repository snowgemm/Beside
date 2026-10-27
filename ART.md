# Besidevalley: Dungeons — Art Bible

**Direction (decided):** stylized voxels. Flat per-voxel colours from `Game.palette`, no image textures, tiny seeded per-voxel lightness noise (3–6%, `palette.jitter`), soft shading from the existing lighting (rig vertex shading, world `tint`). Cheap on phones, easy to generate by code. Look: Cube World / Veloren.

## Units (1 world unit = 1 terrain block)
| Category | Smallest box | Notes |
|---|---|---|
| Terrain, structures | 1.0 | world blocks, dungeon walls |
| Props (chest, door, gate, portal) | 0.25 snap | large parts may be bigger boxes |
| Characters and mobs | 0.05 snap, ~0.1 typical | a rig "voxel" = one chunky box part |
| Held items / weapon parts | 0.05 | |
| Item icons | 12x12 pixel grid | `Game.icons.GRID` |

## Character proportions
Player 1.7 tall. Head ≈ 1/3 of height (30–36%, wider than the torso), torso ≈ 30%, legs ≈ 30%. Chunky limbs: arm/leg thickness 0.12–0.2 (at least 1/8 of height). Eyes are flat unshaded boxes on the face. Forward is -Z. Mob rigs keep the same big-head, short-limb look.

## Mob size classes
| Class | Height | Examples |
|---|---|---|
| S | ≤ 1.0 | slime, wolf, bat, spider |
| M | 1.0–2.0 | mushroom, goblin, archer, skeleton |
| L | > 2.0 | boss (3.4) |

## Performance budgets (weak phones)
One box = 1 voxel = 12 triangles. Rig trim bands (`color2`) count as boxes. `Game.assets.budgets` holds these numbers; the gallery warns when over.
| Category | Max voxels | Max triangles |
|---|---|---|
| character (player + weapon) | 24 | 288 |
| mob S | 16 | 192 |
| mob M | 20 | 240 |
| mob L | 28 | 336 |
| prop small (≤1.5 high) | 40 | 480 |
| prop large | 120 | 1440 |
| item icon | 96 filled cells | 0 |
| item held 3D | 12 | 144 |

Scene guide: ≤ 20 active mobs (≈ 5k tris), creatures + props ≤ 15k tris, whole frame ≤ 60k tris. Share geometry and materials (rig does); no per-frame allocation.

## Rarity colours
common white `#f2f2f2`, uncommon green `#4ccf4c`, rare blue `#4c8dff`, epic purple `#b24cff`, legendary orange `#ff9a1f` (`Game.palette.rarity`). Legacy: the game UI still draws common as grey `#b8b8b8`.

## Naming
- Ids: lowercase English snake_case (`stone_golem`), same id for registry key, GLB file (`assets/models/<id>.glb`) and manifest entry.
- Items: id = icon kind (`sword`, `plate`, `ring`). Display names stay Vietnamese, in UI only.
- Rig parts: camelCase with side suffix (`legL`, `armR`, `eyeL`, `wingL2`); animation role = name.
- Colours: only from `Game.palette`; never raw hex in new assets (use `palette.shade(ramp, step)`).
- Rarity ids: common, uncommon, rare, epic, legendary.

## Adding a new asset (this codebase)
1. Pick category + budget above; pick colours from `Game.palette` (e.g. `Game.palette.shade(Game.palette.cloth.red, 2)`).
2. **Mob:** add an entry to `TYPES` in `js/enemies.js` with `spec` built by `Game.rig.part(...)` (format in `js/rig.js`), plus `ai`/`proj` if needed and a `loot.sources` entry in `js/items.js`. Optional GLB override: add a line to `MANIFEST.models` in `js/assets.js`.
3. **Prop:** add a no-argument factory `name: function () { return THREE.Group }` to `D.visuals` in `js/dungeon.js` (use `G.assets.model(name)` first, then primitives).
4. **Item:** add a base to `BASES` in `js/items.js`, a pixel grid to `GRID` and its Vietnamese name prefix to `BYNAME` in `js/icons.js`.
5. **Character:** edit `makeSpec` in `js/player.js`.
6. Open `gallery.html`: the asset appears automatically (registry reads the code above). Check counts, then the "Kiểm tra" tab (`Game.assets.validate()`) for budget / off-palette / missing-id reports.
7. Update `STATE.md`.
