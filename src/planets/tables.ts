/**
 * planets/tables.ts — статические таблицы генератора (дословно из бандла v0.0.41; ADR-015).
 * Источники: bundle_main.js Nn@53544 (геометрия), Ar@56440 (дескрипторы), $f@55300 (слоги имён),
 * If/Cf/Tf/Af@59300 (лор), Qa@57100 (события), Dy@96430 (параметры mixed-кластеров).
 * Сверено с fixtures/planetgen_tables.json (хarness Этапа 0). Веса/диапазоны частот геометрии
 * переопределяются registry planet.geometryTuning (1.x: IIFE поверх Nn).
 */
import type { DescriptorOption, PlanetEventType, Vec3 } from '../contracts/planets';

export interface GeometryTableEntry {
  readonly name: string;
  readonly weight: number;
  readonly minFrequency: number;
  readonly maxFrequency: number;
  readonly vertices: readonly Vec3[];
  readonly faces: readonly (readonly [number, number, number])[];
}

/** 1.x Nn — четыре базовых многогранника (порядок ключей значим для Jc: Object.entries). */
export const GEOMETRY_TABLES: Readonly<Record<string, GeometryTableEntry>> = Object.freeze({
  icosahedron: {
    name: "Икосаэдр",
    weight: 45,
    minFrequency: 1,
    maxFrequency: 5,
    vertices: [
      [-1.0, 1.618033988749895, 0.0],
      [1.0, 1.618033988749895, 0.0],
      [-1.0, -1.618033988749895, 0.0],
      [1.0, -1.618033988749895, 0.0],
      [0.0, -1.0, 1.618033988749895],
      [0.0, 1.0, 1.618033988749895],
      [0.0, -1.0, -1.618033988749895],
      [0.0, 1.0, -1.618033988749895],
      [1.618033988749895, 0.0, -1.0],
      [1.618033988749895, 0.0, 1.0],
      [-1.618033988749895, 0.0, -1.0],
      [-1.618033988749895, 0.0, 1.0],
    ],
    faces: [
      [0, 11, 5],
      [0, 5, 1],
      [0, 1, 7],
      [0, 7, 10],
      [0, 10, 11],
      [1, 5, 9],
      [5, 11, 4],
      [11, 10, 2],
      [10, 7, 6],
      [7, 1, 8],
      [3, 9, 4],
      [3, 4, 2],
      [3, 2, 6],
      [3, 6, 8],
      [3, 8, 9],
      [4, 9, 5],
      [2, 4, 11],
      [6, 2, 10],
      [8, 6, 7],
      [9, 8, 1],
    ],
  },
  octahedron: {
    name: "Октаэдр",
    weight: 25,
    minFrequency: 1,
    maxFrequency: 4,
    vertices: [
      [1.0, 0.0, 0.0],
      [-1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, -1.0, 0.0],
      [0.0, 0.0, 1.0],
      [0.0, 0.0, -1.0],
    ],
    faces: [
      [0, 2, 4],
      [2, 1, 4],
      [1, 3, 4],
      [3, 0, 4],
      [2, 0, 5],
      [1, 2, 5],
      [3, 1, 5],
      [0, 3, 5],
    ],
  },
  tetrahedron: {
    name: "Тетраэдр",
    weight: 10,
    minFrequency: 1,
    maxFrequency: 4,
    vertices: [
      [1.0, 1.0, 1.0],
      [1.0, -1.0, -1.0],
      [-1.0, 1.0, -1.0],
      [-1.0, -1.0, 1.0],
    ],
    faces: [
      [0, 2, 1],
      [0, 1, 3],
      [0, 3, 2],
      [1, 2, 3],
    ],
  },
  cube: {
    name: "Куб",
    weight: 15,
    minFrequency: 1,
    maxFrequency: 4,
    vertices: [
      [-1.0, -1.0, -1.0],
      [1.0, -1.0, -1.0],
      [1.0, 1.0, -1.0],
      [-1.0, 1.0, -1.0],
      [-1.0, -1.0, 1.0],
      [1.0, -1.0, 1.0],
      [1.0, 1.0, 1.0],
      [-1.0, 1.0, 1.0],
    ],
    faces: [
      [0, 1, 2],
      [0, 2, 3],
      [4, 6, 5],
      [4, 7, 6],
      [0, 4, 5],
      [0, 5, 1],
      [3, 2, 6],
      [3, 6, 7],
      [0, 3, 7],
      [0, 7, 4],
      [1, 5, 6],
      [1, 6, 2],
    ],
  },});

