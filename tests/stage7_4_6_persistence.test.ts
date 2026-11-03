import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { validateSaveV2 } from '../src/persistence/schema';
import { buildStarSystemCatalog } from '../src/galaxy/starSystems';

describe('Stage 7.4.6 system exploration persistence', () => {
  function activatedGame() {
    const game = new Game({ rngSeed: 7406 });
    game.dispatch('grant', { delta: { energy: 10000, research: 3000 }, reason: 'stage7.4.6-test' });
    const body = buildStarSystemCatalog(game.galaxyGraph().nodes['ferrum'])!.bodies[1]!;
    expect(game.dispatch('scanOrbitalBody', { hostPlanetId: 'ferrum', bodyId: body.id }).ok).toBe(true);
    const activation = game.dispatch('activateOrbitalBody', { hostPlanetId: 'ferrum', bodyId: body.id });
    expect(activation.ok).toBe(true);
    if (!activation.ok) throw new Error('activation failed');
    return { game, body, planetId: activation.value.id };
  }

  it('round-trips scanned and activated bodies with their runtime planet', () => {
    const { game, body, planetId } = activatedGame();
    expect(game.dispatch('travelWithinSystem', { hostPlanetId: 'ferrum', destinationId: planetId }).ok).toBe(true);
    const payload = game.dispatch('exportSave', {});
    expect(payload.ok).toBe(true);
    if (!payload.ok) return;
    const restored = new Game({ rngSeed: 1 });
    expect(restored.dispatch('importSave', { payload: payload.value.payload }).ok).toBe(true);
    expect(restored.activePlanetId()).toBe(planetId);
    expect(restored.runtime(planetId)).toBeDefined();
    expect(restored.orbitalExplorationState('ferrum').scannedBodyIds).toContain(body.id);
    expect(restored.orbitalExplorationState('ferrum').activatedBodies[body.id]).toBe(planetId);
    expect(restored.validateIntegrity().ok).toBe(true);
  });

  it('rejects activation mappings without a prior scan', () => {
    const { game, body, planetId } = activatedGame();
    const raw = JSON.parse(game.saves.exportString()) as Record<string, unknown>;
    const systems = raw['orbitalExploration'] as Record<string, { scannedBodyIds: string[]; activatedBodies: Record<string, string> }>;
    systems['ferrum']!.scannedBodyIds = [];
    systems['ferrum']!.activatedBodies[body.id] = planetId;
    expect(validateSaveV2(raw).ok).toBe(false);
  });

  it('rejects mappings to a planet absent from the unlocked set or discovery specs', () => {
    const { game, body } = activatedGame();
    const raw = JSON.parse(game.saves.exportString()) as Record<string, unknown>;
    const systems = raw['orbitalExploration'] as Record<string, { scannedBodyIds: string[]; activatedBodies: Record<string, string> }>;
    systems['ferrum']!.activatedBodies[body.id] = 'missing-planet';
    expect(validateSaveV2(raw).ok).toBe(false);
  });
});
