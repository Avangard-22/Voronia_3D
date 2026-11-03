/**
 * STAGE1 §1 (данные планеты): ferrum — 12 клеток, типы {0:7,1:1,2:1,3:2,4:1}, граф симметричный,
 * битые данные отклоняются валидатором с кодами planet.*.
 */
import { describe, it, expect } from 'vitest';
import { loadPlanetData, validatePlanetData } from '../src/planets/data';
import { buildCatalog } from '../src/planets/catalog';
import { fixture } from './helpers';

describe('planets/data: ferrum v0.0.41', () => {
  const data = buildCatalog().get('ferrum')!;

  it('12 клеток, seed 15929600, icosahedron, planetIndex 1, start 0', () => {
    expect(data.cells).toHaveLength(12);
    expect(data.seed).toBe(15929600);
    expect(data.geometry).toBe('icosahedron');
    expect(data.planetIndex).toBe(1);
    expect(data.startingCellId).toBe(0);
  });

  it('типы клеток: {0:7, 1:1, 2:1, 3:2, 4:1} (fixtures/planet_ferrum_full)', () => {
    const counts: Record<number, number> = {};
    for (const c of data.cells) counts[c.type] = (counts[c.type] ?? 0) + 1;
    expect(counts).toMatchObject({ 0: 7, 1: 1, 2: 1, 3: 2, 4: 1 });
    const fx = fixture<{ planet: { cells: { id: number; type: number }[] } }>('planet_ferrum_full.json');
    for (const fc of fx.planet.cells) {
      expect(data.cells[fc.id]?.type).toBe(fc.type);
    }
  });

  it('перки дескрипторов: «Мёрзлый» ×1.2 апгрейд/×0.7 истощение, «Каменистый» ×1.15 железо (fixtures/income_audit)', () => {
    expect(data.perks.upgradeCostMult).toBeCloseTo(1.2, 10);
    expect(data.perks.depletionMult).toBeCloseTo(0.7, 10);
    expect(data.perks.ironBonus).toBeCloseTo(1.15, 10);
    expect(data.perks.scanCostMult).toBe(1);
  });

  it('жилы: cell1 reserve 126, cell10 reserve 191 (fixtures/veins_audit)', () => {
    expect(data.cells[1]).toMatchObject({ type: 3, reserve: 126 });
    expect(data.cells[10]).toMatchObject({ type: 3, reserve: 191 });
  });

  it('граф: уникальные id, без self-loop, симметричные соседства, старт существует', () => {
    const v = validatePlanetData(data);
    expect(v.problems).toEqual([]);
    expect(v.ok).toBe(true);
  });

  it('валидатор ловит: duplicate-id, self-loop, асимметрию, неизвестного соседа, отсутствующий старт', () => {
    type MutableCell = { id: number; type: number; neighbors: number[] };
    type MutablePlanet = { id: string; cells: MutableCell[]; startingCellId: number };
    const clone = (): MutablePlanet => ({
      id: data.id,
      startingCellId: data.startingCellId,
      cells: data.cells.map((c) => ({ id: c.id, type: c.type, neighbors: [...c.neighbors] })),
    });

    const dup = clone();
    dup.cells[1]!.id = 0;
    expect(validatePlanetData(dup as never).problems.some((p) => p.code === 'planet.duplicate-cell-id')).toBe(true);

    const selfLoop = clone();
    selfLoop.cells[0]!.neighbors.push(0);
    expect(validatePlanetData(selfLoop as never).problems.some((p) => p.code === 'planet.self-loop')).toBe(true);

    const asym = clone();
    const nb = asym.cells[0]!.neighbors[0]!;
    asym.cells[nb]!.neighbors = asym.cells[nb]!.neighbors.filter((x) => x !== 0);
    expect(validatePlanetData(asym as never).problems.some((p) => p.code === 'planet.asymmetric-neighbor')).toBe(true);

    const unknown = clone();
    unknown.cells[0]!.neighbors.push(99);
    expect(validatePlanetData(unknown as never).problems.some((p) => p.code === 'planet.unknown-neighbor')).toBe(true);

    const noStart = clone();
    noStart.startingCellId = 42;
    expect(validatePlanetData(noStart as never).problems.some((p) => p.code === 'planet.no-start')).toBe(true);
  });

  it('loadPlanetData бросает PlanetDataInvalid на битых данных', () => {
    expect(() => loadPlanetData({ id: 'x', cells: [{ id: 0, type: 0, neighbors: [0] }], startingCellId: 5 })).toThrow(/невалидны/);
  });

  it('каталог среза: ferrum + krios (Этап 3 — krios генерируется production-генератором, TV-11 закрыт)', () => {
    const cat = buildCatalog();
    expect(cat.get('ferrum')).toBeDefined();
    const krios = cat.get('krios');
    expect(krios).toBeDefined();
    // паритет с fixtures/planet_krios_full.json доказан в tests/planetGenerator.test.ts
    expect(krios!.seed).toBe(13045769);
    expect(krios!.cells).toHaveLength(92);
    expect(krios!.biome).toBe('krios');
    expect(krios!.resourceList).toEqual(['kriogen']);
    expect(validatePlanetData(krios!).ok).toBe(true);
  });
});
