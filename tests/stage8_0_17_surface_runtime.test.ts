import { describe, expect, it } from 'vitest';
import { SurfaceStreamingRuntime } from '../src/renderer/surfaceStreamingRuntime';
import type { SurfaceChunk } from '../src/renderer/surfaceChunks';

function chunk(id: number, x: number, bytes = 36): SurfaceChunk {
  const positions = new Float32Array([x, 0, 0, x + 1, 0, 0, x, 1, 0]);
  const padding = bytes > positions.byteLength + 4 ? new Float32Array(Math.floor((bytes - positions.byteLength - 4) / 4)) : new Float32Array();
  return { id, positions, attributes: padding.length ? { padding } : {}, faceCellIds: new Uint32Array([id]), triangleCount: 1 };
}

describe('Stage 8.0.17 surface runtime', () => {
  it('installs at most the configured number of chunks per frame', () => {
    const runtime = new SurfaceStreamingRuntime(1024, 2);
    runtime.begin([chunk(0, 1), chunk(1, 2), chunk(2, 3)]);
    expect(runtime.takeFrameBatch()).toHaveLength(2);
    runtime.markInstalled(2);
    expect(runtime.takeFrameBatch()).toHaveLength(1);
    runtime.markInstalled(1);
    expect(runtime.isComplete()).toBe(true);
  });

  it('reprioritizes camera-facing and active chunks without changing chunk identity', () => {
    const runtime = new SurfaceStreamingRuntime(1024, 1);
    runtime.begin([chunk(0, 1), chunk(1, 5), chunk(2, -1)]);
    runtime.reprioritize([1, 0, 0], 2);
    const batch = runtime.takeFrameBatch();
    expect(batch[0]?.chunk.id).toBe(2);
  });

  it('aborts staging when the configured memory budget would be exceeded', () => {
    const runtime = new SurfaceStreamingRuntime(40, 2);
    runtime.begin([chunk(0, 1, 128)]);
    expect(runtime.takeFrameBatch()).toHaveLength(0);
    expect(runtime.isAborted()).toBe(true);
    expect(runtime.stats().preparedBytes).toBe(0);
  });

  it('releases pending staging references on cancellation', () => {
    const runtime = new SurfaceStreamingRuntime();
    runtime.begin([chunk(0, 1), chunk(1, 2)]);
    runtime.cancel();
    expect(runtime.stats().pendingChunks).toBe(0);
    expect(runtime.stats().preparedBytes).toBe(0);
  });
});
