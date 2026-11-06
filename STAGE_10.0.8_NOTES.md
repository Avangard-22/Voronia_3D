# Stage 10.0.8 — Advanced Mining Operations & Geological Extraction Optimization

## Implemented
- Added a read-only mining operation profile for each scanned iron/cryogen deposit.
- Exposes the active extraction multipliers separately: deep-vein status, cell level, drilling arm, planet progression, planet perks, energy/sleep mode, technology modifier and mutation.
- Calculates the combined multiplier from the same factors used by the existing V1-compatible depletion formula.
- Adds operational state and a contextual recommendation: depleted reserve, cooldown, locked/unavailable extraction, limiting modifier, or no critical limiter.
- Displays the operation profile inside the selected deposit panel. Only explored deposits receive this data.

## Compatibility
- No new resources, costs, mining modes, persistent fields, save migration or economy multipliers.
- Existing V1 depletion, reserve, cooldown and reactivation formulas remain unchanged. The profile is diagnostic only and does not alter production.
- Stage 10.0.6 compact number formatting and unified 13px UI text size remain in place.

## Validation
- Source-level checks and ZIP integrity performed.
- Full TypeScript/Vitest/build not run because dependencies are not installed in this environment. Run `npm ci`, `npm test`, and `npm run build` before deployment.
