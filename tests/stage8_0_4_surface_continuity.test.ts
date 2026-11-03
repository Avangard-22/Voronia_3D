import { describe, expect, it } from 'vitest';
import { buildPlanetMeshData } from '../src/renderer/planetMesh';
import { buildPlanet } from '../src/planets/generator';
import { STARTER_PLANET_SPECS, armsFromBalance } from '../src/planets/catalog';
import { loadBalance } from '../src/config/loader';
import type { GeneratorCtx } from '../src/planets/generator';

const balance = loadBalance();
const ctx: GeneratorCtx = { balance, arms: armsFromBalance(balance) };
const planet = buildPlanet({ ...STARTER_PLANET_SPECS.ferrum }, ctx);

describe('Stage 8.0.4 — continuous surface and shared cell boundaries', () => {
  it('retains every unique polygon vertex and adds adaptive points along edges', () => {
    const data = buildPlanetMeshData(planet);
    const unique = new Set(planet.cells.flatMap((cell) => cell.poly.map((p) => p.map((v) => Math.round(v * 1e7)).join(','))));
    expect(data.sharedBoundaryVertexCount).toBeGreaterThanOrEqual(unique.size);
    expect(data.sharedBoundaryPositions).toHaveLength(data.sharedBoundaryVertexCount * 3);
    expect(data.tessellatedEdgeSegmentCount).toBeGreaterThanOrEqual(planet.cells.reduce((sum, cell) => sum + cell.poly.length, 0));
    expect(data.tJunctionCount).toBe(0);
  });

  it('keeps shared seam coordinates finite and close to the base spherical radius', () => {
    const data = buildPlanetMeshData(planet, {
      cellLevels: new Map(planet.cells.map((cell) => [cell.id, (cell.id % 9) * 2])),
    });
    for (let i = 0; i < data.sharedBoundaryPositions.length; i += 3) {
      const r = Math.hypot(data.sharedBoundaryPositions[i]!, data.sharedBoundaryPositions[i + 1]!, data.sharedBoundaryPositions[i + 2]!);
      expect(Number.isFinite(r)).toBe(true);
      expect(r).toBeGreaterThan(0.97);
      expect(r).toBeLessThan(1.04);
    }
  });

  it('uses identical shared vertex coordinates regardless of cell traversal order', () => {
    const forward = buildPlanetMeshData(planet);
    const reversed = buildPlanetMeshData({ ...planet, cells: [...planet.cells].reverse() });
    const normalize = (values: Float32Array): string[] => {
      const rows: string[] = [];
      for (let i = 0; i < values.length; i += 3) rows.push(`${values[i]},${values[i + 1]},${values[i + 2]}`);
      return rows.sort();
    };
    expect(normalize(forward.sharedBoundaryPositions)).toEqual(normalize(reversed.sharedBoundaryPositions));
  });
});
