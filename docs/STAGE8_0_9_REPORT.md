# Stage 8.0.9 — Geological Animation & Dynamic Surface Evolution

## Implemented

- Added deterministic `geologicalAnimationProfile(type)` with restrained class-specific amplitudes and speeds.
- Added per-vertex `geologicalMotionAmplitude` and `geologicalMotionSpeed` attributes to `PlanetMeshData`.
- The Three.js geological material now receives a shared elapsed-time uniform. Its vertex shader applies subtle radial motion; the fragment shader animates water-like flow, crystal pulse, anomaly modulation and emissive response.
- Hidden and merely revealed cells retain geology type `-1` and zero motion attributes. Their geological class is not exposed by animation.
- Animation is renderer-only. It does not mutate cell state, progression, resources, save data or domain commands.

## Design limits

- This is deliberately subtle shader animation, not a physical simulation or persistent terrain deformation.
- The vertex displacement is radial and bounded to at most 0.0032 world units in the current profile.
- Vertex normals are not recomputed per frame; amplitudes are kept small to avoid obvious lighting instability.
- GPU cost and shader compilation still require browser/WebGL acceptance.

## Verification

- Added `tests/stage8_0_9_geological_animation.test.ts` for profile bounds, attribute lengths and zero motion for hidden/revealed cells.
- Browser/WebGL shader compilation and visual acceptance have not been performed in this environment.
