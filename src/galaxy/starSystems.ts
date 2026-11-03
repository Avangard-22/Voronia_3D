/** Stage 7.4 / Этап 9.0 — детерминированный доменный каталог тел звёздной системы.
 *
 * Каталог вычисляется из seed: одинаковый seed всегда даёт одинаковую систему (ADR-019).
 * Этап 9.0 вводит физическую модель «звезда в центре → 1–5 планет на орбитах»:
 *  - `classifyStar` — спектральный класс, температура, светимость, цвет и радиус звезды;
 *  - `buildSystemOrbits` — орбитальные элементы планет (a, e, i, фаза, период по III закону Кеплера);
 *  - `buildStarSystemCatalog` — прежный игровой каталог (Этап 7.4), теперь собираемый из тех же орбит.
 *
 * Первый мир системы — существующая игровая планета; остальные тела остаются неразведанными
 * кандидатами до команд `scanOrbitalBody` / `activateOrbitalBody`.
 */
import type { GraphNode, OrbitBodyClass, StarDescriptor, StarSpectralClass, SystemPlanetOrbit } from '../contracts/galaxy';

export type StarClass = StarSpectralClass;
export type SystemBodyClass = OrbitBodyClass;
export type SystemBodyStatus = 'confirmed' | 'unscanned';

/**
 * Единый блок политики звёздных систем (ТЗ §15: баланс только через config/константы политики).
 * Все числа Этапа 9.0 меняются здесь и больше нигде.
 */
export const SYSTEM_POLICY = Object.freeze({
  /** Система с подтверждённой игровой планетой: host + 1..4 неразведанные орбиты. */
  hostMinPlanets: 2,
  hostMaxPlanets: 5,
  /** Фоновая система галактики: бывает и одна планета, и пять. */
  freeMinPlanets: 1,
  freeMaxPlanets: 5,
  /** Большая полуось первой орбиты, а.е. */
  innerOrbitAu: 0.72,
  /** Шаг между соседними орбитами, а.е. */
  orbitSpacingAu: 0.78,
  /** Случайный разброс полуоси, а.е. */
  orbitJitterAu: 0.3,
  maxEccentricity: 0.2,
  /** Наклонение орбиты, рад (±). */
  maxInclinationRad: 0.14,
  /** Масса звезды в массах Солнца по спектральному классу — для периода обращения. */
  starMassByClass: Object.freeze({ blue: 6.2, white: 2.0, yellow: 1.0, orange: 0.72, red: 0.45 }),
  /** Визуальный радиус звезды относительно солнечного. */
  starRadiusByClass: Object.freeze({ blue: 1.9, white: 1.35, yellow: 1.0, orange: 0.78, red: 0.52 }),
  /** Цвет звезды для рендерера (домен не знает про three.js — отдаёт CSS-строку). */
  starColorByClass: Object.freeze({ blue: '#8bdcff', white: '#e8f4ff', yellow: '#ffe39a', orange: '#ffb66e', red: '#ff806f' }),
} as const);

export interface StarSystemBody {
  readonly id: string;
  readonly hostPlanetId: string;
  readonly name: string | null;
  readonly bodyClass: SystemBodyClass;
  readonly status: SystemBodyStatus;
  readonly orbitIndex: number;
  readonly semiMajorAxis: number;
  readonly eccentricity: number;
  readonly inclination: number;
  readonly orbitalPhase: number;
  readonly sourcePlanetId: string | null;
}

export interface StarSystemCatalog {
  readonly id: string;
  readonly seed: number;
  readonly hostPlanetId: string;
  readonly star: StarDescriptor;
  readonly bodies: readonly StarSystemBody[];
  readonly generatedAtVersion: 1;
}

