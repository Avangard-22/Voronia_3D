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
  readonly path: readonly string[];
  readonly nextHop: string;
  readonly hops: number;
  readonly totalDistance: number;
  readonly totalEnergy: number;
  readonly firstLeg: RouteLeg;
}
