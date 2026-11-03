# Stage 8.0.18 — Surface Residency Manager & GPU Resource Recovery

## Implemented

- Added `SurfaceResidencyManager` with explicit resource classes: `base`, `decorative`, `staging`.
- GPU memory is estimated from typed-array attribute byte lengths. The default residency budget is 96 MiB.
- When the budget is exceeded, least-recently-used, unpinned decorative resources are evicted first. Interactive base geometry is never an eviction candidate; the manager may report that the budget remains exceeded when only protected resources remain.
- Registered the monolithic interactive surface, polygon boundary layer, neighbour graph, and generated base chunks with the residency manager.
- Decorative cell-boundary and neighbour-graph geometries can be disposed under pressure. The cell base surface and chunk geometry remain resident to preserve continuous rendering and Raycaster coverage.
- Added WebGL context-loss/restoration handlers. Rendering pauses while the context is lost. On restoration, retained geometry attributes and materials are marked dirty so Three.js can re-upload retained CPU-side data.
- Added tests for LRU decorative eviction, protection of base geometry, and typed-array memory estimation.

## Polygon invariants

- Source `cell.poly` polygons and their individual side counts are unchanged.
- GPU triangle primitives remain only a rendering/tessellation representation.
- Base cell geometry and `faceIndex -> cellId` maps are not evicted.

## Limitations

- Byte counts are estimates of attribute-buffer storage, not driver-reported VRAM usage; index buffers, alignment, shader/program allocations, textures, and driver overhead are not fully represented.
- The manager currently tracks the main surface, boundaries, neighbour graph, and streamed chunks. It does not yet implement automatic re-creation of evicted decorative layers during the same session; those layers are disposable visual enhancements.
- Context restoration relies on Three.js r170's WebGLRenderer restoration path plus marking retained resources dirty. Actual device/browser context-loss behavior still requires browser testing.
- Full Vitest, Vite build, and browser/WebGL checks were not run because project dependencies are not installed in this workspace.
