/**
 * Этап 9.0 — интеграция: реальная игра → карта звёздных систем → рендер-модель галактики.
 * Проверяет, что слой систем надстроен над PlanetaryGraph без изменения координат узлов,
 * растёт вместе с открытием миров и переживает save/load (карта не хранится в сейве).
 */
import { describe, expect, it } from 'vitest';
import { makeGame } from './helpers';
import { STAR_MAP_POLICY, buildGalaxyStarMap, systemForNode, validateStarMap } from '../src/galaxy/starMap';
import { SYSTEM_POLICY, buildStarSystemCatalog } from '../src/galaxy/starSystems';
import { buildGalaxyRenderData, findRenderSystemByNode } from '../src/renderer/galaxyModel';
import type { Game } from '../src/core/game';
import type { StarSystemDescriptor } from '../src/contracts/galaxy';

function starMapOf(game: Game) {
  const registry = game.balance.registry.galaxy;
  return buildGalaxyStarMap({
    nodes: game.snapshot().galaxy.nodes,
    spiral: registry.arms,
    outerRadius: registry.gen.outerRadius,
    thickness: registry.nodeRender.THICK,
  });
}

function renderDataOf(game: Game, systems: readonly StarSystemDescriptor[]) {
  const snap = game.snapshot();
  return buildGalaxyRenderData({
    nodes: snap.galaxy.nodes,
    edges: snap.galaxy.edges,
    unlockedIds: snap.unlockedPlanets,
    activeId: snap.activePlanetId,
    systems,
    systemSpacing: STAR_MAP_POLICY.minSystemSeparation,
    discRadius: starMapOf(game).radius,
  });
}

