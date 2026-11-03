# Stage 8.0.20 — Surface Streaming Diagnostics & Long-Session Stability

## Implemented

- `SurfaceResidencyManager` now publishes typed lifecycle events for resource registration, explicit removal and LRU eviction. It exposes a read-only snapshot of current resource records and emits removals during `clear()`.
- Added `SurfaceStreamingDiagnostics`: per-category resource counts and estimated bytes (`base`, `decorative`, `staging`), current and peak residency, session elapsed time, registration/release/eviction counters, duplicate-ID replacement counter, lifecycle balance, and a bounded event history.
- Integrated diagnostics with `PlanetViewer.getSurfaceDiagnostics()` so runtime diagnostics can be inspected without exposing renderer internals.
- Added deterministic `runSurfaceLifecycleCycles()` to exercise repeated create/remove cycles without requiring a browser or GPU.
- Added tests for category accounting, peak bytes, duplicate registration, LRU eviction, bounded history, and 1,000 cycles × 4 resources with zero residual registrations/bytes.

## Geometry invariant

Diagnostics only observe resource lifecycle. They do not modify `cell.poly`, polygon side counts, adjacency, tessellation, chunk ownership, or `faceIndex → cellId`. Arbitrary polygonal cell shapes remain the gameplay geometry; triangles remain internal GPU rendering primitives.

## Verification and limitations

- The diagnostics and residency classes are deterministic and can be tested without WebGL.
- Byte figures are estimates from CPU-visible typed-array storage, not actual driver-reported VRAM. Textures, shader programs, driver alignment, and hidden Three.js allocations are not fully measured.
- The stress helper verifies manager-level lifecycle balance, not a real 30–60 minute browser session or GPU-driver leak behavior.
- Browser/WebGL context-loss and long-session profiling remain deferred as requested; full project tests/build depend on installed project dependencies.
