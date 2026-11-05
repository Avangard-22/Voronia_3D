# Stage 9.4.6 — Modal & Windows Restoration

## Implemented
- Reusable modal window shell in the visual language of v0.0.41.0.
- HUD access points for Save, Journal, Settings, and About.
- Save / Load / JSON Export / JSON Import actions routed through `Game.dispatch`.
- Transaction journal window (last 30 entries).
- Device-local UI scale and reduced-motion preferences.
- Keyboard Escape, backdrop click, explicit close controls, and initial focus.
- Mobile sizing and scrollable modal content.

## Boundaries
- No economy, progression, renderer, or save-schema changes.
- UI preferences are stored separately in localStorage (`voronia.uiScale`, `voronia.reducedMotion`).
- Existing HUD save controls remain available for backward compatibility.

## Verification
- Source and archive integrity checks: PASS.
- TypeScript/Vite build and browser/WebGL QA: NOT RUN (dependencies are not installed in the supplied runtime).
