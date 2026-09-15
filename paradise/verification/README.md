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
- `paradise-game-v2-pandora-water-3.png`: live V2 clean/cinematic water capture
  after the PandoraChat-style WebGL ocean pass was strengthened with a wider
  JONSWAP-inspired spectrum, matching CPU wave sampler, darker optical-depth
  absorption, analytical normals, Fresnel/sky/sun reflection, subsurface scatter,
  foam/shore streaks, fog, and tone mapping. It proves the intended water
  framework is active, while still showing that photorealism requires a proper
  authored 3D/PBR pipeline rather than more placeholder scene hacking.
- `paradise-root-v2-primary.png`: live root-page capture after promoting the
  verified `/game-v2/` Three.js rebuild to the primary Paradise entry point.
  Playwright verified that clicking the root CTA navigates to
  `/game-v2/?view=shore&time=dawn&weather=breeze&quality=cinematic` with a
  rendered canvas and zero browser/runtime errors. The older canvas prototype is
  still preserved as a legacy link.
- `paradise-game-v2-articulated-dog.png`: live focused dog capture after adding
  procedural hock/shoulder joint markers, richer paw lift, body breathing, head
  attention shifts, ear flops, and bite-reactive tail motion. This improves the
  black-lab placeholder's readability but also reinforces that true quality now
  requires an imported rigged dog model with authored skeletal animation.
- `paradise-game-v2-bar-composition.png`: live focused bar capture after adding
  more Alhena silhouette/face/hair/accessory detail, subtle bartender idle
  animation, a warmer planked bar front, reduced counter/canopy mass, and a
  pulled-back camera. It improves presentation readability while preserving the
  conclusion that a real rigged character asset is required for AAA quality.
- `paradise-game-v2-atmosphere-depth.png`: live shore capture after adding a
  lightweight Three.js atmosphere layer: camera-facing horizon haze, soft
  cloud-bank cards, preset-driven cloud color/opacity, and subtle drift. This
  improves horizon scale and scene depth without increasing the GLB asset budget,
  but remains a bridge until a real skybox/HDRI/environment pipeline exists.
- `paradise-game-v2-fish-surface-cues.png`: live water capture after replacing
  single-sphere fish with lightweight multi-part species groups and adding
  near-surface silhouettes/glints so fish activity remains visible through the
  opaque spectral ocean. This improves gameplay readability, but realistic fish
  still require authored meshes, animations, and water-material integration.
- `paradise-game-v2-shorebreak.png`: live shore capture after adding procedural
  shorebreak wash texture, layered animated surf sheets, weather-reactive foam
  opacity, and moving shallow-water highlights at the beach/ocean boundary. This
  makes the shoreline transition more legible and less like two intersecting
  planes, while still requiring authored terrain/water integration for AAA.
- `paradise-game-v2-wet-sand-material.png`: live shore capture after binding the
  procedural wash texture into the wet-sand material as color and bump detail,
  raising clearcoat, and tuning opacity/roughness so the surf edge has more
  reflective material response instead of reading as a flat translucent strip.
- `paradise-game-v2-prop-detail-clean.png`: live shore capture after adding
  lightweight authored-environment details: sagging dock rope rails, brass
  cleats, a coiled rope, beach-house door/window trim, a warmer bar face, bar
  plank highlights, and stools. A first shingle attempt was rejected before
  commit because it created jagged roof artifacts.
- `paradise-game-v2-pandorachat-water-refit.png`: live clean water capture
  after explicitly retuning the V2 ocean toward the old PandoraChat approach:
  stronger JONSWAP-inspired long-wave energy, matching CPU/GPU wave amplitude,
  higher analytical-normal contribution, Fresnel/sky reflection, subsurface
  volume bands, fog, controlled foam, and weather-coupled optics. This is the
  correct browser-shader direction, but still not the final AAA path; the scene
  needs authored 3D assets, PBR materials, and likely a Godot/Web export or
  equivalent asset pipeline for the next major leap.
- `paradise-game-v2-pbr-environment-soft-shadows.png`: live clean shore capture
  after adding a generated equirectangular sky/ocean environment map for PBR
  material reflections and disabling the harsh large-object sun shadows that
  made the placeholder house/bar geometry cast ugly rectangular blocks across
  the sand. This gives the current Three.js build a cleaner presentation
  baseline while preserving the finding that real authored assets are required.
- `paradise-game-v2-presentation-hud.png`: live root-click capture proving the
  public launcher now opens the Three.js rebuild in `presentation=1` mode. The
  HUD is subdued rather than fully hidden, the scene remains playable, and the
  `H` key toggles a `hud-hidden` class for clean capture/showcase moments.
- `paradise-game-v2-cinematic-atmosphere.png`: live presentation-mode shore
  capture after adding preset-driven volumetric sun shafts and layered ocean
  mist cards. This improves sky/ocean depth and golden-hour readability without
  relying on more flat prop art; it is still a bridge until real HDRI, authored
  skyboxes, and PBR scene assets replace the procedural stand-ins.
- `paradise-game-v2-cinematic-lens.png`: live presentation-mode shore capture
  after adding a lightweight cinematic lens layer with vignette, warm veil, and
  restrained grain. This improves screenshot focus and perceived contrast while
  keeping gameplay untouched; it is a post/composition bridge, not a substitute
  for authored high-fidelity scene assets.
- `paradise-game-v2-shoreline-microgeometry.png`: live presentation-mode shore
  capture after adding small 3D shoreline micro-forms: reflective tide pools,
  wet rock clusters, and driftwood. This gives the foreground more geometric
  depth than texture-only sand, while keeping the scene lightweight enough for
  the current Cloudflare-hosted browser build.
- `paradise-game-v2-pandorachat-water-pass-final.png`: live clean water capture
  after restoring the old PandoraChat architecture as a dedicated full-screen
  WebGL ocean pass behind the Three.js scene. The pass uses a JONSWAP-inspired
  spectrum, analytical normals, Fresnel/sky reflection, subsurface color, foam,
  fog, and ACES-style tone mapping. In `view=water`, shore props and the V2 mesh
  water are hidden so the proven optical shader can be evaluated directly.
- `paradise-game-v2-dog-four-beat-gait.png`: live dog-focused capture after
  replacing simple sine bobbing with a procedural quadruped stand-in that stores
  base transforms, offsets paw/hock/shoulder phases, plants paws, sniffs, wags,
  and reacts to bite state. This remains a placeholder pending a real rigged GLB.
- `scripts/verify-game.sh`: production verifier now covers the legacy canvas
  game, the root launcher, and the primary `/game-v2/` route. It syntax-checks
  both module scripts, validates asset budgets, checks root CTA markers, and
  verifies V2 markers for the JONSWAP ocean, shorebreak, atmosphere, fish,
  mobile controls, character stand-ins, and runtime asset loading.

Current conclusion: the shader-first water pass is improved and live, but the scene
still requires a true 3D/PBR asset pipeline to approach AAA quality.
