import { describe, expect, it } from 'vitest';
import { atmosphereQualityScale, getPlanetAtmosphereProfile } from '../src/renderer/planetAtmosphere';

describe('Stage 9.12.4 — atmospheric planetary environment', () => {
  it('provides distinct deterministic atmosphere profiles for known biomes', () => {
    const ferrum = getPlanetAtmosphereProfile('ferrum');
    const krios = getPlanetAtmosphereProfile('krios');
    expect(getPlanetAtmosphereProfile('ferrum')).toEqual(ferrum);
    expect(ferrum.color).not.toBe(krios.color);
    expect(ferrum.cloudSpeed).not.toBe(krios.cloudSpeed);
  });

  it('returns safe bounded defaults for unknown biome identifiers', () => {
    const profile = getPlanetAtmosphereProfile('unmapped-biome');
    expect(profile.opacity).toBeGreaterThan(0);
    expect(profile.opacity).toBeLessThanOrEqual(1);
    expect(profile.cloudOpacity).toBeGreaterThanOrEqual(0);
    expect(profile.cloudOpacity).toBeLessThanOrEqual(1);
    expect(profile.altitude).toBeGreaterThan(1);
  });

  it('scales atmospheric cost with runtime quality tier', () => {
    expect(atmosphereQualityScale('low')).toBeLessThan(atmosphereQualityScale('balanced'));
    expect(atmosphereQualityScale('balanced')).toBeLessThan(atmosphereQualityScale('high'));
    expect(atmosphereQualityScale('high')).toBe(1);
  });
});
