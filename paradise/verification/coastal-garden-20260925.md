# Coastal garden refinement, 2026-09-25

Replaced the evenly distributed round shoreline stones and sphere bushes with
27 asymmetrically grouped sculpted stones and 25 folded-leaf rosettes. Rocks
have shared deformed geometry, continuous seam normals and a painted sediment
gradient. The plants have thick, arched leaves with a raised center fold.
Everything uses the same matte miniature visual language as the cottage,
palms, Alhena and the dog. No images or external model assets were added.

The first screenshot was too sparse: outer rocks were largely submerged and
the narrow leaves read as tiny star-shaped props. The revised composition
moves the main rocks inshore and enlarges the broad-leaf planting at the
flanks, preserving the open beach between the cottage, bar and jetty.

The garden uses eight geometry variants and two shared materials, with
102,204 triangles before the existing static-batch merge. It does not add a
per-frame update or change the water solver, terrain, actors or game rules.
Tests conservatively include prop footprints when checking the jetty and the
dog's 100-second walking circuit, instead of testing only prop center points.

## Verification

- All 24 unit tests pass across cove, rain, foliage and garden modules.
- Chromium: full UI-driven cast, strike, tension fight, catch persistence,
  actor reactions, weather/time controls and portrait/landscape touch layouts
  pass, with zero runtime errors. Evidence: `coastal-garden-chromium/`.
- WebKit: the same full interaction suite passes with zero runtime errors.
  Desktop and mobile landscape fishing screenshots were also reviewed.
  Evidence: `coastal-garden-webkit/`.
- Desktop landing, night/storm and mobile portrait screenshots were inspected.
  The plants and rocks frame the beach rather than obscuring the characters.
- Initial desktop and emulated mobile frame rate: 60 on Apple M4. This does
  not establish hardware-phone performance, motion control or haptic support.

This is a coastal art refinement, not completion of the overall AAA-quality
goal. Full overturning waves and volumetric underwater lighting are still
unproven/unimplemented; the independent fluid laboratory and the canonical
tree's untracked `shore.js` are explicitly excluded from this release.
