/**
 * Этап 3 — паритет генератора планет (ADR-015).
 * Фикстуры: planetgen_samples.json (6 сэмплов discoverPlanet с именем «Ген-Тест»),
 * planetgen_named_v0.0.41.json (авто-имена Rf, Br planet_04+, unique/lastVoronia/barren, рёбра Kf),
 * planet_krios_full.json / planet_ferrum_full.json (стартовые планеты oi()),
 * planetgen_determinism_check.json (seed 101 во втором буте).
 * Все сравнения — дословные (deep equality по JSON-форме экстрактора Этапа 0).
 */
import { describe, it, expect } from 'vitest';
import { loadBalance } from '../src/config/loader';
import type { BalanceConfig } from '../src/config/types';
import { armsFromBalance, buildCatalog, STARTER_PLANET_SPECS } from '../src/planets/catalog';
import { buildPlanet, discoverReward, initPlanetStart, pickFrequency, pickGeometry, type GeneratorCtx } from '../src/planets/generator';
import { discoverPlanet, type DiscoveryWorld } from '../src/core/discovery';
import { createInitialGraph } from '../src/galaxy/graph';
import { INITIAL_NODE_POS } from '../src/galaxy/position';
import type { GraphNode } from '../src/contracts/galaxy';
import type { GeneratedCell, GeneratedPlanet } from '../src/contracts/planets';
import { fixture } from './helpers';

// ---------------------------------------------------------------------------
// Дампы — зеркало planetDump/cellDump экстрактора (tools/extract_stage0.cjs)
// ---------------------------------------------------------------------------

function cellDump(c: GeneratedCell): Record<string, unknown> {
  return {
    id: c.id,
    type: c.type,
    displayType: c.displayType,
    level: c.level || 0,
    yield: c.yield || 0,
    ironYield: c.ironYield,
    kriogenYield: c.kriogenYield,
    reserve: c.reserve,
    maxReserve: c.maxReserve,
    cooldownUntil: c.cooldownUntil || 0,
    reactCount: c.reactCount || 0,
    neighbors: [...c.neighbors],
    resourceKey: c.resourceKey || null,
    anomalyType: c.anomalyType || null,
    isDeep: !!c.isDeep,
    mutant: null,
    center: c.center ? [...c.center] : null,
  };
}

function planetDump(p: GeneratedPlanet): Record<string, unknown> {
  return {
    id: p.id,
    name: p.name,
    seed: p.seed,
    f: p.f,
    biome: p.biome,
    geometry: p.geometry,
    geometryName: p.geometryName,
    planetIndex: p.planetIndex,
    armId: p.armId || null,
    role: p.role || null,
    isUnique: p.isUnique,
    descriptors: {
      climate: { ...p.descriptors.climate, effects: { ...p.descriptors.climate.effects } },
      surface: { ...p.descriptors.surface, effects: { ...p.descriptors.surface.effects } },
      anomaly: { ...p.descriptors.anomaly, effects: { ...p.descriptors.anomaly.effects } },
      effects: { ...p.descriptors.effects },
      displayName: p.descriptors.displayName,
    },
    perks: { ...p.perks },
    palette: {
      bg1: p.palette.bg1,
      bg2: p.palette.bg2,
      explored: { ...p.palette.explored },
      unexplored: { ...p.palette.unexplored },
      border: p.palette.border,
    },
    lore: p.lore || null,
    resourceList: [...p.resourceList],
    scanBonus: p.scanBonus ?? null,
    origin: { ...p.origin },
    availableEvents: p.availableEvents.map((e) => ({
      id: e.id,
      name: e.name,
      duration: e.duration,
      desc: e.desc,
      effects: { ...e.effects },
      ...(e.compensate ? { compensate: { ...e.compensate } } : {}),
      ...(e.minPlanetIndex !== undefined ? { minPlanetIndex: e.minPlanetIndex } : {}),
      polarity: e.polarity,
      weight: e.weight,
    })),
    storage: { ...p.storage },
    verts: p.verts.map((v) => [...v]),
    faces: p.faces.map((f) => [...f]),
    startingCellId: p.startingCellId,
    _visited: p._visited,
    explored: [...p.explored],
    revealed: [...p.revealed],
    cells: p.cells.map(cellDump),
    cellCount: p.cells.length,
    typeDistribution: p.cells.reduce<Record<number, number>>((a, c) => ((a[c.type] = (a[c.type] || 0) + 1), a), {}),
  };
}

