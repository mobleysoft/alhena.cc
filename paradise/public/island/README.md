# Unified Cove

One real Three.js scene, one camera and one canvas. No photo cutouts, hidden
PlayCanvas iframe, or independent background renderer.

- `models.js`: rounded clay/vinyl miniatures, articulated dog and Alhena,
  seabed, cottage, bar, jetty, palms, lighting props, clickable promotion board.
- `foliage.js`: deterministic, closed folded palm leaflets with vertex-color
  gradients, shared frond geometry and tapered curved trunks. Growth rings
  follow the trunk surface instead of floating as separate cylinders. These
  are authored miniature meshes, not downloaded photo cutouts or simulation.
- `coastal-garden.js`: asymmetric weathered-stone clusters and folded coastal
  rosettes replacing the ring of sphere props. Geometry variants and two shared
  materials are merged by the existing static batching path; planting stays
  above the waterline and clears the jetty and dog circuit.
- `locomotion.js`: terrain-aware quadruped controller and two-bone IK.
  Planted paws retain world-space positions; only one paw swings at a time.
  Turn speed, foot urgency and a small body crouch keep targets reachable.
  The dog pauses to watch strikes, then resumes after a catch; Alhena blinks
  and acknowledges catches with a short wave. This is procedural kinematic
  animation, not a rigid-body animal simulation or a skinned-mesh asset.
- `ocean.js`: the legacy PandoraChat 32-component JONSWAP spectrum, finite
  difference normals, displaced geometry, reflection/refraction render passes,
  absorption by depth and shoreline foam. A continuous variable-density mesh
  resolves the fishing area without seams. Four small gravity-capillary wind
  waves supplement (not replace) the original 32-component swell.
  A sunlight-ray grid refracts through this same height field onto the seabed;
  projected area contraction determines caustic brightness. This replaces the
  former painted sine-net caustics.
- `ripple-field.js`: a 128x128 finite-difference height/velocity simulation on
  WebGPU compute, with the same integrator as a CPU fallback. Casts, nibbles,
  twitches and strikes inject momentum. Wet/dry masking reflects waves at the
  shore; absorbing outer cells damp the computational boundary. The published
  field feeds both the visible surface and spring-bobber buoyancy. One pending
  GPU readback and at most four queued steps bound resource use. The CPU path
  can be checked explicitly with `?fluid=cpu`.
- `rain.js`: bounded wind-slanted streaks and instanced contact rings. Contacts
  are sampled against the current ocean and terrain; rings follow the water
  tangent, fade with the storm, and are disabled with reduced motion. This is
  decorative surface detail, not fluid forcing or a volumetric rain solver.
- `main.js`: procedural sky, day/weather lighting, depth-buffer lens blur,
  fixed-step spring buoyancy and Verlet line, three-phase fishing, touch,
  optional device-motion and vibration support. Motion/haptics depend on the
  browser and device; desktop browser emulation does not prove phone hardware.
- `catalog.js`: weather/time-sensitive catches and non-destructive import of
  the earlier canvas edition's local catch counts.

Renderer: Three.js WebGL2; ripple computation: WebGPU where available. This
is not yet a Three.js WebGPURenderer migration. The caustic pass approximates
seabed intersection twice and does not trace submerged-object occlusion.
The height field is not a full 3D fluid solver: overturning/breaking waves,
volumetric underwater lighting, two-way rigid-body fluid coupling, and a
commercial Deep Water entitlement flow remain unimplemented.

Third-party source: Three.js 0.164.1 and its BufferGeometryUtils, vendored from
the official npm distribution. See `vendor/THREE-LICENSE.txt` (MIT). Scene
geometry and materials are authored in code. Google Fonts is optional;
the CSS has local fallback fonts. No model/image-generation API is called.

Verification: `node paradise/scripts/test-cove.mjs` and
`node paradise/scripts/verify-cove.mjs` from the repository root. The latter
requires Playwright (`PLAYWRIGHT_MODULE` can point at an existing installation),
accepts `PARADISE_URL`, and writes screenshots plus a JSON report to
`PARADISE_REPORT_DIR`. It drives actual UI, not gameplay mutation hooks.

`node paradise/scripts/verify-fluid.mjs` separately requires real WebGPU on
the test host, compares WGSL against CPU integration (including queued steps),
reads the rendered caustic buffer, exercises casts, and checks forced CPU
fallback. A compiling shader or a backend label alone does not pass this test.

`node paradise/scripts/verify-actors.mjs` measures actual rendered paw
positions against IK and terrain over 22 seconds, including stance slip,
reach, three-foot contact, walking/sniffing states and reduced motion. It
supports `PARADISE_BROWSER=webkit` as well as Chromium.

Rain verification: `node --test paradise/scripts/test-rain.mjs` and
`node paradise/scripts/verify-rain.mjs` (same Playwright environment variables).
The latter checks desktop/mobile, moonlight, storm-to-calm transitions and
reduced motion.
