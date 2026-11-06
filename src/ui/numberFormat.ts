/** Единый компактный формат чисел для всего интерфейса Voronia. */
export function formatCompact(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '∞';
  const abs = Math.abs(value);
  const units: readonly [number, string][] = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'к']];
  for (const [threshold, suffix] of units) {
    if (abs >= threshold) {
      const scaled = value / threshold;
      const precision = Math.abs(scaled) >= 100 ? 0 : Math.abs(scaled) >= 10 ? 1 : 2;
      return `${Number(scaled.toFixed(precision))}${suffix}`;
    }
  }
  return Number(value.toFixed(digits)).toString();
}
