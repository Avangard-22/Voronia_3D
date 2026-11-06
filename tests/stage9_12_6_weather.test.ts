import { describe, expect, it } from 'vitest';
import { getPlanetWeatherProfile, getPlanetWeatherState } from '../src/renderer/planetAtmosphere';

describe('Stage 9.12.6 — planetary weather and atmospheric phenomena', () => {
  it('provides distinct weather signatures for planetary biomes', () => {
    expect(getPlanetWeatherProfile('gas').stormIntensity).toBeGreaterThan(getPlanetWeatherProfile('ice').stormIntensity);
    expect(getPlanetWeatherProfile('ice').aurora).toBeGreaterThan(getPlanetWeatherProfile('desert').aurora);
    expect(getPlanetWeatherProfile('volcanic').lightningRate).toBeGreaterThan(getPlanetWeatherProfile('krios').lightningRate);
  });
  it('is deterministic for the same simulation time and biome', () => {
    expect(getPlanetWeatherState(123456, 'ocean')).toEqual(getPlanetWeatherState(123456, 'ocean'));
  });
  it('keeps all weather channels bounded and finite', () => {
    for (const biome of ['ferrum', 'krios', 'volcanic', 'ocean', 'desert', 'ice', 'gas', 'unknown']) {
      const state = getPlanetWeatherState(987654, biome);
      for (const value of Object.values(state)) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });
});
