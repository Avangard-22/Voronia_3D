# Stage 9.7 — Legacy HUD & Quick Actions Restoration

**Version:** `2.0.0-stage9.7.0`  
**Date:** 2026-11-04  
**Scope:** HUD quick actions and UI routing only. No economy, save-schema, planet-generation, or combat-domain implementation changes.

## Delivered

- Added compact top-HUD actions: Sonar, Galaxy Map, Fullscreen, Combat Events.
- Sonar starts the existing three-pulse sonar mini-game when `snapshot.sonar.available` is true. Otherwise it navigates to the Galaxy section where the Sonar Station status and discovery controls are shown.
- Galaxy Map switches the legacy navigation to the Galaxy tab and emits the existing `voronia:navigate` event so the 3D scene follows the UI.
- Fullscreen toggles the browser Fullscreen API; unsupported/denied requests fail safely without affecting game state.
- Combat Events opens an explicit status window sourced from the `COMBAT_DOMAIN_STATUS` contract. The combat domain remains `NOT_IMPLEMENTED`; no fake battle state, cooldown, enemy, or reward has been introduced.
- Added responsive sizing, accessible labels, and hover/focus-compatible button surfaces.
- Updated package metadata and title-screen version to `2.0.0-stage9.7.0`.

## Verification

- `node tools/check_stage9_7.mjs`: PASS.
- `node tools/check_arch.mjs`: PASS (109 source files; layer boundaries clean).
- `node tools/check_legacy_assets.mjs`: PASS (32/32 SVG assets).
- TypeScript transpile syntax check for changed TS files: PASS.
- `package.json` / `package-lock.json` version parity: PASS.
- Full TypeScript/Vitest/Vite build: NOT RUN in this environment (dependencies not installed).
- Browser Fullscreen API, WebGL and physical Android QA: NOT RUN.

## Invariants

- UI reads game state from `GameSnapshot`.
- Sonar gameplay uses the existing `runSonarMinigame` and `Game.dispatch('unlockKrios', ...)` flow.
- Navigation uses the existing `voronia:navigate` event.
- Combat remains explicitly `NOT_IMPLEMENTED`; the new action is informational only.
- No domain/economy/persistence schema or renderer changes.
