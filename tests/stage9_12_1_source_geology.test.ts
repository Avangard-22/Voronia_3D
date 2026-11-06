import { describe, expect, it } from 'vitest';
import { buildPlanetMeshData } from '../src/renderer/planetMesh';
import { makeGame } from './helpers';

describe('Stage 9.12.1 — V1 merged geology reconstruction', () => {
  it('renders every source polygon of a merged V1 cell while preserving one selectable gameplay cell', () => {
    const { game } = makeGame(15929600);
    const planet = game.worldPlanet('ferrum')!;
    const sourceCell = planet.cells[0]!;
    const merged = { ...planet, cells: planet.cells.map((cell) => cell.id === sourceCell.id ? { ...cell, _polys: [cell.poly, cell.poly] } : cell) };
    const mesh = buildPlanetMeshData(merged);
    const baseline = buildPlanetMeshData(planet);
    const index = merged.cells.findIndex((cell) => cell.id === sourceCell.id);
    const expectedSides = sourceCell.poly.length * 2;

    expect(mesh.cellIds[index]).toBe(sourceCell.id);
    expect(mesh.cellSideCounts[index]).toBe(expectedSides);
    expect(mesh.cellCount).toBe(planet.cells.length);
    expect(mesh.facetCount).toBeGreaterThan(baseline.facetCount);
    expect(mesh.faceCellIds).toHaveLength(mesh.facetCount);
    expect(mesh.positions).toHaveLength(mesh.facetCount * 9);
  });

  it('keeps source geometry and mesh output deterministic', () => {
    const { game } = makeGame(15929600);
    const planet = game.worldPlanet('ferrum')!;
    const a = buildPlanetMeshData(planet);
    const b = buildPlanetMeshData(planet);
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    expect(Array.from(a.boundaryPositions)).toEqual(Array.from(b.boundaryPositions));
  });
});
