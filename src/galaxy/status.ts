/**
 * galaxy/status.ts — PARTIAL: Этап 3 закрыл генерацию позиций (Br), рукава (My/er), граф (Kf/Us)
 * и начальный граф oi(). Этап 5: рендер карты (2D/3D), навигация, маршруты (In), sonar-превью.
 */
import type { DomainStatus } from '../contracts/ports';

export const GALAXY_STATUS: DomainStatus = Object.freeze({
  domain: 'galaxy',
  status: 'PARTIAL',
  stage: 9,
  note: 'позиции/рукава/граф — Этап 3; карта, навигация, маршруты — Этап 5; транзит — Этап 8.1; карта звёздных систем (39 систем, 1–5 планет на орбитах) — Этап 9.0. Не закрыто: привязка сонарных открытий к свободным орбитам фоновых систем (Этап 9.1)',
});