describe('Этап 9.0 — интеграция карты систем с реальной игрой', () => {
  it('новая игра: 1 центральная звезда + 2 системы стартовых планет + 36 фоновых систем', () => {
    const { game } = makeGame();
    const map = starMapOf(game);
    expect(validateStarMap(map)).toEqual([]);
    expect(map.systemCount).toBe(1 + 2 + STAR_MAP_POLICY.backgroundSystems);
    expect(map.planetTotal).toBeGreaterThanOrEqual(map.systemCount * SYSTEM_POLICY.freeMinPlanets);
    expect(map.planetTotal).toBeLessThanOrEqual(map.systemCount * SYSTEM_POLICY.hostMaxPlanets);
    expect(map.radius).toBeGreaterThan(game.balance.registry.galaxy.gen.outerRadius * 0.5);
  });

  it('система стартовой планеты: координаты узла без изменений, орбита 0 занята Феррумом', () => {
    const { game } = makeGame();
    const map = starMapOf(game);
    const ferrum = systemForNode(map, 'ferrum')!;
    const node = game.snapshot().galaxy.nodes.find((item) => item.id === 'ferrum')!;
    expect(ferrum.position).toEqual({ x: node.x, y: node.y, z: node.z });
    expect(ferrum.charted).toBe(true);
    expect(ferrum.planets.length).toBeGreaterThanOrEqual(SYSTEM_POLICY.hostMinPlanets);
    expect(ferrum.planets.length).toBeLessThanOrEqual(SYSTEM_POLICY.hostMaxPlanets);
    expect(ferrum.planets[0]).toMatchObject({ orbitIndex: 0, status: 'bound', planetId: 'ferrum' });
    // Каталог Этапа 7.4 и карта Этапа 9.0 — одна и та же система.
    const catalog = buildStarSystemCatalog(node)!;
    expect(catalog.star).toEqual(ferrum.star);
    expect(catalog.bodies.length).toBe(ferrum.planets.length);
  });

  it('неоткрытый Криос-9: система существует, но не нанесена на карту и не раскрывает имя', () => {
    const { game } = makeGame();
    const map = starMapOf(game);
    const krios = systemForNode(map, 'krios')!;
    expect(krios.charted).toBe(false);
    expect(krios.hostNodeId).toBe('krios');
    expect(krios.name).not.toContain('Криос');
    const data = renderDataOf(game, map.systems);
    expect(findRenderSystemByNode(data, 'krios')?.name).toBe('Неизвестный сигнал');
  });

  it('рендер-модель: диск галактики равен радиусу карты систем и больше облака узлов', () => {
    const { game } = makeGame();
    const map = starMapOf(game);
    const snap = game.snapshot();
    const nodesOnly = buildGalaxyRenderData({ nodes: snap.galaxy.nodes, edges: snap.galaxy.edges, unlockedIds: snap.unlockedPlanets, activeId: snap.activePlanetId });
    const withSystems = renderDataOf(game, map.systems);
    expect(withSystems.discRadius).toBeCloseTo(map.radius * withSystems.scale, 9);
    expect(withSystems.discRadius).toBeGreaterThan(nodesOnly.bounds);
    expect(withSystems.systems.length).toBe(map.systemCount);
    expect(withSystems.systems.filter((system) => system.id.startsWith('sys:bg:')).length).toBe(STAR_MAP_POLICY.backgroundSystems);
  });

  it('открытие мира добавляет ровно одну систему и не двигает остальные', () => {
    const { game } = makeGame();
    const before = starMapOf(game);
    const result = game.dispatch('discoverPlanet', { seed: 777001, name: 'Гелика-Прайм' });
    expect(result.ok).toBe(true);
    const after = starMapOf(game);
    expect(after.systemCount).toBe(before.systemCount + 1);
    const added = after.systems.filter((system) => !before.byId[system.id]);
    expect(added).toHaveLength(1);
    expect(added[0]?.hostNodeId).toBe('planet_03');
    expect(added[0]?.charted).toBe(true);
    expect(added[0]?.planets[0]?.planetId).toBe('planet_03');
    // Фоновые системы и стартовые не меняются: карта стабильна относительно открытий.
    for (const system of before.systems) {
      expect(after.byId[system.id]?.position).toEqual(system.position);
      expect(after.byId[system.id]?.planets).toEqual(system.planets);
    }
  });

  it('карта детерминирована и переживает save/load (в сейве не хранится)', () => {
    const { game } = makeGame();
    game.dispatch('discoverPlanet', { seed: 777001, name: 'Гелика-Прайм' });
    const first = starMapOf(game);
    expect(starMapOf(game)).toEqual(first);
    const saved = game.dispatch('save', {});
    expect(saved.ok).toBe(true);
    const exported = game.dispatch('exportSave', {});
    expect(exported.ok).toBe(true);
    if (exported.ok) expect(exported.value.payload).not.toContain('sys:bg:');
    const loaded = game.dispatch('load', {});
    expect(loaded.ok).toBe(true);
    expect(starMapOf(game)).toEqual(first);
  });

  it('исследованная орбитальная сигнатура раскрывает класс тела в рендер-модели', () => {
    const { game } = makeGame();
    const map = starMapOf(game);
    const ferrum = systemForNode(map, 'ferrum')!;
    const candidate = ferrum.planets.find((planet) => planet.status === 'candidate')!;
    const bodyId = `body:ferrum:${candidate.orbitIndex}`;
    game.dispatch('grant', { delta: { energy: 100000, research: 100000 }, reason: 'test' });
    const before = renderDataOf(game, map.systems);
    expect(findRenderSystemByNode(before, 'ferrum')?.orbits[candidate.orbitIndex]?.bodyClass).toBe('unknown');
    const scan = game.dispatch('scanOrbitalBody', { hostPlanetId: 'ferrum', bodyId });
    expect(scan.ok).toBe(true);
    const state = game.orbitalExplorationState('ferrum');
    expect(state.scannedBodyIds).toContain(bodyId);
    const revealed: Record<string, number[]> = { [ferrum.id]: [candidate.orbitIndex] };
    const snap = game.snapshot();
    const after = buildGalaxyRenderData({
      nodes: snap.galaxy.nodes, edges: snap.galaxy.edges, unlockedIds: snap.unlockedPlanets,
      activeId: snap.activePlanetId, systems: map.systems,
      systemSpacing: STAR_MAP_POLICY.minSystemSeparation, revealedOrbits: revealed,
    });
    const orbit = findRenderSystemByNode(after, 'ferrum')?.orbits[candidate.orbitIndex];
    expect(orbit?.bodyClass).not.toBe('unknown');
    expect(orbit?.revealed).toBe(true);
  });
});
