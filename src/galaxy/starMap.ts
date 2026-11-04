/**
 * Этап 9.0 — карта звёздных систем галактики (ADR-019).
 *
 * Модель: **Галактика = множество звёздных систем**. В центре каждой системы — звезда,
 * вокруг неё 1–5 планет на орбитах. Системы распределены по спиральным рукавам и ядру,
 * центральная звезда галактики находится в начале координат.
 *
 * Два класса систем:
 *  1. **Системы игровых планет** (`sys:<nodeId>`) — позиция берётся из узла PlanetaryGraph,
 *     орбита 0 занята подтверждённым миром, остальные орбиты — кандидаты на исследование.
 *  2. **Фоновые системы** (`sys:bg:<index>`) — звёзды, нанесённые на карту, но без подтверждённых
 *     миров. Именно они делают галактику населённой: их много, у каждой 1–5 планет.
 *
 * Всё детерминировано от `GALAXY_SEED` и seed узлов: карта не зависит от порядка открытий
 * и не хранится в сейве (выводится заново, как и остальные доменные проекции).
 */
import { mulberry32 } from '../contracts/rng';
import type { GalaxyPos, GraphNode, SpiralConfig, StarSystemDescriptor, SystemPlanetOrbit } from '../contracts/galaxy';
import { armIdAt } from './position';
import { galaxySector } from './exploration';
import { buildSystemOrbits, classifyStar, SYSTEM_POLICY } from './starSystems';

/** Seed карты галактики. Фиксирован: одна и та же галактика в каждом прохождении (детерминизм R7). */
export const GALAXY_SEED = 0x564f524f; // 'VORO'

export const CORE_SYSTEM_ID = 'sys:core';

/**
 * Политика карты звёздных систем. Единственное место, где настраивается населённость галактики
 * (ТЗ §15: баланс — через config/константы политики, не размазывать по коду).
 */
/** Буквы каталожных обозначений: рукав → греческая литера. */
const ARM_DESIGNATORS: Readonly<Record<string, string>> = Object.freeze({
  core: 'Α', inter: 'Ζ', forge: 'Β', frost: 'Γ', life: 'Δ', void: 'Ε',
});

export const STAR_MAP_POLICY = Object.freeze({
  /** Сколько фоновых систем наносить на карту сверх систем игровых планет. */
  backgroundSystems: 36,
  /** Минимальное расстояние между системами, мировые единицы (согласовано с galaxy.nodeRender.MIN_DIST). */
  minSystemSeparation: 9,
  /** Попыток размещения системы до перехода на запасную сетку. */
  placementTries: 64,
  /** Доля радиуса галактики, внутри которой фоновые системы плотнее (рукава у ядра). */
  coreBias: 0.22,
  /**
   * Этап 9.2: доля радиуса диска, полностью отведённая центральной звезде.
   * Внутри coreClearRadius нет НИЧЕГО, кроме якорной системы ядра: запрос владельца —
   * «зачем в центре ядра столько солнечных систем». Центр читается как одна звезда
   * с планетами на орбитах, а не как каша из систем.
   */
  coreClearRadius: 0.3,
  /**
   * Этап 9.2: поселенческое кольцо систем игровых планет (доли радиуса диска).
   * Узлы PlanetaryGraph живут в собственных координатах графа (радиус ~4–8 единиц),
   * которые на диске радиусом 95 слипались бы в центре. Система узла получает
   * НАПРАВЛЕНИЕ узла (угол сохраняется — ментальная карта игрока не ломается),
   * но радиус из кольца [nodeRingInner, nodeRingOuter]: детерминировано от seed узла,
   * не зависит от порядка открытий и от состава других узлов.
   */
  nodeRingInner: 0.38,
  nodeRingOuter: 0.56,
  /**
   * Центральная звезда галактики. Seed подобран так, что ядро — аналог Солнца:
   * жёлтый класс, 5772 K, 1.02 L☉ (запрос владельца: «центр Галактики — некая звезда, как Солнце»).
   */
  coreStarSeed: 153086,
  corePlanetCount: 5,
  /** Буквы каталожных обозначений по рукавам. */
  armDesignators: ARM_DESIGNATORS,
} as const);

export interface GalaxyStarMap {
  readonly seed: number;
  readonly systems: readonly StarSystemDescriptor[];
  readonly byId: Readonly<Record<string, StarSystemDescriptor>>;
  /** Индекс по узлу планетарного графа: nodeId → его система. */
  readonly byHostNode: Readonly<Record<string, StarSystemDescriptor>>;
  readonly coreSystemId: string;
  /** Радиус галактического диска в мировых единицах — стабильная величина для масштаба рендера. */
  readonly radius: number;
  readonly systemCount: number;
  readonly planetTotal: number;
}

