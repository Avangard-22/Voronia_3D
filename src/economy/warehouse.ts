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
import { cargoWeight, PLANET_STORAGE_RESOURCES, type ResourceAmounts } from '../contracts/resources';
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

  /** Ey: масса ресурсов планетарного склада (Σ local stock × dn); глобальные ресурсы не занимают склад. */
  storedMass(): number {
    const snap = this.deps.ledger.snapshot();
    return PLANET_STORAGE_RESOURCES.reduce((mass, key) => mass + Math.max(0, snap[key] ?? 0) * cargoWeight(key), 0);
  }

  /** Остаток вместимости склада активной планеты. Избыточный старый запас не удаляется. */
  remainingCapacity(rt: PlanetRuntime): number {
    return Math.max(0, this.capacityFor(rt) - this.storedMass());
  }

  /** V1 Hf/Ey: ограничивает только поступление локальных ресурсов из производственного тика. */
  limitIncomeDelta(rt: PlanetRuntime | null, delta: ResourceAmounts): ResourceAmounts {
    if (!rt) return delta;
    let remaining = this.remainingCapacity(rt);
    const limited: ResourceAmounts = { ...delta };
    for (const key of PLANET_STORAGE_RESOURCES) {
      const requested = Math.max(0, delta[key] ?? 0);
      if (requested <= 0) continue;
      const weight = cargoWeight(key);
      const accepted = Math.min(requested, remaining / weight);
      limited[key] = accepted;
      remaining = Math.max(0, remaining - accepted * weight);
    }
    return limited;
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
