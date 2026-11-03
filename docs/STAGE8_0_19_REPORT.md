# Stage 8.0.19 — Surface Resource Streaming & Dynamic Restoration

## Implemented

- Added `SurfaceResourceStreaming`, a frame-budgeted restoration queue for reconstructible surface decoration.
- Decorative cell boundaries and neighbour graph can be rebuilt from retained CPU-side `PlanetMeshData` after residency eviction.
- Restoration is prioritized: polygon boundaries precede the neighbour graph; the graph is requested only in `near` LOD, while boundaries are requested in `near` and `mid` LOD.
- At most one decorative resource is restored per render frame.
- Restored resources re-register with `SurfaceResidencyManager`, so the existing LRU budget remains authoritative and may evict older unpinned decoration.
- Pending restoration work is cancelled when the planet is replaced or the viewer is disposed.
- The original polygon cell topology and base interactive surface remain resident; restoration only recreates decorative overlays from the original data.

## Geometry invariant

`cell.poly` remains the source polygon geometry. Different side counts and individual polygon shapes are preserved. Triangles are only the renderer's internal primitive representation and are not treated as gameplay cells.

## Limitations

- Residency byte counts are estimates based on CPU-visible BufferAttribute array sizes, not driver-reported VRAM usage.
- Restoration rebuilds decorative overlays from retained `PlanetMeshData`; it does not yet regenerate the entire planet from a serialized compact source after CPU data release.
- Context-loss recovery still depends on Three.js resource restoration and requires browser/WebGL verification.
- Full Vitest and Vite build require project dependencies, which are not installed in this workspace.
