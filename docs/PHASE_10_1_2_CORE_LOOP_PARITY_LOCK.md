# Phase 10.1.2 — V1 Core Loop Parity Lock

Target: legacy Voronia **v0.0.41.0**. This phase locks the existing implementation to executable V1 trails; it is not a balance redesign.

## Locked gameplay contract

| Loop | V1 behavior held as reference | Verification |
|---|---|---|
| Cell discovery | hidden/revealed/explored guards; scan charge, research reward, anomaly payout, neighbor reveal order and scan-price growth | `gs03_scan_trail.json`, `phase10_1_2_core_loop_parity.test.ts` |
| Cell upgrades | registry curve, resource costs, level/yield/reserve progression, upgrade research and atomic ledger commit | `gs04_upgrade_curve.json`, `gs04.test.ts` |
| Passive production | cell-type output, biome/planet/compound modifiers and documented mid-game totals | `income_midgame_documented.json`, `income_audit_v0.0.41.json`, `income.test.ts` |
| Vein extraction | scan activation, reserve depletion, cooldown, resource unlock guard and full-reserve reactivation | `veins_audit_v0.0.41.json`, `phase10_1_2_core_loop_parity.test.ts` |
| Charge cells | neighbor-scaled buff, duration, research and type-2 sonar charge | `stage4_audit_v0.0.41.json`, `stage4_anomaly.test.ts` |

## Priority order for remaining V1 reconciliation

1. Scan/discovery and upgrade/economy correctness (critical; locked here).
2. Production, veins, cooldown/reactivation and charge-cell behavior (critical; locked here).
3. Anomaly branches, deep-cell conversion and planet-specific modifiers (high; existing stage-4 and GS tests remain authoritative).
4. Sonar/orbital access and planet progression inside the **single planetary system** (high; no spiral galaxy map or interstellar expansion scope).
5. Save/load and long-session replay against fresh and mid-game golden saves (high; Phase 10.1.1 baseline remains authoritative).

## Change policy

- Do not introduce new economy formulas or mining/fleet systems while parity gaps remain.
- Do not alter legacy costs, rewards, growth curves, depletion rates, cooldowns, caps, or save schema without a documented V1 source delta and a dedicated migration/parity test.
- Presentation and performance may improve, but must not change command outcomes or ledger deltas.
- Compact number formatting and the unified UI font-size rule from Stage 10.0.6 remain presentation-only requirements.
- Scope remains the local planetary system; the spiral galaxy is not a gameplay destination or map view.

## Verification status

The phase adds an integrated regression suite over the existing golden scan and upgrade trails plus the vein lifecycle. Existing GS-01/02/03/04 and income tests remain part of the lock. Run `npm test -- --run` and `npm run build` in an environment with project dependencies installed before release.
