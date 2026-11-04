/** Stage 7.0 / Этап 9.0 — чистая проекция реального PlanetaryGraph и карты звёздных систем
 * в координаты 3D-сцены. Никакой генерации координат: позиции берутся из игровых данных.
 *
 * Этап 9.0 (ADR-019): галактика рисуется как множество звёздных систем — звезда в центре и
 * 1–5 планет на орбитах. Визуальный масштаб орбит подбирается так, чтобы системы не слипались,
 * а звезда гарантированно помещалась внутри первой орбиты.
 */
import type { GraphNode, StarSystemDescriptor } from '../contracts/galaxy';

export interface GalaxyRenderNode {
  readonly id: string;
  readonly seed: number;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly discovered: boolean;
  readonly unlocked: boolean;
  readonly active: boolean;
  readonly armId: string;
  readonly sectorId: 'core' | 'inner' | 'mid' | 'outer';
  readonly signalClass: 'anomaly' | 'energy' | 'cryo' | 'resource' | 'unknown';
}

/** Одна орбита системы в координатах сцены (радиус — в тех же единицах, что x/y/z). */
export interface GalaxyRenderOrbit {
  readonly orbitIndex: number;
  /** Большая полуось в единицах сцены. */
  readonly radius: number;
  /** Большая полуось в а.е. — для подписей в UI. */
  readonly semiMajorAxisAu: number;
  readonly eccentricity: number;
  readonly inclination: number;
  readonly phase: number;
  readonly periodDays: number;
  readonly bodyClass: string;
  readonly color: string;
  readonly size: number;
  readonly planetId: string | null;
  readonly status: 'bound' | 'candidate';
  /** Показывать ли планету: неразведанные орбиты не раскрывают класс тела. */
  readonly revealed: boolean;
}

export interface GalaxyRenderSystem {
  readonly id: string;
  readonly name: string;
  readonly designation: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly starColor: string;
  readonly starRadius: number;
  readonly glowRadius: number;
  readonly starClass: string;
  readonly temperatureK: number;
  /** Этап 9.2: светимость звезды в L☉ (0 — система не нанесена на карту). */
  readonly luminosity: number;
  readonly charted: boolean;
  readonly core: boolean;
  readonly hostNodeId: string | null;
  readonly discovered: boolean;
  readonly unlocked: boolean;
  readonly active: boolean;
  readonly planetCount: number;
  readonly orbits: readonly GalaxyRenderOrbit[];
}

export interface GalaxyRenderData {
  readonly nodes: readonly GalaxyRenderNode[];
  readonly edges: readonly (readonly [string, string])[];
  /** Звёздные системы (Этап 9.0). Пусто, если вызывающая сторона ещё не передаёт карту. */
  readonly systems: readonly GalaxyRenderSystem[];
  readonly bounds: number;
  /** Визуальный радиус галактического диска — рендер строит декорации по нему, а не по константе. */
  readonly discRadius: number;
  readonly scale: number;
}

/** Палитра орбитальных тел (согласована с палитрой системы Этапа 7.4). */
/** Цвет звезды системы, ещё не нанесённой на карту (скрытый сигнал). */
export const UNCHARTED_STAR_COLOR = '#33505f';

export const ORBIT_BODY_COLORS: Readonly<Record<string, string>> = Object.freeze({
  terrestrial: '#55b8a0',
  ice: '#9fe8ff',
  'gas-giant': '#d9a66c',
  dwarf: '#b6a8c9',
  'asteroid-belt': '#8b929d',
  unknown: '#5d7488',
});

