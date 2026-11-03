/**
 * GS-01 (старт) + GS-02 (стартовое исследование).
 * GS-01: ресурсы 0 (t=0), currentCost 10, MAX_LEVEL 100, warehouseLevel 0, energyPerSec 1 (cell0 type0 L0 → Ur=1).
 * GS-02: explored=[0], revealed=[0,2,1,3,6,7] — порядок вставки (self, затем соседи в порядке списка).
 */
import { describe, it, expect } from 'vitest';
import { makeGame, fixture } from './helpers';

describe('GS-01: старт-нули', () => {
  const { game } = makeGame(12345);
  const snap = game.snapshot();

  it('все ресурсы 0 в момент t=0', () => {
    for (const [k, v] of Object.entries(snap.resources)) expect(v, k).toBe(0);
  });

  it('currentCost 10, warehouseLevel 0, MAX_LEVEL 100', () => {
    expect(snap.scan.currentCost).toBe(10);
    expect(snap.warehouse.level).toBe(0);
    expect(game.balance.baseline.upgrade.maxLevel).toBe(100);
    const fx = fixture<{ snapshot: { currentCost: number; MAX_LEVEL: number; warehouseLevel: number } }>('gs01_fresh_state.json');
    expect(snap.scan.currentCost).toBe(fx.snapshot.currentCost);
    expect(snap.warehouse.maxLevel).toBe(10);
    expect(snap.warehouse.level).toBe(fx.snapshot.warehouseLevel);
  });

  it('energyPerSec = 1 (cell0 исследована, type0 L0 → (1+0)×1)', () => {
    expect(snap.perSec.energy).toBe(1);
    expect(snap.perSec.iron).toBe(0);
    expect(snap.perSec.research).toBeCloseTo(0.001, 12);
    const fx = fixture<{ snapshot: { energyPerSec: number } }>('gs01_fresh_state.json');
    expect(snap.perSec.energy).toBe(fx.snapshot.energyPerSec);
  });

  it('активная планета ferrum, unlocked [ferrum]', () => {
    expect(snap.activePlanetId).toBe('ferrum');
    expect(snap.unlockedPlanets).toEqual(['ferrum']);
  });

  it('seed детерминирован: newGame с явным seed → gameStartSeed = seed', () => {
    expect(game.gameStartSeed()).toBe(12345);
  });
});

describe('GS-02: стартовое исследование', () => {
  const { game } = makeGame();
  const rt = game.runtime('ferrum')!;

  it('explored = [0]', () => {
    expect([...rt.explored]).toEqual([0]);
  });

  it('revealed = [0,2,1,3,6,7] — порядок вставки (parity 1.x Set)', () => {
    expect([...rt.revealed]).toEqual([0, 2, 1, 3, 6, 7]);
    const fx = fixture<{ snapshot: Record<string, unknown> }>('gs01_fresh_state.json');
    void fx;
  });

  it('cell0: type0, yield = 1 (initStart), level 0', () => {
    const st = rt.cellStates.get(0)!;
    expect(st.level).toBe(0);
    expect(st.yield).toBe(1);
  });

  it('жилы не активированы до скана (ironYield 0)', () => {
    expect(rt.cellStates.get(1)!.ironYield).toBe(0);
    expect(rt.cellStates.get(1)!.reserve).toBe(126);
  });
});
