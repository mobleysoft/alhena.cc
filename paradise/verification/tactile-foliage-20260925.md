# Tactile foliage release, 2026-09-25

Replaced flat palm paddles with closed, folded leaflets sharing four deterministic
geometry variants, and tapered the trunks along their actual curved centerlines.
Each palm retains eight articulated fronds. Each frond has 26 leaflets and 1,768
triangles, with one leaflet draw call and one spine draw call. The existing
miniature palette, fish mechanics, water spectrum and camera are unchanged.

Screenshot review caught a batching defect in the first pass: static batching
discarded vertex colors, leaving the new trunks black. The batching helper now
retains colors only when their material needs them, and a unit test covers this.
`tactile-foliage-chromium/` is that superseded first-pass evidence, not a release
candidate. The authoritative final checks are:

- `tactile-foliage-final-chromium/`: full fishing/catch/persistence flow, actor
  reactions, storm/night settings, portrait and landscape touch layouts; no
  runtime errors. Desktop and emulated mobile initial frame rate: 60 on M4.
- `tactile-foliage-final-webkit/`: same flow, zero runtime errors; initial frame
  rate 60 on M4. Screenshots reviewed for desktop, portrait and night/storm.
- `tactile-foliage-rain/`: storm contacts and rings, calm transition and reduced
  motion, including the CPU fluid fallback. All pass, no runtime errors.
- 21 unit tests pass across `test-cove.mjs`, `test-rain.mjs`, `test-foliage.mjs`.

The deployed site's code was compared before release. All checked active files
matched canonical main except `main.js`, and `rain.js` returned 404: the existing
committed rain feature had not been deployed. This release deliberately includes
it after the tests above, rather than silently treating committed as live.

Use `scripts/verify-release.mjs` after deployment to compare the live active
assets against this checkout. Deployment must use a clean main release clone;
the unrelated untracked `island/shore.js` in the shared canonical working tree
is not part of this release. The unfinished breaking-wave laboratory is also
excluded. Browser mobile emulation does not prove real phone performance or
motion/haptic hardware behavior. This is a visual refinement, not a claim that
the full AAA or 3D breaking-wave target is complete.

## Deployment evidence

- Source commit: `69ed0a449b86aa865ccda5bcc2a87b847aa832b1`, fast-forwarded
  into canonical main before release.
- Cloudflare Worker: `alhena-paradise-worker`, authenticated account
  `johnmobley99@gmail.com`; version `00374ad0-8d24-4632-8c68-23798d3daebd`.
- Deployment `fd69e05b-2df0-46de-aa63-798b047f997b`, 100% traffic, confirmed
  through the Cloudflare deployments API, created 2026-09-25T04:18:28Z.
- The clean-main `safe-deploy.sh` passed preflight and all 21 unit tests. It
  uploaded six changed assets. Its immediate foliage post-check returned an
  empty response twice, so the wrapper correctly exited nonzero rather than
  declaring success. No blind redeploy was performed.
- A subsequent `verify-release.mjs` check against the public domain returned
  HTTP 200 and exact SHA-256 matches for all 14 active runtime assets, including
  the two new modules and rain. Evidence: `tactile-foliage-live-source/`.
- The full real-UI Chromium check against `https://paradise.alhena.cc/` passed,
  including catch persistence and both mobile orientations, with zero runtime
  errors. Evidence and screenshots: `tactile-foliage-live/`. Live desktop landing
  and mobile landscape fishing screenshots were visually reviewed. Initial
  frame rate was 60 on this M4 Mac, not a hardware-phone measurement.

Only this verified release is claimed live. The isolated fluid laboratory
checkpoint `2bea6c0` is not merged or deployed. Canonical main's unrelated
untracked shoreline work was preserved untouched.
