# Stage 9.4.4 — Planet Interface Restoration

**Date:** 2026-11-04  
**Base:** Stage 9.4.3  
**Scope:** restore the v0.0.41-style cell interaction hierarchy on the live 3D planet without changing domain rules.

## Implemented

- Replaced the generic selected-cell card with a compact contextual planet-surface action panel.
- Preserved direct cell selection through the existing Three.js Raycaster and the existing `renderCellDock` host over the WebGL canvas.
- Restored distinct interaction states: hidden, revealed/signature found, and explored.
- Revealed cells show scan cost and disable scanning when the current energy balance is insufficient.
- Explored cells show type, level, yield/potential, neighbor count and applicable cell-specific actions.
- Resource veins show reserve capacity, reserve progress, mutant/deep markers and cooldown/reactivation state.
- Rich/rare energy cells retain discharge cooldown/action; anomaly cells retain branch selection and anomaly upgrade.
- All actions continue through existing `Game.dispatch` commands. No domain, economy, save schema or renderer geometry was modified.
- Added responsive panel styling for desktop and narrow mobile viewports; the panel remains over the planet scene, not in the bottom HUD flow.

## Explicitly not changed

- No new costs or balance formulas were introduced.
- No new cell types or gameplay actions were invented.
- No changes to scan, upgrade, anomaly, discharge or vein-reactivation services.
- Original v0.0.41 SVG/icon assets are still unavailable in the supplied project bundle; existing icon mapping remains temporary.

## Verification

- Source-level review completed.
- TypeScript/Vitest/production build and live WebGL/Android visual QA have not been run in this environment; Stage 9.4.4 is implementation-complete but not acceptance-certified.

## Acceptance checklist

- [x] Direct selection remains connected to the 3D surface.
- [x] Scan action remains attached to the selected cell context.
- [x] Upgrade action remains attached to the selected cell context.
- [x] Cell-specific actions remain available for veins, rich/rare cells and anomalies.
- [x] UI remains snapshot-driven and dispatch-only.
- [x] Mobile panel has bounded width/height and scroll behavior.
- [ ] Browser/WebGL visual acceptance.
- [ ] Android touch and viewport acceptance.
- [ ] Full CI (`npm run ci`).
