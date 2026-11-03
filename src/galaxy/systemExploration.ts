/** Stage 7.4 — безопасная UI-проекция доменного каталога звёздной системы. */
import { buildStarSystemCatalog, validateStarSystemCatalog, type StarSystemCatalog } from '../galaxy/starSystems';
import type { GraphNode } from '../contracts/galaxy';

export interface SystemWorldView {
  readonly id: string;
  readonly name: string;
  readonly biome: string;
  readonly geometry: string;
  readonly discovered: true;
  readonly unlocked: boolean;
  readonly active: boolean;
  readonly orbitRadius: number;
  readonly orbitIndex: 0;
}

export interface SystemBodyCandidateView {
  readonly id: string;
  readonly label: string;
  readonly orbitIndex: number;
  readonly orbitRadius: number;
  readonly status: 'unscanned';
}

export interface StarSystemExplorationView {
  readonly id: string;
  readonly name: string;
  readonly catalog: StarSystemCatalog;
  readonly worlds: readonly SystemWorldView[];
  readonly candidates: readonly SystemBodyCandidateView[];
  readonly confirmedWorldCount: number;
  readonly candidateCount: number;
  readonly catalogState: 'orbital-signatures-detected';
  readonly canEnter: boolean;
  readonly activeWorldId: string | null;
}

export function buildStarSystemExploration(
  node: (Pick<GraphNode, 'id' | 'name' | 'seed' | 'discovered' | 'biome' | 'geometryName'> & { readonly unlocked: boolean; readonly active: boolean }) | null | undefined,
): StarSystemExplorationView | null {
  if (!node?.discovered) return null;
  const catalog = buildStarSystemCatalog(node);
  if (!catalog || validateStarSystemCatalog(catalog).length) return null;
  const host = catalog.bodies[0];
  if (!host) return null;
  const world: SystemWorldView = {
    id: node.id, name: node.name,
    biome: node.biome,
    geometry: node.geometryName,
    discovered: true, unlocked: node.unlocked, active: node.active,
    orbitRadius: host.semiMajorAxis, orbitIndex: 0,
  };
  const candidates = catalog.bodies.filter((body) => body.status === 'unscanned').map((body) => ({
    id: body.id, label: 'Неидентифицированное орбитальное тело', orbitIndex: body.orbitIndex,
    orbitRadius: body.semiMajorAxis, status: 'unscanned' as const,
  }));
  return {
    id: catalog.id, name: `${node.name} · система`, catalog,
    worlds: [world], candidates, confirmedWorldCount: 1, candidateCount: candidates.length,
    catalogState: 'orbital-signatures-detected', canEnter: world.unlocked,
    activeWorldId: world.active ? world.id : null,
  };
}
