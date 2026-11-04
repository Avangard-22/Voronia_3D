/**
 * Stage 7.3 → Этап 9.2: визуальная модель системы для подробного вида.
 *
 * Раньше деталь выводилась из signalClass узла и давала подписи вида
 * «ЦЕНТРАЛЬНАЯ ЗВЕЗДА · BLUE · BLUE · CRYO» — заглушку, обгоняющую каталог.
 * С Этапом 9.0 у галактики есть настоящий каталог звёздных систем
 * (`galaxy/starMap.ts` + `galaxy/starSystems.ts`), поэтому деталь принимает
 * каталожную сводку и берёт имя/обозначение/цвет звезды ИЗ НЕЁ. Без каталога
 * (узел ещё не нанесён на карту систем) остаётся детерминированный fallback,
 * но подпись строится из имени мира, а не из классов сигналов.
 */
import type { GalaxyRenderNode } from './galaxyModel';

export interface GalaxySystemCatalogBrief {
  /** Собственное имя системы из каталога (или имя подтверждённого мира). */
  readonly title: string;
  /** Каталогическое обозначение (`VOR-Α-001` …). */
  readonly designation: string;
  /** Цвет звезды из каталога (StarDescriptor.color). */
  readonly starColor: string;
  /** Подпись спектрального класса: «yellow · 5772 K». */
  readonly starLabel: string;
  readonly temperatureK: number;
  readonly luminosity: number;
  readonly planetCount: number;
}

export interface GalaxySystemDetail {
  readonly nodeId: string;
  readonly starClass: 'blue' | 'white' | 'amber' | 'violet';
  readonly starColor: string;
  readonly planetColor: string;
  readonly orbitRadius: number;
  readonly orbitTilt: number;
  readonly orbitPhase: number;
  readonly anomaly: boolean;
  readonly title: string;
  /** Этап 9.2: каталожные данные системы (null — узел вне каталога). */
  readonly catalog: GalaxySystemCatalogBrief | null;
}

function hash(value: string): number {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  return result >>> 0;
}

/**
 * Возвращает визуальный макет известной системы. Орбитальная геометрия (радиус,
 * наклон, фаза) остаётся детерминированной от id узла: она нужна только подробному
 * виду и не входит в сейв. Каталог (имя, обозначение, звезда) — из Этапа 9.0.
 */
export function buildGalaxySystemDetail(node: GalaxyRenderNode | null | undefined, catalog: GalaxySystemCatalogBrief | null = null): GalaxySystemDetail | null {
  if (!node?.discovered) return null;
  const seed = hash(node.id);
  const starClass: GalaxySystemDetail['starClass'] = node.signalClass === 'cryo'
    ? 'blue'
    : node.signalClass === 'energy'
      ? 'amber'
      : node.signalClass === 'anomaly'
        ? 'violet'
        : (seed % 3 === 0 ? 'white' : 'amber');
  const fallbackColor = ({ blue: '#8bdcff', white: '#e8f4ff', amber: '#ffd078', violet: '#c99aff' } as const)[starClass];
  const planetColor = ({ anomaly: '#c18aff', cryo: '#8ceaff', energy: '#ffe18a', resource: '#72d8b0', unknown: '#a5d9ee' } as const)[node.signalClass];
  return {
    nodeId: node.id,
    starClass,
    starColor: catalog?.starColor ?? fallbackColor,
    planetColor,
    orbitRadius: 1.35 + ((seed >>> 8) % 45) / 100,
    orbitTilt: (((seed >>> 16) % 31) - 15) * Math.PI / 180,
    orbitPhase: ((seed >>> 4) % 360) * Math.PI / 180,
    anomaly: node.signalClass === 'anomaly',
    // Этап 9.2: имя системы из каталога, иначе имя подтверждённого мира.
    // Прежняя подпись «BLUE · CRYO» убрана: она дублировала класс и читалась как «BLUEBLUE».
    title: catalog?.title ?? node.name,
    catalog,
  };
}
