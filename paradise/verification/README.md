# Paradise Verification Captures

These screenshots are production captures of `https://paradise.alhena.cc/game/`
taken with Playwright Chromium at `1440x900`.

- `paradise-water-cinematic.png`: first `view=water&clean=1&quality=cinematic` capture; exposed that cinematic mode incorrectly enabled the mesh water carrier and washed out the ocean.
- `paradise-ocean-cinematic.png`: clean `view=ocean&clean=1&quality=cinematic` capture after disabling the mesh carrier by default.
- `paradise-ocean-ridge-cinematic.png`: latest capture after deepening the shader body color and adding spectral ridge energy.
- `paradise-ocean-ridgefield-cinematic.png`: production capture after adding a live
  Three.js spectral ridge field so the ocean has perspective surface lines
  without re-enabling the washed-out mesh carrier.
- `paradise-material-cinematic.png`: production capture after adding a warmer sun
  halo, wet-sand reflection, and beach microgeometry for stronger foreground
  material read.
- `paradise-water3d-cinematic.png`: first `water3d=1` capture using Three.js
  `Water`; rejected because it flooded the foreground and washed out the beach.
- `paradise-water3d-offshore-cinematic.png`: adjusted `water3d=1` capture after
  lazy-loading the dependency and moving the reflector offshore; still kept
  experimental because the visible banding is weaker than the shader-first path.
- `paradise-shoreline-glb-cinematic.png`: first production capture after adding
  `paradise-shoreline.glb`; rejected as a default because the candidate terrain
  over-darkened the foreground.
- `paradise-candidate-default-cinematic.png`: production capture after changing
  runtime model slots to candidate-only loading unless `assets=1`; verifies the
  default visual is restored while the GLB remains deployed for testing.
- `paradise-coherent-surface-cinematic.png`: production capture after adding a
  JavaScript-side spectral surface sampler shared by bobber buoyancy, ridge
  geometry, glints, ripple rings, and fish depth. This is primarily a motion
  coherence improvement, not a still-frame leap.

Current conclusion: the shader-first water pass is improved and live, but the scene
still requires a true 3D/PBR asset pipeline to approach AAA quality.
