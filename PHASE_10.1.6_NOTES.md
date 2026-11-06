# Phase 10.1.6 — V1 Special Cells, Anomaly Branches & Charge Mechanics Parity

## Scope
Reconcile special-cell behavior with the v0.0.41 Stage 4 audit. No new special-cell types, branches, charge resources, or balancing systems are introduced.

## Preserved V1 contracts
- Type-4 anomaly branches: `synth`, `power`, `resonance`; one-time branch selection.
- Power anomaly depletion modifiers: `0.7` normally and `0.5` when deep; other branches do not alter vein depletion.
- Type-1/type-2 manual discharge: same-type explored neighbors, capped neighbor multiplier, duration bonus, energy/research buffs, cooldown, and type-2 sonar charge.
- Manual charge caps: energy buff `0.25`, science buff `0.5`; sonar cap remains the configured V1 cap.
- Automatic v0.0.39 surge: deterministic scheduled event, type-specific intervals/durations, energy buff only, no research or sonar reward.
- Anomaly upgrade costs and deep conversion remain the existing V1 formulas.

## Migration repair
Legacy v1 cells store charge/surge deadlines as wall-clock epoch timestamps. Migration now converts each deadline to the remaining duration at save time and places that duration on the V2 `gameMs` timeline. Expired deadlines become zero rather than being resurrected or interpreted as huge future cooldowns. Branch selection and charge-history flags are retained. Transient `chargedAt` epoch values are not copied as invalid V2 timestamps.

Native V2 save/load continues to serialize the full special-cell state. Temporary planet charge buffs remain runtime-only, as documented by the existing V1 contract.

## Verification
- Added migration tests for active and expired manual/surge deadlines.
- Added native V2 special-cell roundtrip test.
- Added `npm run check:phase10.1.6` static parity check against `fixtures/stage4_audit_v0.0.41.json`.
- Full test/build commands require installed dependencies.
