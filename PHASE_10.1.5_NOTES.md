# Phase 10.1.5 — V1 Warehouse, Storage Capacity & Resource Transfer Parity

## V1 warehouse contract
- `Vi(L) = 10 + 5L` tonnes per explored cell.
- `Hf = exploredCells × Vi`; each planet has its own capacity because its explored-cell count and local stock are independent.
- `Ey = Σ(local planetary resource stock × dn(resource))`; only `iron`, `kriogen`, and `extraResources` occupy the planetary warehouse. Global balances (energy, crystals, research, dust, essence and compounds) do not consume planetary capacity.
- Cargo hold, specialized depot discounts and freight surcharges are not part of this V1 warehouse model. They are no longer shown in the player-facing interface or applied to route quotes. Legacy logistics save fields remain readable for backward compatibility.
- Resource transfer follows V1 `On()/yy()` behavior: switching planets swaps the active planet-local stock atomically; there is no separate cargo loading/unloading step.

## Runtime behavior
- Warehouse capacity and used/free mass are exposed in the snapshot for the active planet.
- Positive production deltas for local resources are clipped to remaining warehouse capacity using the V1 cargo weights.
- Global resource production is unaffected. Existing or migrated over-capacity stock is preserved; no resources are deleted, and further local production pauses until capacity becomes available.
- Warehouse upgrade curves, purchase costs, income multiplier and save schema are unchanged.

## Verification
- Regression coverage added for `Ey` resource scope, weighted capacity clipping, `Hf` capacity growth and preserving stored resources on warehouse upgrades.
- Existing Phase 10.1.4 switching/save migration checks remain the authority for per-planet stock swapping.
- Full Vitest, typecheck and Vite build require dependencies not included in this archive.
