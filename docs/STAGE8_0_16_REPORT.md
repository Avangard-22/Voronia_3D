# Stage 8.0.16 — Seamless Chunk Boundaries & Priority Streaming

## Implemented

1. `surfaceStreamingPolicy.ts` adds deterministic chunk scheduling based on camera-facing direction, selected cell, and actual graph neighbours.
2. Cross-chunk shared borders are represented as canonical dependencies (`minCellId:maxCellId`). This avoids duplicate or direction-dependent edge identities.
3. The Worker receives the priority order and emits whole-cell chunks in that order. The cooperative fallback applies the same order.
4. Existing global polygon tessellation and shared-boundary consensus remain the source of boundary positions. Chunking is a render partition only; it does not triangulate or simplify source `cell.poly` polygons as gameplay cells.
5. The monolithic mesh remains active until all replacement chunks are ready, preserving interaction during preparation.

## Geometry terminology

`cell.poly` is the authoritative gameplay polygon and can have any supported side count and individual shape. GPU triangles are only an internal rasterization representation. A triangle is not a Voronia cell. This invariant is preserved.

## Tests added

- canonical shared-edge key independent of cell order;
- cross-chunk adjacency dependency extraction;
- active-cell and neighbour priority over camera-facing baseline;
- empty topology behavior.

## Limitations

- Priority is calculated when the planet build begins; continuous reprioritization while the camera rotates is not yet implemented.
- The Worker returns the ordered chunk set as one completion payload. Incremental per-chunk installation and camera-driven eviction/reload remain future work.
- Atomic replacement temporarily retains source and replacement geometry concurrently; this stage does not claim zero-overlap memory streaming.
- Browser/WebGL runtime and device FPS were not verified in this stage.
