/**
 * Этап 9.0 — проекция карты звёздных систем в рендер-модель галактики.
 * Проверяет, что галактика рисуется по фактическим данным систем (а не по константе),
 * что звезда всегда помещается внутри первой орбиты, и что неразведанные орбиты
 * не раскрывают класс тела.
 */
import { describe, expect, it } from 'vitest';
import type { GraphNode } from '../src/contracts/galaxy';
import { STAR_MAP_POLICY, buildGalaxyStarMap } from '../src/galaxy/starMap';
import {
  GALAXY_RENDER_POLICY,
  ORBIT_BODY_COLORS,
  UNCHARTED_STAR_COLOR,
  buildGalaxyRenderData,
  findRenderSystem,
  findRenderSystemByNode,
} from '../src/renderer/galaxyModel';

const SPIRAL = { arms: 4, b: 0.55, r0: 3.5, width: 3.2 };

const node = (id: string, x: number, z: number, seed: number, discovered = true): GraphNode => ({
  id, planetId: id, name: discovered ? `Мир ${id}` : `Скрытый ${id}`,
  x, y: 0.2, z, geometryName: 'Crystalline', biome: 'Ice', geometry: 'crystal',
  frequency: 0.5, seed, armId: 'frost', discovered,
});

const NODES: readonly GraphNode[] = [
  node('ferrum', -2.6, 0.4, 15929600),
  node('krios', 3, -0.9, 13045769, false),
  node('planet_03', 41, -28, 777001),
];

const starMap = buildGalaxyStarMap({ nodes: NODES, spiral: SPIRAL, outerRadius: 95, thickness: 3.2 });

function build(overrides: { systems?: typeof starMap.systems; revealedOrbits?: Record<string, number[]>; unlockedIds?: string[] } = {}) {
  return buildGalaxyRenderData({
    nodes: NODES,
    edges: [['ferrum', 'planet_03']],
    unlockedIds: overrides.unlockedIds ?? ['ferrum'],
    activeId: 'ferrum',
    systems: overrides.systems ?? starMap.systems,
    systemSpacing: STAR_MAP_POLICY.minSystemSeparation,
    discRadius: starMap.radius,
    revealedOrbits: overrides.revealedOrbits,
  });
}

