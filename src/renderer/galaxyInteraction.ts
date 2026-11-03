import type { GalaxyRenderData, GalaxyRenderNode } from './galaxyModel';

export interface GalaxyPoint3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** A hidden signal is never selectable through the interactive 3D layer. */
export function findSelectableGalaxyNode(data: GalaxyRenderData, nodeId: string): GalaxyRenderNode | null {
  const node = data.nodes.find((item) => item.id === nodeId);
  return node?.discovered ? node : null;
}

/** Interpolates uniformly by route leg, not by total geometric length. */
export function routePositionAtProgress(points: readonly GalaxyPoint3[], progress: number): GalaxyPoint3 | null {
  if (points.length < 2) return points[0] ?? null;
  const t = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const scaled = t * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(scaled));
  const local = t === 1 ? 1 : scaled - index;
  const from = points[index]!;
  const to = points[index + 1]!;
  return {
    x: from.x + (to.x - from.x) * local,
    y: from.y + (to.y - from.y) * local,
    z: from.z + (to.z - from.z) * local,
  };
}

/** Removes unknown IDs and consecutive duplicates from a display-only route. */
export function resolveGalaxyRoute(data: GalaxyRenderData, path: readonly string[]): GalaxyRenderNode[] {
  const byId = new Map(data.nodes.map((node) => [node.id, node]));
  const result: GalaxyRenderNode[] = [];
  for (const id of path) {
    const node = byId.get(id);
    if (!node || !node.discovered) continue;
    if (result[result.length - 1]?.id !== node.id) result.push(node);
  }
  return result;
}
