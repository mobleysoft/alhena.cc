# Offshore shelf correction - 2026-09-25

## Cause and change

The straight-edged night-water cutoff was not caused by the evening lights or
the light-volume atlas. It persisted with scattering disabled, appeared in the
optical-distance debug view, and was absent from the reflection-only view.
GPU depth reconstruction matched the actual terrain elevations. The old outer
shelf was steep enough to occlude its own far side in the overview camera.
Adjacent rays therefore jumped from the near shelf to the deep bed behind it.

The outer 16-unit descent now spans elliptical radii 1.3 through 8, rather than
1.3 through 4.8. Its maximum grade is below 0.4. The island, shoreline and inner
cove remain unchanged through radius 1.3, and the offshore bed still reaches
-18.72. One frozen configuration supplies both the CPU height field and GLSL.
No blur, extra fog, wave-spectrum change or depth-buffer substitution hides the
defect. This is a deliberate bathymetry/art-direction correction, not a new
physically ray-traced refraction system.

## Evidence

- `boundary-before/`: original six diagnostic renders and 81 real GPU depth /
  water-surface samples. The clear-water seam samples contain optical-distance
  jumps of about 21 and 30 world units.
- `boundary-after/`: the same six views rendered from the changed source,
  without source replacement. Normal and depth frames were visually compared.
- `boundary-depth-webkit/report.json`: actual depth-target/surface-position
  readback, with maximum adjacent jumps of 0.166 and 0.127 in the two regions.
  Terrain-reconstruction error below 0.025 world units.
- `boundary-depth-chromium/report.json`: corresponding jumps of 0.176 and
  0.108, terrain error below 0.025; no captured browser errors in either engine.
  The verifier injects a read-only diagnostic hook into the local module for
  access to the render targets. It does not replace the terrain or depth math.
- `boundary-unit.tap`: all 44 unit tests pass. The three new tests preserve
  the inner cove, constrain the offshore grade and reproduce the original
  first-hit discontinuities before checking the new profile. The old test's
  deep-water probe moved from x=45 to x=70 to reflect the intentionally longer
  slope; its continuity tolerance was not weakened.
- `boundary-flow-webkit/report.json`: full cast/hunt/strike/fight/catch,
  buoyancy, reactions, persisted catch, night/storm and portrait/landscape touch
  controls pass. Actual fishing and mobile screenshots were inspected.
- `boundary-surface/report.json`: Chromium GPU checks pass for 144 normal
  samples, caustic coverage and multisampled reflection. Maximum normal
  difference 0.0004883. Landing and active fishing sampled 60 FPS on this Mac;
  this is not a sustained or physical-mobile performance guarantee.

## Release boundary

Based on canonical `03bda03bdb45ef1d0545d26b4c2c08b955a6d26b`, in isolated
worktree `sandboxes/paradise-ocean-boundaries`. Cloudflare identity was checked
as Johnmobley99@gmail.com, and the preceding live version was confirmed as
`5a42a1c3-beac-4561-a247-9ce9fd503abb` at 100% traffic.

## Observed production result

- Source commit: `c4f0d3fc91527fb253549288e632a54b98e24f20`.
- Deployed through `paradise/safe-deploy.sh` from the clean main-branch release
  clone. All 44 tests reran successfully; ASSETS remained bound. Only the
  changed public `island/ocean.js` asset required upload.
- Version `26a6193b-90da-4c5d-8f91-4951e072e8d9`, confirmed by Cloudflare's
  deployment list at 100% traffic, `2026-09-25T08:46:22.353616Z`.
- `boundary-live-source/source-hashes.json`: all 19 root/runtime/vendor files
  returned HTTP 200 and matched the release's SHA-256 hashes.
- `boundary-live-flow/report.json`: Chromium passed the actual public-site
  fishing loop, saved catch, character reactions, night/storm controls and
  portrait/landscape touch layouts, with no captured errors. Buoyancy mean
  error 0.06341 world units. Night/storm and portrait screenshots were inspected.
- Temporary preview server on port 8798 was stopped after verification.

Full overturning surf, higher-fidelity dog anatomy, physical-phone checks and
commercial entitlement remain outside this fix and unproven. The broad visual
goal is not complete. No code from the separate wave lab was promoted, and the
canonical repo's unrelated untracked `paradise/public/island/shore.js` was not
edited or deployed.
