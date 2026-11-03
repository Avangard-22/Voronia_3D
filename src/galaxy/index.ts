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

export { buildStarSystemCatalog, validateStarSystemCatalog, type StarSystemCatalog, type StarSystemBody, type StarClass, type SystemBodyClass, type SystemBodyStatus } from './starSystems';
export { buildStarSystemExploration, type StarSystemExplorationView, type SystemWorldView, type SystemBodyCandidateView } from './systemExploration';

export * from './systemTopology';
