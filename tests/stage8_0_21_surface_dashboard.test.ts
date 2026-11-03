import { describe, expect, it, vi } from 'vitest';
import { SurfaceResidencyManager } from '../src/renderer/surfaceResidency';
import { SurfaceStreamingDiagnostics, runSurfaceLifecycleCycles } from '../src/renderer/surfaceDiagnostics';
import { SurfaceStabilityMonitor } from '../src/renderer/surfaceStabilityMonitor';

describe('Stage 8.0.21 diagnostics dashboard monitoring', () => {
  it('samples memory and emits a budget alert', () => {
    const residency = new SurfaceResidencyManager(100);
    const diagnostics = new SurfaceStreamingDiagnostics(residency, 16, 0);
    const monitor = new SurfaceStabilityMonitor(100, 10, 8);
    residency.register({ id: 'base', kind: 'base', pinned: true, bytes: 120, evict: vi.fn() });
    monitor.update(diagnostics.snapshot(100), 100);
    expect(monitor.getHistory()).toHaveLength(1);
    expect(monitor.getAlerts().some((item) => item.code === 'memory-budget' && item.severity === 'critical')).toBe(true);
    diagnostics.dispose();
  });

  it('bounds history and alert repetition during long sessions', () => {
    const residency = new SurfaceResidencyManager(1024);
    const diagnostics = new SurfaceStreamingDiagnostics(residency, 8, 0);
    const monitor = new SurfaceStabilityMonitor(0, 5, 3);
    residency.register({ id: 'duplicate', kind: 'decorative', pinned: false, bytes: 1, evict: vi.fn() });
    residency.register({ id: 'duplicate', kind: 'decorative', pinned: false, bytes: 1, evict: vi.fn() });
    for (let i = 0; i < 20; i++) monitor.update(diagnostics.snapshot(i), i * 6000);
    expect(monitor.getHistory()).toHaveLength(5);
    expect(monitor.getAlerts().length).toBeLessThanOrEqual(3);
    expect(monitor.getAlerts().some((item) => item.code === 'duplicate-resource')).toBe(true);
    diagnostics.dispose();
  });

  it('keeps lifecycle monitoring clean after automated planet-resource cycles', () => {
    const residency = new SurfaceResidencyManager(1024 * 1024);
    const diagnostics = new SurfaceStreamingDiagnostics(residency, 32, 0);
    const monitor = new SurfaceStabilityMonitor(0);
    const result = runSurfaceLifecycleCycles(residency, 250, 4);
    monitor.update(diagnostics.snapshot(1000), 1000);
    expect(result.residualResources).toBe(0);
    expect(result.residualBytes).toBe(0);
    expect(diagnostics.snapshot(1000).lifecycleImbalance).toBe(0);
    expect(monitor.getAlerts()).toHaveLength(0);
    diagnostics.dispose();
  });
});