function mix32(value: number): number {
  let x = value >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

function random01(seed: number, salt: number): number {
  return mix32(seed ^ Math.imul(salt + 1, 0x9e3779b1)) / 0x1_0000_0000;
}

/** Спектральный класс звезды по seed: распределение 1.x-подобное (8/12/36/28/16 %). */
export function classifyStar(seed: number): StarDescriptor {
  const roll = random01(seed, 1);
  const klass: StarSpectralClass = roll < 0.08 ? 'blue'
    : roll < 0.2 ? 'white'
      : roll < 0.56 ? 'yellow'
        : roll < 0.84 ? 'orange'
          : 'red';
  const temperatureK = klass === 'blue' ? 10000 + Math.round(random01(seed, 2) * 12000)
    : klass === 'white' ? 7500 + Math.round(random01(seed, 2) * 2500)
      : klass === 'yellow' ? 5200 + Math.round(random01(seed, 2) * 1300)
        : klass === 'orange' ? 3700 + Math.round(random01(seed, 2) * 1300)
          : 2400 + Math.round(random01(seed, 2) * 1300);
  const luminosity = klass === 'blue' ? 8 + random01(seed, 3) * 22
    : klass === 'white' ? 2 + random01(seed, 3) * 5
      : klass === 'yellow' ? 0.65 + random01(seed, 3) * 1.1
        : klass === 'orange' ? 0.12 + random01(seed, 3) * 0.5
          : 0.01 + random01(seed, 3) * 0.12;
  return {
    class: klass,
    temperatureK,
    luminosity,
    color: SYSTEM_POLICY.starColorByClass[klass],
    radiusScale: SYSTEM_POLICY.starRadiusByClass[klass],
  };
}

/** III закон Кеплера: P[сут] = 365.25 · √(a³ / M★). */
export function orbitalPeriodDays(semiMajorAxis: number, star: Pick<StarDescriptor, 'class'>): number {
  const mass = SYSTEM_POLICY.starMassByClass[star.class] ?? 1;
  const a = Math.max(0.01, semiMajorAxis);
  return 365.25 * Math.sqrt((a * a * a) / Math.max(0.05, mass));
}

/** Число планет в системе: детерминированно от seed, в пределах [min, max]. */
export function systemPlanetCount(seed: number, min: number, max: number, salt = 4): number {
  const lo = Math.max(1, Math.min(min, max));
  const hi = Math.max(lo, max);
  return lo + Math.floor(random01(seed, salt) * (hi - lo + 1));
}

const BODY_CLASSES: readonly OrbitBodyClass[] = ['terrestrial', 'ice', 'gas-giant', 'dwarf', 'asteroid-belt'];

export interface OrbitBuildOptions {
  /** Планета-хост на орбите 0 (игровая планета системы). Без хоста все орбиты — кандидаты. */
  readonly host?: { readonly planetId: string } | null;
  /** Границы числа планет; по умолчанию — фоновая система (1–5). */
  readonly min?: number;
  readonly max?: number;
}

/**
 * Орбитальные элементы планет системы. Орбита 0 — мир-хост (круговая, без наклона),
 * остальные — неразведанные кандидаты. Всё детерминировано от seed системы.
 */
export function buildSystemOrbits(seed: number, star: StarDescriptor, options: OrbitBuildOptions = {}): readonly SystemPlanetOrbit[] {
  const policy = SYSTEM_POLICY;
  const total = systemPlanetCount(seed, options.min ?? policy.freeMinPlanets, options.max ?? policy.freeMaxPlanets, 4);
  const orbits: SystemPlanetOrbit[] = [];
  for (let index = 0; index < total; index++) {
    const isHost = index === 0 && Boolean(options.host?.planetId);
    const semiMajorAxis = index === 0
      ? policy.innerOrbitAu + random01(seed, 5) * 0.9
      : policy.innerOrbitAu + index * policy.orbitSpacingAu + random01(seed, 20 + index) * policy.orbitJitterAu + 0.55;
    const roll = random01(seed, 10 + index);
    orbits.push({
      orbitIndex: index,
      semiMajorAxis,
      eccentricity: isHost ? 0 : random01(seed, 30 + index) * policy.maxEccentricity,
      inclination: isHost ? 0 : (random01(seed, 40 + index) - 0.5) * 2 * policy.maxInclinationRad,
      orbitalPhase: random01(seed, 50 + index) * Math.PI * 2,
      periodDays: orbitalPeriodDays(semiMajorAxis, star),
      bodyClass: isHost ? 'terrestrial' : BODY_CLASSES[Math.floor(roll * BODY_CLASSES.length)] ?? 'terrestrial',
      planetId: isHost ? options.host!.planetId : null,
      status: isHost ? 'bound' : 'candidate',
    });
  }
  return orbits;
}

/** Создаёт стабильную систему только для существующего узла; скрытые узлы отклоняются. */
export function buildStarSystemCatalog(node: Pick<GraphNode, 'id' | 'name' | 'seed' | 'discovered'> | null | undefined): StarSystemCatalog | null {
  if (!node?.discovered || !node.id || !Number.isFinite(node.seed)) return null;
  const seed = mix32(node.seed ^ 0x51a7e);
  const star = classifyStar(seed);
  const orbits = buildSystemOrbits(seed, star, {
    host: { planetId: node.id },
    min: SYSTEM_POLICY.hostMinPlanets,
    max: SYSTEM_POLICY.hostMaxPlanets,
  });
  const bodies: readonly StarSystemBody[] = orbits.map((orbit) => ({
    id: `body:${node.id}:${orbit.orbitIndex}`,
    hostPlanetId: node.id,
    name: orbit.status === 'bound' ? node.name : null,
    bodyClass: orbit.bodyClass,
    status: orbit.status === 'bound' ? 'confirmed' : 'unscanned',
    orbitIndex: orbit.orbitIndex,
    semiMajorAxis: orbit.semiMajorAxis,
    eccentricity: orbit.eccentricity,
    inclination: orbit.inclination,
    orbitalPhase: orbit.orbitalPhase,
    sourcePlanetId: orbit.status === 'bound' ? node.id : null,
  }));
  return { id: `system:${node.id}`, seed, hostPlanetId: node.id, star, bodies, generatedAtVersion: 1 };
}

/** Проверяет инварианты каталога перед передачей в UI/рендерер. */
export function validateStarSystemCatalog(catalog: StarSystemCatalog): readonly string[] {
  const issues: string[] = [];
  if (catalog.bodies.length < 1) issues.push('system-has-no-bodies');
  if (catalog.bodies.length > SYSTEM_POLICY.hostMaxPlanets) issues.push('system-exceeds-planet-cap');
  const ids = new Set<string>();
  for (const body of catalog.bodies) {
    if (ids.has(body.id)) issues.push(`duplicate-body:${body.id}`);
    ids.add(body.id);
    if (body.hostPlanetId !== catalog.hostPlanetId) issues.push(`wrong-host:${body.id}`);
    if (!Number.isFinite(body.semiMajorAxis) || body.semiMajorAxis <= 0) issues.push(`invalid-orbit:${body.id}`);
    if (body.status === 'confirmed' && (!body.sourcePlanetId || !body.name)) issues.push(`confirmed-body-without-source:${body.id}`);
    if (body.status === 'unscanned' && (body.sourcePlanetId || body.name)) issues.push(`unscanned-body-leaks-identity:${body.id}`);
  }
  if (catalog.bodies[0]?.status !== 'confirmed' || catalog.bodies[0]?.sourcePlanetId !== catalog.hostPlanetId) issues.push('host-world-not-first-confirmed-body');
  const axes = catalog.bodies.map((body) => body.semiMajorAxis);
  if (axes.some((value, index) => index > 0 && value <= axes[index - 1]!)) issues.push('orbits-not-monotonic');
  return issues;
}
