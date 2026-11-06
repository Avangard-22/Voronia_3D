import { describe, expect, it } from 'vitest';
import type { CellView } from '../src/contracts/snapshot';
import { buildGeologicalSurvey } from '../src/planets/geologicalSurvey';

const cell = (overrides: Partial<CellView>): CellView => ({
  id: 1, type: 3, status: 'explored', geologicalReward: null, geology: null,
  neighbors: [], level: 1, yield: 0, reserve: 0, maxReserve: 0,
  depletionPerSec: 0, reserveLifetimeSeconds: null, cooldownUntil: 0,
  reactCount: 0, anomalyType: null, mutant: null, isDeep: false,
  chargeCooldownUntil: 0, chargedEver: false, miningOperations: null, ...overrides,
});

describe('Stage 10.0.7 geological survey', () => {
  it('aggregates scanned ore deposits by stratum and quality', () => {
    const survey = buildGeologicalSurvey([
      cell({ reserve: 40, maxReserve: 100, geology: { depth: 'deep', depthMeters: 1800, oreQuality: 'high-grade', qualityPct: 75, stratum: 'mantle', layerIndex: 2 } }),
      cell({ id: 2, type: 5, reserve: 0, maxReserve: 80, geology: { depth: 'surface', depthMeters: 200, oreQuality: 'common', qualityPct: 45, stratum: 'regolith', layerIndex: 0 } }),
      cell({ id: 3, status: 'revealed', geology: null }),
      cell({ id: 4, type: 0, geology: null }),
    ]);
    expect(survey.depositsScanned).toBe(2);
    expect(survey.activeDeposits).toBe(1);
    expect(survey.reserve).toBe(40);
    expect(survey.capacity).toBe(180);
    expect(survey.byStratum.mantle).toBe(1);
    expect(survey.byStratum.regolith).toBe(1);
    expect(survey.byQuality['high-grade']).toBe(1);
    expect(survey.byQuality.common).toBe(1);
  });

  it('returns an empty survey when no scanned ore deposits exist', () => {
    const survey = buildGeologicalSurvey([cell({ status: 'hidden', type: -1, geology: null })]);
    expect(survey.depositsScanned).toBe(0);
    expect(survey.activeDeposits).toBe(0);
    expect(survey.reserve).toBe(0);
    expect(survey.capacity).toBe(0);
  });
});
