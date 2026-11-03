# Stage 8.0.24 — Surface GPU Resource Lifecycle & Memory Pressure Recovery

## Scope

This stage introduces explicit ownership for the primary surface geometries and their residency records, and formalizes the renderer's WebGL context-loss recovery path. The manager is deliberately separate from game-domain state.

## Implemented

- Added `SurfaceGpuResourceLifecycle` to track renderer-owned GPU resources by stable ID.
- Explicit release removes the matching residency entry and disposes the tracked resource exactly once.
- Residency-triggered eviction invokes the resource disposer; pinned base resources remain non-evictable under the existing policy.
- Duplicate IDs are replaced safely and counted.
- Context loss/restoration is tracked; restoration callbacks re-mark retained geometry attributes for upload.
- Integrated lifecycle tracking for the monolithic base surface and streamed surface chunks.
- Scene teardown releases tracked resources before disposing remaining untracked scene geometries/materials.
- Chunk replacement and aborted staging release their tracked geometry through the lifecycle manager.
- Existing decorative boundary/neighbor graph resources continue to use their residency eviction callbacks and can be reconstructed from retained `PlanetMeshData`.

## Safety invariants

- Base surface/chunk resources are registered as pinned `base` resources.
- Decorative LRU eviction remains restricted to unpinned `decorative` resources.
- The lifecycle manager does not mutate cells, save data, economy, or polygon topology.
- Context recovery does not discard retained CPU-side geometry arrays.
- This is estimated geometry residency accounting, not a measurement of actual driver VRAM.

## Verification

Added `tests/stage8_0_24_gpu_lifecycle.test.ts` covering explicit exactly-once disposal, decorative eviction with base pinning, context loss/restore callback behavior, and duplicate-ID replacement.

The complete Vitest suite and Vite build require project dependencies (`node_modules`) and are not run in this dependency-free workspace. Browser/WebGL context-loss testing remains deferred. The tests are source-level additions; no physical GPU or Android performance claim is made.
