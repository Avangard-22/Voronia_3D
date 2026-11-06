# Stage 10.0.1 — V1 → V2 Mechanics Parity Audit

**Build:** `2.0.0-stage10.0.1`  
**Audit type:** source/code capability audit; no gameplay behavior changed in this stage.  
**Target baseline:** exact V1 `v0.0.41.0` source (`index.html`, 2.95 MB; version constant and title-screen version both identify `0.0.41.0`), plus the V2-bundled `v0.0.41` balance registry and Ferrum planet data. The accessible `Voronia_2.5D_Hybrid_v0.0.38.1_Fix.html` was used only as a secondary historical reference. This is a source/code capability audit; individual formulas and edge cases still require runtime parity tests.

## 1. Executive result

The exact V1.0.41.0 release notes explicitly include the offline-income formula correction, the research-cell output curve, cell-upgrade soft caps, prestige quest retention, the merged Essence Tree / Echo Shards progression, Guardian combat on the planet playfield, Reactor slot purchases, shipyard/fleet progression, and rare-resource meteor buffs. V2 already contains a substantial playable systems foundation: cell scanning and upgrades, production/depletion, charge mechanics, anomaly branches, technology, a reactor queue, sonar discovery, galaxy routing, orbital discovery, persistence, and a transaction ledger. The current project is **not** a blank gameplay shell.

However, V2 is not yet a complete V1 gameplay replacement. Several highly visible V1 loops are absent or only represented by configuration/data: Guardian combat, prestige and Dust Tree progression, meta reset/Ascension/Shard Tree, achievements and daily/weekly tasks, premium automation, offline settlement, planet roles, and parts of logistics/automation. These gaps are more important than adding further visual effects.

The code also contains stale capability declarations: the `crafting` status says `NOT_IMPLEMENTED` even though `Reactor` queue/crafting logic is present and used by `Game`. This must be corrected as part of the next implementation work, not treated as evidence that the reactor is absent.

## 2. Status definitions

- **IMPLEMENTED** — domain logic and a callable game command exist, with relevant tests and/or UI exposure.
- **PARTIAL** — core behavior exists, but a meaningful V1 loop, UI path, persistence detail, or automation component is missing.
- **MISSING** — no operational V2 gameplay implementation was found; configuration, labels, types, or placeholder UI alone do not count.
- **PARITY CHECK PENDING** — V2 implementation exists, but its detailed formulas, edge cases, or complete V1 content have not yet been exhaustively replayed against the now-available V1.0.41.0 source.

## 3. Mechanics parity matrix

