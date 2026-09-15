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

Before deployment, validate candidate assets from the `paradise/` directory:

```sh
node scripts/verify-assets.mjs
```

The asset budgets and minimum replacement criteria live in
`assets.pipeline.json`. A candidate asset should not replace a fallback unless
it visibly improves the production screenshot set in `verification/`.
