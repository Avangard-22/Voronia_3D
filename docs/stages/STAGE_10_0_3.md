# Stage 10.0.3 — Cell Scanning & Discovery Mechanics

## Scope
Close the information boundary between unknown, revealed and explored cells while preserving the existing v1-derived scan economy and deterministic exploration transition.

## Implemented
- Snapshot cell type is masked (`type: -1`) until the scan succeeds. This prevents the UI from leaking geological identity for hidden and merely revealed cells.
- Cell dock uses a neutral unknown-cell icon and generic label until exploration completes.
- Added a dedicated unknown-cell SVG asset.
- Added regression coverage for hidden/revealed type masking, direct-neighbor reveal, successful identification, and atomic failure behavior.
- Existing `ExplorationService.scanCell` remains the authority for scan cost, ledger transaction, deterministic anomaly rewards, vein activation, mutant roll, neighbor reveal order, and scan-price growth. No v1 baseline formulas or RNG fork labels were changed.

## Verification
- Static TypeScript transpile check: recorded during packaging (see release notes in the handoff).
- Full typecheck/Vitest/build require the project's npm dependencies. If unavailable in the environment, they are explicitly reported as not run; ZIP integrity is checked independently.

## Non-goals
This stage does not implement new scan currencies, scan accuracy mechanics, new geological reward tables, or changes to legacy v1 pricing/reward formulas.
