# Besidevalley: asset sources and license notes

## Current integrated sources

The runtime's checked-in `assets/models/` and `assets/sfx/` folders currently contain only `.gitkeep` placeholders. The game can load optional local GLBs/audio files, while selected environment models are fetched from public mirrors and cached in IndexedDB. Procedural scenery and synthesized sound remain fallbacks.

- **Kenney Nature Kit / Mini Dungeon:** the repository maps the pine, small rock, mushroom prop, coin and potion models to a public GLB mirror. Kenney's official support page says assets on its asset pages are CC0; verify the exact pack's included license before shipping a copy. [Kenney support](https://kenney.nl/support).
- **Quaternius Stylized Nature MegaKit:** the mirror's credits file attributes broadleaf tree variants and a bush to Quaternius. Do not label these files CC0 without the original pack's license evidence. Quaternius currently publishes **Quaternius Asset License (QAL) v1.0**, last updated 2026-08-28. It permits incorporation into personal, educational and commercial products, but prohibits redistributing the assets themselves as standalone assets. Check the license that accompanied the exact source download before relying on an older CC0 claim. [Current Quaternius license](https://quaternius.com/license.html).

## Sources suitable for future review

- [Kenney assets](https://kenney.nl/assets) — UI, environment, props and audio packs; official support describes asset-page releases as CC0.
- [Quaternius](https://quaternius.com/) — stylized models and animations; verify QAL or the exact pack license.
- [Poly Haven](https://polyhaven.com/) — CC0 models, HDRIs and PBR textures. [License](https://polyhaven.com/license).
- [ambientCG](https://ambientcg.com/) — CC0 PBR materials and scans; verify the current source-page terms for each download.
- [Poly Pizza](https://poly.pizza/) — individual asset licenses vary; preserve required attribution.

## Integration and supply-chain rules

- Runtime uses Three.js r128 and the matching `GLTFLoader`. Keep that version pinned until a dedicated engine migration includes loader, renderer, mobile-GPU and offline-cache tests.
- Remote models currently use mutable Git branch URLs. Before a release that depends on a remote asset, pin its source to an immutable commit or vendor a verified package with provenance and hashes.
- Inspect GLB dimensions, orientation, node hierarchy, materials, textures and triangle counts before integration. File extension and mirror credits alone are not verification.
- Preserve source PBR textures; do not replace them with unlit materials. The runtime currently tunes imported Standard materials toward rough, non-metallic surfaces.
- Imported environment props are static. Existing character animation remains procedural.
- Do not add paid or provider-generated assets without a separately approved exact request and spend limit. Do not redistribute an asset pack as a standalone asset collection.
