/**
 * combat/status.ts — домен вне текущего среза: NOT_IMPLEMENTED (ТЗ §19 — статус обязателен, «молчаливых» доменов нет).
 * Этап 8: боссы/стражи/коллапсы (planet.boss — вне среза).
 */
import type { DomainStatus } from '../contracts/ports';

export const COMBAT_STATUS: DomainStatus = Object.freeze({
  domain: 'combat',
  status: 'NOT_IMPLEMENTED',
  stage: 8,
  note: 'боссы/стражи/коллапсы (planet.boss — вне среза)',
});
