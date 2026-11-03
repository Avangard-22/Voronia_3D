# Stage 8.0.12 — Runtime LOD & Surface Streaming

## Implemented

- Added `RuntimeSurfaceLodController` with near / mid / far tiers and hysteresis.
- Runtime tier selection uses camera-to-planet distance and is evaluated in the render loop.
- Near: cell boundaries, neighbour graph, high marker detail, full geological shader detail and animation.
- Mid: cell boundaries remain visible; neighbour graph is hidden; marker detail and shader workload are reduced.
- Far: boundaries and neighbour graph are hidden; marker detail and shader workload are reduced further.
- Marker LOD transition is moved into the actual zoom range (near at 0, low-detail marker mesh from 3.55).
- LOD changes only toggle existing scene layers and uniforms. No planet geometry rebuild or per-frame GPU buffer upload is performed.

## Interaction and topology guarantees

- The base surface mesh remains present at every tier.
- `faceCellIds` and the base surface triangle order are untouched; raycasting continues against the same surface mesh.
- Original per-cell polygon topology (`cell.poly`, including varying side counts) is not simplified.
- Cell boundaries are a decorative layer and can be hidden at far distance without changing picking topology.

## Streaming scope / limitations

This stage implements distance-driven progressive activation/deactivation of already resident render layers (a lightweight surface streaming policy). It does not yet asynchronously load/unload chunks, regenerate geometry in workers, or reduce base-surface triangle count. Those operations require a chunk representation and stable cell/face remapping, and are intentionally not simulated here.

## Validation

- Added unit tests for initial near tier, mid/far transitions, hysteresis and invalid distance handling.
- Browser/WebGL shader compilation and runtime FPS measurements are not claimed; browser verification remains deferred.
- Full Vitest/build depend on project dependencies being installed in the environment.
