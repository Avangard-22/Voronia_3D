import { describe, expect, it } from 'vitest';
import { buildPlanetMeshData, geologicalAnimationProfile } from '../src/renderer/planetMesh';
import { buildPlanet } from '../src/planets/generator';
import { STARTER_PLANET_SPECS, armsFromBalance } from '../src/planets/catalog';
import { loadBalance } from '../src/config/loader';
import type { GeneratorCtx } from '../src/planets/generator';

const balance = loadBalance();
const ctx: GeneratorCtx = { balance, arms: armsFromBalance(balance) };
const planet = buildPlanet({ ...STARTER_PLANET_SPECS.ferrum }, ctx);

describe('Stage 8.0.9 — geological animation and dynamic surface evolution', () => {
  it('assigns distinct, bounded motion profiles to geological classes', () => {
    const water = geologicalAnimationProfile(0);
    const crystal = geologicalAnimationProfile(2);
    const anomaly = geologicalAnimationProfile(4);
    const unknown = geologicalAnimationProfile(-1);
    expect(water.waterFlow).toBeGreaterThan(0);
    expect(crystal.crystalPulse).toBeGreaterThan(0);
    expect(anomaly.anomalyWarp).toBeGreaterThan(0);
    expect(Math.max(water.waterFlow, crystal.crystalPulse, anomaly.anomalyWarp)).toBeLessThanOrEqual(0.0032);
    expect(Object.values(unknown).every((value) => value === 0)).toBe(true);
  });

  it('emits per-vertex motion attributes with matching geometry lengths', () => {
    const mesh = buildPlanetMeshData(planet);
    expect(mesh.geologicalMotionAmplitude).toHaveLength(mesh.positions.length / 3);
    expect(mesh.geologicalMotionSpeed).toHaveLength(mesh.positions.length / 3);
    expect(mesh.geologicalMotionAmplitude.every((value) => Number.isFinite(value) && value >= 0 && value <= 0.0032)).toBe(true);
    expect(mesh.geologicalMotionSpeed.every((value) => Number.isFinite(value) && value >= 0 && value <= 1.15)).toBe(true);
  });

  it('does not animate hidden or merely revealed geological types', () => {
    const revealed = new Set(planet.cells.slice(0, 8).map((cell) => cell.id));
    const mesh = buildPlanetMeshData(planet, { explored: new Set(), revealed });
    expect(mesh.geologicalMotionAmplitude.every((value) => value === 0)).toBe(true);
    expect(mesh.geologicalMotionSpeed.every((value) => value === 0)).toBe(true);
    expect(mesh.geologyTypes.every((value) => value === -1)).toBe(true);
  });
});
