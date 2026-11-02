/**
 * galaxy/position.ts — позиция узла в галактике и принадлежность рукаву (Этап 3, ADR-015).
 * Порт 1:1 функций 1.x: Br (генерация позиции, bundle @102000), My (индекс спирального рукава),
 * er (armId), lo (дистанция). Порядок потребления RNG и арифметика — дословно (parity:
 * fixtures/planetgen_samples.json graph.x/y/z/armId).
 */
import { mulberry32 } from '../contracts/rng';
import type { GalaxyGenConfig, GalaxyPos, GraphNode, NodeRenderConfig, SpiralConfig } from '../contracts/galaxy';

/** Порядок спиральных рукавов 1.x (Lr): индекс My → id. core/inter — вне списка. */
export const SPIRAL_ARM_IDS = ['forge', 'frost', 'life', 'void'] as const;

/** Начальные узлы 1.x oi(): ferrum/krios — фиксированные координаты ядра. */
export const INITIAL_NODE_POS = Object.freeze({
  ferrum: Object.freeze({ x: -2.6, y: 0, z: 0.4, armId: 'core', discovered: true }),
  krios: Object.freeze({ x: 3, y: 0.6, z: -0.9, armId: 'core', discovered: false }),
}) as Readonly<Record<string, Readonly<GalaxyPos & { armId: string; discovered: boolean }>>>;

/** 1.x lo/Or — евклидова дистанция между узлами. */
export function nodeDistance(a: Partial<GalaxyPos>, b: Partial<GalaxyPos>): number {
  return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0), (a.z || 0) - (b.z || 0));
}

/** 1.x My — индекс ближайшего спирального рукава (−1: ядро или межрукавье). */
export function spiralArmIndex(pos: GalaxyPos, spiral: SpiralConfig): number {
  const t = Math.hypot(pos.x || 0, pos.z || 0);
  if (t < spiral.r0) return -1;
  const o = Math.atan2(pos.z || 0, pos.x || 0);
  const r = Math.log(t / spiral.r0) / spiral.b;
  let s = -1;
  let c = Infinity;
  for (let l = 0; l < spiral.arms; l++) {
    const u = l * ((Math.PI * 2) / spiral.arms);
    let f = o - (u + r);
    f = Math.atan2(Math.sin(f), Math.cos(f));
    const h = Math.abs(f) * t;
    if (h < c) {
      c = h;
      s = l;
    }
  }
  return c <= spiral.width ? s : -1;
}

/** 1.x er — armId позиции: core (r<r0) / inter (вне рукавов) / id рукава. */
export function armIdAt(pos: GalaxyPos, spiral: SpiralConfig): string {
  if (Math.hypot(pos.x || 0, pos.z || 0) < spiral.r0) return 'core';
  const o = spiralArmIndex(pos, spiral);
  return o < 0 ? 'inter' : SPIRAL_ARM_IDS[o]!;
}

export interface PositionConfig {
  readonly spiral: SpiralConfig;
  readonly gen: GalaxyGenConfig;
  readonly nodeRender: NodeRenderConfig;
}

/**
 * 1.x Br — детерминированная позиция нового узла по seed относительно существующих узлов.
 * Ветви: «фронт» (frontChance, только при не-стартовых узлах), равномерный диск (armBias-вероятность,
 * растёт к maxTries), спиральный рукав. Ограничения: вне starterZone, ≥starterExclusionR от ferrum/krios,
 * ≥MIN_DIST от прочих. Fallback — золотой угол 2.399963229728653.
 */
export function generatePosition(seed: number, nodes: Readonly<Record<string, GraphNode>>, cfg: PositionConfig): GalaxyPos {
  const { spiral: r, gen: cn, nodeRender: Rr } = cfg;
  const o = Object.values(nodes || {}).filter(Boolean);
  const s = ['ferrum', 'krios'];
  const c = o.filter((g) => g && s.includes(g.id));
  const l = o.filter((g) => g && !s.includes(g.id));
  const u = Math.max(0, 1 - cn.armBias);
  const fR = typeof cn.frontRadius === 'number' ? cn.frontRadius : cn.outerRadius * 0.8;
  const fC = typeof cn.frontChance === 'number' ? cn.frontChance : 0.12;
  const rB = typeof cn.radialBias === 'number' ? cn.radialBias : 0.4;
  const fr = l.length > 0 && mulberry32((seed >>> 0) ^ 305419896)() < fC;
  for (let g = 0; g < cn.maxTries; g++) {
    const b = mulberry32((seed >>> 0) ^ Math.imul(g + 1, 2654435761));
    const w = Math.min(1, g / (cn.maxTries * 0.6));
    const E = Math.min(1, u + w * 0.35);
    let _: number;
    let R: number;
    let A: number;
    if (fr) {
      const V = b() * Math.PI * 2;
      const I = fR + (cn.outerRadius - fR) * b();
      _ = Math.cos(V) * I;
      A = Math.sin(V) * I;
      R = (b() - 0.5) * Rr.THICK * 0.6;
    } else if (b() < E) {
      const V = b() * Math.PI * 2;
      const q = Math.pow(b(), rB);
      const I = cn.starterZoneR + (cn.outerRadius - cn.starterZoneR) * q;
      const N = Rr.THICK * (1.2 - Math.min(1, I / cn.outerRadius) * 0.65);
      _ = Math.cos(V) * I;
      A = Math.sin(V) * I;
      R = (b() - 0.5) * N;
    } else {
      const V = Math.floor(b() * r.arms);
      const q = 0.15 + b() * 0.85;
      const I = cn.starterZoneR + (cn.outerRadius - cn.starterZoneR) * q;
      const N = Math.log(I / r.r0) / r.b;
      const U = (b() - 0.5) * (r.width / Math.max(1, I)) * 2.4;
      const W = V * ((Math.PI * 2) / r.arms) + N + U;
      _ = Math.cos(W) * I;
      A = Math.sin(W) * I;
      R = (b() - 0.5) * Rr.THICK;
    }
    const T = { x: _, y: R, z: A };
    if (!(Math.hypot(T.x, T.z) < cn.starterZoneR) && c.every((V) => nodeDistance(V, T) >= cn.starterExclusionR) && l.every((V) => nodeDistance(V, T) >= Rr.MIN_DIST)) return T;
  }
  const f = (seed >>> 0) / 4294967295;
  const m = f * Math.PI * 2 + o.length * 2.399963229728653;
  const h = fR + (cn.outerRadius - fR) * ((o.length % 5) / 4);
  return { x: Math.cos(m) * h, y: (mulberry32(seed >>> 0)() - 0.5) * Rr.THICK, z: Math.sin(m) * h };
}
