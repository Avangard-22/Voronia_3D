import type { SurfaceResidencyManager, SurfaceResidencyEvent, SurfaceResourceKind } from './surfaceResidency';

export interface SurfaceDiagnosticSnapshot {
  readonly sessionMs: number;
  readonly resources: Readonly<Record<SurfaceResourceKind, number>>;
  readonly bytes: Readonly<Record<SurfaceResourceKind, number>>;
  readonly totalBytes: number;
  readonly budgetBytes: number;
  readonly peakBytes: number;
  readonly registered: number;
  readonly released: number;
  readonly evicted: number;
  readonly duplicateRegistrations: number;
  readonly lifecycleImbalance: number;
  readonly events: readonly SurfaceResidencyEvent[];
}

/** Bounded event history and long-session accounting for renderer-owned surface resources. */
export class SurfaceStreamingDiagnostics {
  private readonly startedAt: number;
  private readonly counts: Record<SurfaceResourceKind, number> = { base: 0, decorative: 0, staging: 0 };
  private readonly bytes: Record<SurfaceResourceKind, number> = { base: 0, decorative: 0, staging: 0 };
  private readonly events: SurfaceResidencyEvent[] = [];
  private registered = 0;
  private released = 0;
  private evicted = 0;
  private duplicateRegistrations = 0;
  private peakBytes = 0;
  private unsubscribe: (() => void) | null = null;

  constructor(private readonly residency: SurfaceResidencyManager, private readonly eventLimit = 128, now = monotonicNow()) {
    this.startedAt = now;
    this.unsubscribe = residency.subscribe((event) => this.consume(event));
    for (const item of residency.records()) {
      this.counts[item.kind]++;
      this.bytes[item.kind] += item.bytes;
    }
    this.peakBytes = residency.residentBytes();
  }

  private consume(event: SurfaceResidencyEvent): void {
    if (event.type === 'register') {
      this.registered++;
      if (event.replaced) this.duplicateRegistrations++;
      this.counts[event.kind]++;
      this.bytes[event.kind] += event.bytes;
    } else {
      this.released++;
      if (event.type === 'evict') this.evicted++;
      this.counts[event.kind] = Math.max(0, this.counts[event.kind] - 1);
      this.bytes[event.kind] = Math.max(0, this.bytes[event.kind] - event.bytes);
    }
    this.peakBytes = Math.max(this.peakBytes, this.totalBytes());
    this.events.push(event);
    if (this.events.length > this.eventLimit) this.events.splice(0, this.events.length - this.eventLimit);
  }

  totalBytes(): number { return this.bytes.base + this.bytes.decorative + this.bytes.staging; }

  snapshot(now = monotonicNow()): SurfaceDiagnosticSnapshot {
    const residency = this.residency.stats();
    return {
      sessionMs: Math.max(0, now - this.startedAt),
      resources: { ...this.counts }, bytes: { ...this.bytes }, totalBytes: this.totalBytes(),
      budgetBytes: residency.budgetBytes, peakBytes: this.peakBytes,
      registered: this.registered, released: this.released, evicted: this.evicted,
      duplicateRegistrations: this.duplicateRegistrations,
      lifecycleImbalance: this.registered - this.released,
      events: this.events.slice(),
    };
  }

  dispose(): void { this.unsubscribe?.(); this.unsubscribe = null; }
}

/** Deterministic lifecycle exercise used by long-session tests; no GPU or browser required. */
export function runSurfaceLifecycleCycles(residency: SurfaceResidencyManager, cycles: number, resourcesPerCycle = 3): { created: number; released: number; residualResources: number; residualBytes: number } {
  const safeCycles = Math.max(0, Math.floor(cycles));
  const safeResources = Math.max(0, Math.floor(resourcesPerCycle));
  let created = 0;
  let released = 0;
  for (let cycle = 0; cycle < safeCycles; cycle++) {
    const ids: string[] = [];
    for (let index = 0; index < safeResources; index++) {
      const id = `stress-${cycle}-${index}`;
      ids.push(id);
      if (residency.register({ id, kind: 'decorative', pinned: false, bytes: 64, evict: () => undefined })) created++;
    }
    for (const id of ids) { residency.remove(id); released++; }
  }
  return { created, released, residualResources: residency.stats().resourceCount, residualBytes: residency.residentBytes() };
}

function monotonicNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