function nodeDump(n: GraphNode): Record<string, unknown> {
  return { id: n.id, planetId: n.planetId, name: n.name, geometryName: n.geometryName, biome: n.biome, geometry: n.geometry, frequency: n.frequency, seed: n.seed, x: n.x, y: n.y, z: n.z, armId: n.armId, discovered: n.discovered };
}

// ---------------------------------------------------------------------------
// Сравнение с фикстурами 1.x: допуск на последний ULP
// ---------------------------------------------------------------------------
// Координаты узлов и вершины геометрии считаются через Math.hypot/atan2/log/pow,
// а эти функции дают расхождение в 1 ULP (~1e-14 при |v|~17) между сборками V8:
// Node 22 в GitHub Actions и Node в Codespace считают последние биты по-разному.
// Логика 1.x при этом идентична, поэтому фикстуры сравниваются не побитово.
//
// POS_DIGITS = 10 → порог |delta| < 5e-11:
//   - на ~4 порядка больше машинного ULP (шум платформы не ловит);
//   - на ~4 порядка меньше любой реальной правки формул (регрессию ловит).
// Строки, id, целые, массивы и вложенные объекты сравниваются строго — как
// раньше, включая семантику toEqual по undefined-полям.
const POS_DIGITS = 10;

function expectNear(actual: unknown, expected: unknown): void {
  if (typeof expected === 'number') {
    expect(typeof actual).toBe('number');
    // NaN/Infinity сравниваем как toEqual (там NaN === NaN), допуск неприменим
    if (!Number.isFinite(expected) || !Number.isFinite(actual)) {
      expect(actual).toEqual(expected);
      return;
    }
    expect(actual as number).toBeCloseTo(expected, POS_DIGITS);
    return;
  }
  if (Array.isArray(expected)) {
    expect(Array.isArray(actual)).toBe(true);
    const act = actual as unknown[];
    expect(act).toHaveLength(expected.length);
    expected.forEach((e, i) => expectNear(act[i], e));
    return;
  }
  if (expected !== null && typeof expected === 'object') {
    expect(actual !== null && typeof actual === 'object' && !Array.isArray(actual)).toBe(true);
    const expObj = expected as Record<string, unknown>;
    const actObj = actual as Record<string, unknown>;
    // как toEqual: поля со значением undefined игнорируются с обеих сторон
    const keys = new Set([...Object.keys(expObj), ...Object.keys(actObj).filter((k) => actObj[k] !== undefined)]);
    for (const k of keys) expectNear(actObj[k], expObj[k]);
    return;
  }
  expect(actual).toEqual(expected);
}

// ---------------------------------------------------------------------------
// Мир (1.x oi()): ferrum+krios + начальный граф
// ---------------------------------------------------------------------------

const balance = loadBalance();
const ctx: GeneratorCtx = { balance, arms: armsFromBalance(balance) };

function starterNode(id: 'ferrum' | 'krios', p: GeneratedPlanet): GraphNode {
  const pos = INITIAL_NODE_POS[id]!;
  return {
    id,
    planetId: id,
    name: p.name,
    geometryName: p.geometryName,
    biome: p.biome,
    geometry: p.geometry,
    frequency: p.f,
    seed: p.seed,
    x: pos.x,
    y: pos.y,
    z: pos.z,
    armId: pos.armId,
    discovered: pos.discovered,
  };
}

function starterWorld(): DiscoveryWorld {
  const ferrum = buildPlanet({ ...STARTER_PLANET_SPECS.ferrum }, ctx);
  initPlanetStart(ferrum, false); // 1.x: startGame → ferrum посещён (GS-02)
  const krios = buildPlanet({ ...STARTER_PLANET_SPECS.krios }, ctx);
  const graph = createInitialGraph(starterNode('ferrum', ferrum), starterNode('krios', krios));
  return { graph, planets: { ferrum, krios } };
}

// ---------------------------------------------------------------------------
// Фикстуры
// ---------------------------------------------------------------------------

interface SampleEntry {
  readonly seed: number;
  readonly planet: Record<string, unknown>;
  readonly graph: Record<string, unknown>;
}
interface NamedEntry {
  readonly id: string;
  readonly seed: number;
  readonly planetIndex: number;
  readonly name: string;
  readonly isUnique: boolean;
  readonly geometry: string;
  readonly f: number;
  readonly biome: string;
  readonly armId: string | null;
  readonly resourceList: string[];
  readonly cellCount: number;
  readonly startingCellId: number;
  readonly _mixed: boolean;
  readonly node: { x: number; y: number; z: number; armId: string } | null;
  readonly edgesAfter: [string, string][];
}
interface NamedFile {
  readonly sequential: NamedEntry[];
  readonly uniques: NamedEntry[];
}

