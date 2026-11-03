# Stage 8.0.10 — Surface Performance & GPU Optimization

## Implemented

- Added `src/renderer/surfaceQuality.ts` with three GPU quality tiers (`low`, `balanced`, `high`).
- Added a rolling frame-time controller with hysteresis: quality is reduced when p95 frame time exceeds 30 ms or average exceeds 23 ms; quality is raised only after sustained headroom (p95 below 17 ms and average below 15 ms).
- Added tier-specific device-pixel-ratio caps, preserving CSS canvas dimensions and the existing mobile/desktop caps.
- Connected the adaptive controller to `PlanetViewer`. The viewer updates internal render resolution only when the tier changes and exposes the current `qualityTier` for diagnostics.
- Added shader quality uniforms. Low tier disables procedural noise contribution and reduces geological displacement/animation; balanced and high tiers progressively restore detail.
- Added unit coverage for invalid samples, sustained pressure, recovery hysteresis, and DPR caps.

## Preserved

- Cell polygons and their different side counts.
- Per-cell geological geometry and feature generation.
- Cell IDs, `faceCellIds`, picking, scan/upgrade domain commands, and persistence.
- No mesh decimation or topology substitution is performed; visual identity and cell interaction are not traded away for performance.

## Verification

- `node tools/check_arch.mjs`: passed.
- ZIP/TAR.GZ archive integrity: verified when packaging.
- Vitest, full TypeScript build, browser/WebGL shader compilation, and device profiling: not run in this environment. The project dependencies are not installed (`node_modules` absent).

## Known limits

- Adaptive control uses CPU-observed frame intervals as a proxy; it cannot distinguish GPU saturation from CPU/main-thread stalls.
- DPR reduction lowers fragment workload but does not reduce triangle count or draw calls.
- Low tier reduces shader work but does not remove procedural geological geometry. A later profiling-led stage should add geometry budgets/LOD only if measurements show this is the bottleneck.