export const GALAXY_RENDER_POLICY = Object.freeze({
  defaultScale: 0.08,
  /**
   * Визуальный радиус орбиты = orbitScale · a^orbitCompressionExponent.
   * Степень < 1 (сжатие) — осознанный приём: в реальном масштабе внутренние орбиты
   * неразличимы рядом со звездой, а так система читается как «звезда + кольца планет».
   */
  orbitCompressionExponent: 0.5,
  /** Доля расстояния между системами, отведённая под самую дальнюю орбиту. */
  orbitFillRatio: 0.46,
  minOrbitScale: 0.02,
  maxOrbitScale: 1.2,
  /** Звезда не может быть больше этой доли от радиуса первой орбиты. */
  starToInnerOrbitRatio: 0.55,
  starBaseRadius: 0.09,
  coreStarBoost: 1.8,
  glowMultiplier: 3.4,
  /** Гало центральной звезды дополнительно усилено — это визуальный центр галактики. */
  coreGlowBoost: 2.2,
  planetBaseSize: 0.042,
  planetSizeStep: 0.005,
  planetMinSize: 0.024,
  /** Запасной шаг между системами, если он не передан явно (мировые единицы). */
  fallbackSystemSpacing: 9,
} as const);

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** Квантиль попарных расстояний между системами — устойчивая оценка шага (минимум шумит в ядре). */
function spacingQuantile(positions: readonly { x: number; y: number; z: number }[], q: number): number {
  if (positions.length < 2) return 1;
  const distances: number[] = [];
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const a = positions[i]!;
      const b = positions[j]!;
      const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      if (d > 1e-6) distances.push(d);
    }
  }
  if (!distances.length) return 1;
  distances.sort((left, right) => left - right);
  return distances[Math.min(distances.length - 1, Math.max(0, Math.floor(q * distances.length)))] ?? 1;
}

