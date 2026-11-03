import { describe, expect, it } from 'vitest';
import { buildPolygonSurfaceChunkPlan } from '../src/renderer/polygonSurfaceStreaming';

describe('Stage 8.0.15 polygon-aware surface streaming', () => {
  const input = {
    cellIds: new Uint32Array([10, 20, 30, 40, 50]),
    cellSideCounts: new Uint16Array([5, 7, 6, 9, 4]),
    neighborOffsets: new Uint32Array([0, 1, 3, 5, 6, 6]),
    neighborIds: new Uint32Array([20, 10, 30, 20, 40, 30]),
  };
  it('preserves every original polygon and its side-count distribution', () => {
    const plan = buildPolygonSurfaceChunkPlan(input, 2);
    expect(plan.minPolygonSides).toBe(4);
    expect(plan.maxPolygonSides).toBe(9);
    expect(plan.polygonSideHistogram).toEqual({ 4: 1, 5: 1, 6: 1, 7: 1, 9: 1 });
    // chunkCellIds — Uint32Array[]: Array.prototype.flat не разворачивает типизированные массивы,
    // поэтому приводим к number[] явно (иначе sort((a, b) => a - b) сравнивал NaN и ничего не проверял).
    expect(plan.chunkCellIds.flatMap((ids) => Array.from(ids)).sort((a, b) => a - b)).toEqual([10, 20, 30, 40, 50]);
  });
  it('uses adjacency and exposes cross-chunk seams without splitting cells', () => {
    const plan = buildPolygonSurfaceChunkPlan(input, 2);
    expect(plan.chunkCellIds[0]).toEqual(new Uint32Array([10, 20]));
    expect(plan.cellChunkIds.length).toBe(input.cellIds.length);
    expect(plan.crossChunkAdjacencyCount).toBeGreaterThan(0);
    expect([...plan.cellChunkIds].every((id) => id < plan.chunkCellIds.length)).toBe(true);
  });
  it('handles isolated cells and an empty planet', () => {
    const empty = buildPolygonSurfaceChunkPlan({ cellIds: new Uint32Array(), cellSideCounts: new Uint16Array(), neighborOffsets: new Uint32Array([0]), neighborIds: new Uint32Array() });
    expect(empty.chunkCellIds).toHaveLength(0);
    const isolated = buildPolygonSurfaceChunkPlan({ cellIds: new Uint32Array([7]), cellSideCounts: new Uint16Array([8]), neighborOffsets: new Uint32Array([0, 0]), neighborIds: new Uint32Array() });
    expect(isolated.chunkCellIds[0]).toEqual(new Uint32Array([7]));
  });
});
