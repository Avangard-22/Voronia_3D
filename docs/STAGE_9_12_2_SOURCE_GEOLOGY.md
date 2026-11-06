# Stage 9.12.2 — Source-Based Merged Surface Reconstruction

## Implemented

- Restored the V1 `ni()` merged-cell geometry contract: `_polys` is treated as the complete set of source polygons belonging to one gameplay cell.
- The V2 planet mesh now builds relief for every source polygon instead of rendering only the representative `cell.poly`.
- Cell selection, resource type, level, exploration state, economy identity, and `faceCellIds` remain attached to the merged gameplay cell ID.
- Internal polygon seams inside one merged cell are omitted from the visible cell-boundary overlay; outer boundaries remain visible.
- `cellSideCounts` reports the total number of source polygon sides for chunk planning.
- Added regression coverage for multi-polygon merged cells and deterministic geometry output.

## Preserved

- No changes to economy, scanning, persistence schema, save migration, or deployment workflow.
- No changes to the V1 mixed-cluster generation or resource aggregation rules.
- Existing non-merged cells continue to use `cell.poly` as before.

## Validation status

- TypeScript syntax transpilation: passed for modified source and test files.
- Full TypeScript typecheck, Vitest suite, and Vite build: not run; dependency installation timed out in the environment.

## Next

- Build connected continental regions from the existing cell-neighbor graph and merged polygon topology.
- Add biome-aware coast transitions, terrain material layers, and atmospheric scattering without changing gameplay cell identity.
