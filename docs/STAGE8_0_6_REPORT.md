# Stage 8.0.6 — Surface Normals, Shading & Geological Transitions

## Implemented

1. `PlanetMeshData.normals`: one normalized normal per non-indexed surface vertex. Face normals are accumulated by canonicalized position, so coincident seam vertices share a lighting normal.
2. `PlanetMeshData.geologyBlend`: a bounded 0..1 mask marking vertices shared by multiple cell IDs.
3. Vertex colors are blended subtly at shared positions only; cell interiors retain their geological palette.
4. The Three.js planet scene now uses hemisphere lighting, a warm key light, a cool fill light, and `MeshStandardMaterial` (roughness 0.86, metalness 0.06).
5. Polygon boundaries and the original variable-sided cell geometry are retained.

## Scope and limitations

- This is vertex-level seam blending, not a continuous texture/shader blend over an area.
- The `geologyBlend` attribute is exported for later shader/material work; the current standard material uses the pre-blended vertex colors.
- Crystal/spire silhouettes remain geometry-driven. Their final specular appearance requires browser tuning.
- No domain economy, cell state, scan, upgrade, or persistence rules were changed.

## Verification

- `node tools/check_arch.mjs`: passed.
- ZIP/TAR archive integrity: checked after packaging.
- Vitest, full TypeScript build, browser and WebGL: not run; dependencies are not installed in this workspace.
