import { describe, expect, it } from 'vitest';
import { galaxyLodForDistance, galaxyVisualBudget } from '../src/renderer/galaxyVisualDepth';

describe('Stage 7.2 — galaxy visual depth', () => {
  it('switches visual detail at stable camera-distance thresholds', () => {
    expect(galaxyLodForDistance(30)).toBe('wide');
    expect(galaxyLodForDistance(22)).toBe('regional');
    expect(galaxyLodForDistance(9)).toBe('system');
    expect(galaxyLodForDistance(Number.NaN)).toBe('wide');
  });

  it('reduces decorative particle budgets on narrow or high-DPR devices', () => {
    const mobile = galaxyVisualBudget(390, 3);
    const desktop = galaxyVisualBudget(1440, 1);
    expect(mobile.nebulaPoints).toBeLessThan(desktop.nebulaPoints);
    expect(mobile.clusterStars).toBeLessThan(desktop.clusterStars);
    expect(galaxyVisualBudget(800, 1.8)).toEqual({ nebulaPoints: 1600, clusterStars: 640 });
  });
});