/** 1.x Ar — пулы дескрипторов (climate выбирается всегда; surface: crystal только при idx>=3; anomaly — шанс-ролл). */
export const DESCRIPTOR_TABLES: Readonly<{ climate: readonly DescriptorOption[]; surface: readonly DescriptorOption[]; anomaly: readonly DescriptorOption[] }> = Object.freeze<{ climate: readonly DescriptorOption[]; surface: readonly DescriptorOption[]; anomaly: readonly DescriptorOption[] }>({
  climate: [
    { id: "temperate", name: "Умеренный", color: "#c0e8b0", effects: {} },
    { id: "frozen", name: "Мёрзлый", color: "#a8d8ff", effects: { depletionMult: 0.7, upgradeCostMult: 1.2 } },
    { id: "scorched", name: "Выжженный", color: "#ff8a5c", effects: { depletionMult: 1.5, energyBonus: 1.3 } },
    { id: "toxic", name: "Токсичный", color: "#8aff6b", effects: { scanCostMult: 1.4, ironBonus: 1.2 } },
    { id: "radioactive", name: "Радиоактивный", color: "#ffe88a", effects: { meteorRate: 2, ironBonus: 1.3 } },
  ],
  surface: [
    { id: "rocky", name: "Каменистый", effects: { ironBonus: 1.15 } },
    { id: "oceanic", name: "Океанический", effects: { kriogenBonus: 1.3, energyBonus: 0.9 } },
    { id: "desert", name: "Пустынный", effects: { scanCostMult: 0.85 } },
    { id: "metallic", name: "Металлический", effects: { ironBonus: 1.4, upgradeCostMult: 1.1 } },
    { id: "crystal", name: "Кристаллический", effects: { rareChance: 2 } },
  ],
  anomaly: [
    { id: "none", name: null, effects: {} },
    { id: "resonant", name: "Резонирующий", effects: { anomalyChance: 3 }, chance: 0.1 },
    { id: "fractured", name: "Расколотый", effects: { eventChance: 2 }, chance: 0.08 },
    { id: "echoing", name: "Эхо", effects: { echoBonus: 2 }, chance: 0.05 },
  ],});

/** 1.x $f — слоги имён (4 стиля; ключи в порядке latin, harsh, soft, ancient — значим для Rf). */
export const NAME_SYLLABLES: Readonly<Record<string, { readonly start: readonly string[]; readonly mid: readonly string[]; readonly end: readonly string[] }>> = Object.freeze({
  latin: {
    start: ["В", "Кс", "Т", "Ар", "З", "Н", "М", "Л", "Сар", "Вел"],
    mid: ["а", "о", "и", "е", "у", "э", "ае"],
    end: ["н", "с", "р", "л", "м", "кс", "т", "рн"],
  },
  harsh: {
    start: ["Кр", "Гр", "Тх", "Вр", "Зн", "Хр", "Др"],
    mid: ["а", "о", "у"],
    end: ["г", "к", "кх", "рг", "зг", "шт"],
  },
  soft: {
    start: ["Эл", "Аэ", "Ил", "Си", "Ли", "Ми", "Ни"],
    mid: ["а", "э", "и", "о"],
    end: ["ль", "н", "с", "ан", "ис", "эль"],
  },
  ancient: {
    start: ["Аз", "Ур", "Эн", "Ак", "Ин", "Ум", "Он"],
    mid: ["а", "у", "э"],
    end: ["ар", "ум", "ор", "ан", "ис", "арх"],
  },});

/** 1.x If — шаблоны лора. */
export const LORE_TEMPLATES = Object.freeze([
  'Эта планета была домом для цивилизации, {event}.',
  'Древние руины здесь говорят о {concept}.',
  'Сигнал отсюда повторяет {concept} уже {number} лет.',
  'Ядро планеты содержит отпечаток {concept}.',
  'Координаты этого мира совпадают с координатами Воронии. Но Воронии больше нет.',
  'Грани этой планеты повторяют чертёж Воронии — мира, расколотого на циклы.',
  'В ядре планеты — грань Воронии, всё ещё тёплая после первого раскола.',
  'Хранитель этого мира помнит Воронию целой. Он не пускает к её сердцу.',
] as const);

/** 1.x Cf — концепты лора. */
export const LORE_CONCEPTS = Object.freeze([
  'гибели', 'возрождения', 'пустоты', 'вечного льда', 'огня', 'тишины', 'резонанса', 'хаоса', 'расколотой Воронии', 'первого цикла',
] as const);

/** 1.x Tf — события лора. */
export const LORE_EVENTS = Object.freeze([
  'исчезнувшей тысячи лет назад', 'погибшей в катастрофе', 'ушедшей в другое измерение',
] as const);

/** 1.x Af — имена уникальных миров (шанс 25% при isUnique). */
export const UNIQUE_PLANET_NAMES = Object.freeze([
  'Ворония-Прайм', 'Осколок Воронии', 'Эхо Воронии', 'Ворония-Реквием', 'Ворония-Нуль', 'Память Воронии',
] as const);

/** Базовый тип события (1.x Qa) — без polarity/weight (оверлей registry events.polarityWeights, см. generator.genEvents). */
export type PlanetEventBase = Omit<PlanetEventType, 'polarity' | 'weight'>;

