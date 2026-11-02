/**
 * crafting/status.ts — домен вне текущего среза: NOT_IMPLEMENTED (ТЗ §19 — статус обязателен, «молчаливых» доменов нет).
 * Этап 6: крафт соединений (recipes), авто-крафт, верфь.
 */
import type { DomainStatus } from '../contracts/ports';

export const CRAFTING_STATUS: DomainStatus = Object.freeze({
  domain: 'crafting',
  status: 'NOT_IMPLEMENTED',
  stage: 6,
  note: 'крафт соединений (recipes), авто-крафт, верфь',
});
