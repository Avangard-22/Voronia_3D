import type { SurfaceResidencyManager, SurfaceResourceKind } from './surfaceResidency';

export interface SurfaceGpuResourceDescriptor {
  readonly id: string;
  readonly kind: SurfaceResourceKind;
  readonly bytes: number;
  readonly pinned: boolean;
  readonly dispose: () => void;
  readonly restore?: () => void;
}

export interface SurfaceGpuLifecycleStats {
  readonly tracked: number;
  readonly disposed: number;
  readonly contextLost: boolean;
  readonly contextLosses: number;
  readonly contextRestores: number;
  readonly duplicateIds: number;
}

interface TrackedResource extends SurfaceGpuResourceDescriptor { disposed: boolean }

/** Owns renderer-side GPU resource lifetimes while residency remains the budget authority. */
export class SurfaceGpuResourceLifecycle {
  private readonly resources = new Map<string, TrackedResource>();
  private disposed = 0;
  private contextLost = false;
  private contextLosses = 0;
  private contextRestores = 0;
  private duplicateIds = 0;

  constructor(private readonly residency: SurfaceResidencyManager) {}

  track(resource: SurfaceGpuResourceDescriptor): boolean {
    if (!resource.id || !Number.isFinite(resource.bytes) || resource.bytes < 0) return false;
    if (this.resources.has(resource.id)) {
      this.duplicateIds++;
      this.release(resource.id);
    }
    const entry: TrackedResource = { ...resource, disposed: false };
    this.resources.set(resource.id, entry);
    const accepted = this.residency.register({
      id: resource.id,
      kind: resource.kind,
      bytes: resource.bytes,
      pinned: resource.pinned,
      evict: () => this.disposeEntry(resource.id, entry),
    });
    if (!accepted) {
      this.disposeEntry(resource.id, entry);
      return false;
    }
    return true;
  }

  release(id: string): boolean {
    const entry = this.resources.get(id);
    if (!entry) return false;
    this.residency.remove(id);
    this.disposeEntry(id, entry);
    return true;
  }

  private disposeEntry(id: string, entry: TrackedResource): void {
    if (entry.disposed) return;
    entry.disposed = true;
    if (this.resources.get(id) === entry) this.resources.delete(id);
    entry.dispose();
    this.disposed++;
  }

  onContextLost(): void {
    if (this.contextLost) return;
    this.contextLost = true;
    this.contextLosses++;
  }

  onContextRestored(): void {
    if (!this.contextLost) return;
    this.contextLost = false;
    this.contextRestores++;
    for (const entry of this.resources.values()) entry.restore?.();
  }

  releaseAll(): void {
    for (const id of [...this.resources.keys()]) this.release(id);
  }

  stats(): SurfaceGpuLifecycleStats {
    return {
      tracked: this.resources.size,
      disposed: this.disposed,
      contextLost: this.contextLost,
      contextLosses: this.contextLosses,
      contextRestores: this.contextRestores,
      duplicateIds: this.duplicateIds,
    };
  }
}
