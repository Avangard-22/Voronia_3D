# Stage 8.0.23 — Adaptive Surface Streaming Controller

## Goal

Adapt surface chunk preparation/install throughput to observed frame time and estimated renderer residency pressure, while preserving the complete interactive base surface and original cell polygon topology.

## Implemented

- Added `AdaptiveSurfaceStreamingController` as a renderer-independent policy module.
- Device classification uses conservative hints: mobile user-agent flag, `navigator.deviceMemory` when available, and `navigator.hardwareConcurrency`.
- Profiles: `constrained`, `balanced`, `capable`; streaming modes: `conservative`, `balanced`, `aggressive`.
- A rolling frame-time window (45 samples by default) and estimated residency ratio drive adaptive decisions.
- Degradation is immediate after sustained overload / memory pressure. Recovery requires sustained low frame time and memory headroom, reducing mode oscillation.
- Controller output adjusts maximum chunk installs per frame (1–4) and staging budget (profile-dependent, approximately 8–32 MiB before device/pressure scaling).
- `SurfaceStreamingRuntime.setLimits()` applies updated limits to the current generation. The limit cannot be reduced below bytes already prepared in that generation, preventing a mid-stream policy change from discarding staged geometry.
- Dynamic reprioritization now boosts the selected cell's chunk and chunks containing its actual graph neighbours, in addition to camera-facing priority.
- Live renderer supplies frame timing and estimated residency statistics to the controller each frame.

## Topology and interaction invariants

- No changes to `GeneratedCell.poly`, polygon side counts, adjacency, or cell IDs.
- No geometry simplification or conversion to a uniform hex grid.
- Base surface remains present until all replacement chunks are staged and installed.
- `faceIndex → cellId` picking remains based on the existing face-cell maps.
- Adaptive controller changes only scheduling throughput and temporary staging limits; it does not mutate game/domain state.

## Verification

- `node tools/check_arch.mjs`: PASS (103 files; architecture boundaries clean).
- Strict TypeScript compile of the new controller and runtime modules: PASS.
- Added tests for device classification, overload degradation, delayed recovery, adjacency priority, and runtime limit updates.
- Full Vitest and full Vite build were not run because `node_modules` is absent in the workspace.
- Browser/WebGL profiling was not run. The user previously deferred browser validation.

## Limitations

- Device memory and core count are browser hints, not reliable hardware benchmarks; some browsers omit `deviceMemory`.
- Residency bytes are estimates of tracked geometry buffers, not driver-reported VRAM or total process memory.
- Frame-time feedback reflects the observed render-loop interval; it is not a GPU timer query and cannot isolate GPU bottlenecks.
- Existing `AdaptiveSurfaceQuality` remains a separate controller for pixel ratio/shader detail. This stage specifically adapts chunk scheduling and staging budget.
- Real Android/low-end-device measurements and long-duration browser stress runs remain outstanding.
