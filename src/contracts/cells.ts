/**
 * contracts/cells.ts — клетки и планеты (parity v0.0.41).
 * Типы клеток 0–7 (VERDICT §2; 1.x wl(): 0 простая энергетическая, 1 богатая, 2 редкая,
 * 3 жила (iron-подобная), 4 аномалия, 5 криогенная жила, 6 ячейка исследований, 7 ядро грани).
 */

export const CELL_TYPES = [0, 1, 2, 3, 4, 5, 6, 7] as const;
export type CellType = (typeof CELL_TYPES)[number];

export const CELL_TYPE_NAMES: Readonly<Record<CellType, string>> = Object.freeze({
  0: 'Простая энергетическая',
  1: 'Богатая энергетическая',
  2: 'Редкая',
  3: 'Жила',
  4: 'Аномалия',
  5: 'Криогенная жила',
  6: 'Ячейка исследований',
  7: 'Ядро грани',
});

/** Ветки аномалий (1.x Ho; fixtures/anomaly_types.json — TV-9 закрыт частично: поведение ветвей — Этап 4). */
export const ANOMALY_TYPES = ['synth', 'power', 'resonance'] as const;
export type AnomalyType = (typeof ANOMALY_TYPES)[number];

export const ANOMALY_META: Readonly<Record<AnomalyType, { name: string; icon: string; color: string }>> = Object.freeze({
  synth: { name: 'Синтез', icon: '🌌', color: '#5cf2b0' },
  power: { name: 'Питание', icon: '⚡', color: '#4ddcff' },
  resonance: { name: 'Резонанс', icon: '💎', color: '#c084fc' },
});

/** Статическая клетка из данных планеты (граф). */
export interface CellNode {
  readonly id: number;
  readonly type: CellType;
  readonly neighbors: readonly number[];
  /** Базовый ресурс жилы (type3: iron-подобные; type5: kriogen). */
  readonly resourceKey?: string;
  /** Стартовый резерв жилы (fixtures: ferrum cell1=126, cell10=191). */
  readonly reserve?: number;
}

/** Динамическое состояние клетки (доменное состояние планеты; резервы жил — не ledger, ADR-013). */
export interface CellState {
  level: number;
  /** type0: yield = 1 + level (1.x Ni); type1/2/7 — фиксированные (Ur: 3/10/100 × members). */
  yield: number;
  /** Жилы: текущий резерв; 0 → cooldown. */
  reserve: number;
  maxReserve: number;
  /** Жилы: момент (gameMs), до которого идёт cooldown. */
  cooldownUntil: number;
  /** Жилы: число реактиваций (Xs = min(14, 1+0.55n), цена $n растёт). */
  reactCount: number;
  /** type4: выбранная ветвь аномалии (Этап 4). */
  anomalyType: AnomalyType | null;
  /** 1.x: базовая добыча жилы, назначается при скане (type3 → 0.1). */
  ironYield: number;
  kriogenYield: number;
  /** Мутант жилы (12% при скане; Эффект — Этап 4, в parity-срезах не участвует). */
  mutant: string | null;
  /** 1.x b0(): клетка стала глубокой при пересечении deepLevelThreshold(8) вверх; доход ×Ws(2), истощение ×Ws. */
  isDeep: boolean;
  /** Заряды (Этап 4; 1.x _chargedAt/_chargedEver/_chargeCooldown, gameMs). */
  chargedAt?: number;
  chargedEver?: boolean;
  chargeCooldownUntil?: number;
  /** Авто-выброс v0.0.39.0 (1.x _v039SurgeNextAt/_v039SurgeUntil, gameMs). */
  surgeNextAt?: number;
  surgeUntil?: number;
  destroyed: boolean;
}

export function emptyCellState(): CellState {
  return {
    level: 0,
    yield: 0,
    reserve: 0,
    maxReserve: 0,
    cooldownUntil: 0,
    reactCount: 0,
    anomalyType: null,
    ironYield: 0,
    kriogenYield: 0,
    mutant: null,
    isDeep: false,
    destroyed: false,
  };
}

export const GEOMETRIES = ['icosahedron', 'octahedron', 'tetrahedron', 'cube'] as const;
export type GeometryId = (typeof GEOMETRIES)[number];

export const BIOMES = ['ferrum', 'krios', 'temperate', 'frozen', 'scorched', 'toxic', 'radioactive', 'oceanic', 'desert', 'metallic', 'crystal', 'hidden', 'unknown'] as const;
export type BiomeId = (typeof BIOMES)[number];

/** Дескрипторы планеты (1.x Ar: climate/surface/anomaly; эффекты сворачиваются в perks). */
export interface PlanetDescriptors {
  readonly climate: { readonly id: string; readonly name: string | null; readonly effects: Readonly<Record<string, number>> } | null;
  readonly surface: { readonly id: string; readonly name: string | null; readonly effects: Readonly<Record<string, number>> } | null;
  readonly anomaly: { readonly id: string; readonly name: string | null; readonly effects: Readonly<Record<string, number>> } | null;
  readonly displayName?: string;
}

/** Perks — свёрнутые эффекты дескрипторов (1.x _biomePerks/descriptors.effects). */
export interface PlanetPerks {
  readonly depletionMult: number;
  readonly scanCostMult: number;
  readonly upgradeCostMult: number;
  readonly energyBonus: number;
  readonly ironBonus: number;
  readonly kriogenBonus: number;
  readonly meteorRate: number;
  readonly rareChance: number;
  readonly anomalyChance: number;
}

export const NEUTRAL_PERKS: PlanetPerks = Object.freeze({
  depletionMult: 1,
  scanCostMult: 1,
  upgradeCostMult: 1,
  energyBonus: 1,
  ironBonus: 1,
  kriogenBonus: 1,
  meteorRate: 1,
  rareChance: 1,
  anomalyChance: 1,
});

/** Данные планеты (статика + seed-параметры; динамическое состояние — в PlanetRuntime). */
export interface PlanetData {
  readonly id: string;
  readonly name: string;
  readonly seed: number;
  readonly biome: string;
  readonly geometry: GeometryId;
  readonly frequency: number;
  readonly planetIndex: number;
  readonly armId: string | null;
  readonly role: string | null;
  readonly isUnique: boolean;
  readonly descriptors: PlanetDescriptors | null;
  readonly perks: PlanetPerks;
  readonly resourceList: readonly string[];
  readonly cells: readonly CellNode[];
  readonly startingCellId: number;
}

/** Исследовательское состояние планеты (1.x explored/revealed — независимые состояния, порядок вставки значим: GS-02). */
export interface PlanetExploration {
  /** Порядок вставки сохраняется (GS-02: revealed=[0,2,1,3,6,7]). */
  readonly explored: number[];
  readonly revealed: number[];
}
