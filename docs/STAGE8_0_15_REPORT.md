# Stage 8.0.15 — Polygon-Aware Surface Streaming

## Implemented

- `PlanetMeshData` now carries each source cell's original polygon side count and its adjacency graph in CSR form (`neighborOffsets` + `neighborIds`).
- Added deterministic breadth-first chunk planning in `polygonSurfaceStreaming.ts`. Chunks are assembled from whole cells by traversing actual `GeneratedCell.neighbors`; a cell is never split between chunks.
- Surface triangle batches are assigned by the owning cell's topology-derived chunk ID in both Worker and cooperative fallback paths.
- The plan reports the original polygon side-count histogram and cross-chunk adjacency count for diagnostics.
- Existing globally generated polygon boundary layer remains intact during surface partitioning. Shared-edge tessellation and radial height consensus remain upstream in `planetMesh.ts`, so chunking does not create independent boundary vertices or alter cell polygons.
- Per-chunk `faceCellIds` remains the picking map; original `cell.poly` remains the source of cell shape and side count.

## Geometry terminology

`cell.poly` is an arbitrary polygon (including irregular polygons with different side counts). Triangles are only the internal GPU tessellation primitives used to render polygon interiors; they are not the game's cell shapes.

## Limitations

- Chunk assignment is graph-aware breadth-first grouping with a cell-count cap, not a camera-prioritized streaming scheduler.
- Cross-chunk adjacency is measured, not eliminated: connected cells can be in different chunks when a chunk reaches its capacity. This is safe because shared polygon boundaries are generated globally and remain a separate layer.
- The current surface worker still receives a copy of the monolithic vertex buffers. This stage does not claim reduced peak memory or per-region network/disk streaming.
- Browser/WebGL visual validation and Android profiling remain deferred.
