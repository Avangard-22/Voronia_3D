import { describe, expect, it } from 'vitest';
import { AdaptiveSurfaceStreamingController, classifySurfaceDevice } from '../src/renderer/adaptiveSurfaceStreamingController';
import { SurfaceStreamingRuntime } from '../src/renderer/surfaceStreamingRuntime';
import type { SurfaceChunk } from '../src/renderer/surfaceChunks';

function chunk(id: number, x: number): SurfaceChunk {
  return { id, positions: new Float32Array([x, 0, 0, x + 1, 0, 0, x, 1, 0]), attributes: {}, faceCellIds: new Uint32Array([id]), triangleCount: 1 };
}

describe('Stage 8.0.23 adaptive surface streaming', () => {
  it('classifies constrained, balanced and capable devices from conservative hints', () => {
    expect(classifySurfaceDevice({ mobile: true, deviceMemoryGb: 8, hardwareConcurrency: 8 })).toBe('constrained');
    expect(classifySurfaceDevice({ deviceMemoryGb: 4, hardwareConcurrency: 8 })).toBe('constrained');
    expect(classifySurfaceDevice({})).toBe('balanced');
    expect(classifySurfaceDevice({ deviceMemoryGb: 8, hardwareConcurrency: 8 })).toBe('capable');
  });

  it('reduces preparation rate immediately under sustained frame or memory pressure', () => {
    const controller = new AdaptiveSurfaceStreamingController({}, 12);
    let limits = controller.limits();
    for (let i = 0; i < 14; i++) limits = controller.update(i * 800, 52, 95, 100);
    expect(limits.mode).toBe('conservative');
    expect(limits.maxChunksPerFrame).toBe(1);
    expect(limits.stagingBudgetBytes).toBeLessThanOrEqual(8 * 1024 * 1024);
  });

  it('recovers only after sustained headroom and does not oscillate on one fast frame', () => {
    const controller = new AdaptiveSurfaceStreamingController({}, 12);
    for (let i = 0; i < 14; i++) controller.update(i * 800, 50, 95, 100);
    const degraded = controller.limits();
    const oneFast = controller.update(12_000, 10, 20, 100);
    expect(oneFast.mode).toBe(degraded.mode);
    let recovered = oneFast;
    for (let i = 16; i < 40; i++) recovered = controller.update(i * 800, 10, 20, 100);
    expect(recovered.mode).not.toBe('conservative');
  });

  it('prioritizes the selected cell chunk and its real adjacency chunks', () => {
    const runtime = new SurfaceStreamingRuntime(1024, 1);
    runtime.begin([chunk(0, 1), chunk(1, 2), chunk(2, 3)]);
    runtime.reprioritize([1, 0, 0], 2, new Set([1]));
    expect(runtime.takeFrameBatch()[0]?.chunk.id).toBe(2);
    runtime.markInstalled(1);
    expect(runtime.takeFrameBatch()[0]?.chunk.id).toBe(1);
  });

  it('applies new limits without replacing the active streaming generation', () => {
    const runtime = new SurfaceStreamingRuntime(1024, 1);
    runtime.setLimits(2 * 1024 * 1024, 3);
    expect(runtime.stats().pendingChunks).toBe(0);
  });
});
