import { describe, expect, it } from 'vitest';
import { buildGalaxyRenderData } from '../src/renderer/galaxyModel';
import type { GraphNode } from '../src/contracts/galaxy';

const node = (id: string, x: number, discovered: boolean): GraphNode => ({
  id, planetId: id, name: discovered ? `Мир ${id}` : `Скрытый ${id}`,
  x, y: x * 0.02, z: -x * 0.5, geometryName: 'Crystalline', biome: 'Ice', geometry: 'crystal',
  frequency: 0.5, seed: 123, armId: 'arm-1', discovered,
});

describe('Stage 7.0 galaxy projection', () => {
  it('uses exact graph coordinates with a stable render scale', () => {
    const result = buildGalaxyRenderData({ nodes: [node('a', 10, true)], edges: [], unlockedIds: ['a'], activeId: 'a' });
    expect(result.nodes[0]).toMatchObject({ id: 'a', x: 0.8, y: 0.016, z: -0.4, discovered: true, unlocked: true, active: true });
  });

  it('does not leak hidden planet metadata and hides links to undiscovered nodes', () => {
    const result = buildGalaxyRenderData({
      nodes: [node('known', 10, true), node('hidden', 20, false)],
      edges: [['known', 'hidden'], ['known', 'known']], unlockedIds: ['known'], activeId: 'known',
    });
    expect(result.nodes[1]).toMatchObject({ name: 'Неизвестный сигнал', armId: '', signalClass: 'unknown', discovered: false, unlocked: false });
    expect(result.edges).toEqual([]);
  });

  it('retains only graph edges whose endpoints are both discovered', () => {
    const result = buildGalaxyRenderData({
      nodes: [node('a', 1, true), node('b', 2, true), node('c', 3, false)],
      edges: [['a', 'b'], ['a', 'c'], ['missing', 'a']], unlockedIds: ['a', 'b'], activeId: 'a',
    });
    expect(result.edges).toEqual([['a', 'b']]);
    expect(result.bounds).toBeGreaterThan(0);
  });
});
