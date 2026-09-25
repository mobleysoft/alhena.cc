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
