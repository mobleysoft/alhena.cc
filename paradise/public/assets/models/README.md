# Paradise Runtime Model Slots

Drop optimized GLB assets here to replace the procedural fallbacks in
`/game/` without changing gameplay code.

Expected files:

- `alhena-bartender.glb`
- `black-lab.glb`
- `paradise-shoreline.glb`

The live page reads `/assets/paradise-asset-manifest.json`, attempts to load
each model slot, and keeps the procedural fallback visible when an asset is
missing or invalid.