const samples = fixture<{ samples: SampleEntry[] }>('planetgen_samples.json').samples;
const named = fixture<NamedFile>('planetgen_named_v0.0.41.json');
const kriosFx = fixture<{ planet: Record<string, unknown> }>('planet_krios_full.json').planet;
const ferrumFx = fixture<{ planet: Record<string, unknown> }>('planet_ferrum_full.json').planet;

// ---------------------------------------------------------------------------
// Тесты
// ---------------------------------------------------------------------------

describe('planets/generator: стартовые планеты oi()', () => {
  it('ferrum (seed 15929600, f1) + initStart — полное совпадение с planet_ferrum_full.json (GS-02)', () => {
    const ferrum = buildPlanet({ ...STARTER_PLANET_SPECS.ferrum }, ctx);
    initPlanetStart(ferrum, false);
    expectNear(planetDump(ferrum), ferrumFx);
    expect([...ferrum.revealed]).toEqual([0, 2, 1, 3, 6, 7]);
  });

  it('krios (seed 13045769, f3, 92 клетки) — полное совпадение с planet_krios_full.json (TV-11)', () => {
    const krios = buildPlanet({ ...STARTER_PLANET_SPECS.krios }, ctx);
    expectNear(planetDump(krios), kriosFx);
  });

  it('каталог: ferrum + krios, krios валиден и совпадает с фикстурой', () => {
    const catalog = buildCatalog(balance);
    expect([...catalog.planets.keys()]).toEqual(['ferrum', 'krios']);
    const krios = catalog.get('krios')!;
    expect(krios.cells).toHaveLength(92);
    expect(krios.startingCellId).toBe(40);
    expect(krios.resourceList).toEqual(['kriogen']);
    expect(krios.seed).toBe(13045769);
    expect(krios.armId).toBeNull();
  });
});

describe('planets/generator: паритет discoverPlanet (planetgen_samples)', () => {
  for (const s of samples) {
    it(`seed ${s.seed}: планета и узел графа совпадают с сэмплом`, () => {
      const world = starterWorld();
      const { planet, node } = discoverPlanet({ seed: s.seed, name: 'Ген-Тест' }, world, ctx);
      expectNear(planetDump(planet), s.planet);
      expectNear(nodeDump(node), s.graph);
    });
  }

  it('детерминизм: одинаковый seed → идентичная планета (planetgen_determinism_check)', () => {
    const check = fixture<{ seed: number; secondBootCellsMatch: boolean; geometry: string; biome: string; armId: string }>('planetgen_determinism_check.json');
    expect(check.secondBootCellsMatch).toBe(true);
    const w1 = starterWorld();
    const w2 = starterWorld();
    const a = discoverPlanet({ seed: check.seed }, w1, ctx);
    const b = discoverPlanet({ seed: check.seed }, w2, ctx);
    expect(planetDump(a.planet)).toEqual(planetDump(b.planet));
    expect(a.planet.geometry).toBe(check.geometry);
    expect(a.planet.biome).toBe(check.biome);
    expect(a.planet.armId).toBe(check.armId);
  });
});

