export type SurfaceResourceKind = 'base' | 'decorative' | 'staging';

export interface SurfaceResourceRecord {
  readonly id: string;
  readonly kind: SurfaceResourceKind;
  readonly bytes: number;
  readonly pinned: boolean;
  lastUsed: number;
  readonly evict: () => void;
}

export type SurfaceResidencyEvent =
  | { readonly type: 'register'; readonly id: string; readonly kind: SurfaceResourceKind; readonly bytes: number; readonly replaced: boolean }
  | { readonly type: 'remove' | 'evict'; readonly id: string; readonly kind: SurfaceResourceKind; readonly bytes: number };

export interface SurfaceResidencyStats {
  readonly residentBytes: number;
  readonly budgetBytes: number;
  readonly resourceCount: number;
  readonly evictedResources: number;
  readonly evictedBytes: number;
}

/** Tracks estimated GPU residency. Interactive base geometry is never an eviction candidate. */
export class SurfaceResidencyManager {
  private readonly resources = new Map<string, SurfaceResourceRecord>();
  private clock = 0;
  private evictedResources = 0;
  private evictedBytes = 0;
  private readonly listeners = new Set<(event: SurfaceResidencyEvent) => void>();

  constructor(readonly budgetBytes = 96 * 1024 * 1024) {
    if (!Number.isFinite(budgetBytes) || budgetBytes < 0) throw new RangeError('Invalid surface residency budget');
  }

  register(input: Omit<SurfaceResourceRecord, 'lastUsed'>): boolean {
    if (!input.id || !Number.isFinite(input.bytes) || input.bytes < 0) return false;
    const replaced = this.resources.has(input.id);
    this.remove(input.id, false);
    this.resources.set(input.id, { ...input, lastUsed: ++this.clock });
    this.emit({ type: 'register', id: input.id, kind: input.kind, bytes: input.bytes, replaced });
    this.evictToBudget();
    return this.resources.has(input.id);
  }

  touch(id: string): void {
    const item = this.resources.get(id);
    if (item) item.lastUsed = ++this.clock;
  }

  remove(id: string, countAsEviction = false): void {
    const item = this.resources.get(id);
    if (!item) return;
    this.resources.delete(id);
    if (countAsEviction) {
      this.emit({ type: 'evict', id: item.id, kind: item.kind, bytes: item.bytes });
      item.evict();
      this.evictedResources++;
      this.evictedBytes += item.bytes;
    } else {
      this.emit({ type: 'remove', id: item.id, kind: item.kind, bytes: item.bytes });
    }
  }

  evictToBudget(): number {
    let resident = this.residentBytes();
    if (resident <= this.budgetBytes) return 0;
    const candidates = [...this.resources.values()]
      .filter((item) => item.kind === 'decorative' && !item.pinned)
      .sort((a, b) => a.lastUsed - b.lastUsed);
    let count = 0;
    for (const item of candidates) {
      if (resident <= this.budgetBytes) break;
      this.remove(item.id, true);
      resident -= item.bytes;
      count++;
    }
    return count;
  }

  residentBytes(): number {
    let total = 0;
    for (const item of this.resources.values()) total += item.bytes;
    return total;
  }

  stats(): SurfaceResidencyStats {
    return {
      residentBytes: this.residentBytes(), budgetBytes: this.budgetBytes,
      resourceCount: this.resources.size, evictedResources: this.evictedResources,
      evictedBytes: this.evictedBytes,
    };
  }

  records(): readonly SurfaceResourceRecord[] { return [...this.resources.values()]; }

  subscribe(listener: (event: SurfaceResidencyEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: SurfaceResidencyEvent): void { for (const listener of this.listeners) listener(event); }

  clear(): void { for (const item of [...this.resources.values()]) this.remove(item.id); }
}

export function estimateGeometryBytes(attributes: Readonly<Record<string, ArrayBufferView>>): number {
  return Object.values(attributes).reduce((sum, attribute) => sum + attribute.byteLength, 0);
}
