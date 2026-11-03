/**
 * Склад (fixtures/warehouse_curve_v0.0.41.json): Td {alloy (L+1)², energy ceil(800×1.6^L)},
 * Vi = 10+5L, Gi = 1+0.05L, Hf = explored×Vi; атомарность alloy+energy, кап 10.
 */
import { describe, it, expect } from 'vitest';
import { makeGame, grant, fixture } from './helpers';

interface WhRow {
  L: number;
  Td: { alloy: number; energy: number };
  Vi: number;
  Gi: number;
  Hf_ferrum: number;
}

describe('склад: кривые (registry + fixtures)', () => {
  const fx = fixture<{ rows: WhRow[] }>('warehouse_curve_v0.0.41.json');
  const { game } = makeGame(5);

  it('Td/Vi/Gi/Hf совпадают с фикстурой для L0..L9', () => {
    const rt = game.runtime('ferrum')!;
    for (const row of fx.rows) {
      game.warehouse.setLevel(row.L);
      const cost = game.warehouse.nextCost();
      if (row.L >= game.warehouse.maxLevel()) {
        expect(cost).toBeNull();
        continue;
      }
      expect(cost, `L${row.L}`).not.toBeNull();
      expect(cost!.alloy, `alloy L${row.L}`).toBe(row.Td.alloy);
      expect(cost!.energy, `energy L${row.L}`).toBe(row.Td.energy);
      expect(game.warehouse.tonsPerCell(), `Vi L${row.L}`).toBe(row.Vi);
      expect(game.warehouse.bonusMult(), `Gi L${row.L}`).toBeCloseTo(row.Gi, 12);
      expect(game.warehouse.capacityFor(rt), `Hf L${row.L}`).toBe(row.Hf_ferrum);
    }
  });

  it('energy-цена — float-ceil parity: 800×1.6² = 2048.0000000000002 → 2049', () => {
    game.warehouse.setLevel(2);
    expect(game.warehouse.nextCost()!.energy).toBe(2049);
  });
});

describe('склад: upgrade()', () => {
  it('успех: списание alloy+energy ОДНОЙ транзакцией, level++, событие', () => {
    const { game } = makeGame(5);
    grant(game, { alloy: 10, energy: 5000 });
    const events: number[] = [];
    game.bus.on('warehouse:upgraded', (p) => events.push(p.level));
    const res = game.dispatch('upgradeWarehouse', {});
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toMatchObject({ level: 1, cost: { alloy: 1, energy: 800 } });
    expect(game.ledger.balance('alloy')).toBe(9);
    expect(game.ledger.balance('energy')).toBe(4200);
    expect(events).toEqual([1]);
    expect(game.session().warehouseUpgrades).toBe(1);
    expect(game.warehouse.bonusMult()).toBeCloseTo(1.05, 12);
  });

  it('атомарность (GS-05): не хватает alloy → energy не списан, уровень не растёт', () => {
    const { game } = makeGame(5);
    grant(game, { energy: 5000 }); // alloy 0
    const res = game.dispatch('upgradeWarehouse', {});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('cost');
    expect(game.ledger.balance('energy')).toBe(5000);
    expect(game.warehouse.getLevel()).toBe(0);
  });

  it('кап 10 → "max"', () => {
    const { game } = makeGame(5);
    grant(game, { alloy: 1e6, energy: 1e9 });
    game.warehouse.setLevel(10);
    const res = game.dispatch('upgradeWarehouse', {});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('max');
    expect(game.warehouse.nextCost()).toBeNull();
  });

  it('Ey: storedMass = Σ баланс×грузовой вес (iron 1, carbon 3, uranium 7, darkMatter 25; энергия не транспортабельна)', () => {
    const { game } = makeGame(5);
    grant(game, { iron: 100, carbon: 10, uranium: 2, darkMatter: 1, energy: 5000 });
    expect(game.warehouse.storedMass()).toBe(100 * 1 + 10 * 3 + 2 * 7 + 1 * 25);
  });

  it('полная лестница L0→L10: суммарные затраты = Σ Td', () => {
    const { game } = makeGame(5);
    grant(game, { alloy: 1e6, energy: 1e9 });
    let alloySpent = 0;
    let energySpent = 0;
    for (let L = 0; L < 10; L++) {
      const res = game.dispatch('upgradeWarehouse', {});
      expect(res.ok).toBe(true);
      if (!res.ok) break;
      alloySpent += res.value.cost.alloy;
      energySpent += res.value.cost.energy;
    }
    expect(game.warehouse.getLevel()).toBe(10);
    expect(alloySpent).toBe(1 + 4 + 9 + 16 + 25 + 36 + 49 + 64 + 81 + 100); // 385
    expect(energySpent).toBe(800 + 1280 + 2049 + 3277 + 5243 + 8389 + 13422 + 21475 + 34360 + 54976);
  });
});
