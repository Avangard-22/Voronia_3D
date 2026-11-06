# Phase 10.1.2 — V1 Core Loop Parity Lock

- Added an integrated regression suite for the V1 v0.0.41 scan trail, upgrade curve, and vein extraction/depletion/cooldown/reactivation lifecycle.
- Locked scan rejection atomicity for hidden cells.
- Added a parity policy and priority matrix for the remaining V1 reconciliation work.
- No balance formulas, resource values, save schema, or runtime gameplay behavior were intentionally changed.
- Planetary-system-only scope retained; no spiral-galaxy map progression is added.

Checks: `node tools/check_phase10_1_1_baseline.mjs` PASS; `node tools/check_phase10_1_2_parity.mjs` PASS. `tsc -p tsconfig.app.json --noEmit` could not run because `vite/client` types are unavailable (dependencies are not installed). `check_arch` still reports the pre-existing `planetMesh.ts -> planets/continental.ts` boundary violation. Full Vitest/build remain unrun for the same missing-dependencies reason.
