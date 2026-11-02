/** renderer/index.ts — экспорт домена рендерера (Stage 7.0: 3D-планета и 3D-галактика). */
export { RENDERER_STATUS } from './status';
export { buildPlanetMeshData, parseColor, type MeshBuildOptions, type PlanetMeshData } from './planetMesh';
export { FpsMeter, type FpsStats } from './fps';
export { createPlanetViewer, type PlanetViewer } from './scene';
export { renderPixelRatio } from './pixelRatio';

export { buildGalaxyRenderData, type GalaxyRenderData, type GalaxyRenderNode } from './galaxyModel';
export { createGalaxyViewer, type GalaxyViewer } from './galaxyScene';