describe('Этап 9.0 — рендер-модель звёздных систем', () => {
  it('проецирует каждую систему в координаты сцены тем же масштабом, что и узлы графа', () => {
    const data = build();
    expect(data.systems.length).toBe(starMap.systems.length);
    for (const system of data.systems) {
      const source = starMap.byId[system.id]!;
      expect(system.x).toBeCloseTo(source.position.x * data.scale, 9);
      expect(system.z).toBeCloseTo(source.position.z * data.scale, 9);
      expect(system.planetCount).toBe(source.planets.length);
      expect(system.planetCount).toBeGreaterThanOrEqual(1);
      expect(system.planetCount).toBeLessThanOrEqual(5);
      expect(system.orbits.length).toBe(source.planets.length);
    }
  });

  it('диск галактики строится от радиуса карты систем, а не от константы 18', () => {
    const nodesOnly = buildGalaxyRenderData({ nodes: NODES, edges: [], unlockedIds: ['ferrum'], activeId: 'ferrum' });
    const withSystems = build();
    expect(nodesOnly.systems).toEqual([]);
    // Регулярная запись бага Этапа 8: декорации строились от константы 18 и не совпадали
    // с облаком узлов — галактика выглядела пустой. Теперь диск равен радиусу карты систем.
    expect(nodesOnly.discRadius).toBe(nodesOnly.bounds);
    expect(withSystems.discRadius).toBeGreaterThan(nodesOnly.bounds);
    expect(withSystems.discRadius).toBeCloseTo(starMap.radius * withSystems.scale, 9);
    // Диск берётся из конфигурации галактики, поэтому он стабилен и не меньше облака узлов.
    expect(withSystems.discRadius).toBeGreaterThanOrEqual(withSystems.bounds);
    const maxSystem = Math.max(...withSystems.systems.map((system) => Math.hypot(system.x, system.y, system.z)));
    expect(withSystems.discRadius).toBeGreaterThanOrEqual(maxSystem);
  });

  it('звезда всегда помещается внутри первой орбиты, орбиты расходятся монотонно', () => {
    const data = build();
    for (const system of data.systems) {
      const radii = system.orbits.map((orbit) => orbit.radius);
      expect(radii).toEqual([...radii].sort((left, right) => left - right));
      expect(new Set(radii).size).toBe(radii.length);
      expect(system.starRadius).toBeGreaterThan(0);
      expect(system.starRadius).toBeLessThanOrEqual(radii[0]! * GALAXY_RENDER_POLICY.starToInnerOrbitRatio + 1e-9);
      const glowFactor = GALAXY_RENDER_POLICY.glowMultiplier * (system.core ? GALAXY_RENDER_POLICY.coreGlowBoost : 1);
      expect(system.glowRadius).toBeCloseTo(system.starRadius * glowFactor, 9);
      // Система не должна вылезать за отведённый ей шаг, иначе кольца соседних систем сливаются.
      const spacing = STAR_MAP_POLICY.minSystemSeparation * data.scale;
      expect(radii[radii.length - 1]!).toBeLessThanOrEqual(spacing * GALAXY_RENDER_POLICY.orbitFillRatio + 1e-9);
    }
  });

  it('орбиты сжаты по степени: внутренняя орбита различима рядом со звездой', () => {
    const data = build();
    const system = data.systems.find((item) => item.orbits.length >= 3)!;
    const ratio = system.orbits[system.orbits.length - 1]!.radius / system.orbits[0]!.radius;
    const linear = system.orbits[system.orbits.length - 1]!.semiMajorAxisAu / system.orbits[0]!.semiMajorAxisAu;
    expect(ratio).toBeLessThan(linear);
    expect(ratio).toBeGreaterThan(1);
  });

  it('система игровой планеты: орбита 0 привязана к миру, активная система подсвечена', () => {
    const data = build({ unlockedIds: ['ferrum', 'planet_03'] });
    const ferrum = findRenderSystemByNode(data, 'ferrum')!;
    expect(ferrum.id).toBe('sys:ferrum');
    expect(ferrum.hostNodeId).toBe('ferrum');
    expect(ferrum.discovered).toBe(true);
    expect(ferrum.active).toBe(true);
    expect(ferrum.unlocked).toBe(true);
    expect(ferrum.orbits[0]).toMatchObject({ orbitIndex: 0, status: 'bound', planetId: 'ferrum', revealed: true });
    expect(ferrum.orbits[0]!.color).toBe(ORBIT_BODY_COLORS['terrestrial']);
    expect(ferrum.orbits.slice(1).every((orbit) => orbit.status === 'candidate' && orbit.planetId === null)).toBe(true);
    expect(findRenderSystem(data, 'sys:ferrum')?.id).toBe('sys:ferrum');
    expect(findRenderSystem(data, 'sys:missing')).toBeNull();
  });

  it('неоткрытый узел: система не нанесена на карту, звезда тусклая, имя не раскрывается', () => {
    const data = build();
    const krios = findRenderSystemByNode(data, 'krios')!;
    expect(krios.charted).toBe(false);
    expect(krios.discovered).toBe(false);
    expect(krios.starColor).toBe(UNCHARTED_STAR_COLOR);
    expect(krios.name).toBe('Неизвестный сигнал');
  });

  it('фоновые системы нанесены на карту, но их планеты не идентифицированы до исследования', () => {
    const data = build();
    const background = data.systems.filter((system) => system.id.startsWith('sys:bg:'));
    expect(background.length).toBe(STAR_MAP_POLICY.backgroundSystems);
    for (const system of background) {
      expect(system.charted).toBe(true);
      expect(system.discovered).toBe(false);
      expect(system.hostNodeId).toBeNull();
      expect(system.unlocked).toBe(false);
      expect(system.name.length).toBeGreaterThan(2);
      expect(system.starColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(system.orbits.every((orbit) => orbit.bodyClass === 'unknown' && !orbit.revealed)).toBe(true);
      expect(system.orbits.every((orbit) => orbit.color === ORBIT_BODY_COLORS['unknown'])).toBe(true);
    }
  });

  it('центральная звезда галактики крупнее обычных и находится в начале координат сцены', () => {
    const data = build();
    const core = findRenderSystem(data, 'sys:core')!;
    expect(core.core).toBe(true);
    expect(core.x).toBe(0);
    expect(core.y).toBe(0);
    expect(core.z).toBe(0);
    expect(core.starRadius).toBeGreaterThan(0);
    // Центральная звезда читается как ядро галактики за счёт усиленного гало.
    const ordinaryGlow = Math.max(...data.systems.filter((system) => !system.core).map((system) => system.glowRadius));
    expect(core.glowRadius).toBeGreaterThan(ordinaryGlow);
    expect(core.starRadius).toBeLessThanOrEqual(core.orbits[0]!.radius * GALAXY_RENDER_POLICY.starToInnerOrbitRatio + 1e-9);
  });

  it('исследованные орбиты раскрывают класс тела, неисследованные — нет', () => {
    const target = starMap.systems.find((system) => system.hostNodeId === 'ferrum')!;
    const before = build();
    const ferrumBefore = findRenderSystemByNode(before, 'ferrum')!;
    expect(ferrumBefore.orbits[2]?.revealed).toBe(false);
    const after = build({ revealedOrbits: { [target.id]: [2] } });
    const ferrumAfter = findRenderSystemByNode(after, 'ferrum')!;
    expect(ferrumAfter.orbits[2]?.revealed).toBe(true);
    expect(ferrumAfter.orbits[2]?.bodyClass).not.toBe('unknown');
    expect(ferrumAfter.orbits[1]?.revealed).toBe(false);
  });

  it('без карты систем проекция остаётся совместимой с Этапом 7 (обратная совместимость)', () => {
    const data = buildGalaxyRenderData({ nodes: NODES, edges: [['ferrum', 'planet_03']], unlockedIds: ['ferrum'], activeId: 'ferrum' });
    expect(data.systems).toEqual([]);
    expect(data.nodes.length).toBe(3);
    expect(data.edges).toEqual([['ferrum', 'planet_03']]);
    expect(data.bounds).toBeGreaterThan(0);
    expect(data.discRadius).toBe(data.bounds);
  });
});
