# Stage 9.11 — Planetary System

## Scope
- The in-game scene switch now exposes only **Планета** and **Система**. The Galaxy tab is removed from the primary player flow; galaxy-domain code remains intact for future work.
- **Система** opens the planetary system belonging to the currently active planet.
- The system contains exactly five planets: the current game world plus four orbital candidates.
- Orbital planes use independent inclination and ascending-node values, with deterministic values per system seed. Orbital radii are distinct and increase outward.
- Undiscovered candidates are omitted from the 3D scene completely: no planet mesh and no orbit line. A successful sonar scan reveals that planet and its orbit. Activation is still required before travel.
- Sonar reveals one next unknown orbit at a time; the system view updates immediately after a successful scan.
- The system information panel is simplified and no longer displays galaxy navigation, sector coordinates, or interstellar routes.

## Preserved
- Existing planet surface, cell interaction, economy, save schema, sonar costs, activation costs, and within-system travel rules.
- Galaxy implementation remains in source but is not exposed as a primary scene tab.

## Validation
- Added/updated tests for five-planet count, deterministic orbital-plane parameters, and sonar visibility gating.
- Full test/build validation was not possible in this environment because dependency installation (`npm ci`) timed out; `tsc` could not resolve `vite/client` without installed dependencies.
