/** Camera- and interaction-aware ordering for whole-polygon surface chunks. */
export interface SurfaceChunkPriorityInput {
  readonly cellIds: Uint32Array;
  readonly cellCenters: Float32Array;
  readonly cellChunkIds: Uint16Array;
  readonly neighborOffsets: Uint32Array;
  readonly neighborIds: Uint32Array;
  readonly viewDirection: readonly [number, number, number];
  readonly activeCellId?: number | null;
  readonly visibleNeighborBoost?: number;
}
export interface SurfaceChunkPriority {
  readonly chunkId: number;
  readonly score: number;
  readonly cellCount: number;
  readonly containsActiveCell: boolean;
  readonly containsActiveNeighbor: boolean;
}

/**
 * Orders complete cell chunks, not GPU triangles. Camera-facing chunks come first; the selected
 * cell and its true graph neighbours receive an interaction boost. No polygon is split or rewritten.
 */
export function prioritizeSurfaceChunks(input: SurfaceChunkPriorityInput): SurfaceChunkPriority[] {
  const maxChunk = input.cellChunkIds.reduce((max, id) => Math.max(max, id), -1);
  if (maxChunk < 0) return [];
  const length = maxChunk + 1;
  const sums: [number, number, number][] = Array.from({ length }, (): [number, number, number] => [0, 0, 0]);
  const counts = new Uint32Array(length);
  const indexById = new Map<number, number>();
  for (let i = 0; i < input.cellIds.length; i++) {
    indexById.set(input.cellIds[i]!, i);
    const chunk = input.cellChunkIds[i]!;
    sums[chunk]![0] += input.cellCenters[i * 3] ?? 0;
    sums[chunk]![1] += input.cellCenters[i * 3 + 1] ?? 0;
    sums[chunk]![2] += input.cellCenters[i * 3 + 2] ?? 0;
    counts[chunk] = (counts[chunk] ?? 0) + 1;
  }
  const activeIndex = input.activeCellId == null ? undefined : indexById.get(input.activeCellId);
  const activeChunk = activeIndex === undefined ? -1 : input.cellChunkIds[activeIndex]!;
  const activeNeighbors = new Set<number>();
  if (activeIndex !== undefined) {
    for (let n = input.neighborOffsets[activeIndex] ?? 0; n < (input.neighborOffsets[activeIndex + 1] ?? 0); n++) {
      const index = indexById.get(input.neighborIds[n]!);
      if (index !== undefined) activeNeighbors.add(input.cellChunkIds[index]!);
    }
  }
  const [vx, vy, vz] = input.viewDirection;
  const viewLength = Math.hypot(vx, vy, vz) || 1;
  const boost = input.visibleNeighborBoost ?? 0.35;
  const result: SurfaceChunkPriority[] = [];
  for (let chunkId = 0; chunkId < length; chunkId++) {
    if (!counts[chunkId]) continue;
    const center = sums[chunkId]!;
    const centerLength = Math.hypot(center[0], center[1], center[2]) || 1;
    const facing = (center[0] * vx + center[1] * vy + center[2] * vz) / (centerLength * viewLength);
    const containsActiveCell = chunkId === activeChunk;
    const containsActiveNeighbor = activeNeighbors.has(chunkId);
    const score = facing + (containsActiveCell ? 3 : 0) + (containsActiveNeighbor ? boost : 0);
    result.push({ chunkId, score, cellCount: counts[chunkId]!, containsActiveCell, containsActiveNeighbor });
  }
  return result.sort((a, b) => b.score - a.score || a.chunkId - b.chunkId);
}

/** Stable, canonical key for a shared cell edge, independent of which chunk owns either cell. */
export function sharedCellEdgeKey(cellA: number, cellB: number): string {
  return cellA < cellB ? `${cellA}:${cellB}` : `${cellB}:${cellA}`;
}

/** Cross-chunk shared borders are explicit dependencies; both cells retain their original polygons. */
export function collectCrossChunkBorders(input: {
  readonly cellIds: Uint32Array;
  readonly cellChunkIds: Uint16Array;
  readonly neighborOffsets: Uint32Array;
  readonly neighborIds: Uint32Array;
}): Array<{ edgeKey: string; cellA: number; cellB: number; chunkA: number; chunkB: number }> {
  const indexById = new Map<number, number>();
  input.cellIds.forEach((id, index) => indexById.set(id, index));
  const borders: Array<{ edgeKey: string; cellA: number; cellB: number; chunkA: number; chunkB: number }> = [];
  for (let i = 0; i < input.cellIds.length; i++) {
    const a = input.cellIds[i]!;
    for (let n = input.neighborOffsets[i] ?? 0; n < (input.neighborOffsets[i + 1] ?? 0); n++) {
      const b = input.neighborIds[n]!;
      const j = indexById.get(b);
      if (j === undefined || b <= a || input.cellChunkIds[i] === input.cellChunkIds[j]) continue;
      borders.push({ edgeKey: sharedCellEdgeKey(a, b), cellA: a, cellB: b, chunkA: input.cellChunkIds[i]!, chunkB: input.cellChunkIds[j]! });
    }
  }
  return borders;
}
