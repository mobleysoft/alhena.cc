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
- `fish.js`: eight authored miniature species with shaped closed hulls,
  rounded fins, gill/stripe/spot vertex colors and inset eyes. Each fish is one
  skinned mesh with six bones; a traveling body/tail bend and pectoral flutter
  replace the rigid cone tail. Fourteen fish share eight cached geometries and
  one material. These are stylized interpretations, not scanned anatomy or
  hydrodynamic swimming. Existing school paths and weighted catches are
  unchanged; the visible fish do not determine which species is caught.
- `locomotion.js`: terrain-aware quadruped controller and two-bone IK.
  Planted paws retain world-space positions; only one paw swings at a time.
  Turn speed, foot urgency and a small body crouch keep targets reachable.
  The dog pauses to watch strikes, then resumes after a catch; Alhena blinks
  and acknowledges catches with a short wave. This is procedural kinematic
  animation, not a rigid-body animal simulation or a skinned-mesh asset.
- `host.js`: Alhena's authored clay miniature. A closed sculpted face integrates
  the nose, jaw, cheek and eye-socket contours; a swept/fluted hair cap, pleated
  dress, curved solid apron, tapered brows/smile, buttons and sandals replace
  the plain oval head, hair blobs and rectangular apron. Seven material-batched
  meshes retain the same head/arm/eye groups for existing blink and greeting
  animation. Geometry is cached between instances; all materials share the
  cove's jade/linen/warm-clay palette. This is a stylized authored character,
  not a scan, a face-data import, or a human-anatomy simulation.
- `ocean.js`: the legacy PandoraChat 32-component JONSWAP spectrum, finite
  difference normals, displaced geometry, reflection/refraction render passes,
  absorption by depth and shoreline foam. A continuous variable-density mesh
  resolves the fishing area without seams. Four small gravity-capillary wind
  waves supplement (not replace) the original 32-component swell.
  A sunlight-ray grid refracts through this same height field onto the seabed;
  projected area contraction determines caustic brightness. This replaces the
  former painted sine-net caustics. Surface normals are now evaluated per
  pixel using angle-addition central differences of that exact same wave
  height field, avoiding offshore triangle interpolation of short waves.
  Planar reflections use up to 4x MSAA with a one-megapixel render-target
  ceiling. Seabed caustics fade at their atlas/depth boundaries rather than
  revealing a rectangular light patch.
- `water-light.js`: four depth slices of surface-refracted sunlight packed into
  a 512x512 half-float atlas. The water shader integrates single scattering in
  eight steps along its depth-reconstructed view ray, stopping at the actual
  opaque seabed or fish. Colored extinction uses optical path length instead
  of vertical depth. Geometry, sunlight, waves and ripple data are shared with
  the existing ocean; no separate ray-texture overlay or downloaded sky is used.
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
The light volume is a bounded real-time approximation, not a path tracer:
four interpolated depth slices, screen-space refraction endpoints, artist-set
optical coefficients, and a homogeneous medium. It does not include multiple
scattering or submerged-object shadows inside the light volume. The height
field is not a full 3D fluid solver: overturning/breaking waves, two-way
rigid-body fluid coupling, and a commercial Deep Water entitlement flow remain
unimplemented.

Third-party source: Three.js 0.164.1 and its BufferGeometryUtils, vendored from
the official npm distribution. See `vendor/THREE-LICENSE.txt` (MIT).
BufferGeometryUtils imports the vendored Three module directly so browser
and Node tests use the same implementation without an import-map dependency.
Scene geometry and materials are authored in code. Google Fonts is optional;
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

Underwater lighting: `node --test paradise/scripts/test-water-light.mjs` and
`node paradise/scripts/verify-water-light.mjs`. The browser check renders GPU
fixtures, confirms unit concentration under a flat water surface, and compares
actual shader radiance to a numerical reference at eight optical path lengths.
It supports Chromium and WebKit. `?volume=off` disables in-scattered radiance
for visual comparison without changing wave physics or the refraction endpoint.

Surface optics: `node --test paradise/scripts/test-water-surface.mjs` and
`node paradise/scripts/verify-water-surface.mjs`. GPU fixtures compare 144
normal samples against direct height-field differences across three winds and
three times, check actual multisample edge coverage and bounded caustic fades.
The old interpolated-normal path remains available as `?normals=vertex` for
comparison. Read-only `?water-debug=1` through `5` display normals, reflection,
refraction color, optical path length and transmitted radiance respectively.
These diagnostics do not alter fishing or wave physics.

Fish: `node --test paradise/scripts/test-fish.mjs` checks deterministic finite
geometry, welded surface closure, weights, asset sharing and actual skinned
vertex movement. `node paradise/scripts/verify-fish.mjs` renders an eight-fish
contact sheet, measures GPU animation pixel changes, then checks the real
fourteen-fish school and captures fishing/strike views in the actual ocean.

Host: `node --test paradise/scripts/test-host.mjs` verifies closed finite
primary meshes, integrated facial relief, the retained articulated interface,
shared geometry and the 25,000-triangle/7-mesh budget. The browser check,
`node paradise/scripts/verify-host.mjs`, captures front/three-quarter/portrait
views, checks actual GPU draw calls, and verifies blinking, head motion,
casting and reduced motion in the real scene. It uses the same Playwright,
browser, URL and output environment variables as the other verifiers.

Rendering background: [GPU Gems, Volume Rendering Techniques](https://developer.nvidia.com/gpugems/gpugems/part-vi-beyond-triangles/chapter-39-volume-rendering-techniques)
describes slice reconstruction and accumulation along viewing rays. This
implementation is authored for this scene, not copied from that chapter.
