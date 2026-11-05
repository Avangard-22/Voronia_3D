# Stage 9.4.3 — HUD Restoration

**Status:** Implemented in source; browser visual QA pending.

## Delivered

- Restored a compact horizontal resource HUD inspired by v0.0.41.0.
- Primary chips: energy, iron, cryogen, essence, crystals and research.
- Rare-resource chips appear when the corresponding resource balance is positive.
- Production rates are shown only when positive.
- Active planet identity is displayed as a compact contextual label, separate from the resource row.
- Resource values are rendered exclusively from `GameSnapshot`; no domain state is mutated by the HUD.
- The strip uses a transparent/low-opacity treatment rather than a large opaque black panel.
- On narrow screens, the resource row becomes horizontally scrollable and the planet identity moves above it.

## Architecture constraints

- Existing `Game` facade and snapshot remain the source of truth.
- No changes to economy, resource ledger, persistence or renderer.
- Existing command delegation remains unchanged.

## Known limitations

- The exact authored SVG icon pack from v0.0.41.0 is not present in the supplied 2.0 archive. Existing resource glyph metadata is used as a safe interim representation; replacing it with the original SVG set is deferred until the asset bundle is available.
- Pixel-level parity and Android browser QA remain pending.

## Verification

- [x] Source changes reviewed.
- [x] Snapshot-only data flow retained.
- [ ] TypeScript/Vitest/production build not run: `node_modules` is absent in the supplied workspace.
- [ ] Desktop and Android visual QA pending.