describe('planets/generator: авто-имена, позиции planet_04+, unique/lastVoronia/barren (planetgen_named)', () => {
  it('последовательные открытия idx 3..16: имена Rf, геометрия, ресурсы, позиции Br, рёбра Kf', () => {
    const world = starterWorld();
    for (const exp of named.sequential) {
      const { planet, node } = discoverPlanet({ seed: exp.seed }, world, ctx);
      expect({ id: planet.id, name: planet.name, isUnique: planet.isUnique, geometry: planet.geometry, f: planet.f, biome: planet.biome, armId: planet.armId, planetIndex: planet.planetIndex }).toEqual({ id: exp.id, name: exp.name, isUnique: exp.isUnique, geometry: exp.geometry, f: exp.f, biome: exp.biome, armId: exp.armId, planetIndex: exp.planetIndex });
      expect([...planet.resourceList]).toEqual(exp.resourceList);
      expect(planet.cells).toHaveLength(exp.cellCount);
      expect(planet.startingCellId).toBe(exp.startingCellId);
      expect(planet._mixed).toBe(exp._mixed);
      expectNear({ x: node.x, y: node.y, z: node.z, armId: node.armId }, exp.node);
      expect(world.graph.edges.map((e) => [...e])).toEqual(exp.edgesAfter);
    }
  });

  it('unique-миры (Jo): бонусный слот ресурса, имена Af/слоговые, mixed', () => {
    const world = starterWorld();
    // прокручиваем мир до той же длины списка узлов, что и в экстракте (14 sequential), затем uniques
    for (const exp of named.sequential) discoverPlanet({ seed: exp.seed }, world, ctx);
    for (const exp of named.uniques) {
      const { planet, node } = discoverPlanet({ seed: exp.seed }, world, ctx);
      expect(planet.id).toBe(exp.id);
      expect(planet.name).toBe(exp.name);
      expect(planet.isUnique).toBe(true);
      expect(planet.geometry).toBe(exp.geometry);
      expect(planet.f).toBe(exp.f);
      expect([...planet.resourceList]).toEqual(exp.resourceList);
      expect(planet.cells).toHaveLength(exp.cellCount);
      expectNear({ x: node.x, y: node.y, z: node.z, armId: node.armId }, exp.node);
      expect(world.graph.edges.map((e) => [...e])).toEqual(exp.edgesAfter);
    }
  });

  it('lastVoronia (idx 15): имя «Последняя Ворония», isUnique, ресурсы из registry', () => {
    const lv = named.sequential.find((e) => e.planetIndex === 15)!;
    expect(lv.name).toBe('Последняя Ворония');
    expect(lv.isUnique).toBe(true);
    expect(lv.resourceList).toEqual([...balance.registry.planet.lastVoronia.resources]);
  });

  it('barren-мир (planet_08, seed 606, idx 8): пустой resourceList, жилы конвертированы в t0', () => {
    const barren = named.sequential.find((e) => e.id === 'planet_08')!;
    expect(barren.resourceList).toEqual([]);
    const world = starterWorld();
    for (const exp of named.sequential) {
      const { planet } = discoverPlanet({ seed: exp.seed }, world, ctx);
      if (planet.id === 'planet_08') {
        expect(planet.cells.filter((c) => c.type === 3)).toHaveLength(0);
      }
      if (exp.id === 'planet_08') break;
    }
  });
});

describe('planets/generator: geometryTuning (реестр переопределяет веса/частоты Nn)', () => {
  it('нули вместо ico/oct/tetra → всегда cube; minFrequency=maxFrequency фиксирует f', () => {
    const tuned: BalanceConfig = {
      ...balance,
      registry: {
        ...balance.registry,
        planet: {
          ...balance.registry.planet,
          geometryTuning: {
            icosahedron: { weight: 0 },
            octahedron: { weight: 0 },
            tetrahedron: { weight: 0 },
            cube: { weight: 100, minFrequency: 3, maxFrequency: 3 },
          },
        },
      },
    };
    const tctx: GeneratorCtx = { balance: tuned, arms: armsFromBalance(tuned) };
    for (const seed of [101, 202, 303, 404, 505]) {
      const g = pickGeometry(seed, 5, tctx);
      expect(g).toBe('cube');
      expect(pickFrequency(g, seed, 5, tctx)).toBe(3);
    }
  });

  it('базовые правила: idx<=2 → icosahedron, f=1 (idx1) / f=3 (idx2)', () => {
    expect(pickGeometry(12345, 2, ctx)).toBe('icosahedron');
    expect(pickGeometry(12345, 1, ctx)).toBe('icosahedron');
    expect(pickFrequency('icosahedron', 12345, 1, ctx)).toBe(1);
    expect(pickFrequency('icosahedron', 12345, 2, ctx)).toBe(3);
  });
});

describe('planets/generator: награда за открытие (TV-6)', () => {
  it('floor(500 × 2.2^max(0, idx−2))', () => {
    expect(discoverReward(1)).toBe(500);
    expect(discoverReward(2)).toBe(500);
    expect(discoverReward(3)).toBe(1100);
    expect(discoverReward(4)).toBe(2420);
    expect(discoverReward(5)).toBe(5324);
    expect(discoverReward(6)).toBe(11712);
  });

  it('discoverPlanet возвращает награду по индексу', () => {
    const world = starterWorld();
    const r = discoverPlanet({ seed: 101 }, world, ctx);
    expect(r.researchReward).toBe(1100);
  });
});
