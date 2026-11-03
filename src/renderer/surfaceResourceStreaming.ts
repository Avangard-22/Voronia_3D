import type { SurfaceResidencyManager } from './surfaceResidency';

export type RestorableSurfaceResource = 'cell-boundaries' | 'neighbour-graph';
export interface SurfaceRestoreRequest {
  readonly id: RestorableSurfaceResource;
  readonly priority: number;
  readonly restore: () => boolean;
}
export interface SurfaceResourceStreamingStats {
  readonly queued: number;
  readonly restored: number;
  readonly failed: number;
  readonly deferredByBudget: number;
  readonly residentBytes: number;
  readonly budgetBytes: number;
}

/** Rebuilds evicted, reconstructible decoration from retained CPU-side planet data. */
export class SurfaceResourceStreaming {
  private requests = new Map<RestorableSurfaceResource, SurfaceRestoreRequest>();
  private restored = 0;
  private failed = 0;
  private deferredByBudget = 0;

  constructor(private readonly residency: SurfaceResidencyManager, private readonly maxRestoresPerFrame = 1) {}

  request(request: SurfaceRestoreRequest): void {
    const previous = this.requests.get(request.id);
    if (!previous || request.priority >= previous.priority) this.requests.set(request.id, request);
  }

  processFrame(): number {
    let count = 0;
    const ordered = [...this.requests.values()].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
    for (const request of ordered) {
      if (count >= this.maxRestoresPerFrame) break;
      this.requests.delete(request.id);
      // Restore callbacks register their geometry and let the residency manager enforce budget.
      const ok = request.restore();
      if (ok) { this.restored++; count++; }
      else this.failed++;
    }
    if (this.requests.size) this.deferredByBudget += this.requests.size;
    return count;
  }

  cancel(): void { this.requests.clear(); }
  stats(): SurfaceResourceStreamingStats {
    const residency = this.residency.stats();
    return { queued: this.requests.size, restored: this.restored, failed: this.failed, deferredByBudget: this.deferredByBudget, residentBytes: residency.residentBytes, budgetBytes: residency.budgetBytes };
  }
}
