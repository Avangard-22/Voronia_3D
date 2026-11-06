# Phase 10.1.3 — V1 Progression, Sonar & Planet Unlock Parity

## Locked V1 progression behavior
- The starter progression begins on Ferrum; Krios remains pre-generated but locked.
- The first ordinary discovery is `planet_03` (V1 `Fr()+1` indexing), with the V1 reward of 1,100 research.
- The next discovery is `planet_04`, with the V1 reward of 2,420 research.
- The canonical reward curve remains `floor(500 × 2.2^max(0, planetIndex − 2))`.
- Opening Krios requires a complete Ferrum survey and the configured three-round sonar sequence.
- Sonar energy cost and accuracy reward remain registry-driven; invalid rounds must not spend energy or unlock Krios.
- Unlocking a planet does not automatically switch the active planet.
- Sonar unlock, charges, and active-planet state survive save/load.

## Planetary-system scope
Progression gates are evaluated only against planets unlocked in the current system. Galaxy-arm and sector counts no longer gate anomaly signals, and galaxy-sector progression discounts are not applied to local planet discovery costs. Legacy galaxy data structures remain internal compatibility data; they do not expand the playable map or progression scope.

## Implementation
- Added regression tests anchored to `fixtures/stage5_audit_v0.0.41.json`.
- Added `tools/check_phase10_1_3_progression.mjs` for fixture and source-contract validation.
- The V1 planet discovery reward curve, save schema, sonar reward thresholds, and planet generation formulas were not changed. Galaxy-wide progression discounts/gates were removed from this local-system unlock path.

## Verification
- `node tools/check_phase10_1_1_baseline.mjs` — run for baseline integrity.
- `node tools/check_phase10_1_2_parity.mjs` — run for prior phase integrity.
- `node tools/check_phase10_1_3_progression.mjs` — run for progression contract.
- Full Vitest/typecheck/build require installed dependencies; not assumed available in this archive environment.
