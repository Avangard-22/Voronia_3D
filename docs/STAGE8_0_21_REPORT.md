# Stage 8.0.21 — Surface Diagnostics Dashboard & Automated Stability Monitoring

## Implemented

- Added an opt-in developer dashboard (`src/renderer/surfaceDiagnosticsDashboard.ts`). Press **F3** to show/hide it. The panel is DOM-only and does not add objects to the Three.js scene.
- Dashboard displays session duration, estimated resident/peak bytes, configured budget, base/decorative/staging resource counts and byte totals, lifecycle counters, duplicate registrations, and recent alerts.
- Added a bounded memory-history bar chart and recent alert list.
- Added `SurfaceStabilityMonitor` with bounded sample/alert histories, sample throttling, and alerts for budget overruns, duplicate registrations, lifecycle-accounting mismatch, and rapid memory growth.
- Integrated monitoring into the planet render loop and exposed `toggleSurfaceDiagnostics()` plus the existing diagnostic snapshot API.
- Added deterministic tests for budget alerts, bounded monitoring history, duplicate detection, and repeated resource create/remove cycles.

## Geometry invariants

This stage does not alter planet or cell geometry. Original `cell.poly` polygons retain their individual vertex counts and shapes. Triangulation remains an internal GPU representation only. The dashboard and monitor are observational and do not mutate cell topology, chunk assignment, or `faceIndex → cellId` mappings.

## Verification status

- Architecture check: run separately and record result in delivery notes.
- TypeScript/Vitest/full Vite build: dependent on project dependencies being installed; do not infer success if unavailable.
- Browser/WebGL profiling: not performed in this stage; dashboard UI and real GPU memory reporting require browser validation.

## Known limits

- Memory values remain estimates based on tracked geometry attribute buffers, not driver-reported VRAM.
- The chart shows bounded samples rather than a continuous profiler trace.
- Automated monitoring is observational; it raises alerts but does not automatically alter quality tiers or evict resources.
