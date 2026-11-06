# Phase 10.1.11 — V1 Full Gameplay Regression, Golden Save Replay & Parity Closure

## Scope
Consolidate the existing V1→V2 parity evidence without introducing new gameplay systems or changing V1 balance. This phase is a regression-closure and evidence-indexing phase, not a mechanics redesign.

## Regression coverage linked

| Area | Existing evidence | Status in source |
|---|---|---|
| Core loop: scan, rewards, upgrades, veins | `tests/phase10_1_2_core_loop_parity.test.ts` | COVERED — runtime suite not executed in this environment |
| Planet progression, sonar, unlocks | `tests/phase10_1_3_progression.test.ts` | COVERED — runtime suite not executed |
| Planet switching and local/global stocks | `tests/phase10_1_4_planet_storage.test.ts` | COVERED — runtime suite not executed |
| Warehouse capacity and resource mass | `tests/phase10_1_5_warehouse_parity.test.ts` | COVERED — runtime suite not executed |
| Special cells, anomalies and charge timers | `tests/phase10_1_6_special_cells.test.ts` | COVERED — runtime suite not executed |
| Synthesizer and mutant modifiers | `tests/phase10_1_7_synth_mutant_parity.test.ts` | COVERED — runtime suite not executed |
| Offline production and recovery | `tests/phase10_1_8_offline_progression.test.ts` | COVERED — runtime suite not executed |
| Timed effects, surge and cooldown recovery | `tests/phase10_1_9_timed_effects.test.ts` | COVERED — runtime suite not executed |
| Save validation, roundtrip and corruption safety | `tests/phase10_1_10_save_integrity.test.ts` | COVERED — runtime suite not executed |
| Golden baseline | `docs/GOLDEN_SCENARIOS.md`, fixtures under `tests/fixtures` | INVENTORY PRESENT; replay execution not run |

## Added
- `tools/check_phase10_1_11_regression.mjs`: verifies the complete phase-suite inventory, key assertions and GS-00…GS-17 golden scenario inventory.
- `npm run check:phase10.1.11`: deterministic source-level regression inventory check.
- This parity matrix and explicit execution limitations.

## Verification performed
- `node tools/check_phase10_1_11_regression.mjs` — PASS.
- `npm run test`, `npm run build`, TypeScript full check — NOT RUN: dependencies are not installed in this checkout. No runtime PASS is claimed.

## Closure decision
The source contains linked regression coverage for all tracked Phase 10.1.2–10.1.10 domains and the 18 golden scenario identifiers. Parity is **evidence-indexed, not fully runtime-certified**. Final closure remains BLOCKED until the project CI runs Vitest, typecheck, Vite build, single-file build and the phase check scripts successfully with the project's supported Node version.

No balance curves, prices, yields, offline caps, surge timings, unlock rules or gameplay systems were changed in this phase.
