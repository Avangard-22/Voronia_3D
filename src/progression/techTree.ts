/**
 * progression/techTree.ts — Этап 9.3 (Этап 7 ТЗ): дерево исследований поверх данных v1.
 *
 * Источники parity:
 *  - имена исследований — `fixtures/resources_research_v0.0.41.json` → RESEARCH_NAMES (1.x);
 *  - стоимости многоуровневых технологий — `registry.tech.costScaleTable` (v0.0.41) +
 *    поздний рост `registry.tech.costCurveLate` (×1.35 за уровень после последней строки);
 *  - разблокировки ресурсов — `contracts/tech.ts` RESOURCE_UNLOCK (1.x Kt).
 *
 * То, чего v1 в registry не оставила (цены unlock-исследований и численные эффекты),
 * собрано в одном блоке `RESEARCH_POLICY` (ТЗ §15: баланс — только через config/константы
 * политики; помечено как балансная спецификация этапа, см. ADR-021).
 */
import type { ResourceAmounts } from '../contracts/resources';
import type { RegistryTechSection } from '../config/types';
import type { TechNodeView } from '../contracts/tech';
import type { TechPort } from '../contracts/ports';

export interface ResearchDef {
  readonly id: string;
  readonly name: string;
  readonly desc: string;
  /** `level` — многоуровневая технология из TechLevels; `unlock` — одноразовое исследование. */
  readonly kind: 'level' | 'unlock';
  readonly maxLevel: number;
  readonly prereq: readonly string[];
}

/** Имена v1 (runtime-извлечение legacy RESEARCH_NAMES). */
export const RESEARCH_NAMES: Readonly<Record<string, string>> = Object.freeze({
  unlock_kriogenBoost: '❄ Криогеника',
  unlock_therm: '🛡 Термофизика',
  unlock_hyperdrill: '⛏ Плазменная физика',
  unlock_recon: '🔬 Инженерия',
  unlock_carbon: '🪨 Углеродный анализ',
  unlock_silicon: '📡 Кремниевые схемы',
  unlock_titanium: '⚙️ Титановая обработка',
  unlock_uranium: '☢️ Урановые реакторы',
  unlock_darkMatter: '🌑 Тёмная материя',
  unlock_synth_helium3: '🌫 Синтез гелия-3',
  unlock_synth_biomass: '🧬 Биосинтез',
  unlock_synth_platinum: '💍 Платиновый синтез',
  recipe_steel: '🔩 Рецепт: Сталь',
  recipe_alloy: '⛓️ Рецепт: Сплав',
  recipe_chip: '💠 Рецепт: Чип',
  recipe_core: '⚛️ Рецепт: Ядро',
  recipe_relic: '🔮 Рецепт: Реликт предтеч',
  recipe_datablock: '📊 Рецепт: Блок данных',
  boost_synth: '⚗️ Усиленный синтез',
  boost_synth2: '⚗️ Двойной синтез',
});

/**
 * Балансная спецификация Этапа 9.3 (ADR-021): цены unlock-исследований и эффекты.
 * Цены выстроены по лестнице ~×2–3 и поверены по ранней/средней игре: награда за мир
 * floor(500×2.2^max(0,idx−2)) 🔬 и доход научных клеток делают первую разблокировку
 * доступной после 2–3 открытий, поздние — цель средней игры.
 */
