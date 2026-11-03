import { describe, expect, it } from 'vitest';
import { RuntimeSurfaceLodController } from '../src/renderer/runtimeSurfaceLod';

describe('Stage 8.0.12 runtime surface LOD', () => {
  it('starts with full interactive surface detail', () => {
    const lod = new RuntimeSurfaceLodController();
    const state = lod.update(3.2);
    expect(state.tier).toBe('near');
    expect(state.showCellBoundaries).toBe(true);
    expect(state.showNeighbourGraph).toBe(true);
  });
  it('reduces decorative layers at mid and far distances', () => {
    const lod = new RuntimeSurfaceLodController();
    expect(lod.update(3.9).tier).toBe('mid');
    expect(lod.update(4.9).tier).toBe('far');
    expect(lod.update(4.9).showCellBoundaries).toBe(false);
  });
  it('uses hysteresis to prevent threshold flicker', () => {
    const lod = new RuntimeSurfaceLodController();
    lod.update(3.9);
    expect(lod.update(3.48).tier).toBe('mid');
    expect(lod.update(3.3).tier).toBe('near');
  });
  it('does not change tier for invalid distances', () => {
    const lod = new RuntimeSurfaceLodController();
    lod.update(4.9);
    expect(lod.update(Number.NaN).tier).toBe('far');
  });
});
