# Stage 10.0.6 — Geological Depth, Ore Quality & Deposit Stratification

## Implemented
- Added a scan-gated geological passport for iron and cryogen deposits: depth class, estimated depth in metres, ore grade, grade score, stratum and layer index.
- Geological descriptors are deterministic and derived from existing deposit yield/reserve data plus the existing deep-vein flag. No new RNG, persisted fields, save migration, resource generation, or balance multipliers were introduced.
- Surface UI displays the geological layer, depth and ore grade only after the cell is explored.
- Added one shared compact number formatter (`src/ui/numberFormat.ts`) for the HUD and resource/cost displays: `к`, `M`, `B`, `T`. Small values retain useful precision; non-finite values render as `∞`.
- Unified textual UI font size through `--v2-ui-font-size: 13px`, applied globally with `!important` so headings, labels, panels, controls, dialogs and inline-styled text share one size. Weight, color, spacing and layout remain independently styled.
- Added tests for scan-gated geology, deterministic geological descriptors, unchanged V1 extraction rates, and compact number formatting.

## Compatibility / economy
- Existing V1 deposit yield, reserve depletion, deep multiplier, cooldown and reactivation formulas are unchanged.
- Geological quality/depth are currently descriptive metadata; they do not silently alter production or prices. This preserves the established V1→V2 economy parity while exposing the stratification layer for subsequent gameplay decisions.
- No save schema changes.

## Validation
- ZIP integrity checked after packaging.
- Automated Vitest/build/typecheck could not be run in this environment because `node_modules` is absent. Run `npm ci`, then `npm test` and `npm run build` locally before deployment.
