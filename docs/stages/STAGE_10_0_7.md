# Stage 10.0.7 — Geological Survey & Deposit Mapping

## Scope
- Add a read-only geological survey summary to each planet snapshot.
- Aggregate only scanned ore cells (iron and kriogen veins); hidden and merely revealed cells are excluded.
- Report deposit count, currently non-empty deposits, remaining reserve, total reserve capacity, distribution by geological stratum, and distribution by ore quality.
- Display the active planet's survey in the existing scan panel.

## Compatibility
- No save schema or persistence changes.
- No production, depletion, reactivation, scan-cost, or reward formulas changed.
- No new resources are created; all figures are derived from the current cell snapshot.
- Compact number formatting and the shared 13px UI text size from Stage 10.0.6 remain in effect.

## Verification
- Added unit coverage for scanned-deposit aggregation and exclusion of hidden/non-ore cells.
- Typecheck could not complete in the current environment because `node_modules` is absent (`vite/client` type definitions unavailable).
