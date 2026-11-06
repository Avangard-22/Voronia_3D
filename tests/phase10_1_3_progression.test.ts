import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import baseline from '../fixtures/stage5_audit_v0.0.41.json';

describe('Phase 10.1.3 — V1 progression, sonar and planet unlock parity', () => {
  function fullyExploreFerrum(seed = 15929600): Game {
    const game = new Game({ rngSeed: seed });
    const ferrum = game.runtime('ferrum')!;
    for (const cell of ferrum.data.cells) ferrum.explored.add(cell.id);
    game.dispatch('grant', { delta: { energy: 5_000_000 }, reason: 'phase10.1.3-test-fuel' });
    return game;
  }

  it('preserves the V1 first discovery index, reward and active-planet behavior', () => {
    const game = new Game({ rngSeed: 15929600 });
    const before = game.ledger.balance('research');
    const opened = game.dispatch('discoverPlanet', { seed: 777001 });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.value.id).toBe('planet_03');
    expect(opened.value.index).toBe(3);
    expect(opened.value.researchReward).toBe(baseline.discover.afterFirst.researchDelta);
    expect(game.ledger.balance('research') - before).toBe(1100);
    expect(game.snapshot().unlockedPlanets).toEqual(['ferrum', 'planet_03']);
    expect(game.snapshot().activePlanetId).toBe('ferrum');
  });

  it('keeps the V1 discovery reward curve for consecutive planets', () => {
    const game = new Game({ rngSeed: 15929600 });
    const first = game.dispatch('discoverPlanet', { seed: 777001 });
    const second = game.dispatch('discoverPlanet', { seed: 888002 });
    expect(first.ok && first.value.researchReward).toBe(1100);
    expect(second.ok && second.value.id).toBe('planet_04');
    expect(second.ok && second.value.researchReward).toBe(2420);
  });

  it('requires full Ferrum exploration and the configured three-round sonar before Krios unlock', () => {
    const game = new Game({ rngSeed: 15929600 });
    const blocked = game.dispatch('unlockKrios', { scores: [0.95, 0.95, 0.95] });
    expect(blocked).toMatchObject({ ok: false, reason: 'state' });
    expect(game.snapshot().unlockedPlanets).not.toContain('krios');

    const ready = fullyExploreFerrum();
    const beforeEnergy = ready.ledger.balance('energy');
    const unlocked = ready.dispatch('unlockKrios', { scores: [0.95, 0.95, 0.95] });
    expect(unlocked.ok).toBe(true);
    expect(ready.snapshot().unlockedPlanets).toContain('krios');
    expect(ready.ledger.balance('energy')).toBe(beforeEnergy - ready.balance.registry.sonar.hintEnergy);
    expect(ready.snapshot().activePlanetId).toBe('ferrum');
  });

  it('rejects invalid sonar rounds atomically and preserves the unlocked-planet list', () => {
    const game = fullyExploreFerrum();
    const before = game.ledger.balance('energy');
    const result = game.dispatch('unlockKrios', { scores: [0.9, 1.01, 0.8] });
    expect(result).toMatchObject({ ok: false });
    expect(game.ledger.balance('energy')).toBe(before);
    expect(game.snapshot().unlockedPlanets).toEqual(['ferrum']);
  });


  it('keeps discovery pricing local to the system without galaxy-sector discounts', () => {
    const game = fullyExploreFerrum();
    expect(game.dispatch('unlockKrios', { scores: [0.95, 0.95, 0.95] }).ok).toBe(true);
    const status = game.snapshot().sonar;
    const expectedBase = Math.ceil(game.balance.registry.sonar.hintEnergy * Math.pow(1, 1.35));
    expect(status.discoveryCost).toBe(expectedBase);
    expect(status.anomalyGate.requiredArms).toBe(1);
    expect(status.anomalyGate.discoveredArms).toBe(1);
  });

  it('persists sonar unlock, charge count and active planet across save/load', () => {
    const game = fullyExploreFerrum();
    expect(game.dispatch('unlockKrios', { scores: [0.95, 0.95, 0.95] }).ok).toBe(true);
    game.addSonarCharge();
    const restored = new Game({ rngSeed: 15929600 });
    restored.applyState(game.collectState());
    expect(restored.snapshot().unlockedPlanets).toContain('krios');
    expect(restored.sonarCharges()).toBe(game.sonarCharges());
    expect(restored.snapshot().activePlanetId).toBe('ferrum');
  });
});
