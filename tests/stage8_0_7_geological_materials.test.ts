import { describe, expect, it } from 'vitest';
import { buildPlanetMeshData, geologicalMaterialProfile } from '../src/renderer/planetMesh';
import { buildPlanet } from '../src/planets/generator';
import { STARTER_PLANET_SPECS, armsFromBalance } from '../src/planets/catalog';
import { loadBalance } from '../src/config/loader';
import type { GeneratorCtx } from '../src/planets/generator';

const balance = loadBalance();
const ctx: GeneratorCtx = { balance, arms: armsFromBalance(balance) };
const planet = buildPlanet({ ...STARTER_PLANET_SPECS.ferrum }, ctx);

describe('Stage 8.0.7 — geological materials and surface detail', () => {
  it('provides a distinct physical material profile for major geological classes', () => {
    const water = geologicalMaterialProfile(0);
    const land = geologicalMaterialProfile(1);
    const crystal = geologicalMaterialProfile(2);
    const anomaly = geologicalMaterialProfile(4);
    expect(water.roughness).toBeLessThan(land.roughness);
    expect(crystal.metalness).toBeGreaterThan(land.metalness);
    expect(anomaly.emissive).toBeGreaterThan(land.emissive);
    expect(crystal.detailScale).toBeGreaterThan(land.detailScale);
  });

  it('emits material, detail and emission attributes aligned with every triangle vertex', () => {
    const mesh = buildPlanetMeshData(planet);
    const vertexCount = mesh.positions.length / 3;
    expect(mesh.geologyTypes).toHaveLength(vertexCount);
    expect(mesh.surfaceDetail).toHaveLength(vertexCount);
    expect(mesh.emissiveStrength).toHaveLength(vertexCount);
    expect(mesh.surfaceDetail.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(mesh.emissiveStrength.every((v) => Number.isFinite(v) && v >= 0)).toBe(true);
  });

  it('does not reveal the geological class of hidden cells through material attributes', () => {
    const mesh = buildPlanetMeshData(planet, { explored: new Set(), revealed: new Set() });
    expect(mesh.geologyTypes.every((type) => type === -1)).toBe(true);
    expect(mesh.emissiveStrength.every((value) => value === 0)).toBe(true);
  });

  it('keeps geometry ownership and face-to-cell mapping intact', () => {
    const mesh = buildPlanetMeshData(planet);
    expect(mesh.faceCellIds).toHaveLength(mesh.facetCount);
    expect(mesh.geologyTypes.length).toBe(mesh.faceCellIds.length * 3);
    expect(mesh.positions.length).toBe(mesh.colors.length);
  });
});
