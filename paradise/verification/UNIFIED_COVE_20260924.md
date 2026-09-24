# Unified Cove: 2026-09-24

## Scope of this release

Replace the public canvas/photo composition with a single native Three.js
scene. The previous root is preserved at `/legacy-canvas.html`; older game
directories and the Godot delivery routes remain intact.

The house, bar, palms, Alhena, articulated black Labrador, jetty and fish now
share authored clay/vinyl materials, scene lighting, shadows and depth. The
landing and play views use the same scene rather than unrelated renderers.

The ocean inherits the legacy PandoraChat 32-component spectrum and phase
constants. It has finite-difference normals, reflection/refraction passes,
depth absorption, shallow-water foam and procedural seabed caustics. A dense
fishing patch resolves short impact rings; filtering prevents distant
capillary waves aliasing into bright grids. Night lighting is not daytime
specular intensity applied to a darker background.

Bobber spring buoyancy samples the same wave heights used to displace the
water. A fixed-step Verlet line changes color with tension. The three-phase
fishing loop supports pointer, keyboard and touch controls. Existing canvas
catch counts import without deleting their original storage key.

## Evidence

- `20260924-before.png`: captured earlier public/legacy scene.
- `20260924-*-diagnosis.png`: intermediate lighting diagnostics, not release
  screenshots.
- `cove-current/report.json` and its nine screenshots: local browser checks
  for cast, buoyancy, strike, feathered reel, catch, reload persistence, time,
  weather, mobile portrait and mobile landscape.
- Six deterministic tests in `scripts/test-cove.mjs`: spectrum invariants,
  ground continuity, journal migration, blocked/full storage and fish weights.
- Browser tests used Chromium on this Mac's Apple M4 through ANGLE Metal;
  measured landing views were 60 fps. This is not a claim about all hardware.
- Mobile tests emulate viewport/touch; actual phone accelerometer and
  vibration remain unverified.

The default `scripts/verify-game.sh` now runs real Cove tests instead of
requiring obsolete photo-placeholder markers. Historical checks remain
available explicitly via `PARADISE_VERIFY_LEGACY=1`.

## Not complete

This release is WebGL2, not WebGPU. Impact ripples and caustics are analytical
and procedural, not a full fluid solver or physically traced caustic field.
Volumetric underwater lighting, physically breaking surf, more sophisticated
character locomotion and the paid Deep Water entitlement flow remain work.
The broader visual-quality goal is still active; this is a coherent deployed
foundation, not a claim of AAA parity.

## Production evidence

Source commit: `cca4b6f96d2b32d4a19094a455f6aac5a44fb683`.
Cloudflare Worker version: `f29df52a-872a-466a-8b25-ee30a7402a5c`.
The safe-deploy wrapper completed on September 24. The root and all five
first-party JS/CSS assets returned HTTP 200 and matched local SHA-256 hashes.

`cove-live-20260924/report.json` records the full Chromium production pass;
`cove-webkit-live-20260924/report.json` records the same pass in WebKit. Both
passed desktop fishing, persistence, weather and emulated portrait/landscape
touch checks with no captured browser or same-origin HTTP errors. Both have
nine production screenshots. Landing views measured about 60 fps on this Mac.
WebKit automation is not verification on a physical iPhone.

The browser verifier now accepts `PARADISE_BROWSER=webkit` as well as its
default Chromium engine. No public runtime change was required for WebKit.
