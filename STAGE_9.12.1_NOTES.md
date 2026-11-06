# Stage 9.12.1 — Mobile HUD & Color Foundation

## Implemented
- Added a brighter deep-space palette foundation: blue/teal glass panels, clearer text contrast, softer borders and less pure-black UI surfaces.
- Added resource-specific accent colors for energy, metals, cryogenic/crystal resources, research, rare matter and gases.
- Reworked the mobile HUD layout for narrow portrait screens: compact planet context, horizontally scrollable resource rail, separated quick actions, and a bottom-sheet treatment for the main information panel and selected-cell dock.
- Added safe-area handling, compact-width tuning, reduced-transparency fallback and mobile modal sizing.
- Kept the planet renderer, economy, save schema, sonar commands, and deployment configuration unchanged.

## Not yet implemented in this substage
- Legacy V1 multi-cell island/continent reconstruction and coherent biome blending.
- Full V1 visual/mechanics parity audit for surface atmosphere, terrain formations, and sonar progression.
- Device/browser visual QA on physical mobile hardware.

## Validation
- Reviewed current Stage 9.11 source and mobile CSS cascade before applying overrides.
- `npm ci --ignore-scripts --no-audit --no-fund` did not finish within the available 120-second window. No typecheck, tests, or production build are claimed for this archive.
