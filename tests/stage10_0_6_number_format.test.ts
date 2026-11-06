import { describe, expect, it } from 'vitest';
import { formatCompact } from '../src/ui/numberFormat';

describe('Stage 10.0.6 — compact number formatting', () => {
  it('uses compact suffixes consistently for thousands through trillions', () => {
    expect(formatCompact(100_000)).toBe('100к');
    expect(formatCompact(1_000_000)).toBe('1M');
    expect(formatCompact(1_000_000_000)).toBe('1B');
    expect(formatCompact(1_000_000_000_000)).toBe('1T');
  });
  it('preserves small values and signs instead of rounding them to zero', () => {
    expect(formatCompact(0.056, 4)).toBe('0.056');
    expect(formatCompact(-1500)).toBe('-1.5к');
    expect(formatCompact(Number.POSITIVE_INFINITY)).toBe('∞');
  });
});
