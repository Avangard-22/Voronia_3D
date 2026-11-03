import { describe, expect, it } from 'vitest';
import { buildGalaxySystemDetail } from '../src/renderer/galaxySystemDetail';
import type { GalaxyRenderNode } from '../src/renderer/galaxyModel';

const node = (overrides: Partial<GalaxyRenderNode> = {}): GalaxyRenderNode => ({
  id: 'krios-9', seed: 90210, name: 'Криос-9', x: 2, y: 0.1, z: -4,
  discovered: true, unlocked: true, active: false, armId: 'Asterion',
  sectorId: 'inner', signalClass: 'cryo', ...overrides,
});

describe('Stage 7.3 — star system detail', () => {
  it('does not build a system display for hidden or missing nodes', () => {
    expect(buildGalaxySystemDetail(node({ discovered: false }))).toBeNull();
    expect(buildGalaxySystemDetail(null)).toBeNull();
  });

  it('creates a deterministic visual profile from a discovered graph node', () => {
    const first = buildGalaxySystemDetail(node());
    const second = buildGalaxySystemDetail(node());
    expect(first).toEqual(second);
    expect(first?.nodeId).toBe('krios-9');
    expect(first?.starClass).toBe('blue');
    expect(first?.planetColor).toBe('#8ceaff');
    expect(first?.orbitRadius).toBeGreaterThan(1.3);
  });

  it('marks anomaly systems for their additional visual treatment', () => {
    const anomaly = buildGalaxySystemDetail(node({ id: 'rift-01', signalClass: 'anomaly' }));
    expect(anomaly?.anomaly).toBe(true);
    expect(anomaly?.starClass).toBe('violet');
  });
});
