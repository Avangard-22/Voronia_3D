/**
 * config/types.ts — типизированное подмножество реестра v0.0.41 (37 секций; используются срезами Этапов 1–3).
 * Полный JSON — data/balance/v0.0.41/registry.json (копия window.VORONIA_BALANCE после слоя override-v41 + offline-v24).
 */
import type { GalaxyGenConfig, NodeRenderConfig } from '../contracts/galaxy';

export interface RegistryCellsSection {
  readonly curveGrowth: number;
  readonly curveGrowthCap: number;
  readonly curveGrowthAfterCap: number;
  readonly deepLevelThreshold: number;
  readonly upgradeCurve: readonly UpgradeCurveEntry[];
  readonly deepUpgradeCurve: readonly UpgradeCurveEntry[];
  readonly hardcore: {
    readonly fromLevel: number;
    readonly compounds: Readonly<Record<string, { readonly from: number; readonly base: number; readonly growth: number; readonly cap: number; readonly research?: string }>>;
  };
  readonly levelRewards: readonly (null | { readonly key: string; readonly amount: number })[];
  readonly researchMaxLevel: number;
  readonly researchPerLevel: number;
  readonly researchPerLevelGrowth: number;
  readonly researchCellCost: {
    readonly energyBase: number;
    readonly energyGrowth: number;
    readonly crystalsBase: number;
    readonly crystalsGrowth: number;
    readonly researchBase: number;
    readonly researchGrowth: number;
    readonly siliconFromLevel: number;
    readonly siliconBase: number;
    readonly siliconGrowth: number;
  };
  readonly veinYieldGrowth: number;
  readonly veinReserveGrowth: number;
  readonly reactCooldownBaseMs: number;
  readonly reactCooldownPerCntMs: number;
  readonly reactCooldownMaxMs: number;
  readonly reactCooldownCntCap: number;
  readonly typePriority?: Readonly<Record<string, number>>;
  readonly researchCostFromLevel?: number;
  readonly researchCostBase?: number;
  readonly researchCostGrowth?: number;
  readonly recycleEnergyMult?: number;
  readonly resourceWeights?: Readonly<Record<string, number>>;
}

export interface RegistryTechSection {
  /** Этап 9.3: таблицы стоимостей многоуровневых технологий v1 (techId → строки уровней). */
  readonly costScaleTable: Readonly<Record<string, readonly Readonly<Record<string, number>>[]>>;
  readonly costScaleCurve: { readonly costScale: readonly number[] };
  readonly costCurveLate: { readonly tableDepth: number; readonly lastRow: number; readonly expFrom: number; readonly lateGrowth: number };
  readonly maxLevel?: number;
}

export interface RegistryWarehouseSection {
  readonly alloyCostFactor: number;
  readonly baseTons: number;
  readonly bonusPerLevel: number;
  readonly energyCostBase: number;
  readonly energyCostGrowth: number;
  readonly tonsPerLevel: number;
  readonly upgradeMax: number;
}

export interface RegistryCoreSection {
  readonly baseYield: number;
  readonly crystalRate: number;
  readonly reactivate: { readonly max: number; readonly step: number };
  readonly buildCost: { readonly energy: number; readonly crystals: number };
}

export interface RegistryEcoSection {
  readonly deficit: { readonly start: number; readonly offset: number; readonly step: number; readonly minMult: number };
  readonly deplete: { readonly start: number; readonly offset: number; readonly step: number; readonly maxMult: number };
  readonly scan: { readonly start: number; readonly step: number; readonly curve: number };
}

export interface RegistryPlanetSection {
  readonly biomeMults: Readonly<Record<string, { readonly mult: number }>>;
  readonly geometryTuning: Readonly<Record<string, { readonly weight?: number; readonly minFrequency?: number; readonly maxFrequency?: number }>>;
  readonly hiddenWorldIndex: number;
  readonly specialCellChance: number;
  readonly tierThresholds: readonly number[];
  readonly uniqueChance: number;
  readonly mutants: Readonly<Record<string, { readonly id: string; readonly name: string; readonly yieldMult: number; readonly depletionMult: number; readonly color: string }>>;
  readonly resourceDist: {
    readonly ironWeight: number;
    readonly kriogenWeight: number;
    readonly focusBonus: number;
    readonly depthPenalty: number;
    readonly depthScale: number;
    readonly slots: readonly (readonly [number, number])[];
    readonly extraSlotPct: number;
    readonly extraSlotDepthPct: number;
    readonly extraSlotMax: number;
    readonly slotFillPct: number;
    readonly uniqueBonus: number;
    readonly maxSlots: number;
    readonly barrenChance: number;
    readonly barrenMinIndex: number;
  };
  readonly lastVoronia: {
    readonly index: number;
    readonly resources: readonly string[];
    readonly cost: { readonly e: number; readonly i: number; readonly k: number };
    readonly armName: string;
    readonly armColor: string;
  };
}

