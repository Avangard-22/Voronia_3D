import { describe, expect, it, vi } from 'vitest';
import { buildSurfaceChunksAsync } from '../src/renderer/surfaceChunks';

describe('Stage 8.0.13 surface chunks', () => {
  const fixture = () => ({
    positions: new Float32Array([0,0,0, 1,0,0, 0,1,0,  0,0,1, 1,0,1, 0,1,1]),
    attributes: { color: new Float32Array([1,0,0, 1,0,0, 1,0,0,  0,1,0, 0,1,0, 0,1,0]), geologyType: new Float32Array([1,1,1, 2,2,2]) },
    faceCellIds: new Uint32Array([10, 20]),
    cellIds: new Uint32Array([10, 20]),
    cellCenters: new Float32Array([1,1,1, -1,-1,-1]),
  });
  it('partitions triangles and preserves per-face cell identity and vertex attributes', async () => {
    const chunks = await buildSurfaceChunksAsync(fixture(), { yieldControl: () => Promise.resolve() });
    expect(chunks).toHaveLength(2);
    expect(chunks.reduce((sum, chunk) => sum + chunk.triangleCount, 0)).toBe(2);
    expect(chunks.flatMap((chunk) => [...chunk.faceCellIds]).sort()).toEqual([10, 20]);
    expect(chunks.every((chunk) => chunk.positions.length === chunk.attributes.color!.length)).toBe(true);
  });
  it('honours cancellation before producing chunks', async () => {
    const cancelled = vi.fn(() => true);
    expect(await buildSurfaceChunksAsync(fixture(), { isCancelled: cancelled })).toEqual([]);
  });
});
