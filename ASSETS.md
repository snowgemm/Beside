# Besidevalley: asset sources and license notes

## Integrated models

The game loads compact environment props over HTTPS from a public mirror of Kenney's asset packs. These are optional: if a remote model fails to load, the built-in procedural scenery remains available.

- **Nature Kit (CC0):** [official pack](https://kenney.nl/assets/nature-kit) · [Kenney license/support](https://kenney.nl/support) · [public GLB mirror](https://github.com/Hidencod/tge-assets)
- Integrated environment props: broadleaf tree, pine, bush, small rock and mushroom.
- A small 3D coin model is used for trinket loot drops, with a rarity-coloured ring. A potion model is cached for later use; it is not currently shown as a gameplay item.

## Free sources for future assets

- [Kenney assets](https://kenney.nl/assets) — environment props, game UI, icons and audio; Kenney packs are generally CC0.
- [Quaternius](https://quaternius.com/) — stylized environment and character packs; verify the specific pack license before shipping.
- [KayKit](https://kaylousberg.com/game-assets) — stylized environments, characters and resources; follow the license on each pack.
- [Poly Haven](https://polyhaven.com/) — CC0 models, HDRIs and PBR textures. [License](https://polyhaven.com/license).
- [ambientCG](https://ambientcg.com/) — CC0 material/texture library.
- [Poly Pizza](https://poly.pizza/) — low-poly models; individual licenses vary, so preserve attribution where the model requires it.

## Integration notes

- Runtime uses Three.js r128 and GLTFLoader. Models are fitted to target heights and their materials are converted to a lightweight unlit material, keeping the stylized palette and avoiding added real-time texture/shader costs.
- Imported scenery props are static. Existing character movement, idle and combat animations stay on the compatible procedural rig; skeletal clips are not applied to an incompatible character rig.
- No paid assets or proprietary game UI are bundled. Check the source page and license of every added asset before publishing.
