/**
 * Этап 9.0 — карта звёздных систем галактики (ADR-019).
 * Проверяет: детерминизм, «много систем в одной галактике», 1–5 планет на орбитах вокруг звезды,
 * центральную звезду, привязку систем игровых планет к координатам узлов графа и кеплеровы периоды.
 */
import { describe, expect, it } from 'vitest';
import type { GraphNode } from '../src/contracts/galaxy';
import {
  CORE_SYSTEM_ID,
  GALAXY_SEED,
  STAR_MAP_POLICY,
  buildGalaxyStarMap,
  generateSystemName,
  systemDesignation,
  systemForNode,
  validateStarMap,
} from '../src/galaxy/starMap';
import { SYSTEM_POLICY, buildStarSystemCatalog, classifyStar, orbitalPeriodDays, validateStarSystemCatalog } from '../src/galaxy/starSystems';

const SPIRAL = { arms: 4, b: 0.55, r0: 3.5, width: 3.2 };
const OUTER_RADIUS = 95;
const THICK = 3.2;

const node = (id: string, x: number, z: number, seed: number, discovered = true): GraphNode => ({
  id, planetId: id, name: discovered ? `Мир ${id}` : `Скрытый ${id}`,
  x, y: 0.2, z, geometryName: 'Crystalline', biome: 'Ice', geometry: 'crystal',
  frequency: 0.5, seed, armId: 'frost', discovered,
});

const STARTERS: readonly GraphNode[] = [node('ferrum', -2.6, 0.4, 15929600), node('krios', 3, -0.9, 13045769, false)];

function buildMap(nodes: readonly GraphNode[] = STARTERS) {
  return buildGalaxyStarMap({ nodes, spiral: SPIRAL, outerRadius: OUTER_RADIUS, thickness: THICK });
}

