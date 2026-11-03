import { describe, expect, it, vi } from 'vitest';
import { SurfaceResidencyManager } from '../src/renderer/surfaceResidency';
import { SurfaceGpuResourceLifecycle } from '../src/renderer/surfaceGpuLifecycle';

describe('Stage 8.0.24 — GPU resource lifecycle', () => {
  it('disposes tracked geometry exactly once on explicit release', () => {
    const residency = new SurfaceResidencyManager(1024);
    const lifecycle = new SurfaceGpuResourceLifecycle(residency);
    const dispose = vi.fn();
    expect(lifecycle.track({ id: 'base', kind: 'base', bytes: 128, pinned: true, dispose })).toBe(true);
    expect(lifecycle.release('base')).toBe(true);
    expect(lifecycle.release('base')).toBe(false);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(residency.stats().resourceCount).toBe(0);
  });

  it('disposes evicted decorative resources and preserves pinned base resources', () => {
    const residency = new SurfaceResidencyManager(100);
    const lifecycle = new SurfaceGpuResourceLifecycle(residency);
    const baseDispose = vi.fn();
    const decorDispose = vi.fn();
    lifecycle.track({ id: 'base', kind: 'base', bytes: 80, pinned: true, dispose: baseDispose });
    lifecycle.track({ id: 'decor', kind: 'decorative', bytes: 40, pinned: false, dispose: decorDispose });
    expect(decorDispose).toHaveBeenCalledTimes(1);
    expect(baseDispose).not.toHaveBeenCalled();
    expect(lifecycle.stats().tracked).toBe(1);
  });

  it('replays restore callbacks after context recovery without dropping resources', () => {
    const residency = new SurfaceResidencyManager(1024);
    const lifecycle = new SurfaceGpuResourceLifecycle(residency);
    const restore = vi.fn();
    lifecycle.track({ id: 'surface', kind: 'base', bytes: 256, pinned: true, dispose: vi.fn(), restore });
    lifecycle.onContextLost();
    lifecycle.onContextLost();
    expect(lifecycle.stats().contextLost).toBe(true);
    lifecycle.onContextRestored();
    lifecycle.onContextRestored();
    expect(restore).toHaveBeenCalledTimes(1);
    expect(lifecycle.stats()).toMatchObject({ contextLost: false, contextLosses: 1, contextRestores: 1, tracked: 1 });
  });

  it('replaces duplicate identifiers without leaving stale residency records', () => {
    const residency = new SurfaceResidencyManager(1024);
    const lifecycle = new SurfaceGpuResourceLifecycle(residency);
    const firstDispose = vi.fn();
    const secondDispose = vi.fn();
    lifecycle.track({ id: 'surface', kind: 'base', bytes: 100, pinned: true, dispose: firstDispose });
    lifecycle.track({ id: 'surface', kind: 'base', bytes: 120, pinned: true, dispose: secondDispose });
    expect(firstDispose).toHaveBeenCalledTimes(1);
    expect(residency.stats()).toMatchObject({ resourceCount: 1, residentBytes: 120 });
    lifecycle.releaseAll();
    expect(secondDispose).toHaveBeenCalledTimes(1);
    expect(residency.stats().resourceCount).toBe(0);
    expect(lifecycle.stats().duplicateIds).toBe(1);
  });
});
