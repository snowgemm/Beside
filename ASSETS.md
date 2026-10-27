# Besidevalley: asset sources and license notes

## Integrated models

The game loads optional environment props over HTTPS from public asset mirrors. If a remote model fails, the procedural fallback remains available.

- **Quaternius Stylized Nature MegaKit (CC0):** [official pack and license](https://quaternius.com/packs/stylizednaturemegakit.html). Three broadleaf tree variants and a bush are GLB files mirrored in [skyline-run](https://github.com/anshaneja5/skyline-run), whose [credits file](https://github.com/anshaneja5/skyline-run/blob/main/CREDITS.md) identifies the tree and bush models as Quaternius CC0 assets.
- **Kenney Nature Kit (CC0):** [official pack](https://kenney.nl/assets/nature-kit) · [Kenney license/support](https://kenney.nl/support) · [public GLB mirror](https://github.com/Hidencod/tge-assets). Used for the pine tree, small rock and mushroom fallback props.
- A small 3D coin model is used for trinket drops, with a rarity-coloured ring. A potion model is cached for later use; it is not currently shown as a gameplay item.

## Free sources for future assets

- [Kenney assets](https://kenney.nl/assets) — environment props, game UI, icons and audio; Kenney packs are generally CC0.
- [Quaternius](https://quaternius.com/) — stylized environment and character packs; verify the specific pack license before shipping.
- [KayKit](https://kaylousberg.com/game-assets) — stylized environments, characters and resources; follow the license on each pack.
- [Poly Haven](https://polyhaven.com/) — CC0 models, HDRIs and PBR textures. [License](https://polyhaven.com/license).
- [ambientCG](https://ambientcg.com/) — CC0 material/texture library.
- [Poly Pizza](https://poly.pizza/) — low-poly models; individual licenses vary, so preserve attribution where the model requires it.

## Integration notes

- Runtime uses Three.js r128 and GLTFLoader. Three textured tree silhouettes are used near the player and a merged low-detail tree mesh is used at distance to limit draw calls. Successfully downloaded GLBs are persisted in IndexedDB; offline-first sessions retain procedural fallback scenery. Imported models preserve their texture data and use rough, non-metallic lit materials.
- Imported scenery props are static. Existing character movement, idle and combat animations stay on the compatible procedural rig; skeletal clips are not applied to an incompatible character rig.
- No paid assets or proprietary game UI are bundled. Check the source page and license of every added asset before publishing.
