/// <reference lib="webworker" />
interface WorkerInput {
  positions: Float32Array; faceCellIds: Uint32Array; cellIds: Uint32Array; cellCenters: Float32Array;
  attributes: Record<string, Float32Array>; maxOutputBytes: number; cellChunkIds?: Uint16Array; chunkPriorityOrder?: readonly number[];
}
interface WorkerChunk { id: number; positions: Float32Array; attributes: Record<string, Float32Array>; faceCellIds: Uint32Array; triangleCount: number; }
const ctx = self as DedicatedWorkerGlobalScope;
ctx.onmessage = (event: MessageEvent<WorkerInput>) => {
  const input = event.data;
  const cellIndex = new Map<number, number>();
  for (let i = 0; i < input.cellIds.length; i++) cellIndex.set(input.cellIds[i]!, i);
  const bucketCount = input.cellChunkIds ? Math.max(1, input.cellChunkIds.reduce((max, value) => Math.max(max, value), 0) + 1) : 8;
  const buckets: number[][] = Array.from({ length: bucketCount }, () => []);
  const count = Math.min(input.faceCellIds.length, Math.floor(input.positions.length / 9));
  for (let t = 0; t < count; t++) {
    const ci = cellIndex.get(input.faceCellIds[t]!);
    if (ci === undefined) continue;
    const x = input.cellCenters[ci * 3] ?? 0, y = input.cellCenters[ci * 3 + 1] ?? 0, z = input.cellCenters[ci * 3 + 2] ?? 0;
    const bucket = input.cellChunkIds?.[ci] ?? ((x >= 0 ? 1 : 0) | (y >= 0 ? 2 : 0) | (z >= 0 ? 4 : 0));
    buckets[bucket]!.push(t);
  }
  const expectedTriangles = buckets.reduce((sum, bucket) => sum + bucket.length, 0);
  const bytesPerVertex = 3 + Object.keys(input.attributes).reduce((sum, name) => sum + (['geologyBlend','geologyType','surfaceDetail','emissiveStrength','geologicalMotionAmplitude','geologicalMotionSpeed'].includes(name) ? 1 : 3), 0);
  const estimatedBytes = expectedTriangles * (bytesPerVertex * 3 * 4 + 4);
  if (estimatedBytes > input.maxOutputBytes) { ctx.postMessage({ error: 'memory-budget-exceeded', estimatedBytes }); return; }
  const chunks: WorkerChunk[] = [];
  const transfer: Transferable[] = [];
  const orderedChunkIds = input.chunkPriorityOrder?.length ? input.chunkPriorityOrder : buckets.map((_, id) => id);
  for (const id of orderedChunkIds) {
    const triangles = buckets[id];
    if (!triangles) continue; if (!triangles.length) continue;
    const positions = new Float32Array(triangles.length * 9);
    const attributes: Record<string, Float32Array> = {};
    for (const [name] of Object.entries(input.attributes)) attributes[name] = new Float32Array(triangles.length * 9);
    const faceCellIds = new Uint32Array(triangles.length);
    for (let j = 0; j < triangles.length; j++) {
      const src = triangles[j]! * 9, dst = j * 9;
      positions.set(input.positions.subarray(src, src + 9), dst);
      for (const [name, values] of Object.entries(input.attributes)) attributes[name]!.set(values.subarray(src, src + 9), dst);
      faceCellIds[j] = input.faceCellIds[triangles[j]!]!;
    }
    chunks.push({ id, positions, attributes, faceCellIds, triangleCount: triangles.length });
    transfer.push(positions.buffer, faceCellIds.buffer, ...Object.values(attributes).map((a) => a.buffer));
  }
  ctx.postMessage({ chunks, estimatedBytes }, transfer);
};
export {};
