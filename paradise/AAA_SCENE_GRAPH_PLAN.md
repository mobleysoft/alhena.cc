# Paradise AAA Scene-Graph Plan

## Diagnosis

The current `/` Paradise experience is a 2D canvas painting with one raster dog sprite. It cannot become photorealistic or AAA-like by incremental ornamentation because it lacks the core properties AAA scenes depend on:

- Real camera perspective
- 3D geometry and scale
- Physically plausible lighting
- Shadow casting and occlusion
- Material separation for sand, water, wood, skin, cloth, fur, glass, and foam
- Rigged characters and animals
- Asset pipeline for replacing placeholders with authored models

## Current Pivot

`/aaa/` is the new experimental base. It is intentionally not promoted to `/` yet.

It currently proves:

- Three.js scene graph loads on Cloudflare Assets
- Perspective camera works
- Shader-displaced ocean plane renders
- Shore, bar, house, character, dog, bobber, and line exist as replaceable scene nodes
- Keyboard, pointer-look, and cast input work

It does not yet prove AAA quality. It proves the architecture required to pursue it.

## Next Required Asset Classes

1. Ocean
   - Replace simple shader with Gerstner/JONSWAP wave stack.
   - Add screen-space reflection approximation.
   - Add foam texture atlas and shoreline wetness mask.

2. Shore
   - Replace flat plane with sculpted dune/shore mesh.
   - Add PBR sand material, shells, pebbles, footprints, and beach debris as instanced geometry.

3. Alhena
   - Replace capsule placeholder with a rigged humanoid model.
   - Use modest beach bartender wardrobe.
   - Support selectable face/hair variants later.

4. Black lab
   - Replace sprite with rigged dog model.
   - Add idle, walk, sniff, sit, tail-wag, look-at-player animations.

5. Bar and beach house
   - Replace boxes with modeled bamboo/wood structures.
   - Add material maps for roughness, normal, and ambient occlusion.

## Promotion Rule

Do not replace `/` with `/aaa/` until:

- `/aaa/` visually exceeds the current 2D version in screenshots.
- No console/runtime errors occur.
- Mobile landscape loads at acceptable frame rate.
- The dog and Alhena no longer read as placeholders.

