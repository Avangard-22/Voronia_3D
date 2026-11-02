/** planets/index.ts — экспорт домена планет. */
export { loadPlanetData, validatePlanetData, PlanetDataError_, PLANET_DATA_ERRORS, type PlanetDataError, type PlanetDataValidation } from './data';
export { createPlanetRuntime, applyStartState, isExplored, isRevealed, cellState, type PlanetRuntime } from './runtime';
export { buildCatalog, toPlanetData, armsFromBalance, defaultGeneratorCtx, STARTER_PLANET_SPECS, type PlanetCatalog } from './catalog';
export { ExplorationService, type ExplorationDeps, type ScanOutcome } from './exploration';
export {
  buildPlanet,
  buildPlanetBody,
  assignPlanetResources,
  applyMixedClusters,
  initPlanetStart,
  pickGeometry,
  pickFrequency,
  isUniquePlanet,
  planetTier,
  planetTierFinal,
  genName,
  genDescriptors,
  genPalette,
  genLore,
  genEvents,
  rollResources,
  crystalEnsure,
  computeBiomePerks,
  discoverReward,
  validateTopology,
  type GeneratorCtx,
  type VeinProfile,
  type ResourceRollResult,
} from './generator';
export {
  GEOMETRY_TABLES,
  DESCRIPTOR_TABLES,
  NAME_SYLLABLES,
  EVENT_TYPES_BASE,
  MIXED_CLIMATE_PARAMS,
  mixedParamsFor,
  mixedMorphologyText,
  type GeometryTableEntry,
  type PlanetEventBase,
} from './tables';
