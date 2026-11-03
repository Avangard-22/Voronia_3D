/** galaxy/index.ts — экспорт домена галактики. */
export { GALAXY_STATUS } from './status';
export {
  SPIRAL_ARM_IDS,
  INITIAL_NODE_POS,
  nodeDistance,
  spiralArmIndex,
  armIdAt,
  generatePosition,
  type PositionConfig,
} from './position';
export { createPlanetaryGraph, createInitialGraph, hasEdge, nodeDegree, addEdge, linkDiscoveredNode } from './graph';

export { ROUTE_POLICY, quoteRouteLeg, findGalaxyRoute, buildRouteOptions } from './routes';

export {
  buildStarSystemCatalog,
  validateStarSystemCatalog,
  buildSystemOrbits,
  classifyStar,
  orbitalPeriodDays,
  systemPlanetCount,
  SYSTEM_POLICY,
  type StarSystemCatalog,
  type StarSystemBody,
  type StarClass,
  type SystemBodyClass,
  type SystemBodyStatus,
} from './starSystems';
export {
  GALAXY_SEED,
  CORE_SYSTEM_ID,
  STAR_MAP_POLICY,
  buildGalaxyStarMap,
  systemForNode,
  validateStarMap,
  generateSystemName,
  systemDesignation,
  type GalaxyStarMap,
  type StarMapInput,
} from './starMap';
export { buildStarSystemExploration, type StarSystemExplorationView, type SystemWorldView, type SystemBodyCandidateView } from './systemExploration';

export * from './systemTopology';
