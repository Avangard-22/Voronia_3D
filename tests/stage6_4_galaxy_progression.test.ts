import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { galaxyProgressionStatus } from '../src/galaxy/exploration';

describe('Stage 6.4 — Galaxy Progression', () => {
  it('unlocks expedition licenses only when every requirement is met', () => {
    const early = galaxyProgressionStatus({ discoveredWorlds: 1, discoveredArms: 1, discoveredSectors: 1, research: 100_000 });
    expect(early.completed).toBe(0);
    expect(early.discountPct).toBe(0);
    const first = galaxyProgressionStatus({ discoveredWorlds: 2, discoveredArms: 1, discoveredSectors: 1, research: 0 });
    expect(first.stages[0]?.unlocked).toBe(true);
    expect(first.discountPct).toBe(3);
    expect(first.stages[1]?.unlocked).toBe(false);
  });

  it('uses the highest completed license and never stacks discounts', () => {
    const status = galaxyProgressionStatus({ discoveredWorlds: 8, discoveredArms: 3, discoveredSectors: 3, research: 5_000 });
    expect(status.completed).toBe(3);
    expect(status.discountPct).toBe(10);
    expect(status.nextStage?.id).toBe('deep-space');
  });

  it('exposes progression in the live game snapshot', () => {
    const snapshot = new Game({ rngSeed: 654321 }).snapshot();
    expect(snapshot.galaxy.progression.total).toBe(4);
    expect(snapshot.galaxy.progression.completed).toBe(0);
    expect(snapshot.galaxy.progression.stages.map((stage) => stage.id)).toEqual(['first-contact', 'cartographer', 'pioneer', 'deep-space']);
  });
});
