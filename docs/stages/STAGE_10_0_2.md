# Stage 10.0.2 — Planet Surface Interaction & Cell Action Completion

## Scope
Complete the existing planet-first interaction loop without changing domain economics, cell identifiers, save schema, or scan/upgrade rules.

## Changes
- Surface taps now select a revealed/explored cell; tapping empty surface clears selection.
- Selection callback accepts `null`, keeping the renderer and cell dock synchronized.
- Multi-touch gestures are tracked separately from taps, preventing the final finger release after pinch-zoom from accidentally selecting a cell.
- Canvas advertises the interaction model to assistive technology, is keyboard-focusable, and uses `touch-action: none` so surface gestures do not scroll the page.
- Cell actions (scan, upgrade, reactivate, discharge, anomaly upgrade, anomaly branch selection) now return visible success/failure feedback in the surface dock.
- Common domain rejections are translated into actionable Russian messages.
- Feedback styling adapts to narrow screens.

## Compatibility
No changes to resource formulas, costs, cell IDs, exploration state transitions, save payloads, or economy services.

## Verification
- Added unit tests for action feedback success, common rejection reasons, and fallback messaging.
- Source syntax transpilation and archive integrity are checked during packaging.
- Full TypeScript build and Vitest remain unverified because dependencies cannot be installed in this environment (offline npm cache misses `yocto-queue`; Node is v22.16.0 while several locked packages require >=22.19/22.22).
