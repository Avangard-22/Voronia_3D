# Stage 8.0.14 — Web Workers & Memory-Aware Surface Streaming

## Implemented
- Added a dedicated module Worker (`surfaceChunk.worker.ts`) for spatial partitioning of the existing rendered surface triangle soup.
- Worker input is copied before transfer; the visible source mesh remains valid and pickable while the worker runs.
- Typed arrays are transferred back to the main thread as Transferable ArrayBuffers.
- Added explicit input-copy and output-geometry byte budgets (24 MiB each). If either budget is exceeded, Worker processing is rejected and the cooperative main-thread fallback is used; the monolithic surface remains visible.
- Worker is terminated after each completed/failed job. Existing generation token cancels stale results when the active planet changes.
- Chunk picking retains each chunk's `faceCellIds` mapping.

## Polygon geometry guarantee
Voronia cells are not assumed to be triangles or hexagons. The source cell is an arbitrary polygon represented by `cell.poly` and may have a different number of vertices/sides from its neighbors. This stage partitions the already triangulated render buffer only after the original polygon tessellation. It does not generate, normalize, or replace cell polygons. `cell.poly`, cell IDs, boundaries, and face-to-cell ownership remain unchanged. The word “triangle” in the renderer refers only to GPU rasterization primitives used to render polygon surfaces, not to the shape/type of a Voronia cell.

## Memory behavior and limitations
- The Worker avoids blocking the main thread during spatial partitioning.
- Input duplication is bounded by 24 MiB; generated chunk geometry is independently bounded by 24 MiB.
- During transition, the source mesh and generated chunks coexist. This is a bounded temporary peak, not zero-copy streaming of the original geometry.
- This implementation still partitions one whole surface into eight spatial octants. It does not yet implement camera-prioritized incremental chunk arrival, persistent worker pools, or eviction/LRU of chunks.
- If budgets are exceeded or Worker is unavailable, the system retains the original mesh and attempts the cooperative fallback. No claim is made that fallback is non-blocking under all device conditions.

## Verification
- Architecture check: run `node tools/check_arch.mjs`.
- Unit tests added for memory accounting; Vitest execution depends on installed dependencies.
- Browser/WebGL and Android-device profiling were not performed; browser verification remains deferred.
