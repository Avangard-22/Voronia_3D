# Stage 10.0.4 — Geological Cell Rewards & Resource Discovery

## Scope
Expose the actual geological reward of a cell after it has been explored, while preserving the v0.0.41 economic formulas and the existing ledger/production pipeline.

## Changes
- `CellView.geologicalReward` carries a read-only, snapshot-derived reward descriptor.
- Hidden and revealed-but-unscanned cells always return `geologicalReward: null`.
- Explored cells expose their primary resource and baseline rate: energy cells (types 0/1/2), resource veins (type 3), cryogenic veins (type 5), research cells (type 6), and facet cores (type 7). Type 7 also reports its crystal side reward.
- The cell panel now displays a Geological Find card, including resource identity and baseline potential.
- No reward formulas, scan charges, ledger transactions, production tick rates, reserve depletion, or upgrade prices were changed. The displayed rates are base rates before biome, arm, technology, compound, warehouse, and other multipliers.

## Verification
- Added tests for pre-scan concealment, post-scan vein identification, starting-cell baseline reward, and unchanged ledger/scan reward behavior.
- Full Vitest/typecheck/build status must be reported from the actual execution environment; syntax and archive checks are performed separately where dependencies are unavailable.