export const RESEARCH_POLICY = Object.freeze({
  unlockCosts: Object.freeze({
    unlock_kriogenBoost: { research: 600 },
    unlock_carbon: { research: 900 },
    unlock_silicon: { research: 2400 },
    unlock_titanium: { research: 6000 },
    unlock_uranium: { research: 15000 },
    unlock_darkMatter: { research: 40000 },
    unlock_therm: { research: 1800 },
    unlock_hyperdrill: { research: 3600 },
    unlock_recon: { research: 1200 },
    unlock_synth_helium3: { research: 25000 },
    unlock_synth_biomass: { research: 30000 },
    unlock_synth_platinum: { research: 45000 },
    recipe_steel: { research: 1500 },
    recipe_chip: { research: 5000 },
    recipe_alloy: { research: 9000 },
    recipe_core: { research: 22000 },
    recipe_relic: { research: 60000 },
    recipe_datablock: { research: 12000 },
    boost_synth: { research: 8000 },
    boost_synth2: { research: 30000 },
  } as Readonly<Record<string, ResourceAmounts>>),
  /** Эффекты многоуровневых технологий (за уровень). */
  effects: Object.freeze({
    /** +25% дохода железа за уровень ironBoost. */
    ironBoostPerLevel: 0.25,
    /** +25% дохода кристаллов за уровень crystalBoost. */
    crystalBoostPerLevel: 0.25,
    /** +25% дохода криогена за уровень kriogenBoost. */
    kriogenBoostPerLevel: 0.25,
    /** −10% кулдауна жил за уровень therm (мультипликативно, пол 0.4). */
    thermCooldownPerLevel: 0.10,
    thermCooldownFloor: 0.4,
    /** +20% к разряду жил за уровень hyperdrill. */
    hyperdrillYieldPerLevel: 0.20,
    /** −5% цены скана за уровень recon (пол 0.5). */
    reconScanPerLevel: 0.05,
    reconScanFloor: 0.5,
    /** +1 к максимальному уровню клетки за уровень maxLevel. */
    maxLevelPerLevel: 1,
  }),
} as const);

/** Потолок уровня многоступенчатых технологий — registry.tech.maxLevel (v0.0.41). */
export const LEVEL_TECH_MAX = 100;

const LEVEL_TECH_IDS = ['costScale', 'ironBoost', 'maxLevel', 'crystalBoost', 'kriogenBoost', 'therm', 'hyperdrill', 'recon'] as const;
export type LevelTechId = (typeof LEVEL_TECH_IDS)[number];

const DESCRIPTIONS: Readonly<Record<string, string>> = Object.freeze({
  costScale: 'Снижает множитель роста цен улучшений (Gk).',
  ironBoost: '+25% дохода железа за уровень.',
  maxLevel: '+1 к максимальному уровню клетки за уровень.',
  crystalBoost: '+25% дохода кристаллов за уровень.',
  kriogenBoost: '+25% дохода криогена за уровень. Требует «Криогеника».',
  therm: '−10% времени кулдауна жил за уровень. Требует «Термофизика».',
  hyperdrill: '+20% к разряду жил за уровень. Требует «Плазменная физика».',
  recon: '−5% цены сканирования за уровень. Требует «Инженерия».',
  unlock_kriogenBoost: 'Открывает криоген и ветку криоген-буста.',
  unlock_therm: 'Открывает ветку термофизики (кулдауны жил).',
  unlock_hyperdrill: 'Открывает ветку плазменной физики (разряд жил).',
  unlock_recon: 'Открывает инженерную ветку (цена скана).',
  unlock_carbon: 'Открывает добычу углерода.',
  unlock_silicon: 'Открывает добычу кремния.',
  unlock_titanium: 'Открывает добычу титана.',
  unlock_uranium: 'Открывает добычу урана.',
  unlock_darkMatter: 'Открывает тёмную материю.',
  unlock_synth_helium3: 'Открывает рецепт синтеза гелия-3 в реакторе.',
  unlock_synth_biomass: 'Открывает рецепт биосинтеза в реакторе.',
  unlock_synth_platinum: 'Открывает рецепт платинового синтеза в реакторе.',
  recipe_steel: 'Открывает рецепт стали в реакторе.',
  recipe_alloy: 'Открывает рецепт сплава в реакторе.',
  recipe_chip: 'Открывает рецепт чипа в реакторе.',
  recipe_core: 'Открывает рецепт ядра в реакторе.',
  recipe_relic: 'Открывает рецепт реликта предтеч в реакторе.',
  recipe_datablock: 'Открывает рецепты блоков данных (researchData).',
  boost_synth: '×1.5 к выходу аномального синтеза.',
  boost_synth2: '×2 к выходу аномального синтеза.',
});

const PREREQ: Readonly<Record<string, readonly string[]>> = Object.freeze({
  kriogenBoost: ['unlock_kriogenBoost'],
  therm: ['unlock_therm'],
  hyperdrill: ['unlock_hyperdrill'],
  recon: ['unlock_recon'],
  boost_synth2: ['boost_synth'],
  recipe_alloy: ['recipe_steel'],
  recipe_chip: ['recipe_steel'],
  recipe_core: ['recipe_alloy'],
  recipe_relic: ['recipe_core'],
});

