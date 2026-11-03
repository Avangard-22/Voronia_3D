import { describe, expect, it } from 'vitest';
import { makeGame, grant } from './helpers';
import { validateGalaxyIntegrity } from '../src/galaxy/validation';

describe('Stage 6.8 — Galaxy Validation', () => {
  it('accepts the fresh game and its save representation', () => {
    const { game } = makeGame();
    const report = game.validateIntegrity();
    expect(report.ok).toBe(true);
    expect(report.checkedNodes).toBeGreaterThanOrEqual(2);
    expect(report.issues).toEqual([]);
  });

  it('validates the integrated unlock → route → cargo → travel → depot → save cycle', () => {
    const { game } = makeGame();
    const ferrum = game.runtime('ferrum')!;
    for (const cell of ferrum.data.cells) ferrum.explored.add(cell.id);
    grant(game, { energy: 100_000, iron: 100 });
    expect(game.dispatch('unlockKrios', { scores: [0.9, 0.9, 0.9] }).ok).toBe(true);
    expect(game.dispatch('loadCargo', { resource: 'iron', amount: 10 }).ok).toBe(true);
    expect(game.validateIntegrity().ok).toBe(true);
    expect(game.dispatch('travelToPlanet', { destinationId: 'krios' }).ok).toBe(true);
    expect(game.dispatch('unloadCargo', { resource: 'iron', amount: 10 }).ok).toBe(true);
    expect(game.validateIntegrity().ok).toBe(true);
    expect(game.dispatch('save', {}).ok).toBe(true);
    expect(game.dispatch('load', {}).ok).toBe(true);
    const report = game.validateIntegrity();
    expect(report.ok).toBe(true);
    expect(report.checkedRoutes).toBeGreaterThanOrEqual(1);
  });

  it('reports dangling edges, duplicate edges, and unreachable unlocked planets', () => {
    const graph = {
      version: 5,
      nodes: {
        a: { id: 'a', planetId: 'a', name: 'A', geometryName: 'sphere', biome: 'x', geometry: 'sphere', frequency: 0.5, seed: 1, armId: 'arm-a', x: 0, y: 0, z: 0, discovered: true },
        b: { id: 'b', planetId: 'b', name: 'B', geometryName: 'sphere', biome: 'x', geometry: 'sphere', frequency: 0.5, seed: 2, armId: 'arm-b', x: 1, y: 0, z: 0, discovered: true },
        // Изолированная открытая планета: a и b связаны ребром (пусть и дублированным), поэтому недостижимость
        // проверяется на узле без единого ребра — иначе issue 'unreachable-unlocked-planet' не может возникнуть.
        c: { id: 'c', planetId: 'c', name: 'C', geometryName: 'sphere', biome: 'x', geometry: 'sphere', frequency: 0.5, seed: 3, armId: 'arm-c', x: 9, y: 0, z: 9, discovered: true },
      },
      edges: [['a', 'missing'], ['a', 'b'], ['b', 'a']] as [string, string][],
    };
    const report = validateGalaxyIntegrity({ graph, unlockedPlanetIds: ['a', 'b', 'c'], activePlanetId: 'a', runtimePlanetIds: ['a', 'b', 'c'], routes: [], cargo: {}, depots: {} });
    expect(report.ok).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toContain('dangling-edge');
    expect(report.issues.map((issue) => issue.code)).toContain('duplicate-edge');
    expect(report.issues.map((issue) => issue.code)).toContain('unreachable-unlocked-planet');
    expect(report.issues.find((issue) => issue.code === 'unreachable-unlocked-planet')?.message).toContain('c');
    // Транзит через неоткрытые системы разрешён (Этап 8.1): достижимость a ↔ b сохраняется.
    expect(report.issues.filter((issue) => issue.code === 'unreachable-unlocked-planet')).toHaveLength(1);
  });

  it('detects invalid cargo amounts and orphan planetary depots', () => {
    const { game } = makeGame();
    const base = game.galaxyGraph();
    const report = validateGalaxyIntegrity({ graph: base, unlockedPlanetIds: ['ferrum'], activePlanetId: 'ferrum', runtimePlanetIds: ['ferrum'], routes: [], cargo: { iron: -3 }, depots: { ghost: { iron: 4 } } });
    expect(report.ok).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toContain('invalid-resource-amount');
    expect(report.issues.map((issue) => issue.code)).toContain('orphan-depot');
  });
});
