# Stage 10.0.9 — Mining Logistics, Deposit Prioritization & Fleet Allocation

## Implemented
- Added a planet-level mining logistics plan built exclusively from scanned iron/cryogen deposits.
- Ranks deposits deterministically using existing geological quality, stratum and remaining-reserve percentage.
- Reports operational state (active, cooldown, depleted, locked), remaining reserve, depletion rate and estimated lifetime.
- Produces a percentage-based recommended allocation of available mining attention across active deposits.
- Displays the top priorities in the planet HUD, with a clear note that the allocation is advisory.

## V1 direction / compatibility
- This is a read-only planning layer, not a new fleet simulation or autonomous mining mechanic.
- No fleet units, costs, resources, persistent assignments, save fields, mining multipliers or production formulas were introduced.
- V1-compatible extraction, depletion, cooldown and reactivation remain authoritative and unchanged.
- Only explored deposits contribute; hidden and revealed-but-unscanned geology remains excluded.
- Compact number formatting and the unified 13px interface text size are retained.

## Validation
- Added tests for quality-based ranking, allocation totals, depleted deposits and cooldown handling.
- ZIP integrity and source syntax transpilation checked.
- Full Vitest/typecheck/build were not run because `node_modules` is not installed in the environment. Run `npm ci`, `npm test`, and `npm run build` before deployment.
