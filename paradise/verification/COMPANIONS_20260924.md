# Grounded Cove Companions: 2026-09-24

## Deployment

- Source: `1419955e8a6ad6bd6c55ddfe5e3bc8d1e19bd1d8`.
- Worker: `alhena-paradise-worker`.
- Live version: `09563671-9c9f-4b9e-822e-fd80d95e2164`.
- Public URL: https://paradise.alhena.cc/
- Cloudflare identity confirmed as `Johnmobley99@gmail.com` before deploy.
- Guarded `safe-deploy.sh` passed clean/main/binding checks, all twelve unit
  tests and public response checks. Five public JS assets were HTTP 200 and
  SHA-256-identical to their committed local source after deployment.

## What Changed

The previous dog root moved on an ellipse while its legs oscillated on an
unrelated clock. That made the paws slide instead of carrying the body.

`public/island/locomotion.js` now owns a procedural quadruped controller:

- World-space paw anchors stay fixed throughout stance.
- Only one paw swings at once; three remain in ground contact.
- Step targets follow terrain height, and paw orientation follows terrain
  normals. Upper/lower legs retain fixed lengths through two-bone IK.
- Turn curvature reduces walking speed. Foot urgency chooses which paw
  needs a step next. A small body crouch keeps targets within reach.
- Walk, rest and sniff behaviors provide variation without a canned gait.
- Strikes/fights attract attention; the dog looks toward the float and
  settles. A catch reaction expires, allowing routine movement to resume.
- Reduced-motion mode stops travel and stepping.

The rendered dog rig has separate shoulder/hip, knee and paw transforms.
Alhena has blinkable eyes, looks toward activity and briefly waves after a
catch. The existing clay/vinyl material language is unchanged; no photo
cutouts, downloaded character models, or new runtime services were added.

## Evidence

- `node --test scripts/test-cove.mjs`: twelve passing tests. New tests
  cover IK segment lengths and unreachable targets, 48-second walks over
  flat/island/sloped terrain, stance anchoring, clearance, three-paw contact,
  attention settling and reduced motion. Existing water/catalog tests pass.
- `actors-current/report.json`: local rendered-rig verification passed.
- `actors-live-chromium-20260924/report.json`: 1,231 public animation frames
  and 61 steps observed over 22 seconds. At least three paws remained in
  stance. Maximum rendered-paw/IK error: `2.85e-15`; maximum stance slip:
  `4.18e-15`; ground-contact error: `1.61e-15` scene units. These are
  floating-point residuals, not millimeter-scale motion. Reach error was zero.
  Reduced-motion check passed. Walking/turning/sniffing screenshots saved.
- `actors-gameplay-local-20260924/report.json`: Chromium gameplay passed.
- `actors-gameplay-local-webkit-20260924/report.json`: WebKit gameplay,
  mobile portrait/landscape, journal persistence, weather and character
  reactions passed. The verifier uses real controls to catch a fish and
  confirms the temporary greeting ends. No browser errors.
- `actors-gameplay-live-webkit-20260924/report.json` and
  `actors-gameplay-live-chromium-20260924/report.json`: public gameplay passed
  all six check groups in both engines, including companion reactions and
  their expiry, mobile portrait/landscape, catch persistence and night/storm.
  Both reported 60 FPS on this Mac and zero browser errors. Nine screenshots
  were captured per engine; this is not physical-phone performance evidence.

## Scope And Remaining Work

This closes the planted-foot/response-animation gap recorded in
`WAVE_FIELD_20260924.md`. It is kinematic procedural animation, not a
rigid-body animal simulation, muscle system, or production skinned mesh.
The dog stays on a bounded, collision-free authored island path; arbitrary
navigation and obstacle handling are not implemented.

The broader visual goal remains active. Remaining work still includes
breaking surf and shoreline dynamics, richer underwater lighting, more
tactile splash/audio feedback, fully diegetic fight presentation, a complete
WebGPU rendering path, Deep Water entitlements, and actual-phone validation.
The already deployed WebGPU ripple computation and WebGL2 rendering remain
distinct and are not represented as one fully WebGPU renderer.
