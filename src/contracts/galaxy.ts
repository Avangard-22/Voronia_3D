/**
 * contracts/galaxy.ts — граф галактики и позиции узлов (parity 1.x: `ge.PlanetaryGraph`, bundle @103400).
 * Узлы хранят позицию {x,y,z} (диск галактики в плоскости XZ, y — «толщина»), armId и метаданные планеты.
 * version: 5 (1.x oi()).
 */

export interface GalaxyPos {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Узел планетарного графа (1.x Yf: объект узла, кладётся в PlanetaryGraph.nodes). */
export interface GraphNode extends GalaxyPos {
  readonly id: string;
  readonly planetId: string;
  readonly name: string;
  readonly geometryName: string;
  readonly biome: string;
  readonly geometry: string;
  readonly frequency: number;
  readonly seed: number;
  readonly armId: string;
  readonly discovered: boolean;
}

export interface PlanetaryGraph {
  version: number;
  nodes: Record<string, GraphNode>;
  /** Рёбра — пары id (1.x: [["ferrum","krios"], …]); дубликаты исключает Hs/Us. */
  edges: [string, string][];
}

export const GALAXY_GRAPH_VERSION = 5;

/** Константы спиральной модели (1.x window.CC_SPIRAL / registry galaxy.arms): r0, b, arms, width. */
export interface SpiralConfig {
  readonly arms: number;
  readonly b: number;
  readonly r0: number;
  readonly width: number;
}

/** Параметры генерации позиции (registry galaxy.gen). */
export interface GalaxyGenConfig {
  readonly armBias: number;
  readonly starterExclusionR: number;
  readonly starterZoneR: number;
  readonly outerRadius: number;
  readonly maxTries: number;
  readonly radialBias: number;
  readonly frontChance: number;
  readonly frontRadius: number;
}

/** Параметры рендера/расстановки узлов (registry galaxy.nodeRender); генератор использует THICK и MIN_DIST. */
export interface NodeRenderConfig {
  readonly BASE_R: number;
  readonly SCALE: number;
  readonly MIN_DIST: number;
  readonly THICK: number;
}

/* ——————————————————— Этап 9.0: слой звёздных систем (ADR-019) ———————————————————
 * Галактика = множество звёздных систем. В центре системы — звезда, вокруг неё 1–5 планет
 * на орбитах. Типы живут в contracts, потому что слой используют два домена (galaxy — генерация,
 * renderer — проекция), а R2 запрещает доменам импортировать друг друга.
 */

/** Спектральный класс звезды (согласован с `galaxy/starSystems.ts`, Этап 7.4). */
export type StarSpectralClass = 'blue' | 'white' | 'yellow' | 'orange' | 'red';

/** Класс орбитального тела. `terrestrial|ice|gas-giant|dwarf|asteroid-belt` — из Этапа 7.4. */
export type OrbitBodyClass = 'terrestrial' | 'ice' | 'gas-giant' | 'dwarf' | 'asteroid-belt' | 'unknown';

/** Звезда — центр системы. `radiusScale` — относительный визуальный радиус (1.0 = звезда типа Солнца). */
export interface StarDescriptor {
  readonly class: StarSpectralClass;
  readonly temperatureK: number;
  readonly luminosity: number;
  /** CSS-цвет для рендерера; домен не знает про three.js. */
  readonly color: string;
  readonly radiusScale: number;
}

/** Статус планеты в системе: привязана к игровому миру или ещё не исследована. */
export type SystemPlanetStatus = 'bound' | 'candidate';

/** Одна планета на орбите звезды. Орбитальные элементы — в астрономических единицах и радианах. */
export interface SystemPlanetOrbit {
  readonly orbitIndex: number;
  readonly semiMajorAxis: number;
  readonly eccentricity: number;
  readonly inclination: number;
  readonly ascendingNode: number;
  readonly orbitalPhase: number;
  /** Сидерический период в сутках (III закон Кеплера, масса звезды в массах Солнца). */
  readonly periodDays: number;
  readonly bodyClass: OrbitBodyClass;
  /** id игровой планеты (GraphNode.id) либо null, если мир ещё не подтверждён. */
  readonly planetId: string | null;
  readonly status: SystemPlanetStatus;
}

export interface StarSystemDescriptor {
  /** `sys:<nodeId>` для системы игровой планеты, `sys:bg:<index>` для фоновой, `sys:core` для ядра. */
  readonly id: string;
  readonly name: string;
  /** Каталогическое обозначение (например `VOR-α-114`) — стабильно, не зависит от открытия. */
  readonly designation: string;
  readonly seed: number;
  readonly star: StarDescriptor;
  readonly position: GalaxyPos;
  readonly armId: string;
  readonly sectorId: 'core' | 'inner' | 'mid' | 'outer';
  /** Узел планетарного графа, живущий в системе (null — система без подтверждённого мира). */
  readonly hostNodeId: string | null;
  /** Нанесена ли система на карту (видна на карте галактики). */
  readonly charted: boolean;
  /** Центральная звезда галактики. */
  readonly core: boolean;
  /** 1–5 планет, отсортированы по orbitIndex. */
  readonly planets: readonly SystemPlanetOrbit[];
}

/** Расчётная смета одного межпланетного перехода (Stage 6.6). */
export interface RouteLeg {
  readonly from: string;
  readonly to: string;
  readonly distance: number;
  readonly energyCost: number;
  readonly freightCost: number;
  readonly sectorId: 'core' | 'inner' | 'mid' | 'outer';
  readonly anomalyRisk: boolean;
}

export interface GalaxyRoute {
  readonly destinationId: string;
  readonly destinationName: string;
  /** Только остановки — открытые (unlocked) планеты. Транзитные системы проезжаются без посадки (Этап 8.1). */
  readonly path: readonly string[];
  readonly nextHop: string;
  readonly hops: number;
  readonly totalDistance: number;
  readonly totalEnergy: number;
  readonly firstLeg: RouteLeg;
  /** Системы без остановки на маршруте: нанесённые на карту, но не открытые, либо неизученные. */
  readonly transitNodeIds?: readonly string[];
}
