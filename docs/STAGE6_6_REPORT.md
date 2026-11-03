# Stage 6.6 — Expedition Routes

## Scope

Stage 6.6 introduces domain-backed travel routes between discovered and unlocked planetary systems. The galaxy renderer remains a consumer of snapshots; route calculation and resource payment are owned by the game domain.

## Implemented

- `src/galaxy/routes.ts`: deterministic Dijkstra route search over graph edges whose endpoints are both discovered and unlocked.
- Per-leg quotes use 150 energy per coordinate-distance unit, plus sector surcharge (core 0, inner 250, mid 700, outer 1400). A leg touching an anomaly-classified system receives a 1.25 multiplier.
- Route options expose full path, hop count, total distance/energy, and the next hop with its current leg cost.
- `travelToPlanet` executes exactly one edge of the shortest-cost path. For a multi-hop destination, the player repeats the action from each intermediate system; the next snapshot recomputes the remaining path.
- Each hop is charged atomically through `ResourceLedger`. Failed payment does not change active planet or travel count.
- Legacy `setActivePlanet` command is retained as an alias, but now uses the same route and payment rules; it can no longer bypass travel economics.
- Route quotes are derived from graph state and active location, so there is no separate route-save state to become stale. Active planet and session travel count remain in the existing save payload.
- HUD displays route path, hop count, next stop, leg price, total route distance and estimated total energy.

## Tests added

`tests/stage6_6_expedition_routes.test.ts` covers multi-hop path selection, exclusion of locked transit nodes, distance/sector/anomaly pricing, deterministic route lists, in-game travel, atomic energy payment, and insufficient-energy rejection.

## Verification status

Architecture check and strict targeted TypeScript checks are run during packaging. Full Vitest, full Vite production build, browser/WebGL and Android device checks require the project dependency installation and are reported separately; they must not be inferred from source-level checks.

## Design notes / limitations

- Route execution is one jump per command; this is intentional so intermediate systems remain meaningful stops and each leg has an independent cost.
- Route graph currently uses the existing generated graph edges. It does not invent new connections or permit travel through locked/undiscovered nodes.
- Sector and anomaly surcharges are Stage 6.6 balance defaults, centralized in `ROUTE_POLICY` for later tuning.
- This stage does not yet add cargo/fuel capacity, travel time, ambush events, or automatic multi-hop travel.
