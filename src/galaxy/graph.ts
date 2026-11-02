/**
 * galaxy/graph.ts — планетарный граф (1.x ge.PlanetaryGraph; Hs/Jn/Us/Kf, bundle @103300).
 * Рёбра — пары id; степень узла ограничена 4 (Us), но fallback Kf (изолированный узел)
 * добавляет ребро в обход ограничений — дословно как в 1.x.
 */
import { mulberry32 } from '../contracts/rng';
import type { GraphNode, PlanetaryGraph } from '../contracts/galaxy';
import { GALAXY_GRAPH_VERSION } from '../contracts/galaxy';
import { nodeDistance } from './position';

/** Пустой граф (1.x: version 1 до oi()). */
export function createPlanetaryGraph(): PlanetaryGraph {
  return { version: 1, nodes: {}, edges: [] };
}

/** Граф после oi(): ferrum+krios, ребро [["ferrum","krios"]], version 5. Узлы собирает core (имена — из каталога планет). */
export function createInitialGraph(ferrumNode: GraphNode, kriosNode: GraphNode): PlanetaryGraph {
  return {
    version: GALAXY_GRAPH_VERSION,
    nodes: { ferrum: ferrumNode, krios: kriosNode },
    edges: [['ferrum', 'krios']],
  };
}

/** 1.x Hs — есть ли ребро (в любом направлении). */
export function hasEdge(graph: PlanetaryGraph, a: string, b: string): boolean {
  return graph.edges.some((o) => (o[0] === a && o[1] === b) || (o[0] === b && o[1] === a));
}

/** 1.x Jn — степень узла. */
export function nodeDegree(graph: PlanetaryGraph, id: string): number {
  return graph.edges.reduce((t, o) => t + (o[0] === id || o[1] === id ? 1 : 0), 0);
}

/** 1.x Us — добавление ребра с проверками (без self-loop/дубликатов; степень < 4). */
export function addEdge(graph: PlanetaryGraph, a: string, b: string): void {
  if (!a || !b || a === b || hasEdge(graph, a, b)) return;
  const cap = 4;
  if (nodeDegree(graph, a) >= cap || nodeDegree(graph, b) >= cap) return;
  graph.edges.push([a, b]);
}

/**
 * 1.x Kf — линковка нового узла: ближайшее ребро (deg<3), два опциональных (шансы .15/.08,
 * детерминированы от seed узла), fallback для изолированного — ребро к узлу минимальной степени
 * (в обход cap/дубликатов — так в 1.x).
 */
export function linkDiscoveredNode(graph: PlanetaryGraph, node: GraphNode): void {
  const t = Object.values(graph.nodes).filter((s) => s && s.id !== node.id && Number.isFinite(s.x));
  if (!t.length) return;
  t.sort((s, c) => nodeDistance(node, s) - nodeDistance(node, c));
  if (nodeDegree(graph, node.id) < 3) addEdge(graph, node.id, t[0]!.id);
  const o = mulberry32(((node.seed || 1) >>> 0) ^ 1374496517)();
  if (t[1] && nodeDegree(graph, node.id) < 2 && nodeDegree(graph, t[1].id) < 4) {
    const s = nodeDistance(node, t[0]!);
    const c = nodeDistance(node, t[1]);
    if (!hasEdge(graph, t[0]!.id, t[1].id) && c < s * 1.35 && o < 0.15) addEdge(graph, node.id, t[1].id);
  }
  const r = mulberry32(((node.seed || 1) >>> 0) ^ 200209633)();
  if (t[2] && nodeDegree(graph, node.id) < 2 && nodeDegree(graph, t[2].id) < 4) {
    const s = nodeDistance(node, t[0]!);
    const c = nodeDistance(node, t[2]);
    const l = hasEdge(graph, t[0]!.id, t[2].id);
    const u = t[1] ? hasEdge(graph, t[1].id, t[2].id) : false;
    if (!l && !u && c < s * 1.7 && r < 0.08) addEdge(graph, node.id, t[2].id);
  }
  if (nodeDegree(graph, node.id) === 0 && t.length) {
    let s = t[0]!;
    let c = Infinity;
    for (const l of t) {
      const u = nodeDegree(graph, l.id);
      if (u < c) {
        c = u;
        s = l;
      }
    }
    graph.edges.push([node.id, s.id]);
  }
}
