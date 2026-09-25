# Tactile materials and draped canopy - 2026-09-25

## Scope

Starting from canonical `484a24f`, this pass changes the miniature environment,
not the fishing mechanics or ocean solver. `tactile-materials.js` supplies
periodic authored wood, linen and terracotta data. Six shared 256x256 textures
provide albedo, bump and roughness, approximately 2 MiB including mipmaps.
Metric UVs follow individual timber members and survive the existing material
batching path. No downloaded assets, photo cutouts, full-screen overlays or
extra render passes are added.

The awning's rigid strips are replaced by 24 closed fabric panels with a draped
profile and scalloped front hem, 6,816 triangles total. Supporting posts were
shortened after the first visual inspection caught them protruding through the
lowered fabric. This is authored cloth geometry, not a dynamic cloth solver.
Chair and umbrella fabric share the same linen material family. Cottage roof
tiles, structural timber, decking and bar platform retain the original palette.

## Local evidence

- `tactile-unit.tap`: 52 passing tests. Four new tests cover bounded periodic
  maps, sharing and filtering, metric UV preservation, closed outward panel
  topology, matching stripe seams, drape and hem shape.
- `tactile-final-webkit/report.json`: no browser errors; actual fixture GPU
  pixels change on 26.5% of the frame when only material maps are toggled.
  This proves rendered material use, not an objective beauty score. Both
  close-up galleries and the landing scene were inspected.
- `tactile-flow-webkit/report.json`: full cast/strike/feathered fight/catch,
  catch persistence, actor responses, night/storm, and both touch layouts pass.
  Mean sampled bobber-to-surface distance is 0.0693 world units. Landing FPS
  samples are 56 desktop, 60 portrait and 49 landscape on this Mac; these are
  not physical-phone benchmarks. Landscape fishing and night captures were
  inspected as well.

The initial gallery is preserved separately in
`mascom/logs/paradise-tactile-first-20260925`; it predates the post-height fix.
The independent wave experiment is checkpointed on its own branch at
`b833a94`, not included in this release. Its failed narrow-tank comparison is
documented rather than promoted. Full overturning waves, physical-phone
validation and commercial entitlement remain incomplete under the overall
Paradise goal.

## Promotion

Deployment must use the clean release clone's `paradise/safe-deploy.sh`, which
now includes the new unit tests and a live module check. Before promotion,
Wrangler identity was verified as the intended Johnmobley99 Cloudflare account.
Public source hashes and the full browser flow must be checked after deploy.
