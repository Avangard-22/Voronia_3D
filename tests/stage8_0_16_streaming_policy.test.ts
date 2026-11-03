import { describe, expect, it } from 'vitest';
import { collectCrossChunkBorders, prioritizeSurfaceChunks, sharedCellEdgeKey } from '../src/renderer/surfaceStreamingPolicy';

describe('Stage 8.0.16 seamless boundaries and priority streaming', () => {
  const topology = {
    cellIds: new Uint32Array([11, 22, 33, 44]),
    cellChunkIds: new Uint16Array([0, 0, 1, 2]),
    neighborOffsets: new Uint32Array([0, 1, 3, 5, 6]),
    neighborIds: new Uint32Array([22, 11, 33, 22, 44, 33]),
  };
  it('creates one canonical dependency for each cross-chunk shared border', () => {
    const borders = collectCrossChunkBorders(topology);
    expect(borders.map((border) => border.edgeKey)).toEqual(['22:33', '33:44']);
    expect(sharedCellEdgeKey(44, 33)).toBe('33:44');
    expect(borders.every((border) => border.chunkA !== border.chunkB)).toBe(true);
  });
  it('prioritizes active cell, its actual neighbours, then camera-facing chunks', () => {
    const priorities = prioritizeSurfaceChunks({
      cellIds: topology.cellIds,
      cellChunkIds: topology.cellChunkIds,
      cellCenters: new Float32Array([0, 0, 1, 0, 0, 0.9, 0, 0, -1, 0, 0, -0.8]),
      neighborOffsets: topology.neighborOffsets,
      neighborIds: topology.neighborIds,
      viewDirection: [0, 0, 1],
      activeCellId: 44,
    });
    expect(priorities[0]?.chunkId).toBe(2);
    expect(priorities[0]?.containsActiveCell).toBe(true);
    expect(priorities.find((item) => item.chunkId === 1)?.containsActiveNeighbor).toBe(true);
  });
  it('handles empty topology deterministically', () => {
    expect(prioritizeSurfaceChunks({
      cellIds: new Uint32Array(), cellCenters: new Float32Array(), cellChunkIds: new Uint16Array(),
      neighborOffsets: new Uint32Array([0]), neighborIds: new Uint32Array(), viewDirection: [0, 0, 1],
    })).toEqual([]);
  });
});
