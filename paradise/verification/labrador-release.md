# Sculpted Labrador - 2026-09-25

## Change and scope

The old dog used 42 independently rendered primitive meshes with exposed ball
joints and a blunt upward-curving tube tail. `island/labrador.js` replaces it
with authored, cached clay geometry: a continuous torso-and-limbs skin, a
continuous skull/muzzle, folded ears, an otter-shaped tail, coral collar, and
small inset eye details. The material remains consistent with the diorama.

Thirteen actual Three.js bones deform the torso/limb skin. The existing
terrain-aware two-bone IK and walking/attention solver remain unchanged.
Soles are fully weighted to the corresponding paw bone; skinning, not merely
empty joint positions, is checked by a regression test. A grid-node collision
in marching tetrahedra is handled by sharing the intersection vertex rather
than dropping arbitrary triangles. Surface normals sample the smooth field.

This is an authored stylized Labrador, not a scan or a biomechanical simulation.
It renders eight meshes with one shared material, versus 42 meshes previously.
Triangle count rises from 29,584 to 42,630. Reduced draw submissions are verified
in the fixture, not claimed as an overall frame-rate improvement.

## Local evidence

- `labrador-unit.tap`: all 48 unit tests pass. Four new tests cover finite,
  deterministic, closed and outward-wound geometry; shared assets/independent
  rigs; chest/waist shape of the actual skin; and deformed sole vertices under
  combined parent, body, and leg transforms.
- `labrador-baseline-gallery/`: the old production dog rendered with the same
  fixture lighting/cameras, by substituting only `models.js` from `47bb405`.
- `labrador-final-webkit/`: final close-up gallery, three actual gait poses,
  landing and fishing screenshots, and browser evidence for blinking,
  side-to-side tail movement, terrain-aware paw positions, and reduced motion.
  Screenshots were inspected, including the changing leg silhouettes.
- `labrador-flow-webkit/`: actual full fishing loop, reactions, persistent catch,
  night/storm and portrait/landscape touch checks passed with no browser errors.
  Actual catch and landscape screenshots were inspected. Mobile here means
  browser emulation on the Mac, not physical-phone validation.

Source starts from canonical `47bb4051e0b08962be24d654a4af327db7fcb0ee` in
`sandboxes/paradise-sculpted-labrador`. Intermediate iteration captures were
preserved outside the repo in `mascom/logs/paradise-labrador-scratch-20260925`.
The clean release clone must pass the guarded deploy script, now including the
new tests and a public Labrador-module check. Live version before promotion:
`26a6193b-90da-4c5d-8f91-4951e072e8d9`, verified at 100% traffic on the intended
Cloudflare account. Public source and runtime verification are pending below.

The overarching visual goal remains incomplete. Full overturning surf,
physical-phone validation, commercial entitlement and other fidelity work are
not supplied or proven by this release. No experimental wave-solver or unrelated
`shore.js` change is included.
