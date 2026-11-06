import { describe, expect, it } from 'vitest';
import { getPlanetarySolarState } from '../src/renderer/planetAtmosphere';

describe('Stage 9.12.5 — dynamic planetary lighting', () => {
  it('produces a normalized, deterministic stellar direction', () => {
    const a = getPlanetarySolarState(12000, 'ferrum');
    const b = getPlanetarySolarState(12000, 'ferrum');
    expect(a).toEqual(b);
    expect(Math.hypot(...a.direction)).toBeCloseTo(1, 6);
  });

  it('changes stellar direction over time and uses biome-specific spectral color', () => {
    const dawn = getPlanetarySolarState(0, 'ferrum');
    const later = getPlanetarySolarState(50000, 'ferrum');
    const ice = getPlanetarySolarState(0, 'ice');
    expect(dawn.direction).not.toEqual(later.direction);
    expect(dawn.color).not.toBe(ice.color);
  });

  it('keeps light and ambient intensity in bounded ranges', () => {
    for (const biome of ['ferrum', 'krios', 'volcanic', 'ocean', 'desert', 'ice', 'gas', 'unknown']) {
      const state = getPlanetarySolarState(123456, biome);
      expect(state.intensity).toBeGreaterThan(0);
      expect(state.intensity).toBeLessThan(2);
      expect(state.ambient).toBeGreaterThan(0);
      expect(state.ambient).toBeLessThan(1);
    }
  });
});