| V1 gameplay system | V2 status | V2 evidence | Gap / decision |
|---|---|---|---|
| Planet cell selection and surface interaction | PARTIAL | `renderer/scene.ts` raycasts the planet surface and selects cell IDs; `ui/app.ts` renders the cell action dock | Confirm parity for all cell types, touch behavior, selection feedback, and direct contextual actions on the physical surface. |
| Cell scanning, reveal-neighbors, scan pricing | IMPLEMENTED — PARITY CHECK PENDING | `planets/exploration.ts`, `progression/scanPricing.ts`, `Game.dispatch('scanCell')`; `tests/gs01gs02.test.ts`, `tests/stage5_4_vertical_slice.test.ts` | Verify final V1.0.41 cost progression, reveal rules, and all special scan outcomes. |
| Cell upgrades and production scaling | IMPLEMENTED — PARITY CHECK PENDING | `economy/upgrades.ts`, `economy/income.ts`, `economy/production.ts`; `tests/gs03.test.ts`, `tests/income.test.ts` | Validate late-game cost curves and all-resource participation against final V1 registry. |
| Deep upgrades / high-level resource ladder | PARTIAL | Registry includes deep curves and deep-level threshold; upgrade services consume configured curves | Validate threshold and resource progression against the final V1 source; ensure late upgrades do not silently omit resource types. |
| Vein depletion, cooldown, reactivation | IMPLEMENTED | `economy/production.ts`; `reactivateCell` command; `tests/gs04.test.ts` | Recheck exact V1 cooldown and reserve exhaustion behavior. |
| Cell charge, discharge, surge and temporary boosts | IMPLEMENTED — PARITY CHECK PENDING | `economy/charge.ts`, charge ticker in `core/game.ts`; `tests/stage4_charge.test.ts` | Verify all chain/pair interactions and final cooldown values. |
| Anomaly branch selection, upgrades, deep conversion | IMPLEMENTED | `planets/anomalies.ts`, `economy/upgrades.ts`; `tests/stage4_anomaly.test.ts` | Validate the full anomaly outcome table and special-case rewards against final V1. |
| Resource accounting / atomic transactions | IMPLEMENTED | `economy/ledger.ts`; all domain operations route through ledger; `tests/ledger.test.ts` | Keep ledger internal. Do not restore a visible transaction feed to the main play screen. |
| Offline income and offline settlement report | MISSING | V1 balance has `offline` section; no V2 offline settlement service or claim flow found in `src` | Implement elapsed-time settlement, cap/efficiency, depleted-deposit accounting, and a claim/report UI. Respect the current project requirement that offline income begins only after 3 hours if that remains the approved balance rule. |
| Technology and research tree | IMPLEMENTED — PARITY CHECK PENDING | `progression/tech.ts`, `techTree.ts`, `buyTech` command; `tests/stage9_3_tech.test.ts` | Check completeness of V1 node catalog, prerequisites, effects and unlocks. |
| Reactor crafting queue | PARTIAL | `crafting/reactor.ts`; `craftEnqueue`/`craftCancel`; tick and persistence integration; `tests/stage9_3_reactor.test.ts` | Core queue works, but automatic crafting and full V1 lab/production behavior are not implemented. Correct stale `CRAFTING_STATUS` declaration. |
| Sonar mini-game and first Krios-9 unlock | IMPLEMENTED — PARITY CHECK PENDING | `unlockKrios`, sonar snapshot/UI, `tests/stage6_sonar.test.ts`, `tests/stage6_1_sonar_expansion.test.ts` | Verify exact three-round timing, score averaging, bonus bands, first-unlock sequence and reward values against final V1. |
| Subsequent sonar discovery, rerolls, progression gates | IMPLEMENTED — PARITY CHECK PENDING | `rerollDiscovery`, discovery preview, anomaly gate, galaxy progression; `tests/stage6_2_galaxy_exploration.test.ts`, `tests/stage6_4_galaxy_progression.test.ts` | Confirm history depth, charge use, reroll escalation, tier rewards and discounts. |
| Galaxy exploration, routes and orbital bodies | IMPLEMENTED | `galaxy/*`, orbital commands in `core/game.ts`; Stage 6–9 tests | Continue integration testing with full planet gameplay; avoid treating navigation-only unlocks as playable world content. |
| Cargo, local depot and interplanetary transport | PARTIAL | `logistics/service.ts`, cargo/depot commands; `tests/stage6_7_galaxy_economy.test.ts` | Automated dispatch, supply chains, fleet upgrades, delivery timing and complete V1 transport loop are not yet represented. |
| Planet specialization / roles | MISSING | Role-related fields/hooks exist in contracts and income modifiers, but no complete role assignment/progression gameplay service or UI flow found | Implement role selection, exclusivity, reassignment costs, bonuses and persistence. |
| Guardian / Sentinel / Overlord combat | MISSING | `contracts/combat.ts` explicitly declares `NOT_IMPLEMENTED`; UI button is unavailable and opens a placeholder notice | Implement battle availability/cooldowns, energy drain, encounter tiers, combat resolution, rewards, failure penalties and restoration. Use approved Guardian rules from project baseline. |
| Prestige and Dust Tree | MISSING | `dust` resource and `prestige`/`tree` config data exist; no operational prestige reset or Dust Tree service/command/UI found | Implement reset transaction, retained progression, Dust reward calculation, permanent perks and save migration. Do not infer mechanics from config alone. |
| Meta reset / Ascension / Shards and Shard Tree | MISSING | `essence`/`shards` resources and related registry sections exist; no complete reset or tree mechanics found | Implement separate reset layers, retained currencies, reward formulas, prerequisites, and persistent upgrades. |
| Achievements, daily/weekly tasks, streaks and events | MISSING | V1 reference contains these systems; no V2 domain services or commands found | Implement event/task state, deterministic refresh windows, reward claims and persistence. |
| Premium access and premium automation | MISSING | V1 registry contains premium product definitions; V2 has no entitlement validation or purchase-code activation path | Build entitlement model first; keep Auto Scan/Auto Upgrade/Auto Transport/Dispatcher behind paid entitlement. No premium-only controls should leak into free/trial UI. |
| Tutorial / guided first-session onboarding | PARTIAL | V2 has first-cell prompt and contextual action UI | Rebuild the full guided sequence, recovery hints, step completion and mobile interaction guidance. |
| Save/load, legacy migration and deterministic replay | IMPLEMENTED — PARITY CHECK PENDING | `persistence/*`, `SaveManager`, legacy migration tests, deterministic planet/discovery specs | Add migrations for all future meta/combat/task systems before shipping them. Capture golden saves from the exact V1.0.41.0 source and replay them through V2 migration. |
| Audio / music / sound effects | MISSING | `audio/status.ts` is `NOT_IMPLEMENTED` | Defer until gameplay loops are stable; implement ambience and event feedback without blocking interaction. |

