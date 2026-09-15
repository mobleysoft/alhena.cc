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

Current conclusion: the shader-first water pass is improved and live, but the scene
still requires a true 3D/PBR asset pipeline to approach AAA quality.
