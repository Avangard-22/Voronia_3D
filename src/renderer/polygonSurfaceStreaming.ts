/** Polygon-aware partitioning: chunks contain whole source cells and follow the planet adjacency graph. */
export interface PolygonChunkPlanInput {
  readonly cellIds: Uint32Array;
  readonly cellSideCounts: Uint16Array;
  readonly neighborOffsets: Uint32Array;
  readonly neighborIds: Uint32Array;
}
export interface PolygonSurfaceChunkPlan {
  /** Parallel to cellIds; every original cell belongs to exactly one chunk. */
  readonly cellChunkIds: Uint16Array;
  readonly chunkCellIds: readonly Uint32Array[];
  readonly crossChunkAdjacencyCount: number;
  readonly minPolygonSides: number;
  readonly maxPolygonSides: number;
  readonly polygonSideHistogram: Readonly<Record<number, number>>;
  readonly maxCellsPerChunk: number;
}

/**
 * Deterministic breadth-first partition. A chunk is filled from a seed through real `neighbors`,
 * never by splitting a cell polygon or by normalizing its side count. Shared borders remain in the
 * existing globally tessellated boundary layer, so chunk boundaries do not create new seams.
 */
export function buildPolygonSurfaceChunkPlan(input: PolygonChunkPlanInput, maxCellsPerChunk = 48): PolygonSurfaceChunkPlan {
  const count = input.cellIds.length;
  const cap = Math.max(1, Math.floor(maxCellsPerChunk));
  const indexById = new Map<number, number>();
  for (let i = 0; i < count; i++) indexById.set(input.cellIds[i]!, i);
  const assignment = new Int32Array(count).fill(-1);
  const chunks: number[][] = [];
  for (let seed = 0; seed < count; seed++) {
    if (assignment[seed] !== -1) continue;
    const chunkId = chunks.length;
    const members: number[] = [];
    const queue = [seed];
    assignment[seed] = chunkId;
    for (let cursor = 0; cursor < queue.length && members.length < cap; cursor++) {
      const index = queue[cursor]!;
      members.push(index);
      const start = input.neighborOffsets[index] ?? 0;
      const end = input.neighborOffsets[index + 1] ?? start;
      for (let n = start; n < end && members.length + (queue.length - cursor - 1) < cap; n++) {
        const neighborIndex = indexById.get(input.neighborIds[n]!);
        if (neighborIndex === undefined || assignment[neighborIndex] !== -1) continue;
        assignment[neighborIndex] = chunkId;
        queue.push(neighborIndex);
      }
    }
    chunks.push(members);
  }
  const histogram: Record<number, number> = {};
  let minSides = Number.POSITIVE_INFINITY;
  let maxSides = 0;
  for (const sides of input.cellSideCounts) {
    histogram[sides] = (histogram[sides] ?? 0) + 1;
    minSides = Math.min(minSides, sides);
    maxSides = Math.max(maxSides, sides);
  }
  let crossChunkAdjacencyCount = 0;
  for (let i = 0; i < count; i++) {
    const start = input.neighborOffsets[i] ?? 0;
    const end = input.neighborOffsets[i + 1] ?? start;
    for (let n = start; n < end; n++) {
      const j = indexById.get(input.neighborIds[n]!);
      if (j !== undefined && j > i && assignment[i] !== assignment[j]) crossChunkAdjacencyCount++;
    }
  }
  return {
    cellChunkIds: Uint16Array.from(assignment),
    chunkCellIds: chunks.map((members) => Uint32Array.from(members.map((index) => input.cellIds[index]!))),
    crossChunkAdjacencyCount,
    minPolygonSides: Number.isFinite(minSides) ? minSides : 0,
    maxPolygonSides: maxSides,
    polygonSideHistogram: histogram,
    maxCellsPerChunk: cap,
  };
}
