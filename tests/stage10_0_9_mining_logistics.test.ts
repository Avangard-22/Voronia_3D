import { describe, expect, it } from 'vitest';
import { buildMiningLogistics } from '../src/planets/miningLogistics';
import type { CellView } from '../src/contracts/snapshot';

function deposit(id: number, quality: 'common' | 'enriched' | 'high-grade' | 'exceptional', reserve: number, depletion: number, cooldownUntil = 0): CellView {
  return {
    id, type: 3, status: 'explored', geologicalReward: null,
    geology: { depth: 'deep', depthMeters: 2200, oreQuality: quality, qualityPct: 80, stratum: 'mantle', layerIndex: 2 },
    neighbors: [], level: 1, yield: 1, reserve, maxReserve: 100, depletionPerSec: depletion,
    reserveLifetimeSeconds: depletion > 0 ? reserve / depletion : null,
    miningOperations: { active: depletion > 0, totalMultiplier: 1, factors: [], recommendation: '' },
    cooldownUntil, reactCount: 0, anomalyType: null, mutant: null, isDeep: true, chargeCooldownUntil: 0, chargedEver: false,
  };
}

describe('Stage 10.0.9 — mining logistics', () => {
  it('ranks higher-grade deposits above common deposits and allocates active capacity', () => {
    const plan = buildMiningLogistics([deposit(1, 'common', 80, 2), deposit(2, 'exceptional', 80, 2)]);
    expect(plan.entries[0].cellId).toBe(2);
    expect(plan.active).toBe(2);
    expect(plan.fleetAllocationPct).toBe(100);
    expect(plan.entries.reduce((sum, entry) => sum + entry.allocationPct, 0)).toBe(100);
  });
  it('does not allocate capacity to depleted or cooling deposits', () => {
    const plan = buildMiningLogistics([deposit(1, 'high-grade', 0, 0), deposit(2, 'enriched', 50, 0, 5000)], 1000);
    expect(plan.active).toBe(0);
    expect(plan.fleetAllocationPct).toBe(0);
    expect(Object.fromEntries(plan.entries.map((entry) => [entry.cellId, entry.status]))).toEqual({ 1: 'depleted', 2: 'cooldown' });
  });
});