export interface RegistryOfflineSection {
  readonly maxSeconds: number;
  readonly efficiency: number;
  readonly minSeconds: number;
}

export interface RegistryGalaxySection {
  readonly arms: { readonly arms: number; readonly b: number; readonly r0: number; readonly width: number };
  readonly gen: GalaxyGenConfig;
  readonly nodeRender: NodeRenderConfig;
  readonly mapCam?: Record<string, unknown>;
}

/** Оверлей событий (1.x y2(): events.polarityWeights поверх таблицы Qa). */
export interface RegistryEventsSection {
  readonly polarityWeights: Readonly<Record<string, { readonly polarity: string; readonly weight: number }>>;
}

/** Роли планет (1.x kt=BALC("roles.defs"); назначение роли — механика transport/UI поздних этапов). */
export interface RoleDef {
  readonly id: string;
  readonly icon: string;
  readonly name: string;
  readonly color: string;
  readonly desc: string;
  readonly mult: Readonly<Record<string, number>>;
  readonly fleet: { readonly cap: number; readonly speed: number };
  readonly cost: { readonly e: number; readonly i: number; readonly materials: Readonly<Record<string, number>> };
}

export interface RegistryRolesSection {
  readonly costGrowthPerDuplicate: number;
  readonly defs: Readonly<Record<string, RoleDef>>;
}

export interface RegistryBusSection {
  readonly historyCap: number;
}

export interface RegistryHygieneSection {
  readonly autosaveMs: number;
  readonly saveIntervalCheckMs?: number;
  readonly saveThrottleMs?: number;
}

export interface RegistrySaveSection {
  readonly backupIntervalMs?: number;
}

export interface RegistryChargeSection {
  readonly config: Readonly<Record<string, { readonly basePct: number; readonly baseDur: number; readonly cd: number; readonly label: string; readonly science: number; readonly sciencePct: number }>>;
  readonly buffCap: number;
  readonly scienceCap: number;
  readonly neighborBonus: number;
  readonly neighborDurBonusSec: number;
  readonly neighborMax: number;
}

/** Типизированный реестр (registryView, ADR-011): fail-fast при отсутствии/несоответствии обязательных путей. */
export interface RegistryView {
  readonly bus: RegistryBusSection;
  readonly cells: RegistryCellsSection;
  readonly charge: RegistryChargeSection;
  readonly core: RegistryCoreSection;
  readonly dispatch: { readonly batchEnergy: number; readonly batchIron: number };
  readonly eco: RegistryEcoSection;
  readonly events: RegistryEventsSection;
  readonly galaxy: RegistryGalaxySection;
  readonly hygiene: RegistryHygieneSection;
  readonly offline: RegistryOfflineSection;
  readonly planet: RegistryPlanetSection;
  readonly roles: RegistryRolesSection;
  readonly save: RegistrySaveSection;
  /** Этап 4: параметры синтезатора (1.x Dn=BALC("transport.config")). */
  readonly transport: {
    readonly config: {
      readonly basePerSec: number;
      readonly inputPerOutput: number;
      readonly offlineCapMult: number;
      readonly maxLevel: number;
      readonly deepMult: number;
    };
  };
  /** Stage 6: параметры сонарной мини-игры и наград (registry v0.0.41). */
  readonly sonar: {
    readonly chargeMax: number;
    readonly difficulty: { readonly baseRounds: number; readonly maxIdx: number; readonly basePeriod: number; readonly periodStep: number; readonly minPeriod: number };
    readonly hintEnergy: number;
    readonly rerollBurnPct: number;
    readonly rerollHistory: number;
    readonly rerollMax: number;
    readonly rewardGood: number;
    readonly rewardHours: number;
    readonly rewardIdxBonus: number;
    readonly rewardOk: number;
    readonly rewardPerfect: number;
    readonly roundSpeedFloor: number;
    readonly roundSpeedStep: number;
    readonly tierRewards: readonly { readonly count: number; readonly label: string; readonly reward: Readonly<Record<string, number>> }[];
  };
  readonly tech: RegistryTechSection;
  readonly warehouse: RegistryWarehouseSection;
  /** Полный сырой объект (37 секций) — для доменов поздних этапов. */
  readonly raw: Readonly<Record<string, unknown>>;
}

