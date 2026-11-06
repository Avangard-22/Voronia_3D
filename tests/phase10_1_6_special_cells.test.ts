import { describe, expect, it } from 'vitest';
import { migrateLegacyV39 } from '../src/persistence/schema';
import { fixture, makeGame } from './helpers';

describe('Phase 10.1.6 — V1 special-cell state parity', () => {
  it('migrates anomaly branch and V1 manual/surge timestamps onto the V2 game clock', () => {
    const legacy = structuredClone(fixture<Record<string, unknown>>('golden_save_midgame_v0.0.41.json')) as Record<string, unknown>;
    const savedAt = 1_800_000_000_000;
    legacy['timestamp'] = savedAt;
    const planets = legacy['planets'] as Record<string, Record<string, unknown>>;
    const ferrum = planets['ferrum']!;
    ferrum['cellStates'] = [{
      id: 4,
      level: 2,
      anomalyType: 'power',
      _chargedAt: savedAt - 5_000,
      _chargedEver: true,
      _chargeCooldown: savedAt + 25_000,
      _v039SurgeNextAt: savedAt + 60_000,
      _v039SurgeUntil: savedAt + 10_000,
    }];

    const migrated = migrateLegacyV39(legacy);
    expect(migrated.planets['ferrum']!.cellStates[0]).toMatchObject({
      id: 4,
      anomalyType: 'power',
      chargedAt: 0,
      chargedEver: true,
      chargeCooldownUntil: 25_000,
      surgeNextAt: 60_000,
      surgeUntil: 10_000,
    });
  });

  it('leaves an unscheduled surge timer undefined when V1 had no timer field', () => {
    const legacy = structuredClone(fixture<Record<string, unknown>>('golden_save_midgame_v0.0.41.json')) as Record<string, unknown>;
    const planets = legacy['planets'] as Record<string, Record<string, unknown>>;
    planets['ferrum']!['cellStates'] = [{ id: 4, _chargedEver: false }];
    const migrated = migrateLegacyV39(legacy);
    expect(migrated.planets['ferrum']!.cellStates[0]!.surgeNextAt).toBeUndefined();
  });

  it('does not resurrect expired V1 charge or surge deadlines', () => {
    const legacy = structuredClone(fixture<Record<string, unknown>>('golden_save_midgame_v0.0.41.json')) as Record<string, unknown>;
    const savedAt = 1_800_000_000_000;
    legacy['timestamp'] = savedAt;
    const planets = legacy['planets'] as Record<string, Record<string, unknown>>;
    planets['ferrum']!['cellStates'] = [{
      id: 4,
      _chargeCooldown: savedAt - 1,
      _v039SurgeNextAt: savedAt - 1,
      _v039SurgeUntil: savedAt - 1,
      _chargedEver: true,
    }];
    const migrated = migrateLegacyV39(legacy);
    expect(migrated.planets['ferrum']!.cellStates[0]).toMatchObject({
      chargeCooldownUntil: 0,
      surgeNextAt: 0,
      surgeUntil: 0,
      chargedEver: true,
    });
  });

  it('preserves special-cell state through a native V2 save/load roundtrip', () => {
    const { game } = makeGame(1016);
    const rt = game.runtime('ferrum')!;
    const anomaly = rt.data.cells.find((cell) => cell.type === 4)!;
    const charged = rt.data.cells.find((cell) => cell.type === 1)!;
    rt.explored.add(anomaly.id);
    rt.explored.add(charged.id);
    rt.cellStates.get(anomaly.id)!.anomalyType = 'resonance';
    Object.assign(rt.cellStates.get(charged.id)!, {
      chargedEver: true,
      chargedAt: 1_000,
      chargeCooldownUntil: 45_000,
      surgeNextAt: 90_000,
      surgeUntil: 20_000,
    });
    const payload = game.dispatch('exportSave', {});
    expect(payload.ok).toBe(true);
    if (!payload.ok) return;
    const { game: restored } = makeGame(1);
    const imported = restored.dispatch('importSave', { payload: payload.value.payload });
    expect(imported.ok).toBe(true);
    const restoredRt = restored.runtime('ferrum')!;
    expect(restoredRt.cellStates.get(anomaly.id)!.anomalyType).toBe('resonance');
    expect(restoredRt.cellStates.get(charged.id)).toMatchObject({
      chargedEver: true,
      chargedAt: 1_000,
      chargeCooldownUntil: 45_000,
      surgeNextAt: 90_000,
      surgeUntil: 20_000,
    });
  });
});
