import type { SurfaceDiagnosticSnapshot } from './surfaceDiagnostics';

export type SurfaceStabilitySeverity = 'info' | 'warning' | 'critical';
export interface SurfaceStabilityAlert {
  readonly code: 'memory-budget' | 'duplicate-resource' | 'lifecycle-imbalance' | 'memory-growth';
  readonly severity: SurfaceStabilitySeverity;
  readonly message: string;
  readonly atMs: number;
}
export interface SurfaceStabilitySample {
  readonly atMs: number;
  readonly totalBytes: number;
  readonly resources: number;
  readonly duplicates: number;
  readonly imbalance: number;
}

/** Bounded runtime monitor. It reports suspicious trends; it never mutates or evicts resources. */
export class SurfaceStabilityMonitor {
  private readonly samples: SurfaceStabilitySample[] = [];
  private readonly alerts: SurfaceStabilityAlert[] = [];
  private lastSampleAt = -Infinity;
  private lastAlertByCode = new Map<string, number>();

  constructor(private readonly sampleIntervalMs = 1000, private readonly historyLimit = 120, private readonly alertLimit = 32) {}

  update(snapshot: SurfaceDiagnosticSnapshot, nowMs: number): void {
    if (nowMs - this.lastSampleAt < this.sampleIntervalMs) return;
    this.lastSampleAt = nowMs;
    const resources = snapshot.resources.base + snapshot.resources.decorative + snapshot.resources.staging;
    const sample: SurfaceStabilitySample = {
      atMs: nowMs, totalBytes: snapshot.totalBytes, resources,
      duplicates: snapshot.duplicateRegistrations, imbalance: snapshot.lifecycleImbalance,
    };
    this.samples.push(sample);
    if (this.samples.length > this.historyLimit) this.samples.shift();

    if (snapshot.totalBytes > snapshot.budgetBytes) this.raise('memory-budget', 'critical', 'Расчётный объём поверхности превышает бюджет памяти.', nowMs);
    if (snapshot.duplicateRegistrations > 0) this.raise('duplicate-resource', 'warning', `Повторные регистрации ресурсов: ${snapshot.duplicateRegistrations}.`, nowMs);
    if (snapshot.lifecycleImbalance !== resources) this.raise('lifecycle-imbalance', 'warning', 'Баланс жизненного цикла не совпадает с числом активных ресурсов.', nowMs);
    if (this.samples.length >= 6) {
      const first = this.samples[Math.max(0, this.samples.length - 6)]!;
      const growth = snapshot.totalBytes - first.totalBytes;
      if (growth > Math.max(4 * 1024 * 1024, snapshot.budgetBytes * 0.1)) this.raise('memory-growth', 'warning', 'Обнаружен быстрый рост расчётного объёма памяти.', nowMs);
    }
  }

  private raise(code: SurfaceStabilityAlert['code'], severity: SurfaceStabilitySeverity, message: string, nowMs: number): void {
    const previous = this.lastAlertByCode.get(code) ?? -Infinity;
    if (nowMs - previous < 5000) return;
    this.lastAlertByCode.set(code, nowMs);
    this.alerts.push({ code, severity, message, atMs: nowMs });
    if (this.alerts.length > this.alertLimit) this.alerts.shift();
  }

  getHistory(): readonly SurfaceStabilitySample[] { return this.samples.slice(); }
  getAlerts(): readonly SurfaceStabilityAlert[] { return this.alerts.slice(); }
  reset(): void { this.samples.length = 0; this.alerts.length = 0; this.lastAlertByCode.clear(); this.lastSampleAt = -Infinity; }
}
