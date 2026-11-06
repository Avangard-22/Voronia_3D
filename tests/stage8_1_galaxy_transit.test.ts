/**
 * Этап 8.1 — регрессия связности галактики (ADR-018).
 *
 * Баг, закрытый этим этапом: `discoverPlanet`/`activateOrbitalBody` вешали новый мир на узел,
 * который игрок ещё не открыл (например, на скрытый Криос-9), а `findGalaxyRoute` требовал
 * непрерывной цепочки из unlocked-узлов. В итоге:
 *   - legacy paid travelToPlanet route remains separate from free V1 setActivePlanet switching;
 *   - `validateIntegrity()` помечал легально полученное состояние как `unreachable-unlocked-planet`;
 *   - это состояние сохранялось в save и восстанавливалось из него.
 *
 * Решение: транзит через неоткрытые системы разрешён (без посадки, с надбавкой), маршрут сжимается
 * до остановок, поэтому `activePlanetId` всегда указывает на открытую планету c runtime.
 */
import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { ManualDriver } from '../src/core/gameClock';
import { MemoryStorage } from '../src/persistence/storage';
import { buildStarSystemCatalog } from '../src/galaxy/starSystems';
import { findGalaxyRoute } from '../src/galaxy/routes';
import { makeGame, grant } from './helpers';

describe('Этап 8.1 — транзит через неоткрытые системы', () => {
  function discoveredGame(seed = 31337) {
    const { game } = makeGame(seed);
    grant(game, { energy: 1_000_000, research: 100_000 });
    const discovered = game.dispatch('discoverPlanet', { seed: 777001, name: 'Гелика-Прайм' });
    if (!discovered.ok) throw new Error(`discoverPlanet отвергнут: ${discovered.detail ?? discovered.reason}`);
    return { game, planetId: discovered.value.id };
  }

  it('открытый мир достижим, даже если он висит на ещё не открытом узле', () => {
    const { game, planetId } = discoveredGame();
    const graph = game.galaxyGraph();
    // Предусловие бага: единственный сосед нового мира — скрытый Криос-9.
    const neighbours = (graph.edges ?? []).filter(([a, b]) => a === planetId || b === planetId).map(([a, b]) => (a === planetId ? b : a));
    expect(neighbours).toEqual(['krios']);
    expect(graph.nodes['krios']?.discovered).toBe(false);
    expect(game.snapshot().unlockedPlanets).not.toContain('krios');

    // Без транзита маршрута нет — это и был баг.
    expect(findGalaxyRoute(graph, game.snapshot().unlockedPlanets, 'ferrum', planetId, 0, { allowTransit: false })).toBeNull();
    const route = findGalaxyRoute(graph, game.snapshot().unlockedPlanets, 'ferrum', planetId);
    expect(route?.path).toEqual(['ferrum', planetId]);
    expect(route?.transitNodeIds).toEqual(['krios']);

    const travel = game.dispatch('setActivePlanet', { pid: planetId });
    expect(travel.ok).toBe(true);
    expect(game.activePlanetId()).toBe(planetId);
    expect(game.runtime(planetId)).toBeDefined();
    expect(game.validateIntegrity().ok).toBe(true);
  });

  it('возврат возможен: activePlanetId никогда не остаётся на транзитном узле', () => {
    const { game, planetId } = discoveredGame();
    expect(game.dispatch('setActivePlanet', { pid: planetId }).ok).toBe(true);
    const back = game.dispatch('travelToPlanet', { destinationId: 'ferrum' });
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.value.pid).toBe('ferrum');
    expect(back.value.transitNodeIds).toEqual(['krios']);
    expect(game.activePlanetId()).toBe('ferrum');
    expect(game.validateIntegrity().ok).toBe(true);
    // Транзитная система не становится активной и не получает runtime.
    expect(game.snapshot().unlockedPlanets).not.toContain('krios');
    expect(game.runtime('krios')).toBeUndefined();
  });

  it('нельзя прилететь в транзитную систему как в точку назначения', () => {
    const { game } = discoveredGame();
    const result = game.dispatch('travelToPlanet', { destinationId: 'krios' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('state');
    expect(game.activePlanetId()).toBe('ferrum');
  });

  it('активированное орбитальное тело не оставляет недостижимых планет ни в runtime, ни в save', () => {
    const game = new Game({ storage: new MemoryStorage(), clockDriver: new ManualDriver(), rngSeed: 7406 });
    grant(game, { energy: 1_000_000, research: 100_000 });
    const body = buildStarSystemCatalog(game.galaxyGraph().nodes['ferrum'])!.bodies[1]!;
    expect(game.dispatch('scanOrbitalBody', { hostPlanetId: 'ferrum', bodyId: body.id }).ok).toBe(true);
    const activation = game.dispatch('activateOrbitalBody', { hostPlanetId: 'ferrum', bodyId: body.id });
    expect(activation.ok).toBe(true);
    if (!activation.ok) return;
    const planetId = activation.value.id;

    expect(game.dispatch('travelWithinSystem', { hostPlanetId: 'ferrum', destinationId: planetId }).ok).toBe(true);
    expect(game.validateIntegrity().ok).toBe(true); // было: unreachable-unlocked-planet (ferrum)
    expect(game.dispatch('travelToPlanet', { destinationId: 'ferrum' }).ok).toBe(true);
    expect(game.activePlanetId()).toBe('ferrum');

    const exported = game.dispatch('exportSave', {});
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const restored = new Game({ storage: new MemoryStorage(), clockDriver: new ManualDriver(), rngSeed: 1 });
    expect(restored.dispatch('importSave', { payload: exported.value.payload }).ok).toBe(true);
    expect(restored.validateIntegrity().ok).toBe(true);
    expect(restored.validateIntegrity().issues).toEqual([]);
  });

  it('транзит стоит дороже и не раскрывает метаданные пролётной системы', () => {
    const { game, planetId } = discoveredGame();
    const graph = game.galaxyGraph();
    const unlocked = game.snapshot().unlockedPlanets;
    const transit = findGalaxyRoute(graph, unlocked, 'ferrum', planetId);
    expect(transit).not.toBeNull();
    // Надбавка применяется к каждому ребру, у которого хотя бы один конец не открыт (ADR-018).
    expect(transit!.totalEnergy).toBe(transit!.firstLeg.energyCost);
    expect(transit!.hops).toBe(1);
    const node = graph.nodes['krios']!;
    expect(node.discovered).toBe(false);
    // Снапшот не выдаёт имя/биом скрытого узла как доступные для перелёта.
    expect(game.snapshot().galaxy.routes.every((entry) => unlocked.includes(entry.destinationId))).toBe(true);
  });
});
