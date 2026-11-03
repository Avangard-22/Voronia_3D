export type SurfaceDeviceClass = 'constrained' | 'balanced' | 'capable';
export type SurfaceStreamingMode = 'conservative' | 'balanced' | 'aggressive';

export interface SurfaceDeviceHints {
  readonly deviceMemoryGb?: number;
  readonly hardwareConcurrency?: number;
  readonly mobile?: boolean;
}

export interface AdaptiveStreamingLimits {
  readonly mode: SurfaceStreamingMode;
  readonly maxChunksPerFrame: number;
  readonly stagingBudgetBytes: number;
  readonly targetFrameBudgetMs: number;
  readonly deviceClass: SurfaceDeviceClass;
  readonly memoryPressure: number;
  readonly frameP95Ms: number;
}

/**
 * Adapts only the rate and temporary memory used to prepare surface chunks. It never changes
 * source polygons, cell topology, base geometry, or game state. Degradation is fast; recovery
 * requires sustained headroom to avoid oscillation on mobile devices.
 */
export class AdaptiveSurfaceStreamingController {
  private readonly samples: number[] = [];
  private current: SurfaceStreamingMode;
  private lastDecisionAt = 0;
  private headroomSince: number | null = null;
  private lastLimits: AdaptiveStreamingLimits;
  readonly deviceClass: SurfaceDeviceClass;

  constructor(hints: SurfaceDeviceHints = {}, private readonly sampleWindow = 45) {
    this.deviceClass = classifySurfaceDevice(hints);
    this.current = this.deviceClass === 'constrained' ? 'conservative' : this.deviceClass === 'capable' ? 'aggressive' : 'balanced';
    this.lastLimits = this.makeLimits(0, 0);
  }

  update(nowMs: number, frameMs: number, residentBytes: number, residencyBudgetBytes: number): AdaptiveStreamingLimits {
    if (Number.isFinite(frameMs) && frameMs > 0 && frameMs < 1000) {
      this.samples.push(frameMs);
      if (this.samples.length > this.sampleWindow) this.samples.shift();
    }
    const memoryPressure = residencyBudgetBytes > 0 ? Math.max(0, residentBytes / residencyBudgetBytes) : 1;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]! : 0;
    if (sorted.length >= 12 && nowMs - this.lastDecisionAt >= 750) {
      this.lastDecisionAt = nowMs;
      const overloaded = p95 > 34 || frameMs > 48 || memoryPressure >= 0.92;
      const pressured = p95 > 24 || memoryPressure >= 0.78;
      if (overloaded) {
        this.current = 'conservative';
        this.headroomSince = null;
      } else if (pressured) {
        if (this.current === 'aggressive') this.current = 'balanced';
        this.headroomSince = null;
      } else if (p95 > 19) {
        this.headroomSince = null;
      } else if (p95 > 0 && p95 < 15 && memoryPressure < 0.62) {
        this.headroomSince ??= nowMs;
        if (nowMs - this.headroomSince >= 6000) {
          this.current = this.current === 'conservative' ? 'balanced' : 'aggressive';
          this.headroomSince = nowMs;
        }
      } else {
        this.headroomSince = null;
      }
    }
    this.lastLimits = this.makeLimits(memoryPressure, p95);
    return this.lastLimits;
  }

  limits(): AdaptiveStreamingLimits { return this.lastLimits; }
  reset(): void {
    this.samples.length = 0;
    this.lastDecisionAt = 0;
    this.headroomSince = null;
    this.current = this.deviceClass === 'constrained' ? 'conservative' : this.deviceClass === 'capable' ? 'aggressive' : 'balanced';
    this.lastLimits = this.makeLimits(0, 0);
  }

  private makeLimits(memoryPressure: number, frameP95Ms: number): AdaptiveStreamingLimits {
    const scale = this.deviceClass === 'constrained' ? 0.65 : this.deviceClass === 'capable' ? 1.25 : 1;
    const limits = this.current === 'conservative'
      ? { chunks: 1, staging: 8 * 1024 * 1024, target: 24 }
      : this.current === 'aggressive'
        ? { chunks: 4, staging: 32 * 1024 * 1024, target: 12 }
        : { chunks: 2, staging: 20 * 1024 * 1024, target: 16 };
    const pressureScale = memoryPressure >= 0.9 ? 0.5 : memoryPressure >= 0.78 ? 0.75 : 1;
    return {
      mode: this.current,
      maxChunksPerFrame: Math.max(1, Math.min(4, Math.floor(limits.chunks * scale * pressureScale))),
      stagingBudgetBytes: Math.max(4 * 1024 * 1024, Math.floor(limits.staging * scale * pressureScale)),
      targetFrameBudgetMs: limits.target,
      deviceClass: this.deviceClass,
      memoryPressure,
      frameP95Ms,
    };
  }
}

export function classifySurfaceDevice(hints: SurfaceDeviceHints): SurfaceDeviceClass {
  const memory = hints.deviceMemoryGb;
  const cores = hints.hardwareConcurrency;
  if (hints.mobile || (memory !== undefined && memory <= 4) || (cores !== undefined && cores <= 4)) return 'constrained';
  if ((memory !== undefined && memory >= 8) && (cores === undefined || cores >= 8)) return 'capable';
  return 'balanced';
}
