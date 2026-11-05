# Stage 9.4.2 — Main Title Screen Integration

**Status:** Implemented in source; runtime browser QA pending.

## Delivered

- Added a dedicated full-screen VORONIA title screen.
- Retained the v0.0.41.0 title identity, subtitle and lore copy.
- Added `ПРОДОЛЖИТЬ` when a valid local save was loaded; otherwise `НАЧАТЬ ИГРУ`.
- Added `НОВАЯ ИГРА` with confirmation before replacing an existing save.
- New game resets the existing `Game` facade and immediately persists the new initial state.
- The title background uses the existing live Three.js planet canvas; no duplicate renderer or static placeholder image was introduced.
- Added responsive layout and reduced-motion handling.
- Title overlay fades away into the existing game UI.

## Architecture constraints preserved

- No direct domain mutation from title UI; new-game reset uses `game.newGame()` and persistence uses `game.saves.save()`.
- Existing renderer, game loop, autosave and save migration remain in place.
- Existing gameplay HUD and scene switch are hidden, not destroyed, while the title screen is active.

## Not included in this substage

- Universe selection (no complete 2.0 universe-selection flow exists yet).
- Save sharing / import-export controls on the title screen.
- Camera fly-in animation; the same live planet scene is retained and the overlay transitions away.
- Full HUD, bottom navigation and modal parity; those belong to Stages 9.4.3–9.4.6.

## Verification

- [x] Source integration and event wiring reviewed.
- [x] CSS includes narrow-screen and reduced-motion rules.
- [ ] TypeScript / Vitest / production build: not run; dependencies are not present in the supplied archive and network access was unavailable.
- [ ] Desktop and Android browser visual QA pending.
