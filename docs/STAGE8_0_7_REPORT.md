# Stage 8.0.7 — Geological Materials & Surface Detail

## Implemented

- Added `geologicalMaterialProfile(type)` as a deterministic material profile for the existing geological type IDs. Energy/water basins use lower roughness; resource terrain is matte; rare crystal classes use higher specular/metal response; mountain classes receive stronger micro-relief contrast; anomaly classes receive restrained emission.
- `PlanetMeshData` now carries per-vertex `geologyTypes`, deterministic `surfaceDetail` seeds and `emissiveStrength`. These arrays are emitted alongside triangle vertices, preserving the existing face-to-cell ordering.
- Hidden and merely revealed cells use geological type `-1` and zero emission, so the material layer does not reveal their hidden geological class.
- The planet surface material in `renderer/scene.ts` consumes the attributes in a custom `MeshStandardMaterial` shader patch. It varies tint, roughness and emission by geological class and applies subtle deterministic procedural micro-detail.
- Existing polygon contours, variable `cell.poly` geometry, cell IDs, cell selection, scan/upgrade commands and domain economy are unchanged.

## Scope and limitations

- Procedural detail is shader-scale shading, not a high-resolution displacement map and not additional geometry.
- Geological IDs are interpreted using the current renderer's established type mapping; no new domain types or balance rules were introduced.
- Browser/WebGL shader compilation and visual acceptance have not been run in this environment. Shader integration must be checked in the browser before calling the stage visually accepted.
