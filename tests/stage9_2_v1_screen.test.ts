/**
 * Этап 9.2 — «экран v1» и чистое ядро галактики (ADR-020).
 *
 * Владелец по скриншоту: «зачем в центре ядра столько солнечных систем» и
 * «ячейки должны работать как в версии 1, а не карточками внизу». Проверяем
 * доменную часть изменений:
 *  1. зона центральной звезды пуста (там только sys:core);
 *  2. системы игровых планет живут на поселенческом кольце: направление узла
 *     сохранено, радиус из полосы политики, позиция стабильна при открытиях;
 *  3. фоновые системы не проваливаются в центр;
 *  4. подписи спектральных классов человекочитаемы (конец «ЦЕНТРАЛЬНАЯ ЗВЕЗДА · YELLOW»);
 *  5. рендер-проекция несёт каталожную светимость и ядро в начале координат.
 */
import { describe, expect, it } from 'vitest';
import type { GraphNode } from '../src/contracts/galaxy';
import {
  CORE_SYSTEM_ID,
  STAR_MAP_POLICY,
  buildGalaxyStarMap,
  nodeRingPosition,
  systemForNode,
  validateStarMap,
} from '../src/galaxy/starMap';
import { STAR_CLASS_LABELS } from '../src/galaxy/starSystems';
import { buildGalaxyRenderData } from '../src/renderer/galaxyModel';

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

const radial = (x: number, z: number): number => Math.hypot(x, z);

describe('Этап 9.2 — чистое ядро галактики', () => {
  it('зона центральной звезды пуста: внутри coreClearRadius нет ничего, кроме sys:core', () => {
    const map = buildMap();
    const clear = OUTER_RADIUS * STAR_MAP_POLICY.coreClearRadius;
    for (const system of map.systems) {
      if (system.core) {
        expect(system.position).toEqual({ x: 0, y: 0, z: 0 });
        continue;
      }
      expect(radial(system.position.x, system.position.z), system.id).toBeGreaterThanOrEqual(clear * 0.999);
    }
    expect(validateStarMap(map)).toEqual([]);
  });

  it('validateStarMap ловит систему, провалившуюся в зону ядра', () => {
    const map = buildMap();
    const tainted = {
      ...map,
      systems: map.systems.map((system) => (system.id === 'sys:ferrum' ? { ...system, position: { x: 1, y: 0, z: 1 } } : system)),
      byId: { ...map.byId, 'sys:ferrum': { ...map.byId['sys:ferrum']!, position: { x: 1, y: 0, z: 1 } } },
    };
    expect(validateStarMap(tainted)).toContain('core-zone-violation:sys:ferrum');
  });

  it('фоновые системы не проваливаются в центр: радиус не ниже coreClearRadius', () => {
    const map = buildMap();
    const clear = OUTER_RADIUS * STAR_MAP_POLICY.coreClearRadius;
    const background = map.systems.filter((system) => system.id.startsWith('sys:bg:'));
    expect(background.length).toBe(STAR_MAP_POLICY.backgroundSystems);
    for (const system of background) {
      expect(radial(system.position.x, system.position.z), system.id).toBeGreaterThanOrEqual(clear * 0.999);
    }
  });
});

describe('Этап 9.2 — поселенческое кольцо систем игровых планет', () => {
  it('направление узла сохранено, радиус из полосы [nodeRingInner, nodeRingOuter]', () => {
    const map = buildMap();
    for (const source of STARTERS) {
      const system = systemForNode(map, source.id);
      expect(system).toBeDefined();
      const position = system!.position;
      expect(radial(position.x, position.z)).toBeGreaterThanOrEqual(OUTER_RADIUS * STAR_MAP_POLICY.nodeRingInner * 0.999);
      expect(radial(position.x, position.z)).toBeLessThanOrEqual(OUTER_RADIUS * STAR_MAP_POLICY.nodeRingOuter * 1.001);
      expect(Math.atan2(position.z, position.x)).toBeCloseTo(Math.atan2(source.z, source.x), 9);
      expect(position).toEqual(nodeRingPosition(source, OUTER_RADIUS));
    }
  });

  it('стабильность: открытие нового мира не сдвигает уже нанесённые системы', () => {
    const before = buildMap();
    const after = buildMap([...STARTERS, node('planet_03', -28, 77, 777001)]);
    for (const system of before.systems) {
      expect(after.byId[system.id]?.position, system.id).toEqual(system.position);
      expect(after.byId[system.id]?.designation, system.id).toBe(system.designation);
    }
    expect(after.systemCount).toBe(before.systemCount + 1);
  });

  it('узел в начале координат не ломает кольцо: угол берётся из seed', () => {
    const origin = node('zero', 0, 0, 424242);
    const position = nodeRingPosition(origin, OUTER_RADIUS);
    expect(radial(position.x, position.z)).toBeGreaterThanOrEqual(OUTER_RADIUS * STAR_MAP_POLICY.nodeRingInner);
    expect(Number.isFinite(position.x)).toBe(true);
    expect(nodeRingPosition(origin, OUTER_RADIUS)).toEqual(position);
  });
});

describe('Этап 9.2 — подписи каталога и рендер-проекция', () => {
  it('STAR_CLASS_LABELS покрывает все спектральные классы человекочитаемыми строками', () => {
    expect(Object.keys(STAR_CLASS_LABELS).sort()).toEqual(['blue', 'orange', 'red', 'white', 'yellow']);
    for (const label of Object.values(STAR_CLASS_LABELS)) expect(label.length).toBeGreaterThan(3);
  });

  it('рендер: ядро в начале координат, каталожная светимость у нанесённых систем', () => {
    const map = buildMap();
    const data = buildGalaxyRenderData({
      nodes: STARTERS,
      edges: [],
      unlockedIds: ['ferrum'],
      activeId: 'ferrum',
      systems: map.systems,
      systemSpacing: STAR_MAP_POLICY.minSystemSeparation,
      discRadius: map.radius,
    });
    const core = data.systems.find((system) => system.id === CORE_SYSTEM_ID);
    expect(core).toBeDefined();
    expect(core?.x).toBeCloseTo(0, 9);
    expect(core?.z).toBeCloseTo(0, 9);
    expect(core?.luminosity).toBeGreaterThan(0);
    const ferrum = data.systems.find((system) => system.id === 'sys:ferrum');
    expect(ferrum?.luminosity).toBeGreaterThan(0);
    // krios не открыт → светимость не раскрывается
    const krios = data.systems.find((system) => system.id === 'sys:krios');
    expect(krios?.luminosity).toBe(0);
  });
});
