/** Stage 7.0 — чистая проекция реального PlanetaryGraph в координаты 3D-сцены. */
import type { GraphNode } from '../contracts/galaxy';

export interface GalaxyRenderNode {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly discovered: boolean;
  readonly unlocked: boolean;
  readonly active: boolean;
  readonly armId: string;
  readonly sectorId: 'core' | 'inner' | 'mid' | 'outer';
  readonly signalClass: 'anomaly' | 'energy' | 'cryo' | 'resource' | 'unknown';
}

export interface GalaxyRenderData {
  readonly nodes: readonly GalaxyRenderNode[];
  readonly edges: readonly (readonly [string, string])[];
  readonly bounds: number;
}

/** Координаты X/Y/Z не генерируются заново: берутся непосредственно из узлов игрового графа. */
export function buildGalaxyRenderData(input: {
  readonly nodes: readonly (GraphNode & { readonly signalClass?: GalaxyRenderNode['signalClass']; readonly sectorId?: GalaxyRenderNode['sectorId'] })[];
  readonly edges: readonly (readonly [string, string])[];
  readonly unlockedIds: readonly string[];
  readonly activeId: string;
  readonly scale?: number;
}): GalaxyRenderData {
  const scale = Number.isFinite(input.scale) && (input.scale ?? 0) > 0 ? input.scale! : 0.08;
  const unlocked = new Set(input.unlockedIds);
  const ids = new Set(input.nodes.map((node) => node.id));
  const discoveredIds = new Set(input.nodes.filter((node) => node.discovered).map((node) => node.id));
  const nodes = input.nodes.map((node): GalaxyRenderNode => ({
    id: node.id,
    name: node.discovered ? node.name : 'Неизвестный сигнал',
    x: node.x * scale,
    y: node.y * scale,
    z: node.z * scale,
    discovered: node.discovered,
    unlocked: unlocked.has(node.id),
    active: node.id === input.activeId,
    armId: node.discovered ? node.armId : '',
    sectorId: node.discovered ? (node.sectorId ?? 'outer') : 'outer',
    signalClass: node.discovered ? (node.signalClass ?? 'unknown') : 'unknown',
  }));
  const edges = input.edges.filter(([a, b]) => ids.has(a) && ids.has(b) && discoveredIds.has(a) && discoveredIds.has(b));
  const bounds = Math.max(1, ...nodes.map((node) => Math.hypot(node.x, node.y, node.z)));
  return { nodes, edges, bounds };
}
