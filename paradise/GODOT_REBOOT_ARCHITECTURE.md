# Paradise Godot Reboot Architecture

## Why the Current Approach Will Not Reach the Target

The existing Paradise implementations are prototypes, not production-grade game foundations.

The `/` version is a 2D canvas composition. It can create mood, but it cannot naturally produce photorealistic water, skeletal animal motion, believable human characters, real shadows, or high-quality materials.

The `/aaa/` version is closer architecturally because it uses a 3D scene graph, but it is still hand-built from primitives. That proves the direction, not the visual target.

The core failure is not effort. The core failure is base selection. AAA-looking games are asset-pipeline products:

- authored 3D models
- rigged animation
- physically based materials
- baked and dynamic lighting
- post-processing
- terrain tools
- water simulation
- camera/game-feel iteration
- export/test/deploy automation

Hand-drawing these directly in a single HTML file is the wrong abstraction.

## Best Immediate Open-Source Seed

Use Godot's official third-person shooter demo as the first architecture seed.

Reasons:

- Official Godot project.
- MIT-licensed.
- Already demonstrates a complete 3D game structure.
- Includes character/controller/camera patterns.
- Provides a better directory and scene architecture than our current single-file experiment.
- Can be progressively transformed into Paradise rather than invented from nothing.

Target source:

- `godotengine/tps-demo`
- Godot Asset Library: Third Person Shooter Demo

Verified 2026-09-15:

- Godot Asset Library page for the Third Person Shooter Demo describes it as a
  complete TPS demo built for Godot Engine and suitable as an engine/sample
  project seed: https://godotengine.org/asset-library/asset/2710
- Godot's official documentation and site continue to describe web deployment as
  a supported target through HTML5/WebAssembly/WebGL-style export paths:
  https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html

Fallback/reference sources:

- `godotengine/godot-demo-projects`
- Godot web-export demos
- GDQuest Godot 4 third-person controller demo for controller architecture study

## Water Research Findings

The bar for satisfying water is not "blue shader plane." The better demos use:

- FFT ocean simulation
- Tessendorf spectral ocean formulation
- JONSWAP wave spectra
- multi-scale swell/ripple layering
- shoreline foam
- buoyancy
- tile-free infinite-ocean tricks
- screen-space reflection/refraction approximations
- weather presets rather than raw sliders

The most relevant product-level reference found quickly was EasyWaterscape for Unreal Engine: it uses FFT/Tessendorf/JONSWAP-style ocean simulation, shoreline foam, buoyancy, presets, and tile-free rendering. We should not copy the product, but we should copy the lesson: the tool/pipeline matters as much as the shader.

## Reboot Plan

### Phase 0: Stop Promoting Placeholder Art

Do not promote `/aaa/` to `/`.

Do not continue adding visual hacks to `/` unless they preserve the current working demo. The target path is a Godot-based rebuild.

### Phase 1: Establish Godot Runtime

Install or locate Godot 4.x locally.

If disk is constrained, do not clone LFS-heavy repositories until space is reclaimed. Current observed free disk during this pass was about 4.3 GiB.

### Phase 2: Clone Seed Into Isolated Workspace

Create:

- `paradise/godot/seed-tps/`
- `paradise/godot/paradise-game/`

Keep the seed untouched. Build Paradise in the second folder by copying/adapting patterns.

### Phase 3: Core Scene Replacement

Replace shooter semantics with Paradise semantics:

- Player/camera: beach walking/fishing controller.
- Level: shoreline, beach house, bar, ocean.
- Interaction: cast/reel, talk to Alhena, pet/follow dog, time/weather controls.
- UI: minimal diegetic fishing HUD.

### Phase 4: Water First

Water is the key visual gate.

Minimum acceptable water for promotion:

- Dedicated full-screen WebGL ocean pass, not painted asset art.
- JONSWAP-inspired spectral wave stack with analytical normals.
- Fresnel sky reflection, subsurface scatter, fog, foam, glints, and ACES-style tone mapping.
- Transparent 3D mesh carrier for perspective displacement instead of an opaque flat sheet.
- Buoyant bobber/line behavior.
- Day/weather presets that change color, chop, foam, and visibility.

### Phase 5: Assets

Replace placeholders in this order:

1. Ocean material and shoreline terrain.
2. Beach house and bar models.
3. Black lab rig with idle/walk/sniff/sit animations.
4. Alhena rig with modest bartender wardrobe and face/hair variants.
5. Fish, fishing rod, bobber, line, and catch animations.

### Phase 6: Web Export

Deploy Godot web export under:

- `https://paradise.alhena.cc/game/`

Keep `/` as a landing/launcher page until `/game/` visually beats it.

## Promotion Gates

The Godot version may replace the current page only when:

- Production URL loads without runtime errors.
- Web export works on desktop Safari/Chrome.
- Mobile landscape controls are usable.
- Water visibly exceeds current 2D water.
- Alhena and dog no longer read as placeholders.
- Screenshot evidence is captured and committed.

## Runtime Asset Contract

The live Three.js `/game/` route now exposes the same asset expectations in a
deployable manifest:

- `public/assets/paradise-asset-manifest.json`

The manifest is intentionally small and production-safe. It lists the runtime
slots that must be replaced by optimized assets:

- `alhena_bartender_rig`
- `black_lab_rig`
- `shoreline_environment`
- `spectral_ocean`

The current `/game/` page fetches this manifest and reports the active/needed
asset count in the hidden `Q` diagnostics panel. This is the bridge between the
current live Three.js prototype and the later Godot/GLB asset pipeline: exports
should satisfy the manifest first, then replace procedural placeholders one slot
at a time.
