# GLB asset audit — Stage 22

**Source commit:** `cea0dc059923ff1c06d74db74ce2b2502221c0e3` (Stage 21 pinned model sources)  
**Audit method:** parse the exact eight pinned GLB v2 binaries, verify each Git blob SHA-1 and byte size, inspect glTF accessors/primitives/materials/embedded images, and estimate decoded RGBA8 texture storage with a full mip chain.  
**Verification boundary:** the binary/topology results are static source measurements. Texture memory is an estimate, not an actual GPU/driver measurement.

## Aggregate results

| Metric | Result |
| --- | ---: |
| Pinned GLB files verified | 8/8 |
| Combined download size | 1,453,332 bytes (1.386 MiB) |
| Triangle count (all eight assets) | 17,241 |
| Vertex count | 26,202 |
| Mesh primitives / materials | 14 / 14 |
| Embedded images / glTF textures | 11 / 11 |
| Distinct embedded image byte payloads | 5 |
| RGBA8 texture memory, including full mip chain | 4.667 MiB |
| RGBA8 estimate if identical images were shared across model templates | 2.667 MiB |
| Potential cross-template texture saving | 2,097,153 bytes (about 2.000 MiB) |

The total triangle count is an asset catalog total, not a frame draw count. The runtime loads model templates separately, then clones each template for instances. Distant trees are replaced by merged procedural chunk geometry; imported tree models are used only within a 42-world-unit radius. Chunk decor is capped at 40 items and 18 trees per chunk.

## Per-model metrics

| Runtime key | Download bytes | Vertices | Triangles | Primitives | Materials | Embedded texture sizes | RGBA8 + mip estimate |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| `tree` | 516,044 | 9,450 | 6,257 | 2 | 2 | 3 × 256×256 WebP | 1.000 MiB |
| `tree2` | 446,732 | 8,085 | 5,625 | 2 | 2 | 3 × 256×256 WebP | 1.000 MiB |
| `tree3` | 332,440 | 5,899 | 4,065 | 2 | 2 | 3 × 256×256 WebP | 1.000 MiB |
| `bush` | 108,520 | 1,800 | 900 | 1 | 1 | 1 × 256×256 WebP | 0.333 MiB |
| `pine` | 7,200 | 272 | 78 | 2 | 2 | None | 0 MiB |
| `rock` | 3,044 | 60 | 16 | 2 | 2 | None | 0 MiB |
| `mushroomProp` | 6,364 | 244 | 48 | 2 | 2 | None | 0 MiB |
| `coin` | 32,988 | 392 | 252 | 1 | 1 | 1 × 512×512 PNG | 1.333 MiB |

All assets are static: no skins or embedded animations were found. The tree/bush assets use alpha-masked, double-sided foliage materials; the coin material is also double-sided. Kenney pine, rock and mushroom models declare `KHR_materials_unlit`.

## Duplicate image findings

The three broadleaf tree GLBs contain the same three embedded WebP images byte-for-byte:

- Bark normal / material map — 4,226 encoded bytes, 256×256.
- Bark color map — 3,034 encoded bytes, 256×256.
- Leaf color map — 14,698 encoded bytes, 256×256.

The three images are repeated in all three tree variants. Bush and coin each use one additional unique image. Across all models this is 11 embedded image records but only 5 distinct byte payloads. Total encoded image payload is 91,800 bytes; unique payload bytes are 47,884 (43,916 duplicate bytes).

Because each model key is parsed into its own GLTF template, these identical tree textures are not currently shared between the `tree`, `tree2` and `tree3` templates. A future shared-texture pool could reduce the estimated tree texture allocation by about 2 MiB. That change must preserve color space, sampler settings, alpha behavior and texture ownership; it is not included in this audit PR.

## Compatibility notes

- The four Quaternius broadleaf/bush models declare `EXT_texture_webp` as required. Three.js r128's GLTFLoader implements this extension and probes browser WebP decoding; if the browser cannot decode WebP, the required-extension path fails and the game uses its existing procedural scenery fallback.
- No required Draco, KTX2/BasisU or Meshopt decoder extensions were found.
- The coin image is 512×512 PNG. All other embedded images are 256×256 WebP.
- RGBA8+mipmap estimates assume 4 bytes per decoded pixel and a full mip chain (approximately 4/3 of base-level storage). Actual WebGL storage, browser decoded-image memory, driver allocations, mipmap availability, and sharing behavior can differ.

## Recommended follow-up

1. Prototype cross-template sharing for the three identical tree textures; verify texture sampler, color-space, alpha and disposal ownership before adopting it.
2. Review the 6,257-triangle tree and 5,625-triangle tree2 models against a real Android frame capture before deciding whether to author lower-detail variants.
3. Keep the current far-distance procedural tree path; do not replace it with more GLB instances.
4. Do not downscale the 256×256 / 512×512 textures without a visual comparison at the actual game camera distance.

## Automated report

The audit script exports `asset-audit-report.json` and the workflow uploads it as the `beside-glb-audit` Actions artifact (30-day retention). It repeats source hash/size verification on every run.

The audit does not measure live renderer draw calls, overdraw, GPU memory, frame time, or Android appearance. Those remain separate device/profile checks.
