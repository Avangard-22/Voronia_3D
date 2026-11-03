import { describe, expect, it } from 'vitest';
import { buildPlanetMeshData } from '../src/renderer/planetMesh';
import { buildPlanet } from '../src/planets/generator';
import { STARTER_PLANET_SPECS, armsFromBalance } from '../src/planets/catalog';
import { createStarterWorld, discoverPlanet } from '../src/core/discovery';
import { loadBalance } from '../src/config/loader';
import type { GeneratorCtx } from '../src/planets/generator';

const ctx: GeneratorCtx = { balance: loadBalance(), arms: armsFromBalance(loadBalance()) };
const planet = buildPlanet({ ...STARTER_PLANET_SPECS.ferrum }, ctx);

describe('Stage 8.0.2 — polygon cell visual states', () => {
  it('preserves each cell polygon boundary rather than imposing a uniform hex grid', () => {
    const data = buildPlanetMeshData(planet);
    const expectedSegments = planet.cells.reduce((sum, cell) => sum + cell.poly.length, 0);
    expect(data.boundaryPositions).toHaveLength(expectedSegments * 6);
    expect(data.boundaryColors).toHaveLength(expectedSegments * 6);
    expect(Array.from(data.cellSideCounts)).toEqual(planet.cells.map((cell) => cell.poly.length));
    // Феррум — строгий додекаэдр: все 12 клеток пятиугольные, поэтому разнообразие сторон проверяется
    // на сгенерированном мире. Инвариант Stage 8.0.2: меш повторяет исходные poly, а не сводит их к hex-сетке.
    const generated = discoverPlanet({ seed: 777001, name: 'Гелика-Прайм' }, createStarterWorld(ctx), ctx).planet;
    expect(new Set(generated.cells.map((cell) => cell.poly.length)).size).toBeGreaterThan(1);
    const generatedData = buildPlanetMeshData(generated);
    expect(Array.from(generatedData.cellSideCounts)).toEqual(generated.cells.map((cell) => cell.poly.length));
    expect(generatedData.boundarySegmentCount).toBe(generated.cells.reduce((sum, cell) => sum + cell.poly.length, 0));
  });

  it('distinguishes hidden, revealed and explored states without exposing hidden cell types', () => {
    const first = planet.cells[0]!;
    const second = planet.cells.find((cell) => cell.id !== first.id)!;
    const third = planet.cells.find((cell) => cell.id !== first.id && cell.id !== second.id)!;
    const data = buildPlanetMeshData(planet, {
      explored: new Set([first.id]),
      revealed: new Set([first.id, second.id]),
    });
    const index = (id: number): number => Array.from(data.cellIds).indexOf(id);
    expect(data.cellStates[index(first.id)]).toBe(2);
    expect(data.cellStates[index(second.id)]).toBe(1);
    expect(data.cellStates[index(third.id)]).toBe(0);
    expect(data.cellSelectable[index(first.id)]).toBe(1);
    expect(data.cellSelectable[index(second.id)]).toBe(1);
    expect(data.cellSelectable[index(third.id)]).toBe(0);
  });
});
