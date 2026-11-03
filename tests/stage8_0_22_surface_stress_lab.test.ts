import { describe, expect, it } from 'vitest';
import { buildPlanet } from '../src/planets/generator';
import { STARTER_PLANET_SPECS, armsFromBalance } from '../src/planets/catalog';
import { loadBalance } from '../src/config/loader';
import { benchmarkPlanetSurface } from '../src/renderer/surfaceStressLab';

const balance = loadBalance();
const ctx = { balance, arms: armsFromBalance(balance) };
const planet = buildPlanet({ ...STARTER_PLANET_SPECS.krios }, ctx);

describe('Stage 8.0.22 surface streaming stress lab', () => {
  it('benchmarks real generated polygon mesh and preserves non-uniform cell side counts', async () => {
    const [result] = await benchmarkPlanetSurface(planet, { detailTiers: [1] });
    expect(result).toBeDefined();
    expect(result!.cellCount).toBe(planet.cells.length);
    expect(result!.minPolygonSides).toBeGreaterThanOrEqual(3);
    expect(result!.maxPolygonSides).toBeGreaterThan(result!.minPolygonSides);
    expect(Object.keys(result!.polygonSideHistogram).length).toBeGreaterThan(1);
    expect(result!.triangles).toBeGreaterThan(0);
    expect(result!.chunkCount).toBeGreaterThan(0);
    expect(result!.chunkBytes).toBeGreaterThan(0);
  });

  it('reports all tiers and completes frame-budgeted staging without losing chunks', async () => {
    const results = await benchmarkPlanetSurface(planet);
    expect(results.map((r) => r.detail)).toEqual([0, 1, 2]);
    for (const result of results) {
      expect(result.runtimeInstalledChunks).toBe(result.chunkCount);
      expect(result.budgetExceeded).toBe(false);
      expect(result.maxChunkCells).toBeLessThanOrEqual(48);
      expect(result.lodTransitions).toBeGreaterThan(0);
    }
  });

  it('detects a deliberately insufficient staging budget', async () => {
    const [result] = await benchmarkPlanetSurface(planet, { detailTiers: [0], stagingBudgetBytes: 1 });
    expect(result!.budgetExceeded).toBe(true);
    expect(result!.runtimeInstalledChunks).toBe(0);
  });
});
