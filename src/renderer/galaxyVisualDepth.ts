/** Stage 7.2 — чистые правила визуальной детализации галактики. */
export type GalaxyLod = 'wide' | 'regional' | 'system';

/** LOD зависит от дистанции камеры, а не от состояния игровых узлов. */
export function galaxyLodForDistance(distance: number): GalaxyLod {
  if (!Number.isFinite(distance) || distance > 22) return 'wide';
  if (distance > 9) return 'regional';
  return 'system';
}

export interface GalaxyVisualBudget {
  readonly nebulaPoints: number;
  readonly clusterStars: number;
}

/** Ограничивает декоративные частицы на узких экранах и при высоком DPR. */
export function galaxyVisualBudget(viewportWidth: number, devicePixelRatio: number): GalaxyVisualBudget {
  const width = Number.isFinite(viewportWidth) ? Math.max(0, viewportWidth) : 0;
  const dpr = Number.isFinite(devicePixelRatio) ? Math.max(1, devicePixelRatio) : 1;
  if (width < 600 || dpr > 2) return { nebulaPoints: 900, clusterStars: 360 };
  if (width < 1100 || dpr > 1.5) return { nebulaPoints: 1600, clusterStars: 640 };
  return { nebulaPoints: 2600, clusterStars: 1050 };
}
