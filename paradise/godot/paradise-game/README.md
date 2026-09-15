# Paradise V3 Godot Workspace

This is the authored-3D candidate workspace for `paradise.alhena.cc/game-v3/`.

The live V2 build already has the strongest water path: a dedicated
PandoraChat-style WebGL ocean shader. V3 exists to replace the weak parts around
that water: shoreline terrain, beach bar, house, fishing props, Alhena, and the
black lab.

## Rules

- Do not promote V3 over V2 until it visibly beats V2 in committed screenshots.
- Use Godot 4.x Compatibility rendering for browser export.
- Export to `../../public/game-v3/index.html`.
- Keep authored models within the budgets in `../../assets.pipeline.json`.
- Replace slots one at a time, with screenshots and verifier coverage.

## First Asset Slots

- `shoreline_environment`: authored beach, dock, bar, house, foliage, props.
- `alhena_bartender_rig`: rigged modest bartender with idle/serve/wave/talk.
- `black_lab_rig`: rigged black lab with idle/walk/sniff/sit/tail-wag.
- `spectral_ocean`: keep V2 shader as the visual baseline until Godot water beats it.

## Export

Install Godot 4.x, then export the `Web` preset. The Cloudflare static asset
Worker serves `/game-v3/` directly from `public/game-v3/`.
