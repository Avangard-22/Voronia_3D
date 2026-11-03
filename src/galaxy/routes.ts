/** Stage 6.6 — детерминированная маршрутизация по открытому графу галактики. */
import type { GalaxyRoute, GraphNode, PlanetaryGraph, RouteLeg } from '../contracts/galaxy';
import { nodeDistance } from './position';
import { classifySignal, galaxySector } from './exploration';

export const ROUTE_POLICY = Object.freeze({ energyPerDistance: 150, anomalyMultiplier: 1.25, freightEnergyPerMassDistance: 0.5,
  /** Этап 8.1: пролёт через нанесённую на карту, но ещё не открытую систему (discovered && !unlocked). */
  lockedTransitMultiplier: 1.5,
  /** Этап 8.1: слепой пролёт через не нанесённую на карту систему. Дороже — поэтому Dijkstra предпочитает изученные пути. */
  blindTransitMultiplier: 2.5,
  sectorSurcharge: {
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

/**
 * Надбавка за пролёт через систему без остановки. Обе конечные точки открыты — обычная цена;
 * одна из них нанесена на карту (discovered) — lockedTransitMultiplier; узел вообще не изучен — blindTransitMultiplier.
 */
export function transitMultiplier(nodes: Readonly<Record<string, GraphNode | undefined>>, unlocked: ReadonlySet<string>, fromId: string, toId: string): number {
  if (unlocked.has(fromId) && unlocked.has(toId)) return 1;
  const known = (id: string): boolean => unlocked.has(id) || nodes[id]?.discovered === true;
  return known(fromId) && known(toId) ? ROUTE_POLICY.lockedTransitMultiplier : ROUTE_POLICY.blindTransitMultiplier;
}

/**
 * Компоненты связности «карты переходов»: все рёбра графа между существующими узлами, независимо от
 * discovered/unlocked. Единственный источник истины для маршрутизации (Этап 8.1) и для проверки
 * целостности галактики (Stage 6.8): открытая планета обязана быть достижима, иначе сейв неремонтопригоден.
 */
export function buildChartedComponents(graph: PlanetaryGraph): Map<string, number> {
  const components = new Map<string, number>();
  const nodes = graph.nodes ?? {};
  for (const node of Object.keys(nodes)) components.set(node, -1);
  const adjacency = new Map<string, string[]>();
  for (const [a, b] of graph.edges ?? []) {
    if (a === b || !nodes[a] || !nodes[b]) continue;
    adjacency.set(a, [...(adjacency.get(a) ?? []), b]);
    adjacency.set(b, [...(adjacency.get(b) ?? []), a]);
  }
  let component = 0;
  for (const start of Object.keys(nodes)) {
    if ((components.get(start) ?? -1) >= 0) continue;
    const queue = [start];
    components.set(start, component);
    while (queue.length) {
      const current = queue.shift()!;
      for (const next of adjacency.get(current) ?? []) {
        if ((components.get(next) ?? -1) >= 0) continue;
        components.set(next, component);
        queue.push(next);
      }
    }
    component++;
  }
  return components;
}

export interface RouteSearchOptions {
  /**
   * false — контракт Этапа 6.6: транзит только через открытые (unlocked) и изученные узлы.
   * По умолчанию true (Этап 8.1): пролёт через неоткрытые системы разрешён с надбавкой, остановка — только в открытой.
   */
  readonly allowTransit?: boolean;
}

/** Dijkstra по графу; остановки — только открытые планеты, транзитные системы проезжаются без посадки. */
export function findGalaxyRoute(
  graph: PlanetaryGraph,
  unlockedIds: readonly string[],
  fromId: string,
  destinationId: string,
  cargoMass = 0,
  options: RouteSearchOptions = {},
): GalaxyRoute | null {
  if (fromId === destinationId) return null;
  const allowed = new Set(unlockedIds);
  if (!allowed.has(fromId) || !allowed.has(destinationId)) return null;
  const nodes = graph.nodes;
  if (!nodes[fromId]?.discovered || !nodes[destinationId]?.discovered) return null;
  const allowTransit = options.allowTransit !== false;

  const adjacency = new Map<string, string[]>();
  for (const [a, b] of graph.edges) {
    if (a === b || !nodes[a] || !nodes[b]) continue;
    if (!allowTransit && (!allowed.has(a) || !allowed.has(b) || !nodes[a]?.discovered || !nodes[b]?.discovered)) continue;
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
      const multiplier = allowTransit ? transitMultiplier(nodes, allowed, current, next) : 1;
      const nextCost = best + Math.ceil(leg.energyCost * multiplier);
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
  const physical = reversed.reverse();

  // Сжатие пути: транзитные системы не становятся остановками, иначе activePlanetId указывал бы на мир без runtime.
  const path: string[] = [physical[0]!];
  const legs: RouteLeg[] = [];
  const transitNodeIds: string[] = [];
  let segmentFrom = physical[0]!;
  let segmentDistance = 0;
  let segmentEnergy = 0;
  let segmentFreight = 0;
  let segmentAnomaly = false;
  for (let i = 1; i < physical.length; i++) {
    const to = physical[i]!;
    const leg = quoteRouteLeg(nodes[physical[i - 1]!]!, nodes[to]!, cargoMass);
    const multiplier = allowTransit ? transitMultiplier(nodes, allowed, physical[i - 1]!, to) : 1;
    segmentDistance += leg.distance;
    segmentEnergy += Math.ceil(leg.energyCost * multiplier);
    segmentFreight += leg.freightCost;
    segmentAnomaly = segmentAnomaly || leg.anomalyRisk;
    if (!allowed.has(to)) transitNodeIds.push(to);
    const isStop = allowed.has(to) || i === physical.length - 1;
    if (!isStop) continue;
    legs.push({
      from: segmentFrom, to, distance: segmentDistance, energyCost: Math.max(1, segmentEnergy),
      freightCost: segmentFreight, sectorId: galaxySector(nodes[to]!).id, anomalyRisk: segmentAnomaly,
    });
    path.push(to);
    segmentFrom = to; segmentDistance = 0; segmentEnergy = 0; segmentFreight = 0; segmentAnomaly = false;
  }

  const nextHop = path[1];
  const firstLeg = legs[0];
  if (!nextHop || !firstLeg) return null;
  return {
    destinationId,
    destinationName: nodes[destinationId].name,
    path,
    nextHop,
    hops: path.length - 1,
    totalDistance: distances.get(destinationId) ?? 0,
    totalEnergy: costs.get(destinationId) ?? 0,
    firstLeg,
    transitNodeIds,
  };
}

export function buildRouteOptions(
  graph: PlanetaryGraph,
  unlockedIds: readonly string[],
  fromId: string,
  cargoMass = 0,
  options: RouteSearchOptions = {},
): GalaxyRoute[] {
  return unlockedIds
    .filter((id) => id !== fromId)
    .map((id) => findGalaxyRoute(graph, unlockedIds, fromId, id, cargoMass, options))
    .filter((route): route is GalaxyRoute => route !== null)
    .sort((a, b) => a.hops - b.hops || a.totalEnergy - b.totalEnergy || a.destinationName.localeCompare(b.destinationName));
}
