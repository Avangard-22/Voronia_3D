import { describe, it, expect } from 'vitest';
import { makeGame, grant } from './helpers';

describe('Stage C — reactor v39 slots', () => {
  it('buys one additional slot atomically and exposes the next price', () => {
    const { game } = makeGame();
    grant(game, { energy: 5_000_000, iron: 400_000, kriogen: 150_000, crystals: 800, steel: 300 });
    expect(game.snapshot().reactor.slots).toBe(1);
    const result = game.dispatch('craftBuySlot', {});
    expect(result.ok).toBe(true);
    expect(game.snapshot().reactor.slots).toBe(2);
    expect(game.snapshot().reactor.purchasedSlots).toBe(1);
    expect(game.ledger.journal().some(tx => tx.reason === 'reactor:slot')).toBe(true);
  });
  it('persists purchased slots and treats missing legacy field as zero', () => {
    const { game } = makeGame();
    grant(game, { energy: 5_000_000, iron: 400_000, kriogen: 150_000, crystals: 800, steel: 300 });
    expect(game.dispatch('craftBuySlot', {}).ok).toBe(true);
    const saved = game.reactor.serialize();
    game.reactor.hydrate(undefined);
    expect(game.snapshot().reactor.slots).toBe(1);
    game.reactor.hydrate(saved);
    expect(game.snapshot().reactor.slots).toBe(2);
    game.reactor.hydrate({ jobs: [], nextJobId: 1 });
    expect(game.snapshot().reactor.slots).toBe(1);
  });
  it('rejects purchase when resources are insufficient', () => {
    const { game } = makeGame();
    const result = game.dispatch('craftBuySlot', {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('cost');
    expect(game.snapshot().reactor.slots).toBe(1);
  });
});
