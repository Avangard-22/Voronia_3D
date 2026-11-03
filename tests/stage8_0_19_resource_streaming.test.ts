import { describe, expect, it } from 'vitest';
import { SurfaceResidencyManager } from '../src/renderer/surfaceResidency';
import { SurfaceResourceStreaming } from '../src/renderer/surfaceResourceStreaming';

describe('Stage 8.0.19 surface resource restoration', () => {
  it('restores at most one resource per frame in priority order', () => {
    const residency = new SurfaceResidencyManager(1024);
    const stream = new SurfaceResourceStreaming(residency, 1);
    const restored: string[] = [];
    const restore = (id: 'cell-boundaries' | 'neighbour-graph') => () => {
      restored.push(id);
      residency.register({ id, kind: 'decorative', pinned: false, bytes: 32, evict: () => undefined });
      return true;
    };
    stream.request({ id: 'neighbour-graph', priority: 1, restore: restore('neighbour-graph') });
    stream.request({ id: 'cell-boundaries', priority: 2, restore: restore('cell-boundaries') });
    expect(stream.processFrame()).toBe(1);
    expect(restored).toEqual(['cell-boundaries']);
    expect(stream.stats().queued).toBe(1);
    expect(stream.processFrame()).toBe(1);
    expect(restored).toEqual(['cell-boundaries', 'neighbour-graph']);
  });

  it('replaces queued priority for the same resource and supports cancellation', () => {
    const stream = new SurfaceResourceStreaming(new SurfaceResidencyManager(1024));
    let calls = 0;
    stream.request({ id: 'cell-boundaries', priority: 1, restore: () => { calls++; return true; } });
    stream.request({ id: 'cell-boundaries', priority: 3, restore: () => { calls += 10; return true; } });
    stream.cancel();
    expect(stream.processFrame()).toBe(0);
    expect(calls).toBe(0);
  });
});
