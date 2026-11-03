# Stage 6.7 — Galaxy Economy / Logistics

## Scope

Stage 6.7 introduces actual freight movement between planetary systems. The player loads transportable resources from the shared ledger into a finite cargo hold, travels using the Stage 6.6 graph, unloads goods into a local planetary depot, and can withdraw depot stock back into the shared ledger at that planet.

## Implemented

- `src/logistics/service.ts`: cargo hold, per-planet depots, transportable-resource validation, mass accounting, capacity checks, load/unload/withdraw operations, serialization and hydration.
- Cargo capacity: 100 t base + 50 t per warehouse level.
- Planetary depot capacity: explored cells × warehouse tons-per-cell.
- Planet specialisation: a resource listed by the planet's cell data occupies 25% less depot capacity (effective cargo weight factor 0.75).
- Freight cost: `ceil(cargoMass × legDistance × 0.5)` additional energy per jump. Dijkstra route selection and route quotes both include the current cargo mass.
- New domain commands: `loadCargo`, `unloadCargo`, `withdrawDepot`.
- Snapshot/HUD show cargo, depot, capacities and available resource operations.
- Save v2 receives an optional `logistics` section; older v2 saves hydrate with an empty cargo hold and empty depots.
- `LOGISTICS_STATUS` is now `PARTIAL`, not `NOT_IMPLEMENTED`.

## Deliberate limitations

- Current production remains in the shared ledger; loading is the explicit step that converts shared stock into physical freight.
- Depots are persistent local stockpiles. Automatic production-to-depot routing, market prices, contracts, fleets and time-based shipments are not part of this stage.
- Local depots do not yet fund cell upgrades directly; `withdrawDepot` returns goods to the shared ledger for existing domain systems.
- Cargo is retained while travelling and adds an energy surcharge; it is not lost on travel.

## Tests added

`tests/stage6_7_galaxy_economy.test.ts` covers cargo loading/capacity, route freight surcharge, travel and delivery, depot capacity rejection, withdrawal and save/load persistence.

## Verification

- `node tools/check_arch.mjs`: passed.
- Strict targeted TypeScript compilation of `Game`, HUD, logistics service and route module: passed.
- Full Vitest suite, full Vite production build, browser/WebGL and Android checks: not run in this environment because project dependencies are not installed. Test cases are added but not claimed as executed.
