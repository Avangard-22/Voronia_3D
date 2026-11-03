import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import type { GraphNode } from '../src/contracts/galaxy';
import { anomalyGateStatus, classifySignal, galaxyMilestone, galaxySector, layoutGalaxy } from '../src/galaxy/exploration';

function node(id: string, x: number, z: number, discovered = true): GraphNode {
  return { id, planetId: id, name: id, geometryName: 'Икосаэдр', biome: 'unknown', geometry: 'icosahedron', frequency: 3, seed: 1, armId: 'inter', x, y: 0, z, discovered };
}

describe('Stage 6.2 — Galaxy Exploration', () => {
  it('classifies anomaly, cryogenic, energy, resource and unknown signals', () => {
    expect(classifySignal({ biome: 'void' })).toBe('anomaly');
    expect(classifySignal({ biome: 'krios' })).toBe('cryo');
    expect(classifySignal({ resources: ['energy'] })).toBe('energy');
    expect(classifySignal({ biome: 'ferrum' })).toBe('resource');
    expect(classifySignal({ biome: 'unknown', geometry: 'icosahedron' })).toBe('unknown');
  });

  it('maps galaxy XZ coordinates into a bounded square without NaN for coincident nodes', () => {
    const points = layoutGalaxy([node('a', 10, 20), node('b', 10, 20, false)]);
    expect(points).toHaveLength(2);
    for (const p of points) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1000);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1000);
    }
    expect(points[1]?.discovered).toBe(false);
  });

  it('exposes the same classified, positioned graph through the Game snapshot', () => {
    const snapshot = new Game({ rngSeed: 24680 }).snapshot();
    expect(snapshot.galaxy.discoveredCount).toBe(1);
    expect(snapshot.galaxy.nodes).toHaveLength(2);
    for (const entry of snapshot.galaxy.nodes) {
      expect(['anomaly', 'energy', 'cryo', 'resource', 'unknown']).toContain(entry.signalClass);
      expect(Number.isFinite(entry.mapX)).toBe(true);
      expect(Number.isFinite(entry.mapY)).toBe(true);
    }
    expect(snapshot.galaxy.nodes.find((entry) => entry.id === 'krios')?.discovered).toBe(false);
    expect(snapshot.galaxy.sectors.map((sector) => sector.id)).toEqual(['core', 'inner', 'mid', 'outer']);
    expect(snapshot.galaxy.discoveredArms).toContain('core');
    expect(snapshot.sonar.anomalyGate.requiredWorlds).toBe(3);
  });

  it('assigns stable radial sectors and gates anomaly discoveries by exploration depth', () => {
    expect(galaxySector(node('core', 4, 3))).toMatchObject({ id: 'core', label: 'Ядро' });
    expect(galaxySector(node('inner', 20, 0)).id).toBe('inner');
    expect(galaxySector(node('mid', 50, 0)).id).toBe('mid');
    expect(galaxySector(node('outer', 80, 0)).id).toBe('outer');
    expect(anomalyGateStatus({ discoveredWorlds: 2, discoveredArms: 1, research: 1500 }).missing).toEqual(['worlds', 'arms']);
    expect(anomalyGateStatus({ discoveredWorlds: 3, discoveredArms: 2, research: 1500 }).unlocked).toBe(true);
  });

  it('advances exploration milestones monotonically', () => {
    expect(galaxyMilestone(2)).toMatchObject({ current: 2, next: 3 });
    expect(galaxyMilestone(4)).toMatchObject({ current: 3, next: 5 });
    expect(galaxyMilestone(8)).toMatchObject({ current: 8, next: 12 });
  });
});
