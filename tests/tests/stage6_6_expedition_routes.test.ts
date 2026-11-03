import { describe, expect, it } from 'vitest';
import type { GraphNode, PlanetaryGraph } from '../src/contracts/galaxy';
import { buildRouteOptions, findGalaxyRoute, quoteRouteLeg, ROUTE_POLICY } from '../src/galaxy/routes';
import { makeGame, grant } from './helpers';

function node(id: string, x: number, z: number, biome = 'unknown', geometryName = 'icosahedron', discovered = true): GraphNode {
  return { id, planetId: id, name: id.toUpperCase(), geometryName, biome, geometry: geometryName, frequency: 1, seed: x + z + 100, armId: 'core', x, y: 0, z, discovered };
}

function graph(nodes: GraphNode[], edges: [string, string][]): PlanetaryGraph {
  return { version: 5, nodes: Object.fromEntries(nodes.map((entry) => [entry.id, entry])), edges };
}

describe('Stage 6.6 — Expedition Routes', () => {
  it('finds a multi-hop route using only discovered and unlocked intermediate nodes', () => {
    const g = graph([node('a', 0, 0), node('b', 3, 0), node('c', 6, 0), node('locked', 3, 2)], [['a', 'b'], ['b', 'c'], ['a', 'locked'], ['locked', 'c']]);
    const route = findGalaxyRoute(g, ['a', 'b', 'c'], 'a', 'c');
    expect(route?.path).toEqual(['a', 'b', 'c']);
    expect(route?.hops).toBe(2);
    expect(route?.nextHop).toBe('b');
    expect(route?.transitNodeIds).toEqual([]);
    // Контракт Этапа 6.6 сохранён за явным флагом: без транзита замкнутой цепочки открытых узлов нет.
    expect(findGalaxyRoute(g, ['a', 'c'], 'a', 'c', 0, { allowTransit: false })).toBeNull();
  });

  it('Этап 8.1: допускает пролёт через неоткрытую систему без посадки и с надбавкой', () => {
    const g = graph([node('a', 0, 0), node('b', 3, 0), node('c', 6, 0), node('locked', 3, 2)], [['a', 'b'], ['b', 'c'], ['a', 'locked'], ['locked', 'c']]);
    const transit = findGalaxyRoute(g, ['a', 'c'], 'a', 'c');
    // Транзитный узел не становится остановкой: activePlanetId всегда указывает на открытую планету с runtime.
    expect(transit?.path).toEqual(['a', 'c']);
    expect(transit?.hops).toBe(1);
    expect(transit?.nextHop).toBe('c');
    expect(transit?.firstLeg).toMatchObject({ from: 'a', to: 'c' });
    expect(transit?.transitNodeIds).toEqual(['b']);
    const rawThroughB = quoteRouteLeg(g.nodes['a']!, g.nodes['b']!).energyCost + quoteRouteLeg(g.nodes['b']!, g.nodes['c']!).energyCost;
    expect(transit?.totalEnergy).toBeGreaterThan(rawThroughB);
    expect(transit?.totalEnergy).toBeLessThanOrEqual(Math.ceil(rawThroughB * ROUTE_POLICY.lockedTransitMultiplier) + 2);
    expect(transit?.firstLeg.energyCost).toBe(transit?.totalEnergy);
    // Открытая планета без связи с остальным графом по-прежнему недостижима.
    expect(findGalaxyRoute(graph([node('a', 0, 0), node('far', 40, 40)], []), ['a', 'far'], 'a', 'far')).toBeNull();
  });

  it('Этап 8.1: неизученная система как транзит стоит дороже нанесённой на карту', () => {
    const charted = graph([node('a', 0, 0), node('c', 6, 0), node('mid', 3, 0)], [['a', 'mid'], ['mid', 'c']]);
    const blind = graph([node('a', 0, 0), node('c', 6, 0), node('mid', 3, 0, 'unknown', 'icosahedron', false)], [['a', 'mid'], ['mid', 'c']]);
    const chartedRoute = findGalaxyRoute(charted, ['a', 'c'], 'a', 'c');
    const blindRoute = findGalaxyRoute(blind, ['a', 'c'], 'a', 'c');
    expect(chartedRoute?.transitNodeIds).toEqual(['mid']);
    expect(blindRoute?.transitNodeIds).toEqual(['mid']);
    expect(chartedRoute?.totalDistance).toBe(blindRoute?.totalDistance);
    expect(blindRoute!.totalEnergy).toBeGreaterThan(chartedRoute!.totalEnergy);
    expect(blindRoute!.totalEnergy).toBeLessThanOrEqual(Math.ceil(chartedRoute!.totalEnergy * (ROUTE_POLICY.blindTransitMultiplier / ROUTE_POLICY.lockedTransitMultiplier)) + 2);
  });

  it('prices distance, destination sector and anomalous instability', () => {
    const origin = node('origin', 0, 0);
    const inner = node('inner', 4, 0);
    const outer = node('outer', 70, 0);
    const anomaly = node('anomaly', 4, 0, 'void', 'rift anomaly');
    expect(quoteRouteLeg(origin, outer).energyCost).toBeGreaterThan(quoteRouteLeg(origin, inner).energyCost);
    expect(quoteRouteLeg(origin, anomaly).energyCost).toBeGreaterThan(quoteRouteLeg(origin, inner).energyCost);
    expect(quoteRouteLeg(origin, anomaly).anomalyRisk).toBe(true);
  });

  it('builds deterministic route quotes for all reachable unlocked destinations', () => {
    const g = graph([node('a', 0, 0), node('b', 5, 0), node('c', 10, 0)], [['a', 'b'], ['b', 'c']]);
    const routes = buildRouteOptions(g, ['a', 'b', 'c'], 'a');
    expect(routes.map((route) => route.destinationId)).toEqual(['b', 'c']);
    expect(routes[1]?.path).toEqual(['a', 'b', 'c']);
  });

  it('requires a real graph route and energy payment for an in-game jump', () => {
    const { game } = makeGame();
    const ferrum = game.runtime('ferrum')!;
    for (const cell of ferrum.data.cells) ferrum.explored.add(cell.id);
    grant(game, { energy: 100_000 });
    const unlocked = game.dispatch('unlockKrios', { scores: [0.9, 0.9, 0.9] });
    expect(unlocked.ok).toBe(true);
    const route = game.snapshot().galaxy.routes.find((entry) => entry.destinationId === 'krios');
    expect(route?.path).toEqual(['ferrum', 'krios']);
    const before = game.ledger.balance('energy');
    const travel = game.dispatch('travelToPlanet', { destinationId: 'krios' });
    expect(travel.ok).toBe(true);
    if (!travel.ok) return;
    expect(travel.value.pid).toBe('krios');
    expect(travel.value.energyCost).toBe(route?.firstLeg.energyCost);
    expect(game.ledger.balance('energy')).toBe(before - travel.value.energyCost);
    expect(game.snapshot().session.travels).toBe(1);
    expect(game.dispatch('travelToPlanet', { destinationId: 'ferrum' }).ok).toBe(true);
  });

  it('rejects a jump when energy is insufficient without changing location or balance', () => {
    const { game } = makeGame();
    const ferrum = game.runtime('ferrum')!;
    for (const cell of ferrum.data.cells) ferrum.explored.add(cell.id);
    grant(game, { energy: 100_000 });
    expect(game.dispatch('unlockKrios', { scores: [0.8, 0.8, 0.8] }).ok).toBe(true);
    const route = game.snapshot().galaxy.routes.find((entry) => entry.destinationId === 'krios')!;
    const state = game.collectState();
    game.ledger.hydrate({ balances: { ...state.ledger.balances, energy: route.firstLeg.energyCost - 1 }, nextId: state.ledger.nextId });
    const result = game.dispatch('travelToPlanet', { destinationId: 'krios' });
    expect(result.ok).toBe(false);
    expect(game.activePlanetId()).toBe('ferrum');
    expect(game.ledger.balance('energy')).toBe(route.firstLeg.energyCost - 1);
  });
});
