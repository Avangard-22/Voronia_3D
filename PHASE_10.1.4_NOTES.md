# Phase 10.1.4 — Planet Switching, Per-Planet Storage & State Parity

## V1 parity restored
- `setActivePlanet` is a free switch between already-unlocked planet runtimes (legacy guard retained); no route energy is charged.
- Planet-local stock follows V1 `On()/yy()` behavior: `iron`, `kriogen`, and all `extraResources` are stored per planet and swapped atomically when the active planet changes.
- Global resources (`energy`, `crystals`, `research`, `dust`, `essence`, compounds, shards) remain global and are not swapped.
- `travelWithinSystem` uses the same atomic switch path. The explicit legacy `travelToPlanet` route API remains separate and performs the stock swap after a successful route payment.
- Production, vein depletion, income and synth ticks are evaluated for the active planet only. All unlocked planet runtimes remain available in the snapshot for selection and state display.

## Persistence and migration
- Save v2 adds optional `planetResources`, keyed by planet ID; old v2 saves remain readable.
- When an old v2 save has no per-planet map, its current stock is assigned to the saved active planet and other planets start empty.
- Legacy v39 migration imports inactive stocks from `planets[pid].storage` and the active planet's current stock from top-level `iron`, `kriogen`, and `extraResources`.
- Active stock is mirrored into the ledger on load; inactive stock remains in the per-planet map.
- Planet cell progress, geological reserves, scan pricing, sonar state, and global balances are preserved.

## Verification
- Added regression tests for free switching, locked/unknown guards, independent stocks, save/load persistence, and v39 migration.
- Updated superseded paid-switch expectations and marked TV-25 complete.
- Full Vitest/build/typecheck depend on installed dependencies; this archive environment does not include `node_modules`.
