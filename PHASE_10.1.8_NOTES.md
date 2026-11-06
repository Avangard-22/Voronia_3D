# Phase 10.1.8 — V1 Offline Production, Time Progression & Recovery Parity

## Implemented
- Save load now computes elapsed wall-clock time from `savedAt` and passes it to the game restore path.
- Offline catch-up follows the V1 balance registry: minimum 60 seconds, maximum 43,200 seconds, 50% efficiency.
- Catch-up advances the game clock and applies active-planet production and passive income at the configured offline efficiency. The synthesizer uses its separate V1 `transport.config.offlineCapMult` multiplier rather than silently inheriting the passive-income efficiency. Offline processing is split at vein depletion/cooldown boundaries so a deposit contributes income only for the interval in which it is actually active. Warehouse capacity remains authoritative.
- Reactor queue progress is restored in offline segments and capped by `craft.offlineCapSec` (28,800 seconds); reactor inputs/outputs still use the existing atomic ledger transactions.
- Random surge scheduling is not replayed during offline catch-up. Short-lived active-session buffs are not fabricated.
- Offline catch-up does not increment active-session playtime.
- Successful load immediately writes a fresh save timestamp, preventing repeated load of the same save from awarding the same offline interval twice.
- Explicit import restores the imported snapshot without crediting time elapsed before the import, then anchors a fresh save.

## Compatibility
- Save schema remains version 2; `savedAt` already existed, so no schema migration is required.
- Legacy v39 migration continues to preserve its source timestamp and therefore can receive one capped offline recovery on first load.
- Per-planet resource ownership and active-planet-only production remain unchanged.

## Verification
- Added `tests/phase10_1_8_offline_progression.test.ts` for capped reactor catch-up, minimum threshold, duplicate-load protection, and import semantics.
- Added `npm run check:phase10.1.8` static contract check.
- Added interval-boundary handling for reserve exhaustion and cooldown expiry to avoid overpaying or prematurely suppressing vein income.
- Full Vitest/TypeScript/Vite build status must be reported separately according to available dependencies.
