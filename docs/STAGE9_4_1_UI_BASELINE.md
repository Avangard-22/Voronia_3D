# Stage 9.4.1 — Legacy UI Baseline Extraction

**Reference:** https://avangard-22.github.io/Voronia/ (v0.0.41.0)  
**Captured:** 2026-11-04  
**Purpose:** freeze the first version's player-facing information architecture before restoring it in Voronia 2.0.

## Baseline structure

| Region | v0.0.41.0 reference | Voronia 2.0 restoration rule |
|---|---|---|
| Title screen | VORONIA wordmark, subtitle, lore, start/continue, new game, universe access, save sharing | Dedicated first screen; title identity and copy retained. Continue is conditional on a valid loaded save. |
| Top resource HUD | Energy, iron, cryogen, essence, crystals and additional resource chips | Restore compact horizontal resource chips; no large opaque strip; values remain sourced from `GameSnapshot`. |
| Planet identity | Planet name, class and exploration progress | Keep compact contextual identity outside the resource row. |
| Planet surface | Main interactive 2.5D surface | Keep Three.js planet as the central play area; cell actions remain attached to selected surface cell. |
| Cell interaction | Select cell, then scan/upgrade/action | Preserve direct surface selection and contextual cell action panel; do not replace with a bottom card grid. |
| Quick actions | Sonar, map, fullscreen, combat and event shortcuts | Restore as contextual quick-action controls, only when the corresponding domain is available. |
| Bottom navigation | Planet / Galaxy / Science / Meta | Four primary destinations; existing scene and domain modules remain the implementation source. |
| Secondary panels | Warehouse, research, reactor, technology, achievements, settings, premium, quests, transport, statistics | Modal/drawer presentation over the active game scene; no separate disconnected page. |
| Save controls | Export, share, import and hourly backup | Keep persistence actions reachable from settings/save panel; do not duplicate persistence logic in UI. |

## Source-of-truth rules

1. v0.0.41.0 is the visual and interaction reference, not a source to copy wholesale into the new runtime.
2. The existing `Game` facade, contracts, snapshots, dispatch commands and persistence remain authoritative.
3. UI must not mutate economy, planet, progression or save state directly.
4. Preserve the original hierarchy and player vocabulary; improve responsive behavior and visual fidelity without changing game rules.
5. The original title-screen text is retained as the initial title copy: “Циклы · Пыль · Осколки”, “Грани забытого мира”, and the short lore statement.

## Scope status

- [x] Inspect the live v0.0.41.0 player-facing structure and title screen.
- [x] Record the UI regions and parity rules.
- [ ] Pixel-level extraction of original CSS, SVG assets and breakpoints. This requires the original HTML/assets bundle; the hosted page inspection alone does not expose a complete local source package.
- [ ] Map every legacy control to a 2.0 command or mark it as intentionally deferred.
