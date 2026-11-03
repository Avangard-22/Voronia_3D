import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';

describe('Stage 6.1 — Sonar Expansion', () => {
  function ready(seed = 15929600): Game {
    const game = new Game({ rngSeed: seed });
    const ferrum = game.runtime('ferrum')!;
    for (const cell of ferrum.data.cells) ferrum.explored.add(cell.id);
    game.dispatch('grant', { delta: { energy: 2_000_000 }, reason: 'stage6.1-test-fuel' });
    expect(game.dispatch('unlockKrios', { scores: [0.95, 0.95, 0.95] }).ok).toBe(true);
    return game;
  }

  it('requires sonar charge and escalating energy to open the next world', () => {
    const game = ready();
    const economy = game.snapshot().sonar;
    expect(economy.discoveryCost).toBeGreaterThan(0);
    expect(economy.discoveryCharges).toBeGreaterThanOrEqual(1);
    const blocked = game.dispatch('discoverPlanet', {});
    expect(blocked).toMatchObject({ ok: false, reason: 'cost' });
    expect(game.snapshot().unlockedPlanets).not.toContain(economy.nextPreview?.id);
    game.addSonarCharge();
    const beforeEnergy = game.ledger.balance('energy');
    const beforeCharges = game.sonarCharges();
    const opened = game.dispatch('discoverPlanet', {});
    expect(opened.ok).toBe(true);
    expect(game.ledger.balance('energy')).toBe(beforeEnergy - economy.discoveryCost);
    expect(game.sonarCharges()).toBe(beforeCharges - economy.discoveryCharges);
  });

  it('rerolls only the pending signal, spends one charge and configured energy, then persists reroll state', () => {
    const game = ready(424242);
    game.addSonarCharge();
    const before = game.nextDiscoveryPreview()!;
    const status = game.snapshot().sonar;
    const energy = game.ledger.balance('energy');
    const charges = game.sonarCharges();
    const reroll = game.dispatch('rerollDiscovery', {});
    expect(reroll.ok).toBe(true);
    if (!reroll.ok) return;
    expect(reroll.value.preview.seed).not.toBe(before.seed);
    expect(game.ledger.balance('energy')).toBe(energy - status.rerollCost);
    expect(game.sonarCharges()).toBe(charges - 1);
    expect(game.snapshot().sonar.rerolls).toBe(1);
    const save = game.collectState();
    const restored = new Game({ rngSeed: 424242 });
    restored.applyState(save);
    expect(restored.snapshot().sonar.rerolls).toBe(1);
    expect(restored.nextDiscoveryPreview()?.seed).toBe(reroll.value.preview.seed);
  });

  it('rejects reroll without charge or after the configured reroll limit', () => {
    const game = ready();
    expect(game.dispatch('rerollDiscovery', {})).toMatchObject({ ok: false, reason: 'cost' });
    for (let i = 0; i < game.balance.registry.sonar.rerollMax; i++) {
      game.addSonarCharge();
      const cost = game.snapshot().sonar.rerollCost;
      if (game.ledger.balance('energy') < cost) game.dispatch('grant', { delta: { energy: 1_000_000 }, reason: 'refill' });
      expect(game.dispatch('rerollDiscovery', {}).ok).toBe(true);
    }
    expect(game.dispatch('rerollDiscovery', {})).toMatchObject({ ok: false, reason: 'max' });
  });

  it('charges are capped and persisted within configured limits', () => {
    const game = ready();
    for (let i = 0; i < game.balance.registry.sonar.chargeMax + 2; i++) game.addSonarCharge();
    expect(game.sonarCharges()).toBe(game.balance.registry.sonar.chargeMax);
    const restored = new Game({ rngSeed: 15929600 });
    restored.applyState(game.collectState());
    expect(restored.sonarCharges()).toBe(game.balance.registry.sonar.chargeMax);
  });
});
