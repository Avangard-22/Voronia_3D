# Stage 8.0.11 — Planet Surface Geometry Budget & LOD

## Implemented

- Added `src/renderer/surfaceBudget.ts`: deterministic distance-to-detail policy (`high` / `balanced` / `low`), geometry memory estimator, triangle/feature/memory budgets, and budget-overrun check.
- `buildPlanetMeshData` accepts `featureDetail` (0/1/2). It reduces only procedural decorative structures: ring segment counts and ridge/crystal spike counts. The base cell surface, original `cell.poly` topology, boundaries, cell IDs and face-to-cell picking order are not simplified.
- Added `featureTriangleCount`, `boundarySegmentCount`, and `estimatedGpuBytes` diagnostics to `PlanetMeshData`.
- Feature triangles remain in the same pickable surface buffer. This deliberately preserves `faceIndex -> faceCellIds` mapping and avoids a second raycast surface.
- Added unit tests for distance tier selection, memory estimate monotonicity, and budget checks.

## Important scope boundary

This stage introduces build-time detail presets and a distance policy, but does not yet hot-swap/rebuild surface geometry while the camera moves. Existing marker LOD in `scene.ts` remains the only runtime Three.js LOD switch. The distance policy is ready for the next integration step; automatically rebuilding the full surface per zoom frame would cause stalls and is intentionally not done.

GPU memory is an estimate based on known attribute widths, not a driver-reported allocation. No triangle reduction is applied to the interactive base polygon mesh.

## Verification

- Architecture check and isolated type checks are recorded in the delivery summary.
- Vitest/browser/WebGL validation is not claimed unless actually run in the delivery environment.
