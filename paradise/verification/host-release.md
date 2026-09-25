# Sculpted host release - 2026-09-25

## Change

Replace Alhena's primitive oval head, separate nose sphere, hair blobs and flat
apron with an authored clay miniature. The face integrates nose, cheek, jaw and
eye-socket relief. A swept hair cap, curved apron, pleated dress, tapered brows
and smile, buttons and sandals share one jade/linen/warm-clay palette.

Seven articulated meshes, 24,096 triangles and one vertex-color material keep
the existing blink, head-turn and catch-greeting interface. This is stylized
geometry, not scanned anatomy or a photorealistic character. No fishing state,
dog gait, water physics, payment or entitlement behavior changes in this release.

## Local evidence

- `host-unit.tap`: 38 tests pass, including four new host tests for finite,
  deterministic geometry, closed primary surfaces, facial relief, rig independence
  and the seven-mesh / 25,000-triangle budget.
- `host-webkit/report.json` and `host-chromium/report.json`: seven GPU draw calls
  for each complete character view; blink, head motion, cast and reduced-motion
  checks pass. No captured browser errors. Both include a three-view gallery and
  actual landing/fishing screenshots, not just geometry assertions.
- `host-cove-webkit/report.json`: real cast, hunt, strike, tension fight and catch;
  persisted catch after reload; dog and host reactions; night/storm controls;
  portrait and landscape touch layouts. All pass, no captured browser errors.
- `host-actors-webkit/report.json`: 834 animation frames, 63 foot steps, at least
  three stance contacts. Maximum measured rendered-paw, stance-slip and ground
  errors are below 4e-15 world units. Reduced-motion check passes. This verifies
  the unchanged kinematic rig, not a real animal physics simulation.

The local gallery and landing frame were visually inspected. In-scene frame-rate
samples are diagnostics, not a device-performance guarantee. Touch emulation is
not proof of wrist motion or haptics on a physical phone.

## Release state

Prepared from canonical main `b1afa71058a680ddf38f427f0d5fd04e3fad24e6` in an
isolated worktree. Source commit: `3bb5f89e5d853388748b4d9fc1518c7fbcc507c3`.

Deployed with `paradise/safe-deploy.sh` from the clean release clone on main,
after verifying the Cloudflare account as `Johnmobley99@gmail.com`. The wrapper
reran all 38 tests successfully, retained the ASSETS binding, and verified the
public root and modules. The shell initially selected Node 20; Wrangler refused
before deploying. Using the already-installed Node 26 through a command-local
PATH resolved this without changing global configuration.

- Worker: `alhena-paradise-worker`.
- Production URL: `https://paradise.alhena.cc/`.
- Version: `99c1c3a0-5f65-4e12-a760-8baf329b0ccb`.
- Deployment list confirms 100% on that version at `2026-09-25T07:38:00.036Z`.
- `host-live-source/source-hashes.json`: all 18 checked root/runtime/vendor files
  return HTTP 200 and exactly match their local SHA-256 hashes.
- `host-live-model/report.json`: live WebKit character gallery, blink, head turn,
  cast and reduced-motion checks pass; zero captured browser errors.
- `host-live-flow/report.json`: live Chromium full fishing flow, saved catch,
  reactions, night/storm controls, portrait and landscape touch checks pass;
  zero captured browser errors. Landing, catch and both mobile fishing frames
  were visually inspected.

The canonical repo's unrelated untracked `paradise/public/island/shore.js` was
neither modified nor included. This release does not push the canonical repo's
unrelated pending commits to its GitHub remote.

The separate full-3D breaking-wave experiment is not included. The larger visual
goal remains open, including a convincing overturning breaker and further
scene-wide quality work; passing this character release does not prove AAA parity.
