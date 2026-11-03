import type { SurfaceChunk, SurfaceChunkInput } from './surfaceChunks';

export interface SurfaceWorkerResult { readonly chunks: SurfaceChunk[]; readonly estimatedBytes: number; readonly workerUsed: boolean; }
export interface SurfaceWorkerOptions { readonly maxOutputBytes: number; readonly maxInputCopyBytes?: number; readonly chunkPriorityOrder?: readonly number[]; readonly onProgress?: (phase: 'copying' | 'building' | 'complete') => void; }

export function estimateSurfaceTransferBytes(input: { triangles: number; attributeComponentsPerVertex: number }): number {
  return Math.max(0, Math.floor(input.triangles)) * (Math.max(0, input.attributeComponentsPerVertex) * 3 * 4 + 4);
}

/** Worker-based partitioning. Input arrays are copied before transfer, so the visible source mesh remains valid. */
export async function buildSurfaceChunksWithWorker(input: SurfaceChunkInput, options: SurfaceWorkerOptions): Promise<SurfaceWorkerResult> {
  if (typeof Worker === 'undefined') throw new Error('Web Workers are unavailable');
  const inputBytes = input.positions.byteLength + input.faceCellIds.byteLength + input.cellIds.byteLength + input.cellCenters.byteLength + Object.values(input.attributes).reduce((sum, values) => sum + values.byteLength, 0);
  if (inputBytes > (options.maxInputCopyBytes ?? 24 * 1024 * 1024)) throw new Error(`input-copy-budget-exceeded:${inputBytes}`);
  options.onProgress?.('copying');
  const positions = input.positions.slice();
  const faceCellIds = input.faceCellIds.slice();
  const cellIds = input.cellIds.slice();
  const cellCenters = input.cellCenters.slice();
  const cellChunkIds = input.cellChunkIds?.slice();
  const attributes: Record<string, Float32Array> = {};
  for (const [name, values] of Object.entries(input.attributes)) attributes[name] = values.slice();
  const transfer: Transferable[] = [positions.buffer, faceCellIds.buffer, cellIds.buffer, cellCenters.buffer, ...(cellChunkIds ? [cellChunkIds.buffer] : []), ...Object.values(attributes).map((a) => a.buffer)];
  options.onProgress?.('building');
  const worker = new Worker(new URL('./surfaceChunk.worker.ts', import.meta.url), { type: 'module' });
  try {
    const response = await new Promise<{ chunks?: SurfaceChunk[]; estimatedBytes?: number; error?: string }>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<{ chunks?: SurfaceChunk[]; estimatedBytes?: number; error?: string }>) => event.data.error ? reject(new Error(`${event.data.error}:${event.data.estimatedBytes ?? 0}`)) : resolve(event.data);
      worker.onerror = (event) => reject(new Error(event.message || 'Surface worker failed'));
      worker.postMessage({ positions, faceCellIds, cellIds, cellCenters, cellChunkIds, attributes, maxOutputBytes: options.maxOutputBytes, chunkPriorityOrder: options.chunkPriorityOrder }, transfer);
    });
    if (!response.chunks) throw new Error('Surface worker returned no chunks');
    options.onProgress?.('complete');
    return { chunks: response.chunks, estimatedBytes: response.estimatedBytes ?? 0, workerUsed: true };
  } finally { worker.terminate(); }
}
