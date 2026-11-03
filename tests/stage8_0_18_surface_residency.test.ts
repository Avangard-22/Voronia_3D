import { describe, expect, it, vi } from 'vitest';
import { SurfaceResidencyManager, estimateGeometryBytes } from '../src/renderer/surfaceResidency';

describe('Stage 8.0.18 surface residency', () => {
  it('evicts least-recently-used decorative resources first', () => {
    const manager = new SurfaceResidencyManager(100);
    const oldEvict = vi.fn();
    const newEvict = vi.fn();
    manager.register({ id: 'old', kind: 'decorative', bytes: 60, pinned: false, evict: oldEvict });
    manager.register({ id: 'new', kind: 'decorative', bytes: 30, pinned: false, evict: newEvict });
    manager.touch('new');
    manager.register({ id: 'base', kind: 'base', bytes: 40, pinned: true, evict: vi.fn() });
    expect(oldEvict).toHaveBeenCalledOnce();
    expect(newEvict).not.toHaveBeenCalled();
    expect(manager.residentBytes()).toBe(70);
  });

  it('never evicts pinned or base interactive geometry', () => {
    const manager = new SurfaceResidencyManager(10);
    const baseEvict = vi.fn();
    manager.register({ id: 'base', kind: 'base', bytes: 20, pinned: true, evict: baseEvict });
    expect(baseEvict).not.toHaveBeenCalled();
    expect(manager.stats().residentBytes).toBe(20);
  });

  it('estimates typed GPU attribute storage', () => {
    expect(estimateGeometryBytes({ positions: new Float32Array(9), ids: new Uint32Array(3) })).toBe(48);
  });
});
