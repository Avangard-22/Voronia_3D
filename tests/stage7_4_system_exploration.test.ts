import { describe, expect, it } from 'vitest';
import { buildStarSystemExploration } from '../src/galaxy/systemExploration';
import { buildStarSystemCatalog, validateStarSystemCatalog } from '../src/galaxy/starSystems';
import type { GraphNode } from '../src/contracts/galaxy';

const node: GraphNode & { unlocked: boolean; active: boolean } = {
  id: 'ferrum', planetId: 'ferrum', seed: 4421, name: 'Феррум', geometryName: 'Сферическая', biome: 'Железные равнины', geometry: 'sphere', frequency: 1, x: 0, y: 0, z: 0,
  discovered: true, unlocked: true, active: true, armId: 'local',
};

describe('Stage 7.4 — system exploration model', () => {
  it('creates a system from a discovered graph node and links its real world', () => {
    const system = buildStarSystemExploration(node);
    expect(system?.id).toBe('system:ferrum');
    expect(system?.worlds).toHaveLength(1);
    expect(system?.worlds[0]).toMatchObject({ id: 'ferrum', name: 'Феррум', unlocked: true, active: true, orbitIndex: 0 });
    expect(system?.canEnter).toBe(true);
    expect(system?.candidateCount).toBeGreaterThanOrEqual(1);
    expect(system?.candidates.every((body) => body.status === 'unscanned' && body.label === 'Неидентифицированное орбитальное тело')).toBe(true);
  });

  it('does not expose an undiscovered node', () => {
    expect(buildStarSystemExploration({ ...node, discovered: false })).toBeNull();
  });

  it('keeps locked worlds visible but prevents entering them', () => {
    const system = buildStarSystemExploration({ ...node, unlocked: false, active: false });
    expect(system?.worlds[0]?.discovered).toBe(true);
    expect(system?.canEnter).toBe(false);
    expect(system?.activeWorldId).toBeNull();
    expect(system?.candidates.length).toBeGreaterThan(0);
  });
});

describe('Stage 7.4 — deterministic domain star-system catalog', () => {
  it('generates stable orbital bodies from the discovered planet seed', () => {
    const first = buildStarSystemCatalog({ id: 'ferrum', name: 'Феррум', seed: 4421, discovered: true });
    const second = buildStarSystemCatalog({ id: 'ferrum', name: 'Феррум', seed: 4421, discovered: true });
    expect(first).toEqual(second);
    expect(first?.bodies[0]).toMatchObject({ status: 'confirmed', sourcePlanetId: 'ferrum', name: 'Феррум' });
    expect(first?.bodies.length).toBeGreaterThan(1);
    expect(first ? validateStarSystemCatalog(first) : ['missing']).toEqual([]);
  });

  it('does not generate a catalog for an undiscovered node', () => {
    expect(buildStarSystemCatalog({ id: 'secret', name: 'Неизвестно', seed: 10, discovered: false })).toBeNull();
  });

  it('keeps unscanned body identity and composition out of the public view', () => {
    const system = buildStarSystemExploration(node);
    expect(system?.candidates.length).toBeGreaterThan(0);
    for (const candidate of system?.candidates ?? []) {
      expect(candidate.label).toBe('Неидентифицированное орбитальное тело');
      expect(candidate).not.toHaveProperty('bodyClass');
      expect(candidate).not.toHaveProperty('name');
    }
  });
});
