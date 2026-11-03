import { describe, expect, it } from 'vitest';
import { buildPlanetMeshData } from '../src/renderer/planetMesh';
import { buildPlanet } from '../src/planets/generator';
import { STARTER_PLANET_SPECS, armsFromBalance } from '../src/planets/catalog';
import { loadBalance } from '../src/config/loader';
import type { GeneratorCtx } from '../src/planets/generator';

const balance = loadBalance();
const ctx: GeneratorCtx = { balance, arms: armsFromBalance(balance) };
const planet = buildPlanet({ ...STARTER_PLANET_SPECS.ferrum }, ctx);

describe('Stage 8.0.8 — geological structures and procedural surface features', () => {
  it('creates deterministic per-cell geological feature metadata', () => {
    const first = buildPlanetMeshData(planet);
    const second = buildPlanetMeshData(planet);
    expect(first.surfaceFeatureKinds).toHaveLength(planet.cells.length);
    expect(first.surfaceFeatureCounts).toHaveLength(planet.cells.length);
    expect(Array.from(first.surfaceFeatureKinds)).toEqual(Array.from(second.surfaceFeatureKinds));
    expect(Array.from(first.surfaceFeatureCounts)).toEqual(Array.from(second.surfaceFeatureCounts));
    expect(first.surfaceFeatureKinds.some((kind) => kind > 0)).toBe(true);
  });

  it('keeps hidden cells free of visible geological structures', () => {
    const hidden = buildPlanetMeshData(planet, { explored: new Set(), revealed: new Set() });
    expect(hidden.surfaceFeatureKinds.every((kind) => kind === 0)).toBe(true);
    expect(hidden.surfaceFeatureCounts.every((count) => count === 0)).toBe(true);
    expect(hidden.geologyTypes.every((type) => type === -1)).toBe(true);
  });

  it('maps procedural geometry triangles back to their owning cell', () => {
    const mesh = buildPlanetMeshData(planet);
    expect(mesh.faceCellIds).toHaveLength(mesh.facetCount);
    expect(mesh.positions.length / 9).toBe(mesh.facetCount);
    expect(mesh.surfaceFeatureCounts.some((count) => count > 0)).toBe(true);
    for (const position of mesh.positions) expect(Number.isFinite(position)).toBe(true);
  });

  it('does not create feature geometry for unknown cells even when they are merely revealed', () => {
    const revealed = new Set(planet.cells.slice(0, 8).map((cell) => cell.id));
    const mesh = buildPlanetMeshData(planet, { explored: new Set(), revealed });
    expect(mesh.surfaceFeatureKinds.every((kind) => kind === 0)).toBe(true);
    expect(mesh.surfaceFeatureCounts.every((count) => count === 0)).toBe(true);
  });
});
