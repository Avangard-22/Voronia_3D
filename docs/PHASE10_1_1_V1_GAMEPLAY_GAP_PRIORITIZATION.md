# Phase 10.1.1 — V1 Gameplay Gap Prioritization & Golden Runtime Baseline

**Baseline:** exact legacy release `v0.0.41.0`, save schema `39`  
**V2 package:** `2.0.0-phase10.1.1`  
**Scope:** audit, baseline locking, regression checks and development priorities. No gameplay/economy changes in this phase.

## 1. Direction lock

Voronia V2 remains an evolution of V1, not a separate game. V1 `v0.0.41.0` is the behavioral authority for established mechanics, formulas, rewards, progression and player-facing loops. V2 may improve 3D presentation, interaction, performance, accessibility and maintainability, but must not introduce replacement mechanics or alter balance without an explicit V1 reference and a documented decision.

The playable navigation scope remains the **current planetary system**. The spiral-galaxy map and galaxy-scale navigation are outside the active player-facing scope. Existing legacy data/services may remain dormant where required for compatibility; they must not expand the current map or create new gameplay dependencies.

## 2. Golden runtime anchors

The following checked-in V1.0.41.0 runtime artifacts are the regression authority:

| Artifact | Purpose | Locked anchors |
|---|---|---|
| `golden_save_fresh_v0.0.41.json` | New-game baseline | schema 39; Ferrum active; energy 0.504; research 0.000504; scan cost 10; Ferrum explored `[0]`; revealed order `[0,2,1,3,6,7]`; warehouse 0 |
| `golden_save_midgame_v0.0.41.json` | Progressed economy baseline | schema 39; Ferrum active; energy 12,345; iron 999,664; research 678; scan cost 33; 12 Ferrum cells explored/revealed; warehouse 3 |
| `GS-00…GS-17` in `GOLDEN_SCENARIOS.md` | Deterministic behavior scenarios | boot, scan, upgrade, ledger, income, veins, warehouse, persistence, generation, charge, anomalies and discovery |
| `fixtures/*_audit_v0.0.41.json` | Extracted formula/runtime evidence | scan/upgrade, income, veins, warehouse, anomaly/charge and planet discovery |

Planet identity anchors: Ferrum seed `15929600`; Krios seed `13045769`. These seeds and their baseline geometry/data must not drift unintentionally.

`npm run check:baseline` validates the golden save files and parity-matrix integrity. Existing persistence tests validate the fresh-save V39 migration; the mid-game migration is included in the phase acceptance checklist and must remain covered by regression tests.

## 3. Prioritized gameplay gaps

Priority is based on player-loop dependency and V1 fidelity, not implementation novelty.

| Priority | V1 system | Current V2 state | Decision / exit condition |
|---|---|---|---|
| P0 | Surface interaction and cell actions | PARTIAL | Every cell type must be selectable and actionable directly on the physical planet surface; mobile taps and gestures must be reliable. |
| P0 | Scanning, reveal, scan pricing | Implemented; formula parity pending | Replay V1 costs, reveal order, anomaly rewards and unlock gates against golden scenarios. |
| P0 | Cell upgrades, production, upgrade costs | Implemented; late-game parity pending | Verify complete cost curves, resource sinks, levels and production multipliers from V1. |
| P0 | Vein depletion/reactivation and charge loops | Implemented; edge-case parity pending | Verify exact reserve, cooldown, charge-chain and recovery behavior. |
| P0 | Save/load and legacy migration | Implemented; broader replay pending | Fresh and mid-game V1 saves must migrate without losing resources, cells, scan cost, tech, warehouse or active planet. |
| P1 | Offline income/settlement | MISSING | Reproduce V1 elapsed-time calculation, cap, depletion accounting and claim report; preserve the approved 3-hour activation threshold if still in force. |
| P1 | Guardian combat | MISSING | Restore the V1 battle loop, cooldown, energy drain, reward/failure and recovery behavior; no placeholder button counted as implementation. |
| P1 | Reactor/crafting progression | PARTIAL | Preserve the existing manual queue; complete V1 recipes, slots, progression and any automation only after entitlement rules are verified. |
| P1 | Technology/research tree | Implemented; content/effect parity pending | Compare all V1 nodes, prerequisites, costs, unlocks and effects. |
| P1 | Sonar and planetary-system discovery | Implemented; formula/sequence parity pending | Verify V1 scoring, charges, rerolls, discovery gates and planet activation. Keep the player-facing map within one planetary system. |
| P2 | Planet roles and specialization | MISSING | Implement only if the complete V1 rules, costs, bonuses and persistence can be established. |
| P2 | Prestige/Dust Tree and meta progression | MISSING | Restore reset/retention/reward/perk rules from V1 source; configuration alone is not sufficient evidence. |
| P2 | Achievements, daily/weekly tasks and events | MISSING | Rebuild deterministic refresh, progress, claims and save behavior from V1. |
| P2 | Premium entitlements and automation | MISSING | Add entitlement validation before any Auto controls; premium-only features must never leak into free/trial UI. |
| P3 | Audio and additional polish | MISSING/PARTIAL | Defer major polish until the core V1 gameplay loop is stable. Keep deep-space ambience non-blocking and restrained. |

## 4. Next implementation sequence

1. **Phase 10.1.2 — V1 Core Loop Parity Lock:** surface interaction, scan/reveal, cell upgrades, production, veins and charges. No new resource types or alternative progression.
2. **Phase 10.1.3 — V1 Offline Income & Settlement:** restore offline calculation and claim/report using V1 rules.
3. **Phase 10.1.4 — Guardian Combat Restoration:** complete the battle and recovery loop using approved V1 rules.
4. **Phase 10.1.5 — Reactor & Crafting Parity:** finish manual V1 crafting progression before any premium automation.
5. **Phase 10.1.6 — Technology & Sonar Parity:** close formula/content gaps and validate planet activation within the current system.
6. **Phase 10.1.7 — Meta Progression & Retention Systems:** prestige, Dust Tree, achievements and tasks, only after source-level rule extraction.
7. **Phase 10.1.8 — Ferrum Golden Vertical Slice:** execute a complete new-game-to-midgame playthrough against the golden baseline.

## 5. Rules for all subsequent stages

- Every gameplay change must cite its V1 source function, registry entry or runtime fixture in its stage notes.
- Preserve V1 formulas by default. Any intentional deviation requires a reason, migration impact and explicit approval.
- Keep `ResourceLedger` as the only resource mutation path.
- Keep the transaction journal internal; do not restore it to the visible main screen.
- Do not add autonomous fleets, mining assignments, new economy layers or other systems absent from V1 unless explicitly requested.
- Keep the current planetary-system map boundary; do not reopen spiral-galaxy navigation as a player-facing map.
- Compact number notation and the unified interface font-size rule from Stage 10.0.6 remain global UI requirements.

## 6. Validation and known limits

- `npm run check:baseline` — deterministic fixture integrity check.
- `tests/persistence.test.ts` — fresh V1.0.41.0 V39 migration and V2 roundtrip coverage.
- `docs/GOLDEN_SCENARIOS.md` — GS-00…GS-17 scenario catalog.
- Full Vitest/typecheck/build must be run in an environment with dependencies installed before deployment.

**Phase verdict:** baseline and priorities are locked. This phase does not claim that missing V1 systems have been implemented; it establishes the order and acceptance authority for restoring them.
