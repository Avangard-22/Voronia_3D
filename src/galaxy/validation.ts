/** Stage 6.8 — независимая проверка целостности состояния галактики. */
import type { PlanetaryGraph, GalaxyRoute } from '../contracts/galaxy';
import type { ResourceAmounts } from '../contracts/resources';

export interface GalaxyIntegrityInput {
  readonly graph: PlanetaryGraph;
  readonly unlockedPlanetIds: readonly string[];
  readonly activePlanetId: string;
  readonly runtimePlanetIds: readonly string[];
  readonly routes: readonly GalaxyRoute[];
  readonly cargo: ResourceAmounts;
  readonly depots: Readonly<Record<string, ResourceAmounts>>;
}

export interface IntegrityIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

export interface GalaxyIntegrityReport {
  readonly ok: boolean;
  readonly checkedNodes: number;
  readonly checkedEdges: number;
  readonly checkedRoutes: number;
  readonly issues: readonly IntegrityIssue[];
}

function amountIssues(amounts: ResourceAmounts, path: string): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  for (const [key, value] of Object.entries(amounts)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      issues.push({ code: 'invalid-resource-amount', severity: 'error', message: `${path}.${key}: ожидалось конечное неотрицательное число` });
    }
  }
  return issues;
}

/** Проверяет только инварианты, которые должны быть истинны для любого корректного runtime/save. */
export function validateGalaxyIntegrity(input: GalaxyIntegrityInput): GalaxyIntegrityReport {
  const issues: IntegrityIssue[] = [];
  const { graph } = input;
  const unlocked = new Set(input.unlockedPlanetIds);
  const runtime = new Set(input.runtimePlanetIds);
  const nodes = graph.nodes ?? {};
  const nodeIds = new Set(Object.keys(nodes));
  const edgeKeys = new Set<string>();

  if (unlocked.size !== input.unlockedPlanetIds.length) {
    issues.push({ code: 'duplicate-unlocked-planet', severity: 'error', message: 'Список открытых планет содержит дубликаты' });
  }
  if (!unlocked.has(input.activePlanetId)) {
    issues.push({ code: 'active-planet-locked', severity: 'error', message: `Активная планета ${input.activePlanetId} не входит в список открытых` });
  }

  for (const id of unlocked) {
    const node = nodes[id];
    if (!node) issues.push({ code: 'unlocked-node-missing', severity: 'error', message: `Для открытой планеты ${id} отсутствует узел графа` });
    else if (!node.discovered) issues.push({ code: 'unlocked-node-undiscovered', severity: 'error', message: `Узел ${id} открыт в игре, но помечен undiscovered` });
    if (!runtime.has(id)) issues.push({ code: 'runtime-planet-missing', severity: 'error', message: `Для открытой планеты ${id} отсутствует runtime` });
  }
  for (const id of runtime) {
    if (!unlocked.has(id)) issues.push({ code: 'orphan-runtime', severity: 'error', message: `Runtime планеты ${id} существует, но планета не открыта` });
  }

  for (const [id, node] of Object.entries(nodes)) {
    if (node.id !== id || node.planetId !== id) {
      issues.push({ code: 'node-id-mismatch', severity: 'error', message: `Ключ графа ${id} не совпадает с node.id/planetId` });
    }
    if (![node.x, node.y, node.z, node.frequency].every(Number.isFinite)) {
      issues.push({ code: 'invalid-node-coordinate', severity: 'error', message: `Узел ${id} содержит нечисловые координаты или частоту` });
    }
    if (node.discovered && !unlocked.has(id)) {
      issues.push({ code: 'discovered-node-locked', severity: 'error', message: `Узел ${id} помечен discovered, но отсутствует среди открытых планет` });
    }
  }

  for (const [a, b] of graph.edges ?? []) {
    const key = [a, b].sort().join('|');
    if (a === b) issues.push({ code: 'self-edge', severity: 'error', message: `Обнаружено ребро ${a} → ${b} с самим собой` });
    if (!nodeIds.has(a) || !nodeIds.has(b)) issues.push({ code: 'dangling-edge', severity: 'error', message: `Ребро ${a} ↔ ${b} ссылается на отсутствующий узел` });
    if (edgeKeys.has(key)) issues.push({ code: 'duplicate-edge', severity: 'warning', message: `Ребро ${a} ↔ ${b} повторяется` });
    edgeKeys.add(key);
  }

  // Все открытые миры должны быть достижимы друг от друга по рёбрам только через открытые узлы.
  if (unlocked.has(input.activePlanetId) && nodes[input.activePlanetId]) {
    const adjacency = new Map<string, string[]>();
    for (const [a, b] of graph.edges ?? []) {
      if (!unlocked.has(a) || !unlocked.has(b) || !nodes[a]?.discovered || !nodes[b]?.discovered) continue;
      adjacency.set(a, [...(adjacency.get(a) ?? []), b]);
      adjacency.set(b, [...(adjacency.get(b) ?? []), a]);
    }
    const reached = new Set<string>([input.activePlanetId]);
    const queue = [input.activePlanetId];
    while (queue.length) {
      const current = queue.shift()!;
      for (const next of adjacency.get(current) ?? []) if (!reached.has(next)) { reached.add(next); queue.push(next); }
    }
    for (const id of unlocked) if (!reached.has(id)) issues.push({ code: 'unreachable-unlocked-planet', severity: 'error', message: `Открытая планета ${id} недостижима из ${input.activePlanetId} по открытым маршрутам` });
  }

  for (const route of input.routes) {
    if (route.path.length < 2 || route.path[0] !== input.activePlanetId || route.path.at(-1) !== route.destinationId) {
      issues.push({ code: 'invalid-route-path', severity: 'error', message: `Маршрут к ${route.destinationId} имеет некорректные начало/конец` });
      continue;
    }
    if (route.hops !== route.path.length - 1 || route.nextHop !== route.path[1]) {
      issues.push({ code: 'invalid-route-summary', severity: 'error', message: `Сводка маршрута к ${route.destinationId} не соответствует пути` });
    }
    for (const id of route.path) if (!unlocked.has(id) || !nodes[id]?.discovered) issues.push({ code: 'route-uses-locked-node', severity: 'error', message: `Маршрут к ${route.destinationId} использует закрытый узел ${id}` });
    for (let i = 1; i < route.path.length; i++) {
      const key = [route.path[i - 1], route.path[i]].sort().join('|');
      if (!edgeKeys.has(key)) issues.push({ code: 'route-uses-nonedge', severity: 'error', message: `Маршрут к ${route.destinationId} использует отсутствующее ребро ${route.path[i - 1]} ↔ ${route.path[i]}` });
    }
    if (![route.totalDistance, route.totalEnergy, route.firstLeg.energyCost].every((n) => Number.isFinite(n) && n >= 0)) {
      issues.push({ code: 'invalid-route-cost', severity: 'error', message: `Маршрут к ${route.destinationId} содержит некорректную стоимость/дистанцию` });
    }
  }

  issues.push(...amountIssues(input.cargo, 'cargo'));
  for (const [planetId, depot] of Object.entries(input.depots)) {
    if (!unlocked.has(planetId)) issues.push({ code: 'orphan-depot', severity: 'error', message: `Депо ${planetId} принадлежит закрытой/отсутствующей планете` });
    issues.push(...amountIssues(depot, `depots.${planetId}`));
  }

  return {
    ok: !issues.some((issue) => issue.severity === 'error'),
    checkedNodes: Object.keys(nodes).length,
    checkedEdges: (graph.edges ?? []).length,
    checkedRoutes: input.routes.length,
    issues,
  };
}
