# Voronia 2.0 — Stage 5.6 report

## Scope
Runtime and rendering hardening of the Planet Vertical Slice. This stage does not claim to complete the later sonar, crafting, combat, logistics, or audio systems.

## Implemented

1. **Event-driven planet mesh rebuild**
   - Removed per-frame construction and sorting of the explored-cell/level signature.
   - A visual rebuild is now marked dirty after a UI game command and consumed once by the render loop.
   - Active-planet changes are still detected independently, so the mesh follows the active world.
   - This avoids repeated O(n log n) signature work on every animation frame.
2. **Visibility-aware animation lifecycle**
   - The WebGL animation loop is cancelled while the document is hidden and restarted when visible.
   - FPS samples are reset across visibility transitions so background-tab throttling does not pollute the measurement window.
   - `pagehide` cancels the pending animation frame, stops game/ticker/autosave services, clears the HUD timer, removes the visibility listener, and disposes the viewer.
3. **Mobile GPU fill-rate guard**
   - Renderer pixel ratio is capped at 1.5 on narrow/mobile viewports and 2 on wider viewports.
   - The cap is recalculated on resize/orientation changes.

## Verification

- Existing `FpsMeter` tests cover window reset and empty stats after reset.
- Added unit tests for mobile/desktop DPR caps, native DPR below the cap, and invalid DPR fallback.
- Architecture check and strict TypeScript check of the changed renderer module should be run in the delivery environment; full browser/WebGL and physical-device checks remain required.

## Not claimed

- No claim of full CI success, browser smoke-test success, or measured Android FPS is made in this report.
- No new gameplay systems are represented as implemented by this stage.

## Next

Proceed to Stage 6: sonar discovery, krios unlocking, sonar preview of neighboring planets, and scan bonus persistence, following the golden-audit/fixture-first workflow documented in the project README.
