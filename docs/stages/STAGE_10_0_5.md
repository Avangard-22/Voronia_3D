# Stage 10.0.5 — Geological Resource Extraction & Deposit Depletion

## Scope

Expose the existing V1-parity vein extraction/depletion lifecycle clearly to the player without changing its balance formulas.

## Implementation

- Added `ProductionService.activeDepletePerSec()` to report the effective reserve drain only for explored, active, unlocked vein cells with remaining reserve and no active cooldown.
- Added `reserveLifetimeSeconds()` as a read-only estimate based on the current reserve and the existing depletion formula.
- Extended `CellView` snapshots with `depletionPerSec` and nullable `reserveLifetimeSeconds`; UI continues to render only snapshot data.
- Geological cell panel now shows reserve, depletion rate, estimated time to exhaustion, active extraction state, and the existing reactivation cooldown/action.
- Preserved the existing V1 depletion, level, planet, arm, perk, sleep, mutant, cooldown, and reactivation formulas. No new resources are minted by these projections.

## Verification

- Added tests for baseline extraction rate/lifetime, reserve progression, cooldown inactivity, reactivation, and hidden/non-vein guards.
- Syntax checks and archive integrity are performed for this delivery.
- Full Vitest/typecheck/production build status is reported separately; these require installed project dependencies.
