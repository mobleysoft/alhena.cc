# Unified Cove

One real Three.js scene, one camera and one canvas. No photo cutouts, hidden
PlayCanvas iframe, or independent background renderer.

- `models.js`: rounded clay/vinyl miniatures, articulated dog and Alhena,
  seabed, cottage, bar, jetty, palms, lighting props, clickable promotion board.
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
