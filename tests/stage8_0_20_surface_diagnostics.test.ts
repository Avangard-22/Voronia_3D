import { describe, expect, it, vi } from 'vitest';
import { SurfaceResidencyManager } from '../src/renderer/surfaceResidency';
import { SurfaceStreamingDiagnostics, runSurfaceLifecycleCycles } from '../src/renderer/surfaceDiagnostics';

describe('Stage 8.0.20 surface diagnostics', () => {
  it('tracks category counts, bytes, peaks and duplicate registrations', () => {
    const residency = new SurfaceResidencyManager(1024);
    const diagnostics = new SurfaceStreamingDiagnostics(residency, 8, 100);
    residency.register({ id: 'base', kind: 'base', pinned: true, bytes: 500, evict: vi.fn() });
    residency.register({ id: 'overlay', kind: 'decorative', pinned: false, bytes: 200, evict: vi.fn() });
    residency.register({ id: 'overlay', kind: 'decorative', pinned: false, bytes: 240, evict: vi.fn() });
    const snapshot = diagnostics.snapshot(250);
    expect(snapshot.sessionMs).toBe(150);
    expect(snapshot.resources).toEqual({ base: 1, decorative: 1, staging: 0 });
    expect(snapshot.bytes).toEqual({ base: 500, decorative: 240, staging: 0 });
    expect(snapshot.peakBytes).toBe(740);
    expect(snapshot.duplicateRegistrations).toBe(1);
    expect(snapshot.lifecycleImbalance).toBe(2);
    diagnostics.dispose();
  });

  it('records LRU evictions and bounds event history', () => {
    const residency = new SurfaceResidencyManager(100);
    const diagnostics = new SurfaceStreamingDiagnostics(residency, 2);
    residency.register({ id: 'a', kind: 'decorative', pinned: false, bytes: 60, evict: vi.fn() });
    residency.register({ id: 'b', kind: 'decorative', pinned: false, bytes: 60, evict: vi.fn() });
    const snapshot = diagnostics.snapshot();
    expect(snapshot.evicted).toBe(1);
    expect(snapshot.events).toHaveLength(2);
    expect(snapshot.resources.decorative).toBe(1);
    diagnostics.dispose();
  });

  it('survives repeated create/remove cycles without residual resources', () => {
    const residency = new SurfaceResidencyManager(1024 * 1024);
    const diagnostics = new SurfaceStreamingDiagnostics(residency);
    const result = runSurfaceLifecycleCycles(residency, 1000, 4);
    expect(result.created).toBe(4000);
    expect(result.released).toBe(4000);
    expect(result.residualResources).toBe(0);
    expect(result.residualBytes).toBe(0);
    const snapshot = diagnostics.snapshot();
    expect(snapshot.lifecycleImbalance).toBe(0);
    expect(snapshot.registered).toBe(4000);
    expect(snapshot.released).toBe(4000);
    diagnostics.dispose();
  });
});