/** 1.x Qa — пул планетарных событий (порядок значим для Of: копия массива + splice-ролл). */
export const EVENT_TYPES_BASE: readonly PlanetEventBase[] = Object.freeze<readonly PlanetEventBase[]>([
  { id: "meteor_storm", name: "☄ Метеоритный шторм", duration: 45, desc: "×5 к частоте метеоритов. Сбивай их тапом — каждый даёт случайную награду: мгновенные ресурсы или временный бафф добычи ×3/×5", effects: { meteorRate: 5 } },
  { id: "solar_flare", name: "☀ Солнечная вспышка", duration: 30, desc: "×2 ко ВСЕЙ добыче энергии на активной планете", effects: { energyMult: 2 } },
  { id: "acid_rain", name: "☣ Кислотный дождь", duration: 60, desc: "×3 к скорости истощения месторождений — они иссякают втрое быстрее", effects: { depletionMult: 3 }, compensate: { crystals: 2 } },
  { id: "gas_cloud", name: "🌫 Газовое облако", duration: 40, desc: "−50% к стоимости сканирования клеток на активной планете", effects: { scanCostMult: 0.5 } },
  { id: "crystal_bloom", name: "💎 Кристальный расцвет", duration: 50, desc: "×3 к добыче кристаллов от глубоких энергоячеек", effects: { crystalMult: 3 } },
  { id: "quasar_pulse", name: "⚡ Квазарный импульс", duration: 20, desc: "×5 к добыче энергии и железа. Коротко, но очень мощно", effects: { energyMult: 5, ironMult: 5 } },
  { id: "deep_pulse", name: "🌀 Глубокий пульс", duration: 60, desc: "Месторождения истощаются вдвое медленнее — но кристаллы не добываются", effects: { depletionMult: 0.5, crystalMult: 0 } },
  { id: "cosmic_dust", name: "✨ Космическая пыль", duration: 45, desc: "×1.5 ко ВСЕМ ресурсам — но сканирование дороже ×1.5", effects: { allMult: 1.5, scanCostMult: 1.5 } },
  { id: "void_echo", name: "🌌 Эхо пустоты", duration: 50, desc: "×3 к появлению аномалий — но истощение жил ×1.5", effects: { anomalyChance: 3, depletionMult: 1.5 } },
  { id: "ion_storm", name: "⚡ Ионный шторм", duration: 45, desc: "Сканирование клеток дороже ×2", effects: { scanCostMult: 2 }, compensate: { crystals: 2 } },
  { id: "magnetic_anomaly", name: "🧲 Магнитная аномалия", duration: 60, desc: "Апгрейды клеток дороже ×1.5", effects: { upgradeCostMult: 1.5 }, compensate: { crystals: 3 } },
  { id: "resonance_collapse", name: "📉 Обвал резонанса", duration: 60, desc: "Синтез соединений идёт ×0.5", effects: { synthMult: 0.5 }, compensate: { crystals: 4 }, minPlanetIndex: 5 },
  { id: "reactor_resonance", name: "⚗️ Резонанс реактора", duration: 60, desc: "+30% к скорости синтеза соединений (работает и на офлайн-очередь)", effects: { craftSpeedMult: 1.3 } },]);

/** 1.x Dy — параметры mixed-кластеров по климату (ni()). */
export interface MixedClimateParams {
  readonly maxCluster: number;
  readonly joinDist: number;
  readonly hotMin: number;
  readonly hotMax: number;
  readonly rKeepMul: number;
  readonly rMergeMul: number;
  readonly scoreNoise: number;
}

export const MIXED_CLIMATE_PARAMS: Readonly<Record<string, MixedClimateParams>> = Object.freeze({
  frozen: { maxCluster: 14, joinDist: 0.78, hotMin: 1, hotMax: 2, rKeepMul: 1.35, rMergeMul: 1.25, scoreNoise: 0.1 },
  scorched: { maxCluster: 5, joinDist: 0.4, hotMin: 3, hotMax: 5, rKeepMul: 0.65, rMergeMul: 0.8, scoreNoise: 0.28 },
  toxic: { maxCluster: 7, joinDist: 0.55, hotMin: 3, hotMax: 5, rKeepMul: 0.9, rMergeMul: 1, scoreNoise: 0.22 },
  radioactive: { maxCluster: 10, joinDist: 0.66, hotMin: 2, hotMax: 4, rKeepMul: 1.1, rMergeMul: 1.15, scoreNoise: 0.15 },
  temperate: { maxCluster: 9, joinDist: 0.62, hotMin: 2, hotMax: 4, rKeepMul: 1, rMergeMul: 1, scoreNoise: 0.2 },
});

/** 1.x Dy(): климат планеты → параметры (дефолт temperate). */
export function mixedParamsFor(climateId: string | undefined): MixedClimateParams {
  return MIXED_CLIMATE_PARAMS[climateId ?? 'temperate'] ?? MIXED_CLIMATE_PARAMS.temperate!;
}

/** 1.x Hy() — описание mixed-морфологии (UI/лор-строка). */
export function mixedMorphologyText(climateId: string | undefined): string {
  switch (climateId) {
    case 'frozen': return 'ледниковые плиты';
    case 'scorched': return 'россыпь выжженных островков';
    case 'toxic': return 'рваная мозаика';
    case 'radioactive': return 'крупные сегменты';
    default: return 'умеренное слияние';
  }
}
