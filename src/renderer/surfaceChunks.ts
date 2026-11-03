/** Cooperative surface chunk builder. Cell triangles are grouped by the octant of their cell centre. */
export interface SurfaceChunkInput {
  readonly positions: Float32Array;
  readonly attributes: Readonly<Record<string, Float32Array>>;
  readonly faceCellIds: Uint32Array;
  readonly cellIds: Uint32Array;
  readonly cellCenters: Float32Array;
  /** Optional polygon-topology assignment parallel to cellIds. */
  readonly cellChunkIds?: Uint16Array;
}
export interface SurfaceChunk {
  readonly id: number;
  readonly positions: Float32Array;
  readonly attributes: Readonly<Record<string, Float32Array>>;
  readonly faceCellIds: Uint32Array;
  readonly triangleCount: number;
}
export interface SurfaceChunkBuildOptions {
  readonly trianglesPerSlice?: number;
  readonly yieldControl?: () => Promise<void>;
  readonly isCancelled?: () => boolean;
}

const defaultYield = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Splits the existing triangle soup without changing triangle order within a chunk or cell identity.
 * Each triangle is assigned using the radial centre of its source cell. This is a rendering partition,
 * not a topology operation: source cell polygons and their boundaries are untouched.
 */
export async function buildSurfaceChunksAsync(input: SurfaceChunkInput, options: SurfaceChunkBuildOptions = {}): Promise<SurfaceChunk[]> {
  const slice = Math.max(128, Math.floor(options.trianglesPerSlice ?? 2048));
  const yieldControl = options.yieldControl ?? defaultYield;
  const cellIndex = new Map<number, number>();
  for (let i = 0; i < input.cellIds.length; i++) cellIndex.set(input.cellIds[i]!, i);
  const bucketCount = input.cellChunkIds ? Math.max(1, input.cellChunkIds.reduce((max, value) => Math.max(max, value), 0) + 1) : 8;
  const buckets: number[][] = Array.from({ length: bucketCount }, () => []);
  const triangleCount = Math.min(input.faceCellIds.length, Math.floor(input.positions.length / 9));
  for (let triangle = 0; triangle < triangleCount; triangle++) {
    if (options.isCancelled?.()) return [];
    const ci = cellIndex.get(input.faceCellIds[triangle]!);
    if (ci === undefined) continue;
    const x = input.cellCenters[ci * 3] ?? 0;
    const y = input.cellCenters[ci * 3 + 1] ?? 0;
    const z = input.cellCenters[ci * 3 + 2] ?? 0;
    const bucket = input.cellChunkIds?.[ci] ?? ((x >= 0 ? 1 : 0) | (y >= 0 ? 2 : 0) | (z >= 0 ? 4 : 0));
    buckets[bucket]!.push(triangle);
    if ((triangle + 1) % slice === 0) await yieldControl();
  }
  if (options.isCancelled?.()) return [];
  const chunks: SurfaceChunk[] = [];
  for (let id = 0; id < buckets.length; id++) {
    const triangles = buckets[id]!;
    if (!triangles.length) continue;
    const positions = new Float32Array(triangles.length * 9);
    const attributes: Record<string, Float32Array> = {};
    for (const [name, values] of Object.entries(input.attributes)) attributes[name] = new Float32Array(triangles.length * 9);
    const faceCellIds = new Uint32Array(triangles.length);
    triangles.forEach((sourceTriangle, targetTriangle) => {
      const src = sourceTriangle * 9;
      const dst = targetTriangle * 9;
      positions.set(input.positions.subarray(src, src + 9), dst);
      for (const [name, values] of Object.entries(input.attributes)) attributes[name]!.set(values.subarray(src, src + 9), dst);
      faceCellIds[targetTriangle] = input.faceCellIds[sourceTriangle]!;
    });
    chunks.push({ id, positions, attributes, faceCellIds, triangleCount: triangles.length });
    await yieldControl();
    if (options.isCancelled?.()) return [];
  }
  return chunks;
}