/** baseline.json — source-only константы среза (см. _provenance внутри). */
export interface BaselineConfig {
  readonly scan: {
    readonly baseCost: number;
    readonly growthDefault: number;
    readonly growthMin: number;
    readonly growthMax: number;
    readonly chargeDiscountCoreArm: number;
    readonly rounding: 'floor';
    readonly costStepFloorIncrement: number;
    readonly costCap: number;
    readonly scienceFromChargeDivisor: number;
    readonly scienceMax: number;
    readonly freeScansAfterPrestige: number;
  };
  readonly anomaly: {
    readonly energyInstantReward: number;
    readonly ironInstantReward: number;
    readonly scienceRandomMin: number;
    readonly scienceRandomSpan: number;
  };
  readonly upgrade: {
    /** Raw-кривая g0 = registry cells.upgradeCurve (20 записей {e:energy, a:primary, b:secondary, g:kriogen?, x:levelRewardsIdx}). */
    readonly baseCurve: readonly UpgradeCurveEntry[];
    readonly researchPerUpgradeDivisor: number;
    readonly researchPerUpgradeMax: number;
    /** 1.x MAX_LEVEL (fixtures/gs01: 100). */
    readonly maxLevel: number;
    readonly extension: { readonly growthKey: string; readonly capKey: string; readonly afterCapKey: string };
  };
  readonly cells: {
    readonly yieldByType: Readonly<Record<string, number | string>>;
    readonly researchPerType0Cell: number;
    readonly levelProfile: { readonly yieldMult: readonly number[]; readonly reserveMult: readonly number[] };
  };
  readonly veins: {
    readonly baseIronYieldOnScan: number;
    readonly cooldownBaseMs: number;
    readonly cooldownStepMs: number;
    readonly reactivationBaseEnergy: number;
    readonly reactivationLevelPow: number;
    readonly reactivationReserveScaleMax: number;
    readonly reactivationReserveScaleK: number;
    readonly reactivationMinEnergy: number;
  };
  readonly start: {
    readonly activePlanetId: string;
    readonly unlockedPlanets: readonly string[];
    readonly ferrumExplored: readonly number[];
    readonly ferrumRevealed: readonly number[];
  };
  readonly research: {
    readonly planetCapEnergyKey: string;
    readonly planetCapIronKey: string;
    readonly exhaustedMult: number;
  };
  readonly researchCell: {
    readonly yieldPerLevel: number;
    readonly yieldGrowthDisplay: number;
    readonly cap: number;
  };
  readonly galaxy: {
    readonly arms: Readonly<Record<string, {
      readonly id: string;
      readonly name: string;
      readonly color: string;
      readonly energy: number;
      readonly iron: number;
      readonly kriogen: number;
      readonly rare: number;
      readonly focus: Readonly<Record<string, number>>;
      readonly deplete: number;
      readonly scan: number;
      readonly event: number;
    }>>;
    readonly biomeMults: Readonly<Record<string, number>>;
  };
  /** Этап 4 — апгрейд аномалий (1.x nr @76900 / tl @77100; source-only константы бандла). */
  readonly anomalyUpgrade: {
    readonly ironBase: number;
    readonly energyBase: number;
    readonly growth: number;
    readonly indexMultFrom: number;
    readonly indexMultGrowth: number;
    readonly deepEnergy: number;
    readonly deepMaterial: number;
  };
  /** Этап 4 — доход ветвей (1.x ce @129995: power 4×(1+L)×dc, resonance 0.005×(1+L)×dc; type0-deep +0.05💎). */
  readonly anomalyIncome: {
    readonly powerBase: number;
    readonly resonanceBase: number;
    readonly deepMult: number;
    readonly type0DeepCrystal: number;
  };
  /** Этап 4 — синтезатор (1.x ti @76100: l ×= 0.5 + rare(product)). */
  readonly synth: { readonly rareOffset: number };
  /** Этап 4 — авто-выброс v0.0.39.0 (1.x surge-планировщик @122100, setInterval 2000). */
  readonly surge: {
    readonly intervalMs: number;
    readonly nextAtMinType1: number;
    readonly nextAtMaxType1: number;
    readonly nextAtMinType2: number;
    readonly nextAtMaxType2: number;
    readonly durationMsType1: number;
    readonly durationMsType2: number;
    readonly basePctFallback: number;
    readonly bonusMultType1: number;
    readonly bonusMultType2: number;
    readonly buffCapFallback: number;
  };
}

export interface UpgradeCurveEntry {
  readonly e: number;
  readonly a: number;
  readonly b: number;
  readonly g: number;
  readonly x: number;
}

export interface BalanceConfig {
  readonly balanceId: string;
  readonly registry: RegistryView;
  readonly baseline: BaselineConfig;
}
