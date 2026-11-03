import { describe, expect, it } from 'vitest';
import { AdaptiveSurfaceQuality, SURFACE_QUALITY, surfacePixelRatio } from '../src/renderer/surfaceQuality';

describe('stage 8.0.10 — adaptive surface quality', () => {
  it('starts balanced and ignores invalid frame samples', () => {
    const quality = new AdaptiveSurfaceQuality();
    expect(quality.tier).toBe('balanced');
    expect(quality.update(100, Number.NaN)).toBe('balanced');
    expect(quality.update(200, 0)).toBe('balanced');
  });

  it('downgrades under sustained frame-time pressure', () => {
    const quality = new AdaptiveSurfaceQuality();
    let tier = quality.tier;
    for (let i = 0; i < 120; i++) tier = quality.update(i * 40, 36);
    expect(tier).toBe('low');
  });

  it('does not upgrade until headroom remains stable', () => {
    const quality = new AdaptiveSurfaceQuality();
    for (let i = 0; i < 120; i++) quality.update(i * 40, 36);
    let tier = quality.tier;
    for (let i = 0; i < 260; i++) tier = quality.update(5000 + i * 40, 12);
    expect(tier).toBe('balanced');
  });

  it('caps DPR by tier without exceeding device capability', () => {
    expect(surfacePixelRatio(3, 390, 'low')).toBe(1);
    expect(surfacePixelRatio(3, 390, 'balanced')).toBe(1.5);
    expect(surfacePixelRatio(1, 1400, 'high')).toBe(1);
    expect(SURFACE_QUALITY.low.shaderDetail).toBe(0);
    expect(SURFACE_QUALITY.high.animationScale).toBe(1);
  });
});
