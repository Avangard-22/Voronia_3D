import { describe, expect, it } from 'vitest';
import type { GraphNode } from '../src/contracts/galaxy';
import { buildAnomalySites } from '../src/galaxy/anomalies';
import { Game } from '../src/core/game';

function node(id: string, index: number, discovered = true): GraphNode {
  return {
    id, planetId: id, name: `Мир ${index}`, geometryName: 'rift anomaly', biome: 'void', geometry: 'rift', frequency: 0.9,
    seed: index * 101, armId: `arm-${index}`, x: index * 10, y: 0, z: index * 4, discovered,
  };
}

describe('Stage 6.5 — Anomaly Systems', () => {
  it('exposes only discovered anomaly worlds and orders the expedition chain', () => {
    const sites = buildAnomalySites([node('a', 1), node('b', 2), node('hidden', 3, false)], new Set());
    expect(sites.map((site) => site.planetId)).toEqual(['a', 'b']);
    expect(sites[0]?.available).toBe(true);
    expect(sites[1]?.available).toBe(false);
  });

  it('unlocks the next expedition only after the previous anomaly is resolved', () => {
    const sites = buildAnomalySites([node('a', 1), node('b', 2), node('c', 3)], new Set(['a']));
    expect(sites[0]?.resolved).toBe(true);
    expect(sites[1]?.available).toBe(true);
    expect(sites[2]?.available).toBe(false);
  });

  it('scales expedition costs and unique rewards by chain depth', () => {
    const sites = buildAnomalySites([node('a', 1), node('b', 2)], new Set(['a']));
    expect(sites[1]!.energyCost).toBeGreaterThan(sites[0]!.energyCost);
    expect(sites[1]!.researchCost).toBeGreaterThan(sites[0]!.researchCost);
    expect(sites[1]!.reward.darkMatter).toBeGreaterThan(sites[0]!.reward.darkMatter);
  });


  it('resolves an anomaly through the domain command exactly once and persists its id', () => {
    const game = new Game({ rngSeed: 441122 });
    const graph = game.galaxyGraph();
    const ferrum = graph.nodes['ferrum']!;
    graph.nodes['ferrum'] = { ...ferrum, biome: 'void', geometryName: 'rift anomaly' };
    const grant = game.dispatch('grant', { delta: { energy: 10_000, research: 2_000 }, reason: 'test-anomaly-funds' });
    expect(grant.ok).toBe(true);
    const resolved = game.dispatch('resolveAnomaly', { planetId: 'ferrum' });
    expect(resolved.ok).toBe(true);
    expect(game.ledger.balance('darkMatter')).toBe(2);
    expect(game.snapshot().galaxy.anomalies[0]?.resolved).toBe(true);
    const duplicate = game.dispatch('resolveAnomaly', { planetId: 'ferrum' });
    expect(duplicate.ok).toBe(false);
    expect(game.collectState().resolvedAnomalyIds).toEqual(['ferrum']);
  });

  it('returns no sites for ordinary resource worlds', () => {
    const ordinary = { ...node('ore', 1), biome: 'ferrum', geometryName: 'crystal plains' };
    expect(buildAnomalySites([ordinary], new Set())).toEqual([]);
  });
});
