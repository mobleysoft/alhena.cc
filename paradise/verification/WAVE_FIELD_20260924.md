# Cove Wave Field: 2026-09-24

## Shipped Source

- Source commit: `fc3ea83286189b74d396e346d47274466697817d`.
- Worker: `alhena-paradise-worker`, Cloudflare account verified as
  `Johnmobley99@gmail.com` before deployment.
- Deployment version: `96f4a889-ff3b-4a51-88d0-c0879fa29f98`.
- Public URL: https://paradise.alhena.cc/
- Used `paradise/safe-deploy.sh`; branch, clean-tree, ASSETS binding,
  nine unit tests and post-deploy HTTP body checks passed.
- Public GET responses for `main.js`, `models.js`, `ocean.js`,
  `ripple-field.js` and `README.md` were HTTP 200 and SHA-256-identical to
  this source commit. The ripple asset uses `max-age=0, must-revalidate`.

## Changes

1. Replaced scripted expanding impact rings with a 128x128 finite-difference
   height/velocity field. WGSL compute and the CPU fallback implement the
   same damped wave equation. Casts, twitches, nibbles and strikes inject
   momentum; waves propagate, reflect against dry cells, and dissipate.
2. The last published field is used by both the render texture and spring
   bobber buoyancy. One pending readback, four queued steps and eight queued
   impulses bound work and memory. Initialization carries forward the latest
   CPU state. Shader compilation errors retain line-level diagnostics; GPU
   failures fall back to the last published state rather than losing play.
3. Replaced two overlapping ocean meshes with one stitched, variable-density
   surface. Screenshot review found and removed the former patch-edge cracks.
4. Retained the exact 32 legacy PandoraChat spectrum components. Added four
   small wind waves with gravity-capillary dispersion to the shared surface
   and buoyancy function, not a separate painted normal/caustic animation.
5. Refracted a grid of sunlight rays through that surface onto the seabed.
   Area contraction determines a 768x768 caustic texture at 30 Hz. This
   replaces the old sine-net caustic pattern. Existing clay/vinyl models,
   procedural sky, reflection/refraction, DOF and fishing controls remain.

## Verified Evidence

- `node --test scripts/test-cove.mjs`: nine passing tests, including wave
  stability, propagation, damping, dry land, legacy spectrum, small-wave
  dispersion, journal migration/storage failures and fish distribution.
- `fluid-current/report.json`: local WGSL/CPU comparison and cast/fallback
  verification passed. This verifier exposed a reserved WGSL identifier in
  the first build; that failure was fixed before deployment.
- `wave-field-live-physics-20260924/report.json`: the public GPU computation
  actually executed. Across 94 integration steps (including a three-step
  catch-up batch), maximum GPU/CPU height error was
  `4.76837158203125e-7`. Casts produced a nonzero physical field. Explicit
  `?fluid=cpu` also produced the expected nonzero field with no errors.
- Live caustic-buffer readback had 102,155 samples brighter than 1.1 and a
  maximum concentration of 31.265625, confirming the pass focuses light
  rather than merely claiming a caustics feature in metadata.
- `wave-field-local-chromium-20260924/report.json` and
  `wave-field-local-webkit-20260924/report.json`: both passed cast, strike,
  tension fight, catch, reload persistence, night/storm, touch journal and
  portrait/landscape checks, each with nine screenshots and no errors.
- `wave-field-live-chromium-20260924/report.json`: the same public gameplay
  checks passed. Observed 60 FPS on the Apple M4 test host; mean sampled
  bobber/surface error was 0.07184 scene units.
- `wave-field-live-webkit-20260924/report.json`: all public gameplay and
  portrait/landscape checks passed with nine screenshots and no errors.
  Observed 60 FPS and a 0.06416 scene-unit mean bobber/surface error on this
  Mac. Both browser engines actually selected the WebGPU compute backend.

Visual review included landing, fishing, strike, night/storm and mobile
frames. The photo cutouts are absent; the miniature scene is consistent.
The new refraction-based caustics move with actual surface curvature. This
is a substantial architecture improvement, not a claim of AAA parity.

## Remaining Work Against the Requested Target

- Three.js still renders with WebGL2. Only the local ripple integration is
  WebGPU compute; a full WebGPURenderer/WGSL rendering migration is not done.
- This is a 2D height field with a static shoreline mask, not 3D Navier-Stokes
  water or overturning/breaking surf. Shoreline foam remains shader-driven.
- Caustic seabed intersections use two height estimates. Submerged-object
  light occlusion and volumetric underwater shafts are not implemented.
- Bobber coupling is one-way after discrete impact forces. It is not a
  fully coupled rigid-body/fluid solver. Fishing line uses the existing CPU
  Verlet constraints, not GPU rope physics.
- The dog has jointed legs, but its gait is still sinusoidal and can slide.
  Foot planting and more expressive Alhena poses are concrete next art tasks.
- The fight still uses a screen-space status panel; the requested fully
  diegetic presentation and more tactile audio/splash response need polish.
- Deep Water paid entitlements, ad removal, and boss-fish gating are not
  implemented. Nothing in this release charges money or claims otherwise.
- Mobile browser emulation does not prove real-device frame rate, haptics
  or motion permission behavior. Actual phone testing remains necessary.

The broader Paradise quality goal remains active.
