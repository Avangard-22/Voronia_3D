/** Stage 6.6 — детерминированная маршрутизация по открытому графу галактики. */
import type { GalaxyRoute, GraphNode, PlanetaryGraph, RouteLeg } from '../contracts/galaxy';
import { nodeDistance } from './position';
import { classifySignal, galaxySector } from './exploration';

export const ROUTE_POLICY = Object.freeze({ energyPerDistance: 150, anomalyMultiplier: 1.25, freightEnergyPerMassDistance: 0.5, sectorSurcharge: {
  core: 0,
  inner: 250,
  mid: 700,
  outer: 1400,
} as const });

const SECTOR_SURCHARGE = ROUTE_POLICY.sectorSurcharge;

function isAnomaly(node: GraphNode): boolean {
  return classifySignal({ biome: node.biome, geometry: node.geometryName, frequency: node.frequency }) === 'anomaly';
}

export function quoteRouteLeg(from: GraphNode, to: GraphNode, cargoMass = 0): RouteLeg {
  const distance = nodeDistance(from, to);
  const sector = galaxySector(to);
  const anomalyRisk = isAnomaly(from) || isAnomaly(to);
  const raw = distance * ROUTE_POLICY.energyPerDistance + SECTOR_SURCHARGE[sector.id];
  const baseCost = Math.ceil(raw * (anomalyRisk ? ROUTE_POLICY.anomalyMultiplier : 1));
  const freightCost = Math.ceil(Math.max(0, cargoMass) * distance * ROUTE_POLICY.freightEnergyPerMassDistance);
  const energyCost = Math.max(1, baseCost + freightCost);
  return { from: from.id, to: to.id, distance, energyCost, freightCost, sectorId: sector.id, anomalyRisk };
}

/** Dijkstra по реально открытым узлам; закрытые/неизвестные узлы не могут служить транзитом. */
export function findGalaxyRoute(
  graph: PlanetaryGraph,
  unlockedIds: readonly string[],
  fromId: string,
  destinationId: string,
  cargoMass = 0,
): GalaxyRoute | null {
  if (fromId === destinationId) return null;
  const allowed = new Set(unlockedIds);
  if (!allowed.has(fromId) || !allowed.has(destinationId)) return null;
  const nodes = graph.nodes;
  if (!nodes[fromId]?.discovered || !nodes[destinationId]?.discovered) return null;

  const adjacency = new Map<string, string[]>();
  for (const [a, b] of graph.edges) {
    if (!allowed.has(a) || !allowed.has(b) || !nodes[a]?.discovered || !nodes[b]?.discovered) continue;
    adjacency.set(a, [...(adjacency.get(a) ?? []), b]);
    adjacency.set(b, [...(adjacency.get(b) ?? []), a]);
  }

  const costs = new Map<string, number>([[fromId, 0]]);
  const distances = new Map<string, number>([[fromId, 0]]);
  const previous = new Map<string, string>();
  const visited = new Set<string>();

  while (true) {
    let current: string | null = null;
    let best = Infinity;
    for (const [id, cost] of costs) {
      if (!visited.has(id) && cost < best) { current = id; best = cost; }
    }
    if (current === null) break;
    if (current === destinationId) break;
    visited.add(current);
    const from = nodes[current];
    if (!from) continue;
    for (const next of adjacency.get(current) ?? []) {
      if (visited.has(next)) continue;
      const to = nodes[next];
      if (!to) continue;
      const leg = quoteRouteLeg(from, to, cargoMass);
      const nextCost = best + leg.energyCost;
      if (nextCost < (costs.get(next) ?? Infinity)) {
        costs.set(next, nextCost);
        distances.set(next, (distances.get(current) ?? 0) + leg.distance);
        previous.set(next, current);
      }
    }
  }

  if (!costs.has(destinationId)) return null;
  const reversed = [destinationId];
  let cursor = destinationId;
  while (cursor !== fromId) {
    const parent = previous.get(cursor);
    if (!parent) return null;
    reversed.push(parent);
    cursor = parent;
  }
  const path = reversed.reverse();
  const nextHop = path[1];
  const first = nextHop ? quoteRouteLeg(nodes[fromId]!, nodes[nextHop]!, cargoMass) : null;
  if (!nextHop || !first) return null;
  return {
    destinationId,
    destinationName: nodes[destinationId]!.name,
    path,
    nextHop,
    hops: path.length - 1,
    totalDistance: distances.get(destinationId) ?? 0,
    totalEnergy: costs.get(destinationId) ?? 0,
    firstLeg: first,
  };
}

export function buildRouteOptions(
  graph: PlanetaryGraph,
  unlockedIds: readonly string[],
  fromId: string,
  cargoMass = 0,
): GalaxyRoute[] {
  return unlockedIds
    .filter((id) => id !== fromId)
    .map((id) => findGalaxyRoute(graph, unlockedIds, fromId, id, cargoMass))
    .filter((route): route is GalaxyRoute => route !== null)
    .sort((a, b) => a.hops - b.hops || a.totalEnergy - b.totalEnergy || a.destinationName.localeCompare(b.destinationName));
}
