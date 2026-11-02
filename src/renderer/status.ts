/**
 * renderer/status.ts — статус домена (ТЗ §19 — «молчаливых» доменов нет).
 * Stage 7.0: 3D-поверхность планеты и интерактивная 3D-галактика, связанная с PlanetaryGraph.
 * Продвинутый LOD, эффекты и финальная браузерная/мобильная приёмка остаются следующими задачами.
 */
import type { DomainStatus } from '../contracts/ports';

export const RENDERER_STATUS: DomainStatus = Object.freeze({
  domain: 'renderer',
  status: 'PARTIAL',
  stage: 7,
  note: 'Three.js r170: 3D-поверхность планеты и базовая интерактивная 3D-галактика из PlanetaryGraph; продвинутый LOD/эффекты/браузерная приёмка ещё впереди',
});
