# Unified Cove

One real Three.js scene, one camera and one canvas. No photo cutouts, hidden
PlayCanvas iframe, or independent background renderer.

- `models.js`: rounded clay/vinyl miniatures, articulated dog and Alhena,
  seabed, cottage, bar, jetty, palms, lighting props, clickable promotion board.
- `ocean.js`: the legacy PandoraChat 32-component JONSWAP spectrum, finite
  difference normals, displaced geometry, reflection/refraction render passes,
  absorption by depth, shoreline foam and animated procedural caustics.
  Short analytical impact waves use a dense local fishing patch rather than
  being undersampled on the distant sea mesh. CPU buoyancy samples the same
  height function. These are not a full fluid solver or wave-breaking model.
- `main.js`: procedural sky, day/weather lighting, depth-buffer lens blur,
  fixed-step spring buoyancy and Verlet line, three-phase fishing, touch,
  optional device-motion and vibration support. Motion/haptics depend on the
  browser and device; desktop browser emulation does not prove phone hardware.
- `catalog.js`: weather/time-sensitive catches and non-destructive import of
  the earlier canvas edition's local catch counts.

Renderer: WebGL2, not WebGPU. This is the verified portable 3D foundation;
WebGPU compute, physically traced caustics, volumetric underwater lighting,
and a commercial Deep Water entitlement flow remain unimplemented.

Third-party source: Three.js 0.164.1 and its BufferGeometryUtils, vendored from
the official npm distribution. See `vendor/THREE-LICENSE.txt` (MIT). Scene
geometry and materials are authored in code. Google Fonts is optional;
the CSS has local fallback fonts. No model/image-generation API is called.

Verification: `node paradise/scripts/test-cove.mjs` and
`node paradise/scripts/verify-cove.mjs` from the repository root. The latter
requires Playwright (`PLAYWRIGHT_MODULE` can point at an existing installation),
accepts `PARADISE_URL`, and writes screenshots plus a JSON report to
`PARADISE_REPORT_DIR`. It drives actual UI, not gameplay mutation hooks.
