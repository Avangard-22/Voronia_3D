/**
 * contracts/planets.ts — runtime-контракт планеты (структура данных; владелец — домен planets, потребители — через contracts).
 * Set/Map сохраняют порядок вставки — parity 1.x (GS-02: revealed=[0,2,1,3,6,7]).
 *
 * GeneratedPlanet/GeneratedCell (Этап 3, ADR-015) — «живая» планета процедурного генератора,
 * форма 1:1 с классом `or` из бандла (@81832): мутабельные поля, порядок потребления RNG фиксирован.
 * Отличается от PlanetData (статический срез для каталога/валидации) и PlanetRuntime (состояние игры).
 */
import type { CellState, PlanetData } from './cells';

export interface PlanetRuntime {
  readonly data: PlanetData;
  readonly explored: Set<number>;
  readonly revealed: Set<number>;
  readonly cellStates: Map<number, CellState>;
  /** 1.x planet.origin (Этап 4, $o @74650): происхождение ресурсов {mined,delivered,synthesized}. */
  readonly origin: Record<string, { mined: number; delivered: number; synthesized: number }>;
}

export type Vec3 = [number, number, number];

/** Опция таблицы дескрипторов (1.x Ar.climate/surface/anomaly — элементы со chance для аномалий). */
export interface DescriptorOption {
  readonly id: string;
  readonly name: string | null;
  readonly color?: string;
  readonly effects: Readonly<Record<string, number>>;
  readonly chance?: number;
}

/** Дескрипторы сгенерированной планеты (1.x Qc): climate+surface+anomaly, свернутые effects, displayName. */
export interface GeneratedDescriptors {
  readonly climate: DescriptorOption;
  readonly surface: DescriptorOption;
  readonly anomaly: DescriptorOption;
  readonly effects: Record<string, number>;
  readonly displayName: string;
}

/** Perks планеты (1.x _biomePerks): базовые множители биома × эффекты дескрипторов + badge/desc. */
export interface GeneratedPerks {
  depletionMult: number;
  scanCostMult: number;
  upgradeCostMult: number;
  badge: string;
  desc: string;
  energyBonus: number;
  ironBonus: number;
  kriogenBonus: number;
  meteorRate: number;
  rareChance: number;
  anomalyChance: number;
}

/** Палитра планеты (1.x Lf; чистая косметика, но входит в parity-сэмплы). */
export interface PlanetPalette {
  readonly bg1: string;
  readonly bg2: string;
  readonly explored: Readonly<Record<string, string>>;
  readonly unexplored: Readonly<Record<string, string>>;
  readonly border: string;
}

/** Тип планетарного события (1.x Qa + оверлей registry events.polarityWeights через y2()). */
export interface PlanetEventType {
  readonly id: string;
  readonly name: string;
  readonly duration: number;
  readonly desc: string;
  readonly effects: Readonly<Record<string, number>>;
  readonly compensate?: Readonly<Record<string, number>>;
  readonly minPlanetIndex?: number;
  readonly polarity: string;
  readonly weight: number;
}

/** Клетка «живой» планеты (1.x or.cells[i]; после ni() — мёрж-клетка с _mixedRep/_oldIds). */
export interface GeneratedCell {
  id: number;
  center: Vec3;
  poly: Vec3[];
  neighbors: number[];
  type: number;
  yield: number;
  ironYield: number;
  kriogenYield: number;
  level: number;
  isDeep: boolean;
  displayType: number;
  reserve: number;
  maxReserve: number;
  cooldownUntil: number;
  reactCount: number;
  resourceKey: string;
  anomalyType: string | null;
  _exploredAt: number;
  _lastYieldAt: number;
  /** 1.x: у мёрж-клеток (ni) эти поля ОТСУТСТВУЮТ — поэтому опциональны. */
  _chargedAt?: number;
  _chargedEver?: boolean;
  _chargeCooldown?: number;
  /** pl(): базовые значения до level-множителей (нужны ni() для мёрж-клеток). */
  _baseMaxReserve?: number;
  _baseIronYield?: number;
  _baseKriogenYield?: number;
  /** ni(): следы смешанного мира. */
  _polys?: Vec3[][];
  _mixedCluster?: boolean;
  _memberCount?: number;
  _mixedRep?: number;
  _oldIds?: number[];
}

/** Планета-объект генератора (1.x `new or(...)`; мутабельна — _build/ni/_assignResources меняют её на месте). */
export interface GeneratedPlanet {
  id: string;
  name: string;
  seed: number;
  f: number;
  geometry: string;
  geometryName: string;
  biome: string;
  planetIndex: number;
  armId: string | null;
  role: string | null;
  isUnique: boolean;
  descriptors: GeneratedDescriptors;
  perks: GeneratedPerks;
  palette: PlanetPalette;
  lore: string;
  availableEvents: PlanetEventType[];
  storage: Record<string, number>;
  origin: Record<string, unknown>;
  scanBonus: unknown;
  resourceList: string[];
  verts: Vec3[];
  faces: [number, number, number][];
  cells: GeneratedCell[];
  revealed: Set<number>;
  explored: Set<number>;
  startingCellId: number;
  _visited: boolean;
  _mixed: boolean;
  _mixedVer?: number;
  _skipValidate?: boolean;
  _oldCentroids?: Vec3[];
  _deserializing?: boolean;
  _uniqueForm?: unknown;
  /** 1.x deserialize: принудительные кластеры из сейва (_mixedClusters) для ni(). */
  _forcedClusters?: readonly (readonly number[])[] | null;
}

/** Спецификация на создание планеты (1.x конструктор or + discoverPlanet). */
export interface PlanetSpec {
  readonly id: string;
  readonly seed: number;
  readonly f: number;
  readonly geometry: string;
  readonly biome: string;
  readonly planetIndex: number;
  readonly name?: string | null;
  readonly armId?: string | null;
}
