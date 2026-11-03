import type { SurfaceChunk } from './surfaceChunks';

export interface RuntimeChunkEntry {
  readonly chunk: SurfaceChunk;
  readonly center: readonly [number, number, number];
  readonly bytes: number;
  score: number;
}
export interface SurfaceRuntimeStats {
  readonly pendingChunks: number;
  readonly preparedChunks: number;
  readonly preparedBytes: number;
  readonly installedChunks: number;
  readonly evictedStagingChunks: number;
}

/**
 * Frame-budgeted runtime scheduler. It retains complete source-cell chunks and only reorders
 * their preparation; it never clips polygons or drops the interactive base surface. Memory
 * eviction applies to stale staging payloads on cancellation/replacement, not live cell geometry.
 */
export class SurfaceStreamingRuntime {
  private pending: RuntimeChunkEntry[] = [];
  private prepared: RuntimeChunkEntry[] = [];
  private preparedBytes = 0;
  private installed = 0;
  private evicted = 0;
  private generation = 0;
  constructor(private maxStagingBytes = 24 * 1024 * 1024, private maxInstallsPerFrame = 2) {
    this.setLimits(maxStagingBytes, maxInstallsPerFrame);
  }

  /** Update temporary streaming limits without restarting the current generation. */
  setLimits(maxStagingBytes: number, maxInstallsPerFrame: number): void {
    this.maxStagingBytes = Math.max(this.preparedBytes, 0, Math.floor(maxStagingBytes));
    this.maxInstallsPerFrame = Math.max(1, Math.min(4, Math.floor(maxInstallsPerFrame)));
  }

  begin(chunks: readonly SurfaceChunk[]): number {
    this.cancel();
    const generation = this.generation;
    this.pending = chunks.map((chunk) => {
      const x = chunk.positions;
      let cx = 0, cy = 0, cz = 0;
      for (let i = 0; i < x.length; i += 3) { cx += x[i]!; cy += x[i + 1]!; cz += x[i + 2]!; }
      const vertices = Math.max(1, x.length / 3);
      const center: [number, number, number] = [cx / vertices, cy / vertices, cz / vertices];
      const bytes = chunk.positions.byteLength + chunk.faceCellIds.byteLength + Object.values(chunk.attributes).reduce((sum, a) => sum + a.byteLength, 0);
      return { chunk, center, bytes, score: 0 };
    });
    this.prepared = [];
    this.preparedBytes = 0;
    this.installed = 0;
    return generation;
  }

  reprioritize(viewDirection: readonly [number, number, number], activeCellChunkId: number | null = null, activeNeighborChunkIds: ReadonlySet<number> = new Set()): void {
    const length = Math.hypot(...viewDirection) || 1;
    for (const entry of this.pending) {
      const [x, y, z] = entry.center;
      const radius = Math.hypot(x, y, z) || 1;
      const facing = (x * viewDirection[0] + y * viewDirection[1] + z * viewDirection[2]) / (radius * length);
      entry.score = facing + (entry.chunk.id === activeCellChunkId ? 3 : activeNeighborChunkIds.has(entry.chunk.id) ? 0.35 : 0);
    }
    this.pending.sort((a, b) => b.score - a.score || a.chunk.id - b.chunk.id);
  }

  takeFrameBatch(): RuntimeChunkEntry[] {
    const batch: RuntimeChunkEntry[] = [];
    while (this.pending.length && batch.length < this.maxInstallsPerFrame) {
      const next = this.pending[0]!;
      if (this.preparedBytes + next.bytes > this.maxStagingBytes) {
        // A newly lowered adaptive limit must not discard chunks already prepared this generation.
        // Defer remaining work; abort only when even the first chunk cannot fit the budget.
        if (this.prepared.length > 0) return batch;
        this.evicted += this.pending.length;
        this.pending = [];
        return [];
      }
      this.pending.shift();
      this.prepared.push(next);
      this.preparedBytes += next.bytes;
      batch.push(next);
    }
    return batch;
  }

  markInstalled(count: number): void { this.installed += Math.max(0, Math.floor(count)); }
  isComplete(): boolean { return this.pending.length === 0 && this.installed === this.prepared.length && this.prepared.length > 0; }
  isAborted(): boolean { return this.pending.length === 0 && this.prepared.length === 0 && this.evicted > 0; }
  stats(): SurfaceRuntimeStats { return { pendingChunks: this.pending.length, preparedChunks: this.prepared.length, preparedBytes: this.preparedBytes, installedChunks: this.installed, evictedStagingChunks: this.evicted }; }
  cancel(): void { this.generation++; this.pending = []; this.prepared = []; this.preparedBytes = 0; this.installed = 0; this.evicted = 0; }
}
