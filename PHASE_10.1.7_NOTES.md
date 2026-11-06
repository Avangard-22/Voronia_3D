# Phase 10.1.7 — V1 Synthesizer, Mutants & Production Interaction Parity

## Scope
Reconcile the V1 synthesizer and vein-mutant production contracts with per-planet storage from Phase 10.1.4. No new resources, recipes, mutation classes, or economy modifiers are introduced.

## Changes
- Clarified and locked the runtime contract: the game tick supplies only `activeRuntimes()` to `SynthService`. This is required because `ResourceLedger` contains the active planet's local iron/kriogen/extra-resource balances after the V1 `On()/yy()` storage swap.
- Synth input is therefore consumed from the active planet's stock only; synthesized product remains recorded in that planet's `origin.synthesized` provenance, while global resources remain shared according to the existing V1 resource model.
- Preserved the V1 product/input selection, anomaly branch gating, cell/depth multipliers, research boosts, rare-resource offset, partial-input behavior, and atomic ledger transaction.
- Reconfirmed that mutant yield and depletion are independent registry multipliers. V1 values remain: ember 1.5/1.5, rime 1.2/0.8, mycelium 1.3/1.0, shadow 2.0/2.0, prime 1.4/1.2.
- Reactor crafting remains a separate global production queue. Its input/output transactions are not redirected into planetary mining storage.
- Updated stale Game tick commentary that previously implied synthesis over all unlocked planets.

## Verification added
- Active-planet synthesizer/local-stock integration test across Ferrum and Krios.
- Mutant yield/depletion parity tests, including neutral fallback for unknown mutant IDs.
- `npm run check:phase10.1.7` static contract check against the v0.0.41 registry values.

## Compatibility
- No save schema changes.
- No balance values changed.
- No changes to V1 synth recipes, input/output ratio, mutant chance, mutant values, vein depletion formulas, or reactor costs/timing.
- Existing compact number formatting and unified UI font settings are preserved.
