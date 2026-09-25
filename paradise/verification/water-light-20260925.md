# Depth-aware underwater light, 2026-09-25

Added a single-scattering water volume tied to the existing PandoraChat wave
spectrum, ripple field and sun. A grid of refracted sunlight rays projects
into four horizontal slices at depths 0.35, 1.2, 3 and 7 scene units. Their
area contraction gives local light concentration, stored in a 512x512
half-float atlas. There is one additional light-field draw, updated with the
existing caustic pass at at most 30 Hz.

The surface shader now reconstructs the visible opaque seabed/fish position
from the refraction depth texture. Colored extinction uses that optical path
length, not the vertical distance to analytic ground. Eight front-to-back
integration steps accumulate attenuated, direction-dependent in-scattered
light. Above-water refraction samples are rejected to avoid pulling the
cottage or pier into a water ray.

## Visual refinement

The initial coefficients made the cove too yellow. They were adjusted to keep
the established turquoise palette, with restrained direct-light scattering.
The initial depth-slice mask also zeroed light below the seabed, causing
interpolation to falsely darken shallow water above it. The volume now masks
only dry surface entry points; the actual viewing ray ends at opaque depth.

Landing, fishing and night/storm screenshots were reviewed. Fish now retain
their local color and distance through the water instead of sharing one
vertical-depth tint with the seabed. No new image overlay, game mechanic,
neural model or external runtime service was added.

## Evidence

- All 28 unit tests pass, including analytic extinction/scattering limits,
  finite and bounded slice geometry, and camera depth reconstruction.
- `water-light-optics-chromium/` and `water-light-optics-webkit/` contain
  real-GPU checks, screenshots and raw numeric results. Both report no errors.
- Flat-water fixtures return exactly 1.0 concentration in every atlas slice,
  with no focused pixels. The same renderer that produces the scene's atlas
  is used for these fixtures, not a substitute CPU implementation.
- At eight path lengths from 0.125 to 16 units, actual half-float shader
  radiance matches the numerical reference within 0.000020312 per channel.
  Disabling in-scattering yields exactly zero fixture radiance.
- The actual moving scene's depth slices have distinct nonuniform focused
  light, verified by GPU readback; this is not just a backend label.
- Initial fishing frame rate in both optical checks is 59 FPS on Apple M4.
  This is not a phone-hardware benchmark.
- Full UI-driven fishing, catch persistence, actor reactions, weather/time,
  portrait and landscape touch layouts pass in both Chromium and WebKit.
  Evidence: `water-light-flow-chromium/` and `water-light-flow-webkit/`.
  Desktop and mobile fishing screenshots were reviewed; no runtime errors.
- `water-light-fluid/`: GPU/CPU ripple parity (including queued GPU steps)
  passes with max height error 0.00000047684. The forced CPU fallback casts
  correctly. The existing seabed caustic buffer still contains focused light.

## Limits

This is a real-time single-scattering approximation, not path tracing or
multiple scattering. Its optical coefficients are artist-set, not measured
seawater data. Refraction endpoints remain screen-space, the medium is
homogeneous, only four depth slices are interpolated, and objects do not
cast shadows within the light volume. The existing seabed caustic pass is
unchanged. Full overturning waves and two-way rigid-body fluid coupling are
still unfinished. The canonical working tree's untracked `shore.js` and the
independent fluid laboratory are not part of this change.

Design references:
[GPU Gems: Volume Rendering Techniques](https://developer.nvidia.com/gpugems/gpugems/part-vi-beyond-triangles/chapter-39-volume-rendering-techniques)
for slice reconstruction/accumulation, and
[Three.js DepthTexture](https://threejs.org/docs/pages/DepthTexture.html)
for depth attachment behavior. The implementation is authored here.
