import { describe, expect, it } from 'vitest';
import { makeGame, grant } from './helpers';
import { findGalaxyRoute } from '../src/galaxy/routes';

describe('Stage 6.7 — Galaxy Economy / Logistics', () => {
  it('loads transportable resources into cargo atomically and enforces cargo capacity', () => {
    const { game } = makeGame();
    grant(game, { iron: 500, titanium: 100 });
    const before = game.ledger.balance('iron');
    const loaded = game.dispatch('loadCargo', { resource: 'iron', amount: 25 });
    expect(loaded.ok).toBe(true);
    expect(game.ledger.balance('iron')).toBe(before - 25);
    expect(game.snapshot().logistics.cargo.iron).toBe(25);
    expect(game.snapshot().logistics.cargoMass).toBe(25);

    const tooMuch = game.dispatch('loadCargo', { resource: 'titanium', amount: 100 });
    expect(tooMuch.ok).toBe(false);
    if (!tooMuch.ok) expect(tooMuch.reason).toBe('max');
    expect(game.snapshot().logistics.cargoMass).toBe(25);
  });

  it('transports cargo through a real route, unloads it into a planet depot and withdraws it', () => {
    const { game } = makeGame();
    const ferrum = game.runtime('ferrum')!;
    for (const cell of ferrum.data.cells) ferrum.explored.add(cell.id);
    grant(game, { energy: 100_000, iron: 100 });
    expect(game.dispatch('unlockKrios', { scores: [0.9, 0.9, 0.9] }).ok).toBe(true);
    expect(game.dispatch('loadCargo', { resource: 'iron', amount: 10 }).ok).toBe(true);

    const graph = game.snapshot().galaxy;
    const from = graph.nodes.find((node) => node.id === 'ferrum')!;
    const to = graph.nodes.find((node) => node.id === 'krios')!;
    const routeWithoutCargo = findGalaxyRoute({ version: 5, nodes: Object.fromEntries(graph.nodes.map((node) => [node.id, node])), edges: graph.edges.map((edge) => [edge[0], edge[1]] as [string, string]) }, game.snapshot().unlockedPlanets, 'ferrum', 'krios', 0);
    const routeWithCargo = game.snapshot().galaxy.routes.find((route) => route.destinationId === 'krios');
    expect(from.id).toBe('ferrum');
    expect(to.id).toBe('krios');
    expect(routeWithCargo?.firstLeg.freightCost).toBeGreaterThan(0);
    expect(routeWithCargo?.firstLeg.energyCost).toBeGreaterThan(routeWithoutCargo?.firstLeg.energyCost ?? 0);

    expect(game.dispatch('travelToPlanet', { destinationId: 'krios' }).ok).toBe(true);
    const unloaded = game.dispatch('unloadCargo', { resource: 'iron', amount: 10 });
    expect(unloaded.ok).toBe(true);
    expect(game.snapshot().logistics.depot.iron).toBe(10);
    expect(game.snapshot().logistics.cargo.iron).toBeUndefined();

    const withdrawn = game.dispatch('withdrawDepot', { resource: 'iron', amount: 4 });
    expect(withdrawn.ok).toBe(true);
    expect(game.snapshot().logistics.depot.iron).toBe(6);
    // Phase 10.1.13: ресурсы per-planet. Активная — krios, withdraw идёт в krios ledger (4).
    expect(game.ledger.balance('iron')).toBe(4);
  });

  it('rejects unloading beyond local depot capacity without losing cargo', () => {
    const { game } = makeGame();
    grant(game, { iron: 100 });
    expect(game.dispatch('loadCargo', { resource: 'iron', amount: 20 }).ok).toBe(true);
    const result = game.dispatch('unloadCargo', { resource: 'iron', amount: 20 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('max');
    expect(game.snapshot().logistics.cargo.iron).toBe(20);
    expect(game.snapshot().logistics.depot.iron).toBeUndefined();
  });

  it('persists cargo and planetary depots across save/load', () => {
    const { game, storage } = makeGame();
    grant(game, { iron: 50 });
    expect(game.dispatch('loadCargo', { resource: 'iron', amount: 7 }).ok).toBe(true);
    const saved = game.dispatch('save', {});
    expect(saved.ok).toBe(true);
    expect(game.dispatch('unloadCargo', { resource: 'iron', amount: 7 }).ok).toBe(true);
    expect(game.dispatch('load', {}).ok).toBe(true);
    expect(game.snapshot().logistics.cargo.iron).toBe(7);
    expect(game.snapshot().logistics.depot.iron).toBeUndefined();
    expect(storage.keys().length).toBeGreaterThan(0);
  });

  it('rejects non-transportable currencies and zero/negative quantities', () => {
    const { game } = makeGame();
    grant(game, { energy: 1000, research: 1000 });
    expect(game.dispatch('loadCargo', { resource: 'energy', amount: 1 }).ok).toBe(false);
    expect(game.dispatch('loadCargo', { resource: 'research', amount: 1 }).ok).toBe(false);
    expect(game.dispatch('loadCargo', { resource: 'iron', amount: 0 }).ok).toBe(false);
    expect(game.dispatch('loadCargo', { resource: 'iron', amount: -1 }).ok).toBe(false);
  });
});
