/** Geometry accounting and deterministic detail tiers for Voronia's planet surface. */
export type SurfaceDetailTier = 'low' | 'balanced' | 'high';

export interface SurfaceGeometryStats {
  readonly cells: number;
  readonly triangles: number;
  readonly vertices: number;
  readonly boundarySegments: number;
  readonly featureTriangles: number;
  readonly estimatedGpuBytes: number;
}

export interface SurfaceGeometryBudget {
  readonly maxTriangles: number;
  readonly maxFeatureTriangles: number;
  readonly maxGpuBytes: number;
}

export const SURFACE_GEOMETRY_BUDGETS: Readonly<Record<SurfaceDetailTier, SurfaceGeometryBudget>> = {
  low: { maxTriangles: 18_000, maxFeatureTriangles: 3_000, maxGpuBytes: 8 * 1024 * 1024 },
  balanced: { maxTriangles: 42_000, maxFeatureTriangles: 9_000, maxGpuBytes: 20 * 1024 * 1024 },
  high: { maxTriangles: 90_000, maxFeatureTriangles: 24_000, maxGpuBytes: 48 * 1024 * 1024 },
};

/** Geometry attributes are Float32 except cell/face metadata (Uint8/Uint32). */
export function estimateSurfaceGeometryBytes(stats: {
  triangles: number; boundarySegments: number; cells: number; sharedBoundaryVertices: number;
}): number {
  const surfaceVertices = stats.triangles * 3;
  const surfaceFloatAttributes = 3 + 3 + 3 + 1 + 1 + 1 + 1 + 1 + 1; // position/color/normal + shader attrs
  const surfaceBytes = surfaceVertices * surfaceFloatAttributes * 4 + stats.triangles * 4;
  const boundaries = stats.boundarySegments * 2 * 6 * 4;
  const markers = stats.cells * (3 * 4 + 3 * 4 + 4 + 1);
  const seams = stats.sharedBoundaryVertices * 3 * 4;
  return surfaceBytes + boundaries + markers + seams;
}

export function chooseSurfaceDetailTier(distance: number): SurfaceDetailTier {
  if (!Number.isFinite(distance) || distance >= 4.4) return 'low';
  if (distance >= 3.0) return 'balanced';
  return 'high';
}

export function surfaceGeometryStats(input: {
  cells: number; triangles: number; boundarySegments: number; featureTriangles: number; sharedBoundaryVertices: number;
}): SurfaceGeometryStats {
  const vertices = input.triangles * 3;
  return {
    cells: input.cells,
    triangles: input.triangles,
    vertices,
    boundarySegments: input.boundarySegments,
    featureTriangles: input.featureTriangles,
    estimatedGpuBytes: estimateSurfaceGeometryBytes(input),
  };
}

export function exceedsSurfaceBudget(stats: SurfaceGeometryStats, budget: SurfaceGeometryBudget): boolean {
  return stats.triangles > budget.maxTriangles || stats.featureTriangles > budget.maxFeatureTriangles || stats.estimatedGpuBytes > budget.maxGpuBytes;
}
