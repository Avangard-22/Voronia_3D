/**
 * economy/warehouse.ts — WarehouseService (1.x Vi/Gi/Td/Hf/Ey; fixtures/warehouse_curve_v0.0.41.json).
 * Vi(L) = baseTons(10) + L×tonsPerLevel(5); Gi(L) = 1+L×bonusPerLevel(0.05);
 * Td(L→L+1) = { alloy: ceil(alloyCostFactor×(L+1)²/2 × ov), energy: ceil(energyCostBase×energyCostGrowth^L × ov) },
 * ov = 1 (eso-перк склада 0.85 — Этап 10); parity: alloy 1/4/9/16, energy 800/1280/2049/3277 (float ceil!).
 * upgrade() — атомарная транзакция {alloy, energy} (GS-05-принцип), кап registry warehouse.upgradeMax(10).
 */
import type { ActionResult, WarehouseUpgradeResult } from '../contracts/commands';
import { fail, ok } from '../contracts/commands';
import type { WarehouseCost, WarehouseInfo } from '../contracts/economy';
import { cargoWeight, type LedgerResourceKey } from '../contracts/resources';
import type { BalanceConfig } from '../config/types';
import type { EventPort, LedgerPort } from '../contracts/ports';
import type { PlanetRuntime } from '../contracts/planets';

export interface WarehouseDeps {
  readonly balance: BalanceConfig;
  readonly ledger: LedgerPort;
  readonly bus: EventPort;
  readonly gameMs: () => number;
  readonly sessionBump: (key: 'warehouseUpgrades') => void;
  /** eso-перк (Этап 10): ov = 0.85 при покупке; по умолчанию 1. */
  readonly costOverrideMult?: () => number;
}

export class WarehouseService {
  private level = 0;

  constructor(private readonly deps: WarehouseDeps) {}

  getLevel(): number {
    return this.level;
  }

  maxLevel(): number {
    return this.deps.balance.registry.warehouse.upgradeMax;
  }

  /** Vi: тонн на исследованную клетку. */
  tonsPerCell(): number {
    const w = this.deps.balance.registry.warehouse;
    return w.baseTons + this.level * w.tonsPerLevel;
  }

  /** Gi: множитель дохода. */
  bonusMult(): number {
    return 1 + this.level * this.deps.balance.registry.warehouse.bonusPerLevel;
  }

  /** Td: цена следующего уровня (null — на капе). */
  nextCost(): WarehouseCost | null {
    if (this.level >= this.maxLevel()) return null;
    const w = this.deps.balance.registry.warehouse;
    const ov = this.deps.costOverrideMult ? this.deps.costOverrideMult() : 1;
    return {
      alloy: Math.ceil((w.alloyCostFactor * Math.pow(this.level + 1, 2)) / 2 * ov),
      energy: Math.ceil(w.energyCostBase * Math.pow(w.energyCostGrowth, this.level) * ov),
    };
  }

  /** Hf: вместимость планеты = explored × Vi × techMult (хук mt=1 в срезе). */
  capacityFor(rt: PlanetRuntime): number {
    return rt.explored.size * this.tonsPerCell();
  }

  /** Ey: масса хранимого (Σ баланс × грузовой вес dn). */
  storedMass(): number {
    let m = 0;
    const snap = this.deps.ledger.snapshot();
    for (const [k, v] of Object.entries(snap)) {
      const w = cargoWeight(k as LedgerResourceKey);
      if (Number.isFinite(w)) m += (v ?? 0) * w;
    }
    return m;
  }

  info(rts: readonly PlanetRuntime[]): WarehouseInfo {
    const capacityFor = (pid: string): number => {
      const rt = rts.find((r) => r.data.id === pid);
      return rt ? this.capacityFor(rt) : 0;
    };
    return {
      level: this.level,
      maxLevel: this.maxLevel(),
      tonsPerCell: this.tonsPerCell(),
      bonusMult: this.bonusMult(),
      capacityFor,
      nextCost: this.nextCost(),
    };
  }

  upgrade(): ActionResult<WarehouseUpgradeResult> {
    const cost = this.nextCost();
    if (!cost) return fail('max', `warehouse cap ${this.maxLevel()}`);
    const commit = this.deps.ledger.tryCommit({
      reason: 'warehouse:upgrade',
      scope: 'global',
      delta: { alloy: -cost.alloy, energy: -cost.energy },
      gameMs: this.deps.gameMs(),
    });
    if (!commit.ok) return fail(commit.insufficient.includes('energy') && commit.insufficient.length === 1 ? 'energy' : 'cost', commit.insufficient.join(','));
    this.level += 1;
    this.deps.sessionBump('warehouseUpgrades');
    this.deps.bus.emit('warehouse:upgraded', { level: this.level });
    return ok({ level: this.level, cost });
  }

  setLevel(v: number): void {
    this.level = Math.max(0, Math.min(this.maxLevel(), Math.floor(v)));
  }
}
