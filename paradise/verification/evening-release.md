# Cove evening lighting - 2026-09-25

## Shipped scope

The night scene had one local light over the bar, unlit cottage glazing and
emissive festoon bulbs without local illumination. This release adds authored
brass/jade lantern geometry on the porch and pier, a bar pendant, curtained
frosted glazing and warm pools of light. Four bounded point lights represent
these fixtures; no additional shadow maps or image-overlay glow is introduced.
Time and weather controls drive the same materials and lights in every scene
pass, including reflection and refraction. Daylight restores unlit glazing.

This is a cohesive clay-miniature treatment, not photoreal interiors or global
illumination. Fishing, waves, animal motion, catches and payments are unchanged.

## Verification

- `evening-unit.tap`: all 41 tests pass, including three new lighting tests.
  They cover deterministic curtain texture, independent material state, finite
  bounded presets (including unknown/inherited object keys), fixture geometry,
  four local lights, zero new shadow lights and exact return to daylight state.
- `evening-webkit/report.json` and `evening-chromium/report.json`: noon, sunset,
  night/calm and night/storm rendered through real controls, night casting and
  reduced-motion lighting. Both pass with zero captured browser errors. The
  daylight and night frames were visually inspected, not inferred from tests.
- `evening-cove-webkit/report.json`: full cast/hunt/strike/fight/catch sequence,
  saved catch after reload, host/dog reactions, real time/weather controls and
  portrait/landscape touch layouts all pass. Screenshots include actual fishing,
  not only the entry page.
- `evening-live-source/source-hashes.json`: all 19 public root/runtime/vendor
  files return HTTP 200 and match the local SHA-256 hashes exactly.
- `evening-live-light/report.json`: the same lighting checks pass on the public
  domain in WebKit with zero captured browser errors. Night frame inspected.
- `evening-live-flow/report.json`: Chromium passes the full public-site fishing
  loop, persisted catch, reactions and both mobile touch layouts, with zero
  captured browser errors. Mean sampled buoyancy error is 0.07395 world units.

Frame-rate readings are samples on this Mac, not a universal device guarantee.
The dedicated local WebKit lighting run sampled 54-59 FPS; Chromium landing
scenes sampled 56-60 FPS but its night fishing sample was 44 FPS. A separate
WebKit full-flow run sampled 30 FPS on its initial landing frame. These results
do not establish locked 60 FPS. Touch emulation does not verify phone motion
sensors, haptics or sustained physical-phone performance.

## Release provenance

- Source commit: `541dd8230c8485226799512fbda0ce964e1e80b1`.
- Based on canonical main `2f9a76eabc14fb59605a20127f946b18ba06b0e3`.
- Worker: `alhena-paradise-worker`.
- URL: `https://paradise.alhena.cc/`.
- Version: `5a42a1c3-beac-4561-a247-9ce9fd503abb`.
- Cloudflare's deployment list confirms 100% on this version at
  `2026-09-25T08:25:42.765Z`.
- Deployed from a clean isolated release clone on main using
  `paradise/safe-deploy.sh`, after Cloudflare identity verification. The wrapper
  reran all 41 tests, retained the ASSETS binding and checked public modules.
  The new module required one propagation retry before its response matched.
- Canonical main fast-forwarded to the reviewed source. The unrelated untracked
  `paradise/public/island/shore.js` was neither modified nor shipped. No bulk
  push of the canonical repo's unrelated pending GitHub commits was performed.

## Remaining work, not concealed by this release

The larger visual goal remains open. The separate 3D wave lab is checkpointed
at `6e638bce565bca26403d2462ccadecda5eee023b`, outside the deployed asset tree.
Its adaptive strong APIC case passes the earlier CFL event but exceeds the
unchanged 45-second watchdog at 11.1 simulated seconds. It is not production
surf and has not been deployed; the lab server is stopped.

The production renderer remains WebGL2 with WebGPU ripple computation, not a
full WebGPU renderer. Full overturning surf, further dog-body sculpting, mobile
hardware verification and the previously requested commercial entitlement flow
are not established by these lighting tests. Straight-edged tonal boundaries
remain visible in the night ocean screenshots and deserve a separate rendering
diagnosis. This release is a visual improvement, not evidence of AAA parity.
