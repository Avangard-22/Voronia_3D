# Phase 10.1.13 — P0 Gap Closure: Offline Synth, Hidden Profile & Golden Save Replay

## Changes

- Added a dedicated `SynthService.tickOffline()` path corresponding to V1 `Ay()`; it applies `transport.config.offlineCapMult` inside the synth domain rather than routing offline production through live `Ty()`.
- Offline synth retains the same V1 input/output ratio, unlock checks, active-planet/local-stock scope, synthesized-origin accounting and ledger atomicity.
- Game offline recovery now calls the dedicated offline synth path. The existing elapsed-time normalization is retained, so the offline efficiency policy remains unchanged and the synth-specific cap is applied exactly once.
- Added executable Vitest coverage for offline synth resource accounting and actual legacy-load/rewrite/reload replay for both V1 schema-39 golden saves (Fresh and Mid-game).

## Evidence boundary / unresolved items

- The checked-in V1 `stage4_audit_v0.0.41.json` records `spc_hidden: false`; the checked-in golden saves do not establish a true hidden-profile case or a mapping from a V2 technology/planet role to that profile. Therefore this phase does **not** invent a trigger or enable hidden mode globally. `spcHiddenFor` remains false pending a V1 runtime capture showing the true case.
- `roleMultFor` and `modsFor` also remain neutral because no exact V1 role/meta multiplier mapping is present in the available fixtures. Their closure is **BLOCKED by evidence**, not silently treated as parity.
- Golden replay tests have been added, but could not be executed in this dependency-free environment. Structural gate and Node checks are not substitutes for Vitest, typecheck or browser runtime.

## Validation

- `npm run check:phase10.1.13`: structural evidence gate.
- `npm run check:phase10.1.1` through `check:phase10.1.12`: run where present; these are contract/evidence scripts only.
- Vitest, TypeScript and Vite build: NOT RUN (`node_modules` is absent).

## Verdict

Offline synth implementation path: **IMPLEMENTED — runtime test pending**. Fresh/Mid-game replay: **TESTS ADDED — execution pending**. `spc_hidden` true-case and role/meta multipliers: **OPEN / BLOCKED pending authoritative V1 evidence**. Overall P0 closure: **PARTIAL**, not full parity.
