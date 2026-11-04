# Besidevalley: asset sources and license notes

## Current integrated sources

The runtime's checked-in `assets/models/` and `assets/sfx/` folders currently contain only `.gitkeep` placeholders. The game can load optional local GLBs/audio files, while selected environment models are fetched from public mirrors and cached in IndexedDB. Procedural scenery and synthesized sound remain fallbacks.

- **Kenney Nature Kit / Mini Dungeon:** the pinned mirror is `Hidencod/tge-assets` at commit `ea2f2aa1ca8da0898330c97df8a5489976b051d0`. Its root license says the models are Kenney-authored and CC0 1.0; the official [Nature Kit page](https://kenney.nl/assets/nature-kit) and [Mini Dungeon pack page](https://kenney-assets.itch.io/mini-dungeon) identify the respective packs as CC0 1.0.
- **Quaternius Stylized Nature MegaKit:** the pinned mirror is `anshaneja5/skyline-run` at commit `0c41526d8d4130c37c15e219c2c3737fa8cb4ad8`; its credits attribute the broadleaf trees and bush to this pack. The official [Stylized Nature MegaKit page](https://quaternius.com/packs/stylizednaturemegakit) labels this exact pack CC0 1.0. The mirror's `public/assets/models/LICENSE-quaternius.txt` is for **Downtown City MegaKit**, not Stylized Nature, so it is not used as license evidence for these nature assets.

## Sources suitable for future review

- [Kenney assets](https://kenney.nl/assets) — UI, environment, props and audio packs; official support describes asset-page releases as CC0.
- [Quaternius](https://quaternius.com/) — stylized models and animations; verify QAL or the exact pack license.
- [Poly Haven](https://polyhaven.com/) — CC0 models, HDRIs and PBR textures. [License](https://polyhaven.com/license).
- [ambientCG](https://ambientcg.com/) — CC0 PBR materials and scans; verify the current source-page terms for each download.
- [Poly Pizza](https://poly.pizza/) — individual asset licenses vary; preserve required attribution.

## Integration and supply-chain rules

- Runtime uses Three.js r128 and the matching `GLTFLoader`. Keep that version pinned until a dedicated engine migration includes loader, renderer, mobile-GPU and offline-cache tests.
- Remote models now use immutable Git commit URLs. Their source revision, exact blob IDs, file sizes and pack-specific license evidence are recorded below.
- Inspect GLB dimensions, orientation, node hierarchy, materials, textures and triangle counts before integration. File extension and mirror credits alone are not verification.
- Preserve source PBR textures; do not replace them with unlit materials. The runtime currently tunes imported Standard materials toward rough, non-metallic surfaces.
- Imported environment props are static. Existing character animation remains procedural.
- Do not add paid or provider-generated assets without a separately approved exact request and spend limit. Do not redistribute an asset pack as a standalone asset collection.


## Stage 21: immutable remote model sources

| Runtime key | Exact pack | Pinned source path | Source Git blob | Bytes |
| --- | --- | --- | --- | ---: |
| `tree` | Quaternius Stylized Nature MegaKit | `public/assets/models/tree1.glb` | `80bd662cc51f983986f4e201463dc3a729a6cd4a` | 516,044 |
| `tree2` | Quaternius Stylized Nature MegaKit | `public/assets/models/tree2.glb` | `0197de65879eb650247c8d56ac52da34489938cb` | 446,732 |
| `tree3` | Quaternius Stylized Nature MegaKit | `public/assets/models/tree3.glb` | `828786b4bdb5224a8b3672f5e5d6cebe1c65bd93` | 332,440 |
| `bush` | Quaternius Stylized Nature MegaKit | `public/assets/models/bush.glb` | `84b4153c17e988a658e56d4093b0028d1b034c3f` | 108,520 |
| `pine` | Kenney Nature Kit | `packs/nature-kit/tree-pinetalla.glb` | `b064580b04a93cea7cbb76f83dd880a55f530fed` | 7,200 |
| `rock` | Kenney Nature Kit | `packs/nature-kit/rock-smalla.glb` | `b23471253cfafcca5916ffddb79853eca7433195` | 3,044 |
| `mushroomProp` | Kenney Nature Kit | `packs/nature-kit/mushroom-red.glb` | `3420847cd67ed2403a40c78fcacf8b57f8e6c20c` | 6,364 |
| `coin` | Kenney Mini Dungeon | `packs/mini-dungeon/coin.glb` | `5d0ff9df2d53956151b1adefc0d0a99ce549fdd6` | 32,988 |

The pinned GLB set is 1,453,332 bytes (about 1.39 MiB) before decoding textures or renderer allocations. This is transfer size, not GPU memory. The previously declared potion model had no runtime call site and has been removed from the manifest (23,720 bytes no longer requested).

A previous IndexedDB entry stored under a mutable `main` URL is reused only after Web Crypto verifies its exact Git blob SHA-1, including Git's `blob <size>\\0` header. A mismatch is ignored; the loader fetches the immutable URL or keeps the procedural fallback.


## Binary audit

See [ASSET_AUDIT.md](ASSET_AUDIT.md) for measured GLB topology, embedded texture dimensions, exact duplicate image payloads, RGBA8+mipmap estimates and the runtime verification boundary.


## Shared broadleaf textures

Stage 23 pools the three SHA-256-verified 256×256 WebP texture payloads across the `tree`, `tree2` and `tree3` GLTF templates. The pool requires matching texture JSON, sampler, image MIME/name and material slot. Materials and geometry are not shared by this feature. A replaced duplicate Texture is disposed once only after a scan confirms it is no longer referenced by any material in the parsed root. See `ASSET_AUDIT.md` for the source hashes and memory estimate.