export interface StarMapInput {
  readonly nodes: readonly GraphNode[];
  readonly spiral: SpiralConfig;
  readonly outerRadius: number;
  readonly thickness: number;
  readonly seed?: number;
  readonly policy?: Partial<typeof STAR_MAP_POLICY>;
}

function mix32(value: number): number {
  let x = value >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

/* ——————————————————— имена и обозначения (локально: R2 запрещает импорт из planets) ————— */

const NAME_START = ['Вор', 'Ке', 'Тар', 'Си', 'Оль', 'Ма', 'Ре', 'Га', 'Ни', 'Зе', 'Уль', 'Ха', 'Те', 'Ли'] as const;
const NAME_MID = ['ан', 'ор', 'и', 'ы', 'э', 'ал', 'ен', 'ир', 'ум', 'ос'] as const;
const NAME_END = ['ия', 'ос', 'ум', 'ар', 'ея', 'он', 'ида', 'ор', 'ант', 'ея-9'] as const;

/** Короткое собственное имя системы; детерминировано от seed. */
export function generateSystemName(seed: number): string {
  const rnd = mulberry32(mix32(seed ^ 0x2f6e2b1));
  const start = NAME_START[Math.floor(rnd() * NAME_START.length)]!;
  const mid = NAME_MID[Math.floor(rnd() * NAME_MID.length)]!;
  const end = NAME_END[Math.floor(rnd() * NAME_END.length)]!;
  return `${start}${mid}${end}`;
}

/** Каталогическое обозначение: `VOR-<буква рукава>-<номер>`. */
export function systemDesignation(armId: string, ordinal: number): string {
  const letter = STAR_MAP_POLICY.armDesignators[armId] ?? 'Ζ';
  return `VOR-${letter}-${(100 + (ordinal % 900)).toString()}`;
}

/* ——————————————————— размещение систем по рукавам ————————————————— */

/**
 * Позиция фоновой системы на спиральном рукаве (та же логарифмическая спираль, что и в
 * `galaxy/position.ts`, но без привязки к существующим узлам графа).
 */
function armPosition(random: () => number, spiral: SpiralConfig, outerRadius: number, thickness: number, coreBias: number, minRadius: number): GalaxyPos {
  const armIndex = Math.floor(random() * Math.max(1, spiral.arms));
  const t = coreBias * random() + (1 - coreBias) * Math.pow(random(), 0.72);
  const r = Math.max(minRadius, spiral.r0 * 0.6, spiral.r0 + t * Math.max(1, outerRadius - spiral.r0));
  const wind = Math.log(Math.max(0.1, r / spiral.r0)) / Math.max(0.05, spiral.b);
  const spread = (random() - 0.5) * (spiral.width / Math.max(1, r)) * 2.6;
  const angle = armIndex * ((Math.PI * 2) / Math.max(1, spiral.arms)) + wind + spread;
  return {
    x: Math.cos(angle) * r,
    y: (random() - 0.5) * thickness * (1.15 - Math.min(1, r / Math.max(1, outerRadius)) * 0.55),
    z: Math.sin(angle) * r,
  };
}

function distance2d(a: GalaxyPos, b: GalaxyPos): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function placeSystems(
  seed: number,
  count: number,
  taken: readonly GalaxyPos[],
  spiral: SpiralConfig,
  outerRadius: number,
  thickness: number,
  minSeparation: number,
  tries: number,
  coreBias: number,
  minRadius: number,
): GalaxyPos[] {
  const placed: GalaxyPos[] = [];
  const occupied = [...taken];
  for (let index = 0; index < count; index++) {
    const random = mulberry32(mix32(seed ^ Math.imul(index + 1, 0x9e3779b1)));
    let position: GalaxyPos | null = null;
    for (let attempt = 0; attempt < tries; attempt++) {
      const candidate = armPosition(random, spiral, outerRadius, thickness, coreBias, minRadius);
      if (occupied.every((other) => distance2d(other, candidate) >= minSeparation)) {
        position = candidate;
        break;
      }
    }
    if (!position) {
      // Запасная детерминированная сетка: золотой угол, как fallback в galaxy/position.ts.
      const golden = (index + 1) * 2.399963229728653;
      const r = Math.max(minRadius, spiral.r0 + ((index + 1) / Math.max(1, count)) * Math.max(1, outerRadius - spiral.r0));
      position = { x: Math.cos(golden) * r, y: ((index % 5) - 2) * thickness * 0.2, z: Math.sin(golden) * r };
    }
    occupied.push(position);
    placed.push(position);
  }
  return placed;
}

/* ——————————————————— сборка карты ————————————————— */

/**
 * Этап 9.2: позиция системы узла графа на поселенческом кольце.
 * Угол берётся ИЗ УЗЛА (направление сохраняется), радиус — детерминированная доля
 * кольца от seed узла. Не зависит от других узлов и от порядка открытий: добавление
 * нового мира не сдвигает уже нанесённые системы (инвариант Этапа 9.0).
 */
export function nodeRingPosition(node: GraphNode, outerRadius: number, policy: { nodeRingInner: number; nodeRingOuter: number } = STAR_MAP_POLICY): GalaxyPos {
  const graphRadius = Math.hypot(node.x, node.z);
  const angle = graphRadius > 1e-6 ? Math.atan2(node.z, node.x) : (mix32(node.seed >>> 0) % 360) * (Math.PI / 180);
  const frac = (mix32((node.seed >>> 0) ^ 0x51a7e) % 10000) / 10000;
  const radius = outerRadius * (policy.nodeRingInner + frac * (policy.nodeRingOuter - policy.nodeRingInner));
  return {
    x: Math.cos(angle) * radius,
    y: node.y,
    z: Math.sin(angle) * radius,
  };
}

function makeSystem(input: {
  id: string;
  seed: number;
  position: GalaxyPos;
  spiral: SpiralConfig;
  hostNodeId: string | null;
  hostName?: string | null;
  charted: boolean;
  core: boolean;
  ordinal: number;
  planets: readonly SystemPlanetOrbit[];
  /** Этап 9.2: каноничный рукав узла графа (иначе спиральная закрутка на радиусе кольца уводила бы систему в другой рукав). */
  armIdOverride?: string;
}): StarSystemDescriptor {
  const star = classifyStar(input.seed);
  const armId = input.core ? 'core' : (input.armIdOverride ?? armIdAt(input.position, input.spiral));
  return {
    id: input.id,
    name: input.core ? 'Центральная звезда' : (input.hostName ?? generateSystemName(input.seed)),
    designation: input.core ? 'VOR-Α-001' : systemDesignation(armId, input.ordinal),
    seed: input.seed,
    star,
    position: input.position,
    armId,
    sectorId: galaxySector(input.position).id,
    hostNodeId: input.hostNodeId,
    charted: input.charted,
    core: input.core,
    planets: input.planets,
  };
}

/**
 * Собирает полную карту звёздных систем галактики.
 * Порядок систем стабилен: ядро → системы узлов графа (по id) → фоновые системы (по индексу).
 */
export function buildGalaxyStarMap(input: StarMapInput): GalaxyStarMap {
  const policy = { ...STAR_MAP_POLICY, ...(input.policy ?? {}) };
  const seed = Number.isFinite(input.seed) ? (input.seed as number) >>> 0 : GALAXY_SEED;
  const systems: StarSystemDescriptor[] = [];

  // 1. Центральная звезда галактики — якорь всей карты.
  const coreStar = classifyStar(policy.coreStarSeed);
  systems.push(makeSystem({
    id: CORE_SYSTEM_ID,
    seed: policy.coreStarSeed,
    position: { x: 0, y: 0, z: 0 },
    spiral: input.spiral,
    hostNodeId: null,
    charted: true,
    core: true,
    ordinal: 0,
    planets: buildSystemOrbits(policy.coreStarSeed, coreStar, { min: policy.corePlanetCount, max: policy.corePlanetCount }),
  }));

  // 2. Системы игровых планет: позиция — ровно из узла графа (никакой перегенерации координат).
  const nodes = [...(input.nodes ?? [])].filter((node) => node && node.id).sort((a, b) => a.id.localeCompare(b.id));
  for (const node of nodes) {
    const systemSeed = mix32((node.seed >>> 0) ^ 0x51a7e);
    const star = classifyStar(systemSeed);
    const planets = buildSystemOrbits(systemSeed, star, {
      host: { planetId: node.id },
      min: SYSTEM_POLICY.hostMinPlanets,
      max: SYSTEM_POLICY.hostMaxPlanets,
    });
    systems.push(makeSystem({
      id: `sys:${node.id}`,
      seed: systemSeed,
      position: nodeRingPosition(node, input.outerRadius, policy),
      spiral: input.spiral,
      hostNodeId: node.id,
      hostName: node.discovered ? node.name : null,
      charted: node.discovered,
      core: false,
      ordinal: mix32(node.seed >>> 0) % 900,
      planets,
      armIdOverride: node.armId,
    }));
  }

  // 3. Фоновые системы: много звёзд на рукавах, у каждой 1–5 планет, ни одна не подтверждена.
  // ВАЖНО: размещение зависит ТОЛЬКО от seed карты и позиции ядра, но не от узлов графа —
  // иначе каждое открытие мира сдвигало бы все фоновые системы (регрессия поймана интеграционным тестом).
  const positions = placeSystems(
    seed, policy.backgroundSystems, [{ x: 0, y: 0, z: 0 }], input.spiral, input.outerRadius, input.thickness,
    policy.minSystemSeparation, policy.placementTries, policy.coreBias,
    policy.coreClearRadius * input.outerRadius,
  );
  positions.forEach((position, index) => {
    const systemSeed = mix32(seed ^ Math.imul(index + 1, 0x85ebca6b));
    const star = classifyStar(systemSeed);
    systems.push(makeSystem({
      id: `sys:bg:${index}`,
      seed: systemSeed,
      position,
      spiral: input.spiral,
      hostNodeId: null,
      charted: true,
      core: false,
      ordinal: index + 1,
      planets: buildSystemOrbits(systemSeed, star, {
        min: SYSTEM_POLICY.freeMinPlanets,
        max: SYSTEM_POLICY.freeMaxPlanets,
      }),
    }));
  });

  const byId: Record<string, StarSystemDescriptor> = {};
  const byHostNode: Record<string, StarSystemDescriptor> = {};
  let planetTotal = 0;
  let maxOccupied = 1;
  for (const system of systems) {
    byId[system.id] = system;
    if (system.hostNodeId) byHostNode[system.hostNodeId] = system;
    planetTotal += system.planets.length;
    maxOccupied = Math.max(maxOccupied, Math.hypot(system.position.x, system.position.y, system.position.z));
  }
  // Радиус диска — конфигурационный внешний радиус галактики: он не меняется при открытии миров,
  // поэтому масштаб сцены и дистанция камеры стабильны от кадра к кадру.
  const radius = Math.max(input.outerRadius, maxOccupied);
  return { seed, systems, byId, byHostNode, coreSystemId: CORE_SYSTEM_ID, radius, systemCount: systems.length, planetTotal };
}

/** Система узла планетарного графа (или null, если узел неизвестен карте). */
export function systemForNode(map: GalaxyStarMap, nodeId: string | null | undefined): StarSystemDescriptor | null {
  if (!nodeId) return null;
  return map.byHostNode[nodeId] ?? null;
}

/** Инварианты карты — проверяются тестами и `galaxy/validation.ts`. */
export function validateStarMap(map: GalaxyStarMap): readonly string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  for (const system of map.systems) {
    if (ids.has(system.id)) issues.push(`duplicate-system:${system.id}`);
    ids.add(system.id);
    if (system.planets.length < SYSTEM_POLICY.freeMinPlanets) issues.push(`too-few-planets:${system.id}`);
    if (system.planets.length > SYSTEM_POLICY.freeMaxPlanets) issues.push(`too-many-planets:${system.id}`);
    if (!Number.isFinite(system.position.x) || !Number.isFinite(system.position.z)) issues.push(`invalid-position:${system.id}`);
    const axes = system.planets.map((planet) => planet.semiMajorAxis);
    if (axes.some((value, index) => index > 0 && value <= axes[index - 1]!)) issues.push(`orbits-not-monotonic:${system.id}`);
    if (system.planets.some((planet) => planet.orbitIndex < 0)) issues.push(`invalid-orbit-index:${system.id}`);
    if (system.core && system.hostNodeId) issues.push('core-system-must-not-have-host');
    // Этап 9.2: зона центральной звезды принадлежит только якорной системе.
    if (!system.core) {
      const radial = Math.hypot(system.position.x, system.position.z);
      if (radial < map.radius * STAR_MAP_POLICY.coreClearRadius * 0.999) issues.push(`core-zone-violation:${system.id}`);
    }
  }
  if (!map.byId[CORE_SYSTEM_ID]) issues.push('missing-core-system');
  return issues;
}
