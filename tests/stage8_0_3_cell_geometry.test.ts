import { describe, expect, it } from 'vitest';
import { buildPlanetMeshData } from '../src/renderer/planetMesh';
import { buildPlanet } from '../src/planets/generator';
import { STARTER_PLANET_SPECS, armsFromBalance } from '../src/planets/catalog';
import { loadBalance } from '../src/config/loader';
import type { GeneratorCtx } from '../src/planets/generator';

const balance = loadBalance();
const ctx: GeneratorCtx = { balance, arms: armsFromBalance(balance) };
const planet = buildPlanet({ ...STARTER_PLANET_SPECS.ferrum }, ctx);

describe('Stage 8.0.3 — cell geometry and upgrade deformation', () => {
  it('retains original variable polygon topology and reports a deterministic per-cell morphology variant', () => {
    const a = buildPlanetMeshData(planet);
    const b = buildPlanetMeshData(planet);
    expect(a.cellMorphology).toHaveLength(planet.cells.length);
    expect(Array.from(a.cellMorphology)).toEqual(Array.from(b.cellMorphology));
    expect(new Set(a.cellMorphology).size).toBeGreaterThan(1);
    expect(a.boundaryPositions).toHaveLength(planet.cells.reduce((sum, cell) => sum + cell.poly.length, 0) * 6);
  });

  it('upgrade changes the selected cell relief while preserving the shared polygon boundary', () => {
    const target = planet.cells.find((cell) => cell.type === 1)!;
    const base = buildPlanetMeshData(planet, { cellLevels: new Map([[target.id, 0]]) });
    const upgraded = buildPlanetMeshData(planet, { cellLevels: new Map([[target.id, 18]]) });
    const index = planet.cells.indexOf(target);
    expect(upgraded.cellHeights[index]).toBeGreaterThan(base.cellHeights[index]!);
    expect(upgraded.cellLevels[index]).toBe(18);
    // Общая линия стыка клеток остаётся неизменной, поэтому повышение не раздвигает соседние полигоны.
    expect(Array.from(upgraded.boundaryPositions)).toEqual(Array.from(base.boundaryPositions));
    expect(Array.from(upgraded.positions)).not.toEqual(Array.from(base.positions));
  });

  it('all displaced vertices remain radial and finite; cell IDs stay mapped per triangle', () => {
    const levels = new Map<number, number>(planet.cells.map((cell) => [cell.id, (cell.id % 7) * 3]));
    const data = buildPlanetMeshData(planet, { cellLevels: levels });
    expect(data.faceCellIds).toHaveLength(data.facetCount);
    for (const value of data.positions) expect(Number.isFinite(value)).toBe(true);
    for (let i = 0; i < data.cellCount; i++) {
      const x = data.cellSurfaceCenters[i * 3]!;
      const y = data.cellSurfaceCenters[i * 3 + 1]!;
      const z = data.cellSurfaceCenters[i * 3 + 2]!;
      const r = Math.hypot(x, y, z);
      expect(r).toBeGreaterThan(0.9);
      expect(r).toBeLessThan(1.2);
    }
  });
});
