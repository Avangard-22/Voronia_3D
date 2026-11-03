import { describe, expect, it } from 'vitest';
import { buildPlanetMeshData } from '../src/renderer/planetMesh';
import { buildPlanet } from '../src/planets/generator';
import { STARTER_PLANET_SPECS, armsFromBalance } from '../src/planets/catalog';
import { loadBalance } from '../src/config/loader';
import type { GeneratorCtx } from '../src/planets/generator';

const balance = loadBalance();
const ctx: GeneratorCtx = { balance, arms: armsFromBalance(balance) };
const planet = buildPlanet({ ...STARTER_PLANET_SPECS.ferrum }, ctx);

describe('Stage 8.0.6 — surface normals, shading and geological transitions', () => {
  it('provides one finite, normalized normal for every surface vertex', () => {
    const mesh = buildPlanetMeshData(planet);
    expect(mesh.normals).toHaveLength(mesh.positions.length);
    for (let i = 0; i < mesh.normals.length; i += 3) {
      const x = mesh.normals[i]!;
      const y = mesh.normals[i + 1]!;
      const z = mesh.normals[i + 2]!;
      expect(Number.isFinite(x + y + z)).toBe(true);
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 4);
    }
  });

  it('provides a bounded geological transition mask without changing polygon ownership', () => {
    const mesh = buildPlanetMeshData(planet);
    expect(mesh.geologyBlend).toHaveLength(mesh.positions.length / 3);
    expect(mesh.faceCellIds).toHaveLength(mesh.facetCount);
    expect(Array.from(mesh.geologyBlend).every((value) => value >= 0 && value <= 1)).toBe(true);
    expect(mesh.colors.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
  });

  it('keeps hidden cells visually neutral while retaining valid lighting data', () => {
    const mesh = buildPlanetMeshData(planet, { explored: new Set([planet.startingCellId]), revealed: new Set([planet.startingCellId]) });
    expect(mesh.normals).toHaveLength(mesh.positions.length);
    expect(mesh.cellStates[mesh.cellIds.indexOf(planet.startingCellId)]).toBe(2);
    expect(mesh.cellStates.filter((state) => state === 0).length).toBeGreaterThan(0);
  });
});