describe('Этап 9.0 — карта звёздных систем', () => {
  it('детерминирована: две сборки бит-в-бит идентичны, seed карты фиксирован', () => {
    const a = buildMap();
    const b = buildMap();
    expect(a.seed).toBe(GALAXY_SEED);
    expect(a).toEqual(b);
    expect(JSON.stringify(a.systems)).toBe(JSON.stringify(b.systems));
  });

  it('систем много: ядро + системы узлов графа + фоновые системы', () => {
    const map = buildMap();
    expect(map.systemCount).toBe(1 + STARTERS.length + STAR_MAP_POLICY.backgroundSystems);
    expect(map.systemCount).toBeGreaterThan(30);
    expect(map.systems.filter((system) => system.hostNodeId === null).length).toBeGreaterThan(30);
  });

  it('в каждой системе 1–5 планет, орбиты монотонно расходятся от звезды', () => {
    const map = buildMap();
    expect(validateStarMap(map)).toEqual([]);
    for (const system of map.systems) {
      expect(system.planets.length).toBeGreaterThanOrEqual(SYSTEM_POLICY.freeMinPlanets);
      expect(system.planets.length).toBeLessThanOrEqual(SYSTEM_POLICY.hostMaxPlanets);
      const axes = system.planets.map((planet) => planet.semiMajorAxis);
      expect(axes).toEqual([...axes].sort((left, right) => left - right));
      expect(new Set(axes).size).toBe(axes.length);
      expect(system.planets.every((planet, index) => planet.orbitIndex === index)).toBe(true);
      for (const planet of system.planets) {
        expect(Number.isFinite(planet.periodDays)).toBe(true);
        expect(planet.periodDays).toBeGreaterThan(0);
        expect(Math.abs(planet.eccentricity)).toBeLessThanOrEqual(SYSTEM_POLICY.maxEccentricity + 1e-9);
        expect(Math.abs(planet.inclination)).toBeLessThanOrEqual(SYSTEM_POLICY.maxInclinationRad + 1e-9);
      }
    }
  });

  it('на карте встречаются системы и с одной планетой, и с пятью', () => {
    const map = buildMap();
    const counts = new Set(map.systems.map((system) => system.planets.length));
    expect(counts.has(1)).toBe(true);
    expect(counts.has(5)).toBe(true);
  });

  it('центральная звезда галактики: в начале координат, нанесена на карту, без игрового мира-хоста', () => {
    const map = buildMap();
    const core = map.byId[CORE_SYSTEM_ID];
    expect(core).toBeDefined();
    expect(core?.position).toEqual({ x: 0, y: 0, z: 0 });
    expect(core?.core).toBe(true);
    expect(core?.charted).toBe(true);
    expect(core?.hostNodeId).toBeNull();
    expect(core?.armId).toBe('core');
    expect(core?.sectorId).toBe('core');
    expect(core?.planets.length).toBe(STAR_MAP_POLICY.corePlanetCount);
  });

  it('система игровой планеты стоит на поселенческом кольце: направление узла сохранено, радиус из полосы (Этап 9.2)', () => {
    const map = buildMap();
    for (const source of STARTERS) {
      const system = systemForNode(map, source.id);
      expect(system?.id).toBe(`sys:${source.id}`);
      // Этап 9.2: координаты узла графа (радиус ~4–8) на диске 95 сливались бы в центре,
      // поэтому система получает направление узла, но радиус из кольца политики.
      const radius = Math.hypot(system?.position.x ?? 0, system?.position.z ?? 0);
      expect(radius).toBeGreaterThanOrEqual(OUTER_RADIUS * STAR_MAP_POLICY.nodeRingInner * 0.999);
      expect(radius).toBeLessThanOrEqual(OUTER_RADIUS * STAR_MAP_POLICY.nodeRingOuter * 1.001);
      expect(Math.atan2(system?.position.z ?? 0, system?.position.x ?? 1)).toBeCloseTo(Math.atan2(source.z, source.x), 9);
      expect(system?.position.y).toBe(source.y);
      expect(system?.hostNodeId).toBe(source.id);
      expect(system?.planets[0]).toMatchObject({ orbitIndex: 0, planetId: source.id, status: 'bound', eccentricity: 0, inclination: 0 });
      expect(system?.planets.slice(1).every((planet) => planet.status === 'candidate' && planet.planetId === null)).toBe(true);
    }
  });

  it('неоткрытый узел даёт систему без имени и не наносится на карту (спойлеров нет)', () => {
    const map = buildMap();
    const krios = systemForNode(map, 'krios');
    expect(krios?.charted).toBe(false);
    expect(krios?.name).not.toBe('Скрытый krios');
    expect(krios?.hostNodeId).toBe('krios');
  });

  it('игровой каталог системы (Этап 7.4) согласован с картой: тот же seed, звезда и орбиты', () => {
    const map = buildMap([node('ferrum', -2.6, 0.4, 15929600)]);
    const system = systemForNode(map, 'ferrum')!;
    const catalog = buildStarSystemCatalog(node('ferrum', -2.6, 0.4, 15929600))!;
    expect(validateStarSystemCatalog(catalog)).toEqual([]);
    expect(catalog.seed).toBe(system.seed);
    expect(catalog.star).toEqual(system.star);
    expect(catalog.bodies.length).toBe(system.planets.length);
    expect(catalog.bodies.map((body) => body.semiMajorAxis)).toEqual(system.planets.map((planet) => planet.semiMajorAxis));
  });

  it('фоновые системы лежат внутри галактического диска и не слипаются', () => {
    const map = buildMap();
    const background = map.systems.filter((system) => system.id.startsWith('sys:bg:'));
    expect(background.length).toBe(STAR_MAP_POLICY.backgroundSystems);
    for (const system of background) {
      expect(Math.hypot(system.position.x, system.position.z)).toBeLessThanOrEqual(OUTER_RADIUS * 1.05);
      expect(Math.abs(system.position.y)).toBeLessThanOrEqual(THICK);
      expect(Number.isFinite(system.position.x)).toBe(true);
      expect(system.planets.every((planet) => planet.status === 'candidate')).toBe(true);
      expect(system.charted).toBe(true);
      expect(system.name.length).toBeGreaterThan(2);
      expect(system.designation).toMatch(/^VOR-[Α-Ω]-\d{3}$/);
    }
    for (let i = 0; i < background.length; i++) {
      for (let j = i + 1; j < background.length; j++) {
        const a = background[i]!;
        const b = background[j]!;
        const d = Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y, a.position.z - b.position.z);
        expect(d, `${a.id} ↔ ${b.id}`).toBeGreaterThanOrEqual(STAR_MAP_POLICY.minSystemSeparation * 0.999);
      }
    }
  });

  it('рукава: фоновые системы распределены минимум по двум спиральным рукавам', () => {
    const map = buildMap();
    const arms = new Set(map.systems.filter((system) => system.id.startsWith('sys:bg:')).map((system) => system.armId));
    expect(arms.size).toBeGreaterThanOrEqual(2);
  });

  it('фоновые системы не зависят от узлов графа: открытие мира ничего не сдвигает', () => {
    const before = buildMap();
    const after = buildMap([...STARTERS, node('planet_03', 41, -28, 777001)]);
    expect(after.systemCount).toBe(before.systemCount + 1);
    for (const system of before.systems) {
      expect(after.byId[system.id]?.position).toEqual(system.position);
      expect(after.byId[system.id]?.planets).toEqual(system.planets);
      expect(after.byId[system.id]?.designation).toBe(system.designation);
      expect(after.byId[system.id]?.star).toEqual(system.star);
    }
    const backgroundBefore = before.systems.filter((item) => item.id.startsWith('sys:bg:'));
    const backgroundAfter = after.systems.filter((item) => item.id.startsWith('sys:bg:'));
    expect(backgroundAfter).toEqual(backgroundBefore);
  });

  it('радиус карты покрывает все системы — рендер масштабирует диск по данным, а не по константе', () => {
    const map = buildMap();
    const max = Math.max(...map.systems.map((system) => Math.hypot(system.position.x, system.position.y, system.position.z)));
    expect(max).toBeLessThanOrEqual(map.radius);
    // Радиус диска — конфигурационная величина: он не меняется при открытии миров.
    expect(map.radius).toBe(OUTER_RADIUS);
    expect(buildMap([...STARTERS, node('planet_03', 41, -28, 777001)]).radius).toBe(map.radius);
  });

  it('кеплеров период: P² / a³ одинаков для всех планет одной звезды и растёт с полуосью', () => {
    const star = classifyStar(12345);
    const ratio = (a: number): number => {
      const p = orbitalPeriodDays(a, star) / 365.25;
      return (p * p) / (a * a * a);
    };
    expect(ratio(1)).toBeCloseTo(ratio(4), 6);
    expect(orbitalPeriodDays(4, star)).toBeGreaterThan(orbitalPeriodDays(1, star));
    expect(orbitalPeriodDays(1, { class: 'red' })).toBeGreaterThan(orbitalPeriodDays(1, { class: 'blue' }));
  });

  it('звезда: класс → цвет/радиус/масса из единой политики, все значения конечны', () => {
    for (const seed of [1, 7, 999, 15929600, 0x50505f53]) {
      const star = classifyStar(seed);
      expect(SYSTEM_POLICY.starColorByClass[star.class]).toMatch(/^#[0-9a-f]{6}$/i);
      expect(star.color).toBe(SYSTEM_POLICY.starColorByClass[star.class]);
      expect(star.radiusScale).toBe(SYSTEM_POLICY.starRadiusByClass[star.class]);
      expect(star.temperatureK).toBeGreaterThan(0);
      expect(star.luminosity).toBeGreaterThan(0);
    }
  });

  it('имена и обозначения систем стабильны и не повторяются в пределах карты', () => {
    expect(generateSystemName(42)).toBe(generateSystemName(42));
    expect(systemDesignation('forge', 7)).toBe('VOR-Β-107');
    const map = buildMap();
    const ids = map.systems.map((system) => system.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
