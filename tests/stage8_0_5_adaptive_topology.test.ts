import { describe, expect, it } from 'vitest';
import { buildPlanetMeshData } from '../src/renderer/planetMesh';
import { buildPlanet } from '../src/planets/generator';
import { STARTER_PLANET_SPECS, armsFromBalance } from '../src/planets/catalog';
import { loadBalance } from '../src/config/loader';
import type { GeneratorCtx } from '../src/planets/generator';

const balance = loadBalance();
const ctx: GeneratorCtx = { balance, arms: armsFromBalance(balance) };
const planet = buildPlanet({ ...STARTER_PLANET_SPECS.ferrum }, ctx);

describe('Stage 8.0.5 — planet surface topology and adaptive tessellation', () => {
  it('detects shared edges and builds a common tessellation sequence', () => {
    const mesh = buildPlanetMeshData(planet);
    expect(mesh.sharedEdgeCount).toBeGreaterThan(0);
    expect(mesh.tessellatedEdgeSegmentCount).toBeGreaterThanOrEqual(
      planet.cells.reduce((sum, cell) => sum + cell.poly.length, 0),
    );
    expect(mesh.tJunctionCount).toBe(0);
  });

  it('keeps adaptive seam positions finite and on the planetary shell', () => {
    const mesh = buildPlanetMeshData(planet, {
      cellLevels: new Map(planet.cells.map((cell) => [cell.id, (cell.id % 11) * 2])),
    });
    expect(mesh.sharedBoundaryPositions.length).toBe(mesh.sharedBoundaryVertexCount * 3);
    for (let i = 0; i < mesh.sharedBoundaryPositions.length; i += 3) {
      const radius = Math.hypot(mesh.sharedBoundaryPositions[i]!, mesh.sharedBoundaryPositions[i + 1]!, mesh.sharedBoundaryPositions[i + 2]!);
      expect(Number.isFinite(radius)).toBe(true);
      expect(radius).toBeGreaterThan(0.97);
      expect(radius).toBeLessThan(1.04);
    }
  });

  it('preserves each cell polygon shape and cell-to-face ownership', () => {
    const mesh = buildPlanetMeshData(planet);
    expect(mesh.cellCount).toBe(planet.cells.length);
    expect(mesh.faceCellIds).toHaveLength(mesh.facetCount);
    expect(mesh.cellIds).toHaveLength(planet.cells.length);
    expect(mesh.boundaryPositions.length).toBe(planet.cells.reduce((sum, cell) => sum + cell.poly.length * 6, 0));
  });
});
