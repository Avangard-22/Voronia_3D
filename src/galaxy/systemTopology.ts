/** Stage 7.4.2 — доменная проекция иерархии «звезда → орбита → планета». */
import type { StarSystemCatalog } from './starSystems';

export interface SystemTopologyBody {
  readonly bodyId: string;
  readonly orbitIndex: number;
  readonly orbitRadius: number;
  readonly eccentricity: number;
  readonly inclination: number;
  readonly ascendingNode: number;
  readonly orbitalPhase: number;
  readonly bodyClass: string;
  readonly discovered: boolean;
  readonly planetId: string | null;
  readonly parentSystemId: string;
}

export interface StarSystemTopology {
  readonly systemId: string;
  readonly hostPlanetId: string;
  readonly star: StarSystemCatalog['star'];
  readonly bodies: readonly SystemTopologyBody[];
}

export function buildStarSystemTopology(
  catalog: StarSystemCatalog,
  scannedBodyIds: readonly string[],
  activatedBodies: Readonly<Record<string, string>>,
): StarSystemTopology {
  const scanned = new Set(scannedBodyIds);
  return {
    systemId: catalog.id,
    hostPlanetId: catalog.hostPlanetId,
    star: catalog.star,
    bodies: catalog.bodies.map((body) => ({
      bodyId: body.id,
      orbitIndex: body.orbitIndex,
      orbitRadius: body.semiMajorAxis,
      eccentricity: body.eccentricity,
      inclination: body.inclination,
      ascendingNode: body.ascendingNode,
      orbitalPhase: body.orbitalPhase,
      bodyClass: body.status === 'confirmed' || scanned.has(body.id) ? body.bodyClass : 'unknown',
      discovered: body.status === 'confirmed' || scanned.has(body.id),
      planetId: body.sourcePlanetId ?? activatedBodies[body.id] ?? null,
      parentSystemId: catalog.id,
    })),
  };
}

/** Только подтверждённые/активированные планеты допускаются к межпланетному переходу. */
export function canNavigateWithinSystem(topology: StarSystemTopology, destinationId: string): boolean {
  return topology.bodies.some((body) => body.planetId === destinationId && body.discovered);
}
