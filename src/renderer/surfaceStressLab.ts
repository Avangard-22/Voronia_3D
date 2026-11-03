import type { GeneratedPlanet } from '../contracts/planets';
import { buildPlanetMeshData } from './planetMesh';
import { buildPolygonSurfaceChunkPlan } from './polygonSurfaceStreaming';
import { buildSurfaceChunksAsync } from './surfaceChunks';
import { RuntimeSurfaceLodController } from './runtimeSurfaceLod';
import { SurfaceStreamingRuntime } from './surfaceStreamingRuntime';

export interface SurfaceBenchmarkRun {
  readonly planetId: string;
  readonly planetName: string;
  readonly detail: 0 | 1 | 2;
  readonly cellCount: number;
  readonly polygonSideHistogram: Readonly<Record<number, number>>;
  readonly minPolygonSides: number;
  readonly maxPolygonSides: number;
  readonly meshBuildMs: number;
  readonly chunkPlanMs: number;
  readonly chunkBuildMs: number;
  readonly lodSweepMs: number;
  readonly chunkCount: number;
  readonly triangles: number;
  readonly vertices: number;
  readonly estimatedGpuBytes: number;
  readonly chunkBytes: number;
  readonly crossChunkAdjacencyCount: number;
  readonly maxChunkCells: number;
  readonly runtimePeakStagingBytes: number;
  readonly runtimeInstalledChunks: number;
  readonly lodTransitions: number;
  readonly budgetExceeded: boolean;
}

export interface SurfaceBenchmarkOptions {
  readonly detailTiers?: readonly (0 | 1 | 2)[];
  readonly maxCellsPerChunk?: number;
  readonly stagingBudgetBytes?: number;
  readonly maxInstallsPerFrame?: number;
}

/** CPU-side stress/benchmark harness. It never mutates the planet or the live renderer. */
export async function benchmarkPlanetSurface(planet: GeneratedPlanet, options: SurfaceBenchmarkOptions = {}): Promise<SurfaceBenchmarkRun[]> {
  const tiers = options.detailTiers ?? [0, 1, 2];
  const output: SurfaceBenchmarkRun[] = [];
  for (const detail of tiers) {
    const meshStart = now();
    const mesh = buildPlanetMeshData(planet, { featureDetail: detail });
    const meshBuildMs = elapsed(meshStart);

    const planStart = now();
    const plan = buildPolygonSurfaceChunkPlan({
      cellIds: mesh.cellIds,
      cellSideCounts: mesh.cellSideCounts,
      neighborOffsets: mesh.neighborOffsets,
      neighborIds: mesh.neighborIds,
    }, options.maxCellsPerChunk ?? 48);
    const chunkPlanMs = elapsed(planStart);

    const chunkStart = now();
    const chunks = await buildSurfaceChunksAsync({
      positions: mesh.positions,
      attributes: {
        colors: mesh.colors,
        normals: mesh.normals,
        geologyBlend: mesh.geologyBlend,
        geologyTypes: mesh.geologyTypes,
        surfaceDetail: mesh.surfaceDetail,
        emissiveStrength: mesh.emissiveStrength,
        geologicalMotionAmplitude: mesh.geologicalMotionAmplitude,
        geologicalMotionSpeed: mesh.geologicalMotionSpeed,
      },
      faceCellIds: mesh.faceCellIds,
      cellIds: mesh.cellIds,
      cellCenters: mesh.cellCenters,
      cellChunkIds: plan.cellChunkIds,
    }, { trianglesPerSlice: 4096, yieldControl: () => Promise.resolve() });
    const chunkBuildMs = elapsed(chunkStart);

    const lodStart = now();
    const lod = new RuntimeSurfaceLodController();
    let lodTransitions = 0;
    let previous = lod.tier;
    const distances = [2.2, 3.2, 3.9, 4.9, 4.2, 3.1, 2.0, 4.8, 5.2, 3.4, 2.4];
    for (let repeat = 0; repeat < 500; repeat++) {
      for (const distance of distances) {
        const next = lod.update(distance).tier;
        if (next !== previous) lodTransitions++;
        previous = next;
      }
    }
    const lodSweepMs = elapsed(lodStart);

    const runtime = new SurfaceStreamingRuntime(options.stagingBudgetBytes ?? 24 * 1024 * 1024, options.maxInstallsPerFrame ?? 2);
    runtime.begin(chunks);
    runtime.reprioritize([0.3, 0.7, 0.6], null);
    let guard = 0;
    while (!runtime.isComplete() && !runtime.isAborted() && guard++ < chunks.length + 4) {
      const batch = runtime.takeFrameBatch();
      runtime.markInstalled(batch.length);
    }
    const runtimeStats = runtime.stats();
    const chunkBytes = chunks.reduce((sum, chunk) => sum + chunk.positions.byteLength + chunk.faceCellIds.byteLength + Object.values(chunk.attributes).reduce((n, a) => n + a.byteLength, 0), 0);
    output.push({
      planetId: planet.id, planetName: planet.name, detail, cellCount: mesh.cellCount,
      polygonSideHistogram: plan.polygonSideHistogram,
      minPolygonSides: plan.minPolygonSides, maxPolygonSides: plan.maxPolygonSides,
      meshBuildMs: round(meshBuildMs), chunkPlanMs: round(chunkPlanMs), chunkBuildMs: round(chunkBuildMs), lodSweepMs: round(lodSweepMs),
      chunkCount: chunks.length, triangles: mesh.facetCount, vertices: mesh.facetCount * 3,
      estimatedGpuBytes: mesh.estimatedGpuBytes, chunkBytes,
      crossChunkAdjacencyCount: plan.crossChunkAdjacencyCount,
      maxChunkCells: Math.max(0, ...plan.chunkCellIds.map((ids) => ids.length)),
      runtimePeakStagingBytes: runtimeStats.preparedBytes,
      runtimeInstalledChunks: runtimeStats.installedChunks,
      lodTransitions, budgetExceeded: runtime.isAborted(),
    });
    runtime.cancel();
  }
  return output;
}

export async function runSurfaceStressSuite(planets: readonly GeneratedPlanet[], options: SurfaceBenchmarkOptions = {}): Promise<SurfaceBenchmarkRun[]> {
  const results: SurfaceBenchmarkRun[] = [];
  for (const planet of planets) results.push(...await benchmarkPlanetSurface(planet, options));
  return results;
}

function now(): number { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
function elapsed(start: number): number { return Math.max(0, now() - start); }
function round(value: number): number { return Math.round(value * 100) / 100; }
