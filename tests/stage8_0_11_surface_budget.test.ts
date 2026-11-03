import { describe, expect, it } from 'vitest';
import { chooseSurfaceDetailTier, estimateSurfaceGeometryBytes, exceedsSurfaceBudget, SURFACE_GEOMETRY_BUDGETS, surfaceGeometryStats } from '../src/renderer/surfaceBudget';

describe('Stage 8.0.11 surface geometry budget and LOD policy', () => {
  it('selects deterministic distance tiers', () => {
    expect(chooseSurfaceDetailTier(2.2)).toBe('high');
    expect(chooseSurfaceDetailTier(3.4)).toBe('balanced');
    expect(chooseSurfaceDetailTier(5.0)).toBe('low');
    expect(chooseSurfaceDetailTier(Number.NaN)).toBe('low');
  });
  it('estimates GPU memory monotonically', () => {
    const small = estimateSurfaceGeometryBytes({ triangles: 100, boundarySegments: 20, cells: 10, sharedBoundaryVertices: 15 });
    const large = estimateSurfaceGeometryBytes({ triangles: 200, boundarySegments: 40, cells: 20, sharedBoundaryVertices: 30 });
    expect(large).toBeGreaterThan(small);
  });
  it('flags over-budget geometry and reports feature share', () => {
    const stats = surfaceGeometryStats({ cells: 500, triangles: 50_000, boundarySegments: 2_000, featureTriangles: 12_000, sharedBoundaryVertices: 1_000 });
    expect(stats.vertices).toBe(150_000);
    expect(exceedsSurfaceBudget(stats, SURFACE_GEOMETRY_BUDGETS.balanced)).toBe(true);
    expect(exceedsSurfaceBudget(stats, SURFACE_GEOMETRY_BUDGETS.high)).toBe(false);
  });
});