export function buildGalaxyRenderData(input: {
  readonly nodes: readonly (GraphNode & { readonly signalClass?: GalaxyRenderNode['signalClass']; readonly sectorId?: GalaxyRenderNode['sectorId'] })[];
  readonly edges: readonly (readonly [string, string])[];
  readonly unlockedIds: readonly string[];
  readonly activeId: string;
  readonly scale?: number;
  /** Карта звёздных систем из `galaxy/starMap.ts` (composition root передаёт её целиком). */
  readonly systems?: readonly StarSystemDescriptor[];
  /** Какие орбитальные сигнатуры уже исследованы игроком: systemId → orbitIndex. */
  readonly revealedOrbits?: Readonly<Record<string, readonly number[]>>;
  /** Шаг между системами в мировых единицах (STAR_MAP_POLICY.minSystemSeparation) — для масштаба орбит. */
  readonly systemSpacing?: number;
  /**
   * Радиус галактического диска в мировых единицах (`GalaxyStarMap.radius`). Передаётся из
   * конфигурации, а не вычисляется по текущим узлам: иначе диск и дистанция камеры «дышали» бы
   * при каждом открытии мира.
   */
  readonly discRadius?: number;
}): GalaxyRenderData {
  const scale = Number.isFinite(input.scale) && (input.scale ?? 0) > 0 ? input.scale! : GALAXY_RENDER_POLICY.defaultScale;
  const unlocked = new Set(input.unlockedIds);
  const ids = new Set(input.nodes.map((node) => node.id));
  const discoveredIds = new Set(input.nodes.filter((node) => node.discovered).map((node) => node.id));
  const nodes = input.nodes.map((node): GalaxyRenderNode => ({
    id: node.id,
    seed: node.seed,
    name: node.discovered ? node.name : 'Неизвестный сигнал',
    x: node.x * scale,
    y: node.y * scale,
    z: node.z * scale,
    discovered: node.discovered,
    unlocked: unlocked.has(node.id),
    active: node.id === input.activeId,
    armId: node.discovered ? node.armId : '',
    sectorId: node.discovered ? (node.sectorId ?? 'outer') : 'outer',
    signalClass: node.discovered ? (node.signalClass ?? 'unknown') : 'unknown',
  }));
  const edges = input.edges.filter(([a, b]) => a !== b && ids.has(a) && ids.has(b) && discoveredIds.has(a) && discoveredIds.has(b));

  const sourceSystems = input.systems ?? [];
  const projected = sourceSystems.map((system) => ({
    system,
    x: system.position.x * scale,
    y: system.position.y * scale,
    z: system.position.z * scale,
  }));
  const exponent = GALAXY_RENDER_POLICY.orbitCompressionExponent;
  const maxSemiMajor = Math.max(1, ...sourceSystems.flatMap((system) => system.planets.map((planet) => planet.semiMajorAxis)));
  const spacing = Number.isFinite(input.systemSpacing) && (input.systemSpacing ?? 0) > 0
    ? input.systemSpacing! * scale
    : spacingQuantile(projected, 0.2);
  const orbitScale = clamp((spacing * GALAXY_RENDER_POLICY.orbitFillRatio) / Math.pow(maxSemiMajor, exponent), GALAXY_RENDER_POLICY.minOrbitScale, GALAXY_RENDER_POLICY.maxOrbitScale);
  const revealed = input.revealedOrbits ?? {};

  const systems: GalaxyRenderSystem[] = projected.map(({ system, x, y, z }) => {
    const hostNodeId = system.hostNodeId;
    /** `discovered` — в системе есть подтверждённый игровой мир; `charted` — система нанесена на карту. */
    const discovered = hostNodeId ? discoveredIds.has(hostNodeId) : system.core;
    const charted = system.charted || discovered;
    const innerOrbitRadius = Math.max(1e-4, Math.pow(system.planets[0]?.semiMajorAxis ?? 1, exponent) * orbitScale);
    const boost = system.core ? GALAXY_RENDER_POLICY.coreStarBoost : 1;
    const starRadius = clamp(
      GALAXY_RENDER_POLICY.starBaseRadius * system.star.radiusScale * boost,
      0.018,
      innerOrbitRadius * GALAXY_RENDER_POLICY.starToInnerOrbitRatio,
    );
    const orbits: GalaxyRenderOrbit[] = system.planets.map((planet) => {
      const bodyClass = planet.status === 'bound' || (revealed[system.id] ?? []).includes(planet.orbitIndex) ? planet.bodyClass : 'unknown';
      return {
        orbitIndex: planet.orbitIndex,
        radius: Math.pow(planet.semiMajorAxis, exponent) * orbitScale,
        semiMajorAxisAu: planet.semiMajorAxis,
        eccentricity: planet.eccentricity,
        inclination: planet.inclination,
        phase: planet.orbitalPhase,
        periodDays: planet.periodDays,
        bodyClass,
        color: ORBIT_BODY_COLORS[bodyClass] ?? ORBIT_BODY_COLORS['unknown']!,
        size: Math.max(GALAXY_RENDER_POLICY.planetMinSize, GALAXY_RENDER_POLICY.planetBaseSize - planet.orbitIndex * GALAXY_RENDER_POLICY.planetSizeStep),
        planetId: planet.planetId,
        status: planet.status,
        revealed: bodyClass !== 'unknown',
      };
    });
    return {
      id: system.id,
      name: charted ? system.name : 'Неизвестный сигнал',
      designation: system.designation,
      x, y, z,
      starColor: charted ? system.star.color : UNCHARTED_STAR_COLOR,
      starRadius,
      glowRadius: starRadius * GALAXY_RENDER_POLICY.glowMultiplier * (system.core ? GALAXY_RENDER_POLICY.coreGlowBoost : 1),
      starClass: system.star.class,
      temperatureK: system.star.temperatureK,
      luminosity: charted ? system.star.luminosity : 0,
      charted,
      core: system.core,
      hostNodeId,
      discovered,
      unlocked: hostNodeId ? unlocked.has(hostNodeId) : false,
      active: hostNodeId ? hostNodeId === input.activeId : false,
      planetCount: system.planets.length,
      orbits,
    };
  });

  const radii = [...nodes.map((node) => Math.hypot(node.x, node.y, node.z)), ...systems.map((system) => Math.hypot(system.x, system.y, system.z))];
  const bounds = Math.max(1, ...(radii.length ? radii : [1]));
  const configured = Number.isFinite(input.discRadius) && (input.discRadius ?? 0) > 0 ? input.discRadius! * scale : 0;
  return { nodes, edges, systems, bounds, discRadius: Math.max(bounds, configured), scale };
}

/** Система по узлу графа — для панели UI и перехода «система → поверхность». */
export function findRenderSystem(data: GalaxyRenderData, systemId: string | null | undefined): GalaxyRenderSystem | null {
  if (!systemId) return null;
  return data.systems.find((system) => system.id === systemId) ?? null;
}

/** Система, в которой живёт игровая узел (планета). */
export function findRenderSystemByNode(data: GalaxyRenderData, nodeId: string | null | undefined): GalaxyRenderSystem | null {
  if (!nodeId) return null;
  return data.systems.find((system) => system.hostNodeId === nodeId) ?? null;
}
