import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';

describe('Stage 6 — SONAR SYSTEM', () => {
  function preparedGame(seed = 15929600): Game {
    const game = new Game({ rngSeed: seed });
    const ferrum = game.runtime('ferrum')!;
    for (const cell of ferrum.data.cells) ferrum.explored.add(cell.id);
    game.dispatch('grant', { delta: { energy: 5000 }, reason: 'test-sonar-fuel' });
    return game;
  }

  it('blocks Krios before full Ferrum exploration and prevents direct discovery bypass', () => {
    const game = new Game({ rngSeed: 15929600 });
    expect(game.snapshot().sonar.available).toBe(false);
    const direct = game.dispatch('discoverPlanet', { seed: 123 });
    expect(direct.ok).toBe(true);
    expect(game.snapshot().unlockedPlanets).not.toContain('krios');
  });

  it('opens Krios after three valid sonar rounds, deducts energy and applies perfect bonus', () => {
    const game = preparedGame();
    const before = game.ledger.balance('energy');
    const result = game.dispatch('unlockKrios', { scores: [0.98, 0.95, 0.96] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pid).toBe('krios');
    expect(result.value.accuracy).toBe(96);
    expect(result.value.bonusMult).toBe(1.5);
    expect(game.ledger.balance('energy')).toBe(before - game.balance.registry.sonar.hintEnergy);
    expect(game.runtime('krios')).toBeDefined();
    expect(game.galaxyGraph().nodes.krios?.discovered).toBe(true);
    expect(game.snapshot().unlockedPlanets).toContain('krios');
    expect(game.snapshot().sonar.bonusMult).toBe(1.5);
  });

  it('rejects malformed rounds without spending energy or unlocking the planet', () => {
    const game = preparedGame();
    const before = game.ledger.balance('energy');
    const result = game.dispatch('unlockKrios', { scores: [0.9, 1.2, 0.8] });
    expect(result.ok).toBe(false);
    expect(game.ledger.balance('energy')).toBe(before);
    expect(game.snapshot().unlockedPlanets).not.toContain('krios');
  });

  it('persists sonar bonus and restores Krios discovery', () => {
    const game = preparedGame();
    const opened = game.dispatch('unlockKrios', { scores: [0.95, 0.95, 0.95] });
    expect(opened.ok).toBe(true);
    const save = game.collectState();
    const restored = new Game({ rngSeed: 15929600 });
    restored.applyState(save);
    expect(restored.snapshot().unlockedPlanets).toContain('krios');
    expect(restored.galaxyGraph().nodes.krios?.discovered).toBe(true);
    expect(restored.snapshot().sonar.bonusMult).toBe(1.5);
  });


  it('previews the next procedural planet from the same deterministic generator used by discovery', () => {
    const game = preparedGame();
    const opened = game.dispatch('unlockKrios', { scores: [0.95, 0.95, 0.95] });
    expect(opened.ok).toBe(true);
    const preview = game.nextDiscoveryPreview();
    expect(preview).not.toBeNull();
    game.addSonarCharge();
    const discovered = game.dispatch('discoverPlanet', {});
    expect(discovered.ok).toBe(true);
    if (preview && discovered.ok) {
      expect(discovered.value.id).toBe(preview.id);
      expect(discovered.value.name).toBe(preview.name);
      expect(discovered.value.biome).toBe(preview.biome);
    }
  });

  it('uses configured thresholds for a weak signal and grants no production bonus', () => {
    const game = preparedGame();
    const result = game.dispatch('unlockKrios', { scores: [0.2, 0.3, 0.4] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.bonusMult).toBe(1);
    expect(game.snapshot().sonar.bonusMult).toBe(1);
  });
});