function defs(): ResearchDef[] {
  const out: ResearchDef[] = [];
  for (const id of LEVEL_TECH_IDS) {
    out.push({ id, name: TECH_TITLE[id], desc: DESCRIPTIONS[id] ?? '', kind: 'level', maxLevel: LEVEL_TECH_MAX, prereq: PREREQ[id] ?? [] });
  }
  for (const id of Object.keys(RESEARCH_NAMES)) {
    if ((id === 'unlock_kriogenBoost')) continue; // уже учтён как prereq-ветка, но и как unlock покупается отдельно
    out.push({ id, name: RESEARCH_NAMES[id] ?? id, desc: DESCRIPTIONS[id] ?? '', kind: 'unlock', maxLevel: 1, prereq: PREREQ[id] ?? [] });
  }
  out.push({ id: 'unlock_kriogenBoost', name: RESEARCH_NAMES['unlock_kriogenBoost'] ?? '', desc: DESCRIPTIONS['unlock_kriogenBoost'] ?? '', kind: 'unlock', maxLevel: 1, prereq: [] });
  return out;
}

const TECH_TITLE: Readonly<Record<LevelTechId, string>> = Object.freeze({
  costScale: '📉 Оптимизация цен',
  ironBoost: '⛏ Железный импульс',
  maxLevel: '🧱 Предел совершенства',
  crystalBoost: '💠 Кристальный резонанс',
  kriogenBoost: '❄ Криогенный импульс',
  therm: '🛡 Термоизоляция',
  hyperdrill: '⛏ Плазменный бур',
  recon: '🔬 Разведка',
});

export const RESEARCH_DEFS: readonly ResearchDef[] = Object.freeze(defs());
export const RESEARCH_BY_ID: Readonly<Record<string, ResearchDef>> = Object.freeze(
  Object.fromEntries(RESEARCH_DEFS.map((d) => [d.id, d])),
);

/** Короткие ключи стоимостей v1 → ключи ledger. */
const COST_KEY_ALIAS: Readonly<Record<string, string>> = Object.freeze({
  e: 'energy',
  i: 'iron',
  k: 'kriogen',
  c: 'crystals',
});

/**
 * Цена следующего уровня многоуровневой технологии (level — текущий, 0-based строки таблицы).
 * После последней строки — поздний рост v1: row[last] × lateGrowth^(level − lastRow).
 */
export function levelTechCost(section: RegistryTechSection, id: LevelTechId, level: number): ResourceAmounts {
  const table = (section.costScaleTable)[id];
  if (!table || table.length === 0) return { research: 1000 };
  const late = section.costCurveLate;
  const lastIndex = Math.max(0, table.length - 1);
  const row = table[Math.min(level, lastIndex)]!;
  let mult = 1;
  if (level > lastIndex) mult = Math.pow(late.lateGrowth, level - lastIndex);
  const cost: Record<string, number> = {};
  for (const [key, value] of Object.entries(row)) {
    const ledgerKey = COST_KEY_ALIAS[key] ?? key;
    cost[ledgerKey] = Math.ceil((value ?? 0) * mult);
  }
  return cost;
}

/** Полная цена покупки: unlock — из политики, уровень — из таблицы v1. */
export function researchCost(section: RegistryTechSection, id: string, level: number): ResourceAmounts {
  const def = RESEARCH_BY_ID[id];
  if (!def) return {};
  if (def.kind === 'unlock') return RESEARCH_POLICY.unlockCosts[id] ?? { research: 1000 };
  return levelTechCost(section, id as LevelTechId, level);
}

/** Этап 9.3: узлы дерева для снапшота/UI — уровень, цена следующего уровня, доступность (Этап 7 ТЗ). */
export function techNodes(tech: TechPort, section: RegistryTechSection): readonly TechNodeView[] {
  return RESEARCH_DEFS.map((def) => {
    const level = tech.level(def.id);
    const maxed = def.maxLevel > 0 && level >= def.maxLevel;
    const prereqOk = def.prereq.every((p) => tech.hasResearch(p));
    return {
      id: def.id,
      name: def.name,
      desc: def.desc,
      kind: def.kind,
      level,
      maxLevel: def.maxLevel,
      prereq: def.prereq,
      cost: maxed ? ({}) : researchCost(section, def.id, level),
      available: !maxed && prereqOk,
      bought: level > 0,
    };
  });
}
