/** renderer/index.ts — экспорт домена рендерера (Stage 7.0: 3D-планета и 3D-галактика). */
export { RENDERER_STATUS } from './status';
export { buildPlanetMeshData, parseColor, type MeshBuildOptions, type PlanetMeshData } from './planetMesh';
export { FpsMeter, type FpsStats } from './fps';
export { createPlanetViewer, type PlanetViewer } from './scene';
export { renderPixelRatio } from './pixelRatio';

export { buildGalaxyRenderData, type GalaxyRenderData, type GalaxyRenderNode } from './galaxyModel';
export { createGalaxyViewer, type GalaxyViewer } from './galaxyScene';
export { findSelectableGalaxyNode, resolveGalaxyRoute, routePositionAtProgress, type GalaxyPoint3 } from './galaxyInteraction';

export { galaxyLodForDistance, galaxyVisualBudget, type GalaxyLod, type GalaxyVisualBudget } from './galaxyVisualDepth';

export { buildGalaxySystemDetail, type GalaxySystemDetail } from './galaxySystemDetail';



export { SurfaceStabilityMonitor } from './surfaceStabilityMonitor';
export { createSurfaceDiagnosticsDashboard } from './surfaceDiagnosticsDashboard';

export { benchmarkPlanetSurface, runSurfaceStressSuite, type SurfaceBenchmarkRun, type SurfaceBenchmarkOptions } from './surfaceStressLab';

export { AdaptiveSurfaceStreamingController, classifySurfaceDevice, type AdaptiveStreamingLimits, type SurfaceDeviceClass, type SurfaceDeviceHints, type SurfaceStreamingMode } from './adaptiveSurfaceStreamingController';

export { SurfaceGpuResourceLifecycle, type SurfaceGpuResourceDescriptor, type SurfaceGpuLifecycleStats } from './surfaceGpuLifecycle';
