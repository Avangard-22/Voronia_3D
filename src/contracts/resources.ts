/**
 * contracts/resources.ts — каталог ресурсов v0.0.41 (parity 1.x).
 * Источник: fixtures/golden_save_fresh_v0.0.41.json (20 ресурсов: 7 top-level + 8 extra + 5 compounds),
 * реестр VORONIA_BALANCE (rare-веса), runtime-аудит dn() (грузовые веса).
 */

/** Ресурсы верхнего уровня сейва (глобальные, 1.x: n.energy … n.essence + research/dust). */
export const CORE_RESOURCES = ['energy', 'iron', 'kriogen', 'crystals', 'research', 'dust', 'essence'] as const;
export type CoreResourceKey = (typeof CORE_RESOURCES)[number];

/** Редкие/дополнительные ресурсы (1.x: n.extraResources). */
export const EXTRA_RESOURCES = ['carbon', 'silicon', 'titanium', 'uranium', 'helium3', 'biomass', 'platinum', 'darkMatter'] as const;
export type ExtraResourceKey = (typeof EXTRA_RESOURCES)[number];

/** Соединения (1.x: n.compoundResources). steel..relic дают compound-бонус дохода; helium3/biomass/platinum — toResource (без бонуса). */
export const COMPOUND_RESOURCES = ['steel', 'chip', 'alloy', 'core', 'relic'] as const;
export type CompoundResourceKey = (typeof COMPOUND_RESOURCES)[number];

/** Всё, что учитывает ledger (shards — вне основного сейва, см. VERDICT §Постскриптум 5). */
export const LEDGER_RESOURCES = [...CORE_RESOURCES, ...EXTRA_RESOURCES, ...COMPOUND_RESOURCES, 'shards'] as const;
export type LedgerResourceKey = (typeof LEDGER_RESOURCES)[number];

export type AnyResourceKey = CoreResourceKey | ExtraResourceKey | CompoundResourceKey;

export type ResourceAmounts = Partial<Record<LedgerResourceKey, number>>;

/** Грузовые веса dn() 1.x (fixtures/warehouse_curve_v0.0.41.json cargoWeights). */
export const CARGO_WEIGHTS: Readonly<Partial<Record<LedgerResourceKey, number>>> = Object.freeze({
  iron: 1,
  kriogen: 1,
  carbon: 3,
  silicon: 3,
  titanium: 4,
  uranium: 7,
  darkMatter: 25,
  helium3: 8,
  biomass: 12,
  platinum: 15,
});

/**
 * Метаданные пула ресурсов для генератора (1.x таблица `te`, bundle @28695): rare-вес, минимальный индекс планеты,
 * hidden/legacy-флаги. ПОРЯДОК КЛЮЧЕЙ ЗНАЧИМ — VorResRoll/VorCrystalEnsure итерируют `for(K in te)`
 * (вставка: iron, kriogen, carbon, silicon, titanium, uranium, darkMatter, helium3, biomass, platinum).
 */
export interface ResourceGenInfo {
  readonly rare: number;
  readonly minPlanetIndex: number;
  readonly tier?: number;
  readonly hidden?: boolean;
  readonly legacy?: boolean;
}

export const RESOURCE_GEN: Readonly<Record<string, ResourceGenInfo>> = Object.freeze({
  iron: { rare: 0, minPlanetIndex: 1 },
  kriogen: { rare: 0, minPlanetIndex: 2 },
  carbon: { rare: 0.4, minPlanetIndex: 3, tier: 1 },
  silicon: { rare: 0.35, minPlanetIndex: 5, tier: 2 },
  titanium: { rare: 0.25, minPlanetIndex: 8, tier: 3 },
  uranium: { rare: 0.15, minPlanetIndex: 12, tier: 4 },
  darkMatter: { rare: 0.05, minPlanetIndex: 15, tier: 5 },
  helium3: { rare: 0, minPlanetIndex: 99, hidden: true, legacy: true },
  biomass: { rare: 0, minPlanetIndex: 99, hidden: true, legacy: true },
  platinum: { rare: 0, minPlanetIndex: 99, hidden: true, legacy: true },
});

/** Ключи RESOURCE_GEN в порядке вставки (1.x for-in по te). */
export const RESOURCE_GEN_ORDER = Object.keys(RESOURCE_GEN);

export function cargoWeight(key: LedgerResourceKey): number {
  // 1.x dn(): darkMatter 25; rare>0 → min(25, ceil(1/rare)); base → 1; неизвестные → Infinity (нетранспортабельны)
  const w = CARGO_WEIGHTS[key];
  if (w !== undefined) return w;
  if (key === 'energy' || key === 'crystals' || key === 'research' || key === 'dust' || key === 'essence' || key === 'shards') return Number.POSITIVE_INFINITY;
  return 1;
}

export const RESOURCE_META: Readonly<Record<LedgerResourceKey, { name: string; icon: string }>> = Object.freeze({
  energy: { name: 'Энергия', icon: '⚡' },
  iron: { name: 'Железо', icon: '⛏' },
  kriogen: { name: 'Криоген', icon: '❄' },
  crystals: { name: 'Кристаллы', icon: '💎' },
  research: { name: 'Исследования', icon: '🔬' },
  dust: { name: 'Пыль', icon: '✨' },
  essence: { name: 'Эссенция', icon: '🌌' },
  shards: { name: 'Осколки', icon: '💫' },
  carbon: { name: 'Углерод', icon: '🪨' },
  silicon: { name: 'Кремний', icon: '📡' },
  titanium: { name: 'Титан', icon: '⚙️' },
  uranium: { name: 'Уран', icon: '☢' },
  helium3: { name: 'Гелий-3', icon: '🌫️' },
  biomass: { name: 'Биомасса', icon: '🧬' },
  platinum: { name: 'Платина', icon: '💍' },
  darkMatter: { name: 'Тёмная материя', icon: '🌑' },
  steel: { name: 'Сталь', icon: '🔩' },
  chip: { name: 'Чип', icon: '💠' },
  alloy: { name: 'Сплав', icon: '⛓️' },
  core: { name: 'Ядро', icon: '⚛️' },
  relic: { name: 'Реликт', icon: '🔮' },
});

/** COMPOUNDS-таблица 1.x (je): bonus на единицу к global-множителю дохода (кап ×6 — Fa()). */
export const COMPOUND_BONUS: Readonly<Record<CompoundResourceKey, { tier: number; bonus: number }>> = Object.freeze({
  steel: { tier: 1, bonus: 0.005 },
  chip: { tier: 2, bonus: 0.015 },
  alloy: { tier: 3, bonus: 0.03 },
  core: { tier: 4, bonus: 0.05 },
  relic: { tier: 5, bonus: 0.1 },
});

/** Compound-множитель дохода: 1 + min(Σ units×bonus, 5) — кап ×6 (1.x Fa(), fixtures/income_midgame_documented.json). */
export function compoundBonusMult(compounds: Readonly<Partial<Record<CompoundResourceKey, number>>>): number {
  let sum = 0;
  for (const key of COMPOUND_RESOURCES) sum += (compounds[key] ?? 0) * COMPOUND_BONUS[key].bonus;
  return 1 + Math.min(sum, 5);
}
