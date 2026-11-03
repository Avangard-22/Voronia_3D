import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { buildStarSystemCatalog } from '../src/galaxy/starSystems';

describe('Stage 7.4 orbital discovery and activation', () => {
  it('requires resources and an unlocked host system before scanning', () => {
    const game = new Game({ rngSeed: 77 });
    const host = game.galaxyGraph().nodes['ferrum']!;
    const body = buildStarSystemCatalog(host)!.bodies[1]!;
    const denied = game.dispatch('scanOrbitalBody', { hostPlanetId: 'ferrum', bodyId: body.id });
    expect(denied.ok).toBe(false);
    expect(game.orbitalExplorationState('ferrum').scannedBodyIds).toHaveLength(0);
  });

  it('scans once, activates a runtime planet, and persists the result', () => {
    const game = new Game({ rngSeed: 78 });
    game.dispatch('grant', { delta: { energy: 10000, research: 3000 }, reason: 'stage7.4-test' });
    const host = game.galaxyGraph().nodes['ferrum']!;
    const body = buildStarSystemCatalog(host)!.bodies[1]!;

    const scan = game.dispatch('scanOrbitalBody', { hostPlanetId: 'ferrum', bodyId: body.id });
    expect(scan.ok).toBe(true);
    expect(game.dispatch('scanOrbitalBody', { hostPlanetId: 'ferrum', bodyId: body.id }).ok).toBe(false);

    const activation = game.dispatch('activateOrbitalBody', { hostPlanetId: 'ferrum', bodyId: body.id });
    expect(activation.ok).toBe(true);
    if (!activation.ok) return;
    expect(game.runtime(activation.value.id)).toBeDefined();
    expect(game.snapshot().unlockedPlanets).toContain(activation.value.id);

    const exported = game.dispatch('exportSave', {});
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const restored = new Game({ rngSeed: 78 });
    expect(restored.dispatch('importSave', { payload: exported.value.payload }).ok).toBe(true);
    expect(restored.runtime(activation.value.id)).toBeDefined();
    expect(restored.orbitalExplorationState('ferrum').activatedBodies[body.id]).toBe(activation.value.id);
  });

  it('does not activate an unscanned orbital body', () => {
    const game = new Game({ rngSeed: 79 });
    game.dispatch('grant', { delta: { energy: 10000, research: 3000 }, reason: 'stage7.4-test' });
    const body = buildStarSystemCatalog(game.galaxyGraph().nodes['ferrum']!)!.bodies[1]!;
    const result = game.dispatch('activateOrbitalBody', { hostPlanetId: 'ferrum', bodyId: body.id });
    expect(result.ok).toBe(false);
  });
});