## 4. Cross-cutting findings

### 4.1 Capability status drift

`src/crafting/status.ts` currently reports the entire crafting domain as `NOT_IMPLEMENTED`, while `src/crafting/reactor.ts` is instantiated by `Game`, has queue logic, is ticked, is serialized, and is exposed in the UI. The correct state is **PARTIAL**: manual reactor queue exists; auto-craft and other V1 crafting/production features remain absent.

### 4.2 Data present does not mean mechanics present

V2 bundles a large `v0.0.41` balance registry, including sections for Guardian, prestige, offline, premium, weekly, transport, craft, sonar, roles, events, shards and more. Several corresponding V2 systems do not exist yet. Registry coverage must not be counted as gameplay parity until the relevant service, command, UI and save behavior are connected.

### 4.3 Surface-first requirement

The 3D scene supports raycast cell selection, while actions are presented in a cell dock. The next gameplay pass must verify that the player can select and operate all meaningful cell types on the actual planet surface, including revealed/hidden states, anomaly branches, veins and upgraded structures. The planet must remain the gameplay space, not become a decorative background behind menus.

### 4.4 Economy integrity

Keep `ResourceLedger` as the only balance mutation path. New systems (offline claim, prestige, combat rewards, tasks, premium entitlements where applicable) must use explicit ledger transactions and deterministic save state. The transaction journal remains an internal diagnostic/accounting structure, not a visible main-screen panel.

## 5. Priority order for Stage 10.0.2 onward

1. **10.0.2 — Planet Surface Interaction & Cell Action Completion**: complete raycast selection, contextual action states, touch input, and interaction parity for every cell class.
2. **10.0.3 — Scanning & Discovery Loop Verification**: lock down scan costs, reveal propagation, first-session progression and sonar unlock sequence.
3. **10.0.4 — Cell Upgrades, Production & Depletion**: validate early/mid/late cost curves, resource ladders, depletion and reactivation.
4. **10.0.5 — Economy Progression & Offline Settlement**: add offline calculation and report/claim, then verify all production modifiers and resource sinks.
5. **10.0.6 — Technology & Research Completion**: compare the complete V1 tech graph and effects.
6. **10.0.7 — Anomalies, Rare Deposits & Special Cells**: finish all special cell loops and reward paths.
7. **10.0.8 — Reactor, Auto-Craft Entitlements & Crafting Progression**: finish manual queue parity first; automation stays entitlement-gated.
8. **10.0.9 — Sonar & Planet Discovery Completion**: final V1 parity for scoring, charges, rerolls, history and unlocks.
9. **10.0.10 — Guardian Combat**: implement the complete battle loop and failure/recovery rules.
10. **10.0.11 — Save/Load/Progression Verification**: migration, offline replay, reset persistence and long-session integrity.
11. **10.0.12 — Ferrum Playable Planet Vertical Slice**: prove the complete loop from new game to stable mid-game progression on one planet.

Prestige/meta systems, daily/weekly tasks, achievements, planet roles, and automated logistics should be scheduled after the Ferrum vertical slice unless the final V1.0.41 audit identifies a dependency that requires earlier implementation.

## 6. Acceptance criteria for closing this audit

- The exact V1 `v0.0.41.0` HTML source is now available; all rows marked PARITY CHECK PENDING must be verified with formula-level tests and golden-save replay.
- Every row has a linked implementation, test, or explicit accepted deferral.
- `NOT_IMPLEMENTED` / `PARTIAL` capability declarations agree with actual code.
- No configuration-only feature is reported as implemented.
- A golden V1 save can be migrated and replayed without losing economy, cells, sonar, discovery or progression state.
- The first complete playable planet can be finished without debug grants or manual state edits.

**Audit verdict:** V2 has a strong core systems foundation, but is not yet V1 gameplay-complete. The next work should focus on interaction and the playable Ferrum loop, then offline economy and the missing high-impact loops—not additional atmosphere/visual polish.
