/**
 * contracts/rng.ts — mulberry32 (байт-паритет с 1.x `qe`, bundle @55166).
 * В 1.x весь процедурный контент (планеты, позиции, имена) потребляет именно эту функцию
 * с явными seed-константами (XOR-«соли»), поэтому порядок потребления критичен (ADR-015).
 * Класс Rng (core/rng.ts) — тот же алгоритм, но с состоянием/fork для сейвов 2.0.
 */

/** Инкремент mulberry32 (1.x: `t=t+1831565813|0`). */
export const MULBERRY32_INCREMENT = 1831565813;

/**
 * 1.x `qe(seed)`: `let t=e>>>0; return function(){t|=0,t=t+1831565813|0; let o=Math.imul(t^t>>>15,1|t);
 * o=o+Math.imul(o^o>>>7,61|o)^o; return((o^o>>>14)>>>0)/4294967296}`.
 * Возвращает генератор [0,1). Детерминирован; состояние — одно 32-битное слово.
 */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return function next(): number {
    t |= 0;
    t = (t + MULBERRY32_INCREMENT) | 0;
    let o = Math.imul(t ^ (t >>> 15), 1 | t);
    o = (o + Math.imul(o ^ (o >>> 7), 61 | o)) ^ o;
    return ((o ^ (o >>> 14)) >>> 0) / 4294967296;
  };
}
