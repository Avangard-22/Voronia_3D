# Stage 9.6 — Legacy Visual Restoration & Asset Recovery

**Version:** `2.0.0-stage9.6.0`  
**Date:** 2026-11-04  
**Scope:** UI icon assets only. No domain/economy/save schema changes.

## Delivered

- Added a local, dependency-free SVG icon pack under `public/assets/legacy-icons/`.
- 21 resource icons: core, rare, and compound resources.
- 8 planet-cell icons.
- 3 anomaly-branch icons.
- Replaced emoji/glyph rendering in the resource HUD, cell header, logistics rows, resource amount summaries, and anomaly branch UI with SVG `<img>` assets.
- Added shared sizing and glow styles; SVGs inherit `currentColor` so UI state/color can be styled without editing each asset.
- Added `tools/check_legacy_assets.mjs` to verify that all mapped SVGs exist and have the expected SVG envelope/viewBox.
- Updated package version to `2.0.0-stage9.6.0`.

## Verification

- `node tools/check_legacy_assets.mjs`: PASS — 32 mapped SVG assets present and validated.
- Source delimiter sanity check: PASS — balanced braces in `src/ui/app.ts`.
- TypeScript build: BLOCKED — local `node_modules` is absent; global `tsc` cannot resolve `vite/client` (`TS2688`).
- Browser/WebGL/Android visual QA: NOT RUN.

## Asset provenance limitation

These are newly authored Voronia-styled SVG replacements, **not extracted original v0.0.41.0 SVGs**. The supplied `Voronia-04.11.2026.zip` contains the Voronia_3D source tree but no original legacy HTML or asset bundle. The live reference page does not provide the complete original local asset bundle in the supplied materials. Therefore this stage restores a consistent vector icon system but does not claim pixel-perfect recovery of the original artwork.

To replace these provisional assets with the exact v0.0.41.0 originals, provide the original single-file HTML or its asset bundle. The mapping and integration seam are now in place.

## Invariants

- UI still reads values from `GameSnapshot`.
- UI actions still dispatch through `Game.dispatch`.
- No economy, progression, persistence, planet-generation, or renderer logic changed.
