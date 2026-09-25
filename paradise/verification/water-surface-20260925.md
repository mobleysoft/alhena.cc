# Surface optics refinement, 2026-09-25

The previous public screenshots showed coarse offshore wave shading and
stair-stepped palm/pier reflections. Per-pixel normals now sample the same
32-component PandoraChat swell, four short wind waves, shoreline attenuation
and ripple texture used by displacement and buoyancy. Angle addition evaluates
the four central-difference samples with one sin/cos pair per component;
the normal step is 0.04 scene units. This is not a new wave spectrum or solver.

The planar reflection target now uses up to four samples per pixel, bounded
by device capability. Its resolution follows the drawing-buffer aspect ratio,
never exceeds native resolution and is capped at 1,048,576 pixels. It is not an
unbounded supersampling pass. Screen-space refraction is unchanged.

Separate color/depth/normal diagnostic views identified an additional visible
boundary in the caustic map. Its square support now fades over the outer 7%
instead of abruptly cutting bright seabed detail off; the projection's depth
cutoff also fades from 10 to 14 units instead of switching at 12.

## Verification

- All 30 unit tests pass. Two new tests cover exact angle-addition reconstruction and bounded
  reflection sizing across tiny, mobile, desktop and 8K dimensions.
- GPU tests pass in Chromium and WebKit: 144 normal samples across three wind
  speeds, three times, shallow/deep/offshore positions, and a nonzero synthetic
  ripple texture. Max component disagreement with direct central differences
  is 0.0009765625 in half-float readback.
- The exact reflection-target factory produces 63 fractional-coverage pixels
  on a small triangle fixture with 4x MSAA versus zero without. Projected area
  changes by less than one percent, rather than disappearing into a blur.
- Sixteen GPU caustic-boundary samples match their smooth reference within
  0.001, including zero outside the atlas and full strength inside it.
- Both browser optical checks report no runtime/console errors and 60 FPS at
  the initial fishing snapshot on this M4. This is not a phone benchmark.
- Full UI-driven cast/hook/fight/catch, catch persistence, actor reactions,
  time/weather and portrait/landscape touch checks pass in both Chromium and
  WebKit with no errors: `surface-flow-chromium/`, `surface-flow-webkit/`.
  Desktop, mobile portrait fishing and moonlit storm screenshots were reviewed.
- `surface-light-regression/` confirms the existing flat-water light atlas
  and actual GPU single-scattering integral still pass, max radiance error
  0.000020312 with no runtime errors.
- An early local shader concatenation lacked a newline before Three.js's
  preprocessor directive. Browser validation caught the compile error; it was
  corrected before release and both engine checks rerun successfully.

Evidence: `surface-optics-chromium/` and `surface-optics-webkit/`. Landing and
fishing screenshots were inspected, not just generated. The reflection edges
are visibly cleaner; this does not claim all shoreline artifacts are solved.

## Remaining Limits

This still uses a height-field ocean with planar reflection and screen-space
refraction. It does not implement overhanging waves, full 3D liquid, volumetric
object shadows, or a WebGPU rendering-engine migration. Geometry can still
under-resolve displacement far offshore even though its normals no longer
interpolate coarse short-wave samples. The pre-existing `shore.js` experiment
in the canonical working tree was not modified or included.
