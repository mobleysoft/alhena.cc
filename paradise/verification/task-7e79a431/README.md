# Paradise rain polish — task 7e79a431

Implemented wind-slanted rain streaks and expanding, fading water-contact rings
in the existing unified Three.js cove. The old rain was 600 falling points with
a hardcoded y=0 reset. Contacts now use the actual moving ocean/terrain, and
rings align with the ocean tangent. Rendering uses one line batch and one
instanced ring batch per scene pass, with a fixed pool of 600 drops / 64 rings.
Weather changes fade the effect; reduced motion disables it. No extra assets,
runtime dependencies, controls, or ocean solver changes.

## Isolation and review

The coordinator originally assigned this task to `/Users/johnmobley/nginx`,
which contains no Paradise source. The actual source is `/Users/johnmobley/alhena.cc`.
Created branch `task-7e79a431` from `208bb91` in a worktree inside the provided
sandbox (`paradise-source/`). Corrected only this task's `repo_dir`, `sandbox_dir`,
and `verification_cmd` so submission/review targets the actual source. The
original nginx checkout was not edited. Existing untracked `shore.js` in the
canonical Alhena checkout was not copied or modified.

No deployment, push, safe-deploy invocation, or merge was performed.

## Verification

- `node --test paradise/scripts/test-cove.mjs paradise/scripts/test-rain.mjs`:
  **18 passed**, including existing waves, locomotion, splash and catalog tests.
- `verify-cove.mjs`: **passed** real cast/strike/reel/catch, persistence after
  reload, actor reactions, time/weather controls, portrait and landscape touch.
- `verify-rain.mjs`: **passed** desktop/mobile storm and moonlight, water
  contacts increasing over time, bounded rendered rings, complete fade to
  calm, reduced motion and no horizontal overflow.
- Both browser reports contain no console errors. Chromium on Apple M4/Metal,
  served locally on port 8798 with the CPU ripple fallback explicitly selected.
  This pass does not claim production, real phone hardware, or WebGPU testing.
- Reviewed before/after desktop storm and mobile moonlight screenshots.

Reports/screenshots are in `gameplay/` and `rain/`; `before-storm.png` records
  the previous point-based rain. Reproduce with a static server rooted at
  `paradise/public`, setting `PARADISE_URL` and `PLAYWRIGHT_MODULE` as needed.

Scope limits: decorative rain, not a full 3D fluid simulation. Contacts sample
terrain and water rather than colliding with individual roofs/palm leaves.
