import { describe, expect, it } from 'vitest';
import { buildGalaxyRenderData } from '../src/renderer/galaxyModel';
import { findSelectableGalaxyNode, resolveGalaxyRoute, routePositionAtProgress } from '../src/renderer/galaxyInteraction';

const data = buildGalaxyRenderData({
  nodes: [
    { id: 'ferrum', planetId: 'ferrum', name: 'Феррум', x: 0, y: 0, z: 0, geometryName: 'Плато', biome: 'Пустыня', geometry: 'plateau', frequency: 1, seed: 1, armId: 'A', discovered: true },
    { id: 'krios', planetId: 'krios', name: 'Криос-9', x: 10, y: 0, z: 0, geometryName: 'Лёд', biome: 'Арктика', geometry: 'ice', frequency: 1, seed: 2, armId: 'A', discovered: true },
    { id: 'hidden', planetId: 'hidden', name: 'Секрет', x: 20, y: 0, z: 0, geometryName: 'Неизвестно', biome: 'Неизвестно', geometry: 'unknown', frequency: 1, seed: 3, armId: 'B', discovered: false },
  ],
  edges: [['ferrum', 'krios'], ['krios', 'hidden']],
  unlockedIds: ['ferrum', 'krios'],
  activeId: 'ferrum',
});

describe('Stage 7.1 — galaxy interaction', () => {
  it('allows selection only for discovered systems', () => {
    expect(findSelectableGalaxyNode(data, 'krios')?.name).toBe('Криос-9');
    expect(findSelectableGalaxyNode(data, 'hidden')).toBeNull();
    expect(findSelectableGalaxyNode(data, 'missing')).toBeNull();
  });

  it('resolves route nodes without leaking hidden signals or duplicate stops', () => {
    expect(resolveGalaxyRoute(data, ['ferrum', 'ferrum', 'krios', 'hidden', 'missing']).map((node) => node.id)).toEqual(['ferrum', 'krios']);
  });

  it('interpolates a ship position across multi-leg routes and clamps progress', () => {
    const points = [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 10, y: 10, z: 0 }];
    expect(routePositionAtProgress(points, 0)).toEqual({ x: 0, y: 0, z: 0 });
    expect(routePositionAtProgress(points, 0.5)).toEqual({ x: 10, y: 0, z: 0 });
    expect(routePositionAtProgress(points, 0.75)).toEqual({ x: 10, y: 5, z: 0 });
    expect(routePositionAtProgress(points, 2)).toEqual({ x: 10, y: 10, z: 0 });
  });
});
