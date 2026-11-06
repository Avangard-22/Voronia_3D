import { describe, expect, it } from 'vitest';
import { buildContinentalTopology } from '../src/planets/continental';
import { buildPlanetMeshData } from '../src/renderer/planetMesh';
import { makeGame } from './helpers';

describe('Stage 9.12.3 — continental formation and biome transitions', () => {
  it('derives deterministic landmasses and coastal transitions from the V1 neighbor graph', () => {
    const { game } = makeGame(15929600);
    const planet = game.worldPlanet('ferrum')!;
    const first = planet.cells[0]!;
    const neighborId = first.neighbors[0]!;
    const cells = planet.cells.map((cell) => ({ ...cell, type: cell.id === first.id ? 0 : cell.id === neighborId ? 1 : 0 }));
    const topology = buildContinentalTopology({ cells });
    const repeated = buildContinentalTopology({ cells });
    const landIndex = cells.findIndex((cell) => cell.id === neighborId);

    expect(topology.regionIds).toEqual(repeated.regionIds);
    expect(topology.classes[landIndex]).toBe(1);
    expect(topology.coastalInfluence[landIndex]).toBe(1);
    expect(topology.biomeTransition[landIndex]).toBeGreaterThan(0);
    expect(topology.landRegionCount).toBeGreaterThan(0);
  });

  it('exposes per-cell continent and shore data without changing gameplay cell identity', () => {
    const { game } = makeGame(15929600);
    const planet = game.worldPlanet('ferrum')!;
    const mesh = buildPlanetMeshData(planet);
    expect(mesh.continentalRegionIds).toHaveLength(planet.cells.length);
    expect(mesh.continentalClasses).toHaveLength(planet.cells.length);
    expect(mesh.coastalInfluence).toHaveLength(planet.cells.length);
    expect(mesh.biomeTransition).toHaveLength(planet.cells.length);
    expect(Array.from(mesh.coastalInfluence).every((value) => value >= 0 && value <= 1)).toBe(true);
    expect(Array.from(mesh.biomeTransition).every((value) => value >= 0 && value <= 1)).toBe(true);
    expect(Array.from(mesh.cellIds)).toEqual(planet.cells.map((cell) => cell.id));
  });
});
