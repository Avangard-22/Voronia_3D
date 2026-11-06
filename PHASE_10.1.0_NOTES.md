# Phase 10.1.0 — V1 Mechanics Reconciliation & Development Direction Reset

## Scope reset

- V2 remains a development of V1, not a separate game with an independent progression direction.
- The playable navigation boundary is the active planetary system. The spiral galaxy map and background star systems are not exposed in the game map.
- Planet surface remains the primary gameplay space; the system map is a local navigation layer for the star and its planets.
- Galaxy graph, route, and discovery domain data are retained internally for compatibility/future work, but are not projected into the active map.

## Implemented in this phase

1. Render payload is restricted to the active planet node and its single host star system, centered at local origin. No galaxy edges, distant systems, or spiral coordinates are passed to the renderer.
2. Legacy `galaxy` navigation events now resolve to the active planetary system view.
3. Removed the spiral-arm / galaxy-cluster / galaxy-nebula backdrop from the system scene.
4. Added slow deep-space starfield drift and a separate isotropic dust field for subtle parallax and motion.
5. Unrevealed orbital bodies are no longer instantiated as dark placeholder spheres. The zero-instance fallback that could create a black point is removed; only confirmed/scanned planets render as bodies.
6. Preserved orbital discovery, activation, and travel commands. No save schema or economy formula changed.

## V1 reconciliation decision

- Use the exact V1 `v0.0.41.0` source and bundled `v0.0.41` registry as the reference baseline already documented in `docs/STAGE10_0_1_MECHANICS_PARITY_AUDIT.md`.
- Treat all `PARITY_CHECK_PENDING` rows as unverified until formula-level tests or runtime replay are completed.
- Prioritize missing V1 gameplay loops over new galaxy-scale features or decorative systems.
- Keep ledger as the only balance mutation path; keep transaction journal out of the visible main screen.

## Validation

- Added a render-model test for one centered active planetary system with no galactic edges.
- Source changes inspected; ZIP integrity checked after packaging.
- Full TypeScript/Vitest/Vite build not run because `node_modules` is not present in the supplied archive/runtime.

## Next phase

**Phase 10.1.1 — V1 Gameplay Gap Prioritization & Golden Runtime Baseline**

Extract a compact V1 feature/command/formula inventory, rank missing loops by their dependency on the playable planet, and define golden runtime scenarios/save snapshots. No new unrelated mechanics should be added before this baseline is established.
