# Stage 8.0.17 — Surface Streaming Runtime & Memory Eviction

## Implemented

1. `SurfaceStreamingRuntime` schedules no more than two chunk installations per render frame.
2. Pending chunks are reprioritized using the current camera-facing direction and the chunk containing the selected cell.
3. Prepared chunks are staged off-scene while the original monolithic surface remains visible and pickable.
4. The scene swaps to chunk meshes atomically after all chunks have been staged. If the 24 MiB staging budget would be exceeded, staging is aborted and the monolithic surface remains active.
5. Planet replacement/disposal cancels pending runtime work and disposes staged GPU geometries.
6. Tests cover frame budgeting, camera/selection priority, staging-memory rejection, and cancellation cleanup.

## Geometry invariants

- `cell.poly` remains the authoritative gameplay polygon geometry.
- Polygon side counts and graph adjacency are not modified by runtime streaming.
- Triangles are GPU rendering primitives, not gameplay cells.
- Per-chunk `faceCellIds` continue to map Raycaster face indices to original cell IDs.

## Memory semantics and limitations

The runtime bounds staging payloads and releases temporary staged geometry on cancellation or rejection. It does **not** evict resident base-surface chunks after installation: doing so would create holes or remove raycast coverage. It also does not yet provide GPU-memory residency paging or restoration from compressed CPU backing storage. The 24 MiB guard covers staged chunk payloads, not the monolithic source mesh plus all Three.js/WebGL allocations.

The worker still returns its chunk set as one result; this stage schedules installation across frames, not incremental worker messages. Camera reprioritization affects chunks that have not yet been staged; it cannot reorder chunks already installed into the staging set.

## Verification status

- Unit tests added: `tests/stage8_0_17_surface_runtime.test.ts`.
- Full Vitest, complete Vite build, browser/WebGL execution, and device memory profiling were not run in this environment.
