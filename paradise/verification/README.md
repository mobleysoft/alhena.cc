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
- `paradise-jonswap-ocean-pass.png`: production capture after replacing the
  full-screen ocean pass with a PandoraChat-style JONSWAP surface sampler that
  returns height, analytic gradient, curvature, and energy from one spectrum.
- `paradise-jonswap-ocean-tuned.png`: production capture after reducing the
  blanket reflection/fog washout and deepening the spectral water body.
- `paradise-nearfield-water-cinematic.png`: production capture after turning the
  offshore Three.js water mesh into a low-opacity parallax/specular carrier on
  top of the Pandora-style full-screen shader. It improves depth slightly
  without returning to the earlier washed-out beach failure mode.
- `paradise-game-v2-initial.png`: first live capture of the isolated `/game-v2/`
  real-3D rebuild route; rejected because the frame rendered black before
  import-map/runtime hardening.
- `paradise-game-v2-fixed.png`: second live V2 capture after fixing module
  resolution and shader portability; rejected because the ocean mesh overlapped
  the beach/bar and flooded the foreground.
- `paradise-game-v2-layout.png`: live V2 capture after moving the spectral ocean
  mesh offshore and widening the default camera. This establishes the cleaner
  replacement architecture for future PBR/GLB asset iteration.
- `paradise-game-v2-atmosphere.png`: live V2 capture after adding the procedural
  sky dome, sun billboard, horizon islands, shoreline foam contours, analytic
  wave normals, and additional beach/bar prop details; rejected as over-fogged.
- `paradise-game-v2-atmosphere-tuned.png`: live V2 capture after reducing fog,
  softening the sun bloom, deepening water color, and lowering reflected-sky
  washout.
- `paradise-game-v2-final-atmosphere.png`: final live capture for this pass;
  verifies the `/game-v2/` route remains renderable after linking it from the
  Paradise landing page.
- `paradise-game-v2-play-idle.png`: live V2 capture from the automated
  production playtest before input.
- `paradise-game-v2-play-cast.png`: live V2 capture after pressing Space and
  clicking Reel in production; verifies the bobber, line, bite status, and
  tension meter path.
- `paradise-game-v2-dog-rig.png`: live V2 capture after adding dog paw, collar,
  ear, eye, and rim-light geometry; rejected as a weak proof because V2 had not
  yet wired initial `view` query routing.
- `paradise-game-v2-alhena-bar.png`: live V2 capture after adding Alhena tray,
  drink, apron, face, hair, and arm detail; rejected as a weak proof because V2
  had not yet wired initial `view` query routing.
- `paradise-game-v2-focused-dog.png`: live V2 focused dog capture after wiring
  `?view=dog`; proves the procedural rig is more readable but still needs a real
  skeletal GLB/animation asset to approach AAA.
- `paradise-game-v2-focused-bar.png`: live V2 focused bar capture after wiring
  `?view=bar`; rejected because the canopy/counter occluded Alhena too heavily.
- `paradise-game-v2-character-dog-final.png`: live V2 dog composition after
  camera refinement; verifies a stronger procedural black-lab stand-in with
  paws, collar, ears, eyes, body bob, tail wag, and gait animation.
- `paradise-game-v2-character-bar-final.png`: live V2 bar composition before the
  final canopy/counter correction; kept as regression evidence.
- `paradise-game-v2-character-bar-composed.png`: live V2 bar composition after
  raising the canopy, lowering the counter, lifting Alhena, and retargeting the
  camera so the bartender reads as a character instead of an occluded blob.
- `paradise-game-v2-pandora-water-pass.png`: live V2 clean/cinematic capture
  after tuning the Three.js ocean shader toward the old PandoraChat water
  recipe: JONSWAP-inspired spectral waves, analytic normals, stronger Fresnel
  reflection, sky/horizon reflection, subsurface scatter, foam streaks, fog,
  and tone mapping. It verifies the approach is active in `/game-v2/`, but also
  shows the visual ceiling of the current procedural scene.
- `paradise-game-v2-water-optics-tuned.png`: live V2 clean/cinematic capture
  after correcting the failed beige transparent-water pass, making the ocean
  opaque, lowering cinematic fog, deepening the water body, raising the water
  camera, and adding a shader-only optical highlight layer. This is the current
  best verified V2 water view.
- `paradise-game-v2-textured-bar.png`: live V2 focused bar capture after adding
  procedural cloth/apron/fur bump textures and moving the bar camera toward the
  front of the bartender. Still rejected as AAA-quality because the bartender is
  procedural primitive geometry, not a rigged model.
- `paradise-game-v2-textured-dog.png`: live V2 focused dog capture after adding
  procedural fur texture/bump detail. Still rejected as AAA-quality because the
  animal needs a skeletal dog asset and authored gait clips.
- `paradise-game-v2-lit-shore.png`: live V2 shore capture after adding stronger
  hemisphere/ocean fill, warm practical lights, shadow-bias tuning, brighter
  wood/glass response, and geometry-based palms/sea-grass for stronger beach
  silhouette and scale.
- `paradise-game-v2-lit-bar.png`: live V2 bar capture from the same lighting and
  environment pass. It verifies the bartender is more readable but still proves
  the need for a real rigged character asset.
- `paradise-game-v2-lit-dog.png`: live V2 dog capture from the same lighting and
  environment pass. It verifies better material readability and beach context,
  while preserving the conclusion that the dog must become a skeletal GLB.
- `paradise-game-v2-mobile-controls.png`: live V2 mobile-landscape capture after
  adding a touch control rail. Playwright verified the controls render as a grid,
  Cast/Reel update game state, and View cycles to the water camera without
  runtime errors.
- `paradise-game-v2-sunset-storm.png`: live V2 capture after adding time-of-day
  and weather presets that drive sky colors, fog density, sun/fill/practical
  light intensity, ocean wind, foam, water tint, and optics strength.
- `paradise-game-v2-night-bar.png`: live V2 night/calm bar capture from the same
  preset system. It proves the scene can shift mood coherently, while also
  showing the remaining primitive-character limitation.
- `paradise-game-v2-wave-coupled-fishing.png`: live V2 production play probe
  after adding a JavaScript-side spectral ocean sampler. The bobber and fish now
  use the same wind/time-driven wave model family as the shader, and weather
  affects bite timing, foam, wind, and optics.
- `paradise-game-v2-postfx-tuned.png`: live V2 sunset/storm capture after adding
  a cinematic post-processing path with selective bloom and output pass. The
  first post-processing attempt over-bloomed the water; this capture verifies the
  tuned threshold/strength no longer blows out the scene.

Current conclusion: the shader-first water pass is improved and live, but the scene
still requires a true 3D/PBR asset pipeline to approach AAA quality.
