# Sculpted miniature fish, 2026-09-25

The previous school used ellipsoid bodies, cone tails and four similar colors.
The replacement is eight authored vinyl/clay miniatures matching the existing
catalog, with distinct body depth, fin outlines, flank markings and eye detail.
Each fish is one closed, vertex-colored SkinnedMesh with six bones. A traveling
bend passes down the spine/tail; paired pectoral fins flutter independently.
This is procedural skeletal animation, not fluid-driven animal simulation.

The fourteen-fish school shares eight cached geometries and one material.
Each variant is 9,056 triangles and one draw call per scene pass. Existing
school paths, attraction, jump placement, catch probabilities, controls and
saved catches are unchanged. The caught species is still weighted-random;
it is not yet bound to the visible fish that approaches the float.

## Local evidence

- All 34 unit tests pass, including four new fish tests. All eight variants
  have finite bounded geometry, normalized skin weights, consistently wound
  closed welded surfaces, nondegenerate triangles and valid normals/colors.
- Actual skinned vertices bend at the tail while the head remains stable;
  reduced-motion animation has lower amplitude. Skeletons are independent,
  while material and geometry reuse is asserted directly.
- `fish-preview/` includes an eight-fish rendered contact sheet, real landing,
  underwater fishing and strike screenshots. GPU readback changes 43,408 pixels
  between two poses with no transform/camera/light changes. The contact sheet
  uses eight draw calls, not dozens of independent primitive meshes.
- The real scene reports fourteen skinned fish spanning all eight variants,
  with six bones each and changing local-space tail vertices. Browser tests
  allow only 1e-10 head-position roundoff from scene matrix transforms.
- `fish-flow-chromium/` and `fish-flow-webkit/` each pass all six existing
  end-to-end checks: cast/buoyancy/hook/fight/catch, actor reactions, reload
  persistence, time/weather, portrait touch, landscape touch. No runtime or
  console errors. Screenshots were inspected, including underwater close-up,
  portrait fishing and moonlit storm views.
- Recorded initial FPS on this M4: Chromium 60, WebKit 56. Mobile emulation
  is not a benchmark of phone hardware and does not prove haptics/motion input.

The vendored BufferGeometryUtils now imports the adjacent vendored Three
module directly. It previously relied on a browser import map, which prevented
the new geometry tests from importing it in Node. Both paths use the same
bundled implementation; no package/model download was needed.

## Remaining work

Fish still follow the previous prescribed paths and can overlap one another.
They are miniature interpretations, not biological reconstructions. This pass
does not solve full 3D overturning waves, two-way fluid coupling, or paid Deep
Water entitlements. It does not establish the whole experience as AAA quality.
The unrelated untracked canonical `shore.js` experiment is untouched.

## Public release

- Source commit `5759815ca18ee3e58a310ca23bbea8a4c5b1f07b`, fast-forwarded
  into canonical main and deployed from a separate clean release clone.
- Guarded deployment passed all 34 unit tests and public response checks.
- Cloudflare version `f433e7dc-7f01-4d31-b015-12d23b060283`, deployment
  `96e59434-3b0f-4c5a-aadb-d2dd3444fc48`, 100% traffic, created
  `2026-09-25T05:32:52.09758Z`, independently confirmed through the API.
- All 17 runtime files return HTTP 200 and match the release SHA-256 exactly:
  `fish-live-source/source-hashes.json`.
- Public GPU contact sheet and real-school animation checks pass with no
  errors: `fish-live/models/`. Live fishing/strike screenshots were inspected;
  recorded fishing-view FPS is 58 on this M4, not a phone performance claim.
- Public end-to-end regression passes all six checks without runtime/console
  errors, including catch persistence and both mobile orientations:
  `fish-live/flow/report.json`. This was a complete UI-driven run against the
  production URL, not a substitute localhost result.
- The owned localhost preview server was stopped and no port 8796 listener
  remains. No persistent process or model was installed.
