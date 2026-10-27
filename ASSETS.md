# Besidevalley: asset sources and license notes

## Integrated models

The game loads compact environment props over HTTPS from a public mirror of Kenney's asset packs. These are optional: if a remote model fails to load, the built-in procedural scenery remains available.

- **Nature Kit (CC0):** [official pack](https://kenney.nl/assets/nature-kit) · [Kenney license/support](https://kenney.nl/support) · [public GLB mirror](https://github.com/Hidencod/tge-assets)
- Current integrated props: broadleaf tree, pine, bush, small rock and mushroom.
- Other GLBs in the same mirror (coin and potion) are listed as available item-art resources, but are not substituted for equipment: the game's loot generator currently creates weapons, armor and trinkets.

## Free sources for future assets

- [Kenney assets](https://kenney.nl/assets) — environment props, game UI, icons and audio; Kenney packs are generally CC0.
- [Quaternius](https://quaternius.com/) — stylized environment and character packs; verify the specific pack license before shipping.
- [KayKit](https://kaylousberg.com/game-assets) — stylized environments, characters and resources; follow the license on each pack.
- [Poly Haven](https://polyhaven.com/) — CC0 models, HDRIs and PBR textures. [License](https://polyhaven.com/license).
- [ambientCG](https://ambientcg.com/) — CC0 material/texture library.
- [Poly Pizza](https://poly.pizza/) — low-poly models; individual licenses vary, so preserve attribution where the model requires it.

## Integration notes

- Runtime uses Three.js r128 and GLTFLoader. Models are fitted to target heights and their materials are converted to a lightweight unlit material, keeping the stylized palette and avoiding added real-time texture/shader costs.
- Imported scene props are static. Character movement and combat animations remain the existing procedural rig animations; no third-party skeleton/animation pack is silently applied to an incompatible rig.
- No paid assets or proprietary game UI are bundled. Check the source page and license of every added asset before publishing.
