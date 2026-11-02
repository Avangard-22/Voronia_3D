/**
 * core/Rng.ts — mulberry32, seedable, сериализуемый (состояние в сейве), fork(label), детерминизм.
 * Примечание (STAGE1 §1): алгоритм 1.x (qe) — тот же mulberry32, но совпадение последовательностей
 * с baseline НЕ требуется (GS-исключение «gameStartSeed»); требуется детерминизм 2.0.
 */
import type { RngPort } from '../contracts/ports';

const MULBERRY_INCREMENT = 1831565813;

function mix32(x: number): number {
  let t = x | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

export class Rng implements RngPort {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  next(): number {
    const t = (this.s = (this.s + MULBERRY_INCREMENT) | 0);
    let o = Math.imul(t ^ (t >>> 15), 1 | t);
    o = (o + Math.imul(o ^ (o >>> 7), 61 | o)) ^ o;
    return ((o ^ (o >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(minInclusive: number, maxExclusive: number): number {
    return minInclusive + Math.floor(this.next() * (maxExclusive - minInclusive));
  }

  fork(label: string): Rng {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < label.length; i++) {
      h ^= label.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return new Rng(mix32(h ^ this.s));
  }

  state(): number {
    return this.s >>> 0;
  }

  hydrate(state: number): void {
    this.s = state >>> 0;
  }

  clone(): Rng {
    return new Rng(this.s);
  }
}
