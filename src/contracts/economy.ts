/**
 * contracts/economy.ts — типы экономики (Этап 2): доход/цены/склад/жилы.
 * Все константы — из версионированного набора v0.0.41 (ADR-011) и runtime-фикстур, не из ТЗ.
 */
import type { ResourceAmounts } from './resources';

/** Постатейный доход (1.x n.*PerSec + planetIncome + energyByType). */
export interface IncomeSnapshot {
  readonly energyPerSec: number;
  readonly ironPerSec: number;
  readonly kriogenPerSec: number;
  readonly crystalsPerSec: number;
  readonly researchPerSec: number;
  readonly extraPerSec: Readonly<Record<string, number>>;
  readonly byPlanet: Readonly<Record<string, PlanetIncome>>;
}

export interface PlanetIncome {
  readonly energy: number;
  readonly iron: number;
  readonly kriogen: number;
  readonly crystals: number;
  readonly extra: Readonly<Record<string, number>>;
  readonly energyByType: Readonly<Record<number, number>>;
}

export const EMPTY_PLANET_INCOME: PlanetIncome = Object.freeze({ energy: 0, iron: 0, kriogen: 0, crystals: 0, extra: {}, energyByType: {} });

/** Именованные множители цепочки (ADR-014): каждый контекст — произведение именованных факторов. */
export interface MultiplierChain {
  readonly name: string;
  readonly factors: Readonly<Record<string, number>>;
  readonly total: number;
}

/** Цена апгрейда клетки (1.x zn(): energy — глобально, resources — склад планеты, global — research-подобные, compounds). */
export interface CellUpgradeCost {
  readonly energy: number;
  readonly resources: Readonly<ResourceAmounts>;
  readonly global: Readonly<ResourceAmounts>;
  readonly compounds: Readonly<ResourceAmounts>;
}

/** Цена скана: charge (списываемая энергия) и текущая база currentCost. */
export interface ScanPrice {
  readonly charge: number;
  readonly currentCost: number;
  readonly science: number;
}

/** Склад (1.x Vi/Gi/Td/Hf/Ey; fixtures/warehouse_curve_v0.0.41.json). */
export interface WarehouseCost {
  readonly alloy: number;
  readonly energy: number;
}

export interface WarehouseInfo {
  readonly level: number;
  readonly maxLevel: number;
  /** Vi: тонн на исследованную ячейку. */
  readonly tonsPerCell: number;
  /** Gi: множитель дохода 1+0.05L. */
  readonly bonusMult: number;
  /** Hf: вместимость планеты = explored × Vi × techMult. */
  readonly capacityFor: (pid: string) => number;
  /** Td: цена следующего уровня. */
  readonly nextCost: WarehouseCost | null;
}

/** Информация по жиле (1.x gt/ta/$n/$l/Xs; fixtures/veins_audit_v0.0.41.json). */
export interface VeinInfo {
  readonly cellId: number;
  readonly active: boolean;
  readonly reserve: number;
  readonly maxReserve: number;
  readonly depletePerSec: number;
  readonly cooldownUntil: number;
  readonly reactCount: number;
  readonly reactivationCost: number;
  readonly yieldMult: number;
  readonly unlockRequirement: string | null;
}

/** Таблица рукава галактики (1.x Df/Za/Lr; baseline galaxy.arms — fixtures/galaxy_arms_full.json). */
export interface ArmModifiers {
  readonly id: string;
  readonly name: string;
  readonly energy: number;
  readonly iron: number;
  readonly kriogen: number;
  readonly rare: number;
  readonly deplete: number;
  readonly scan: number;
  readonly event: number;
  readonly focus: Readonly<Record<string, number>>;
}
