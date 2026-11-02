/**
 * galaxy/status.ts — PARTIAL: Этап 3 закрыл генерацию позиций (Br), рукава (My/er), граф (Kf/Us)
 * и начальный граф oi(). Этап 5: рендер карты (2D/3D), навигация, маршруты (In), sonar-превью.
 */
import type { DomainStatus } from '../contracts/ports';

export const GALAXY_STATUS: DomainStatus = Object.freeze({
  domain: 'galaxy',
  status: 'PARTIAL',
  stage: 3,
  note: 'позиции/рукава/граф — готовы (Этап 3); карта, навигация, маршруты — Этап 5',
});
