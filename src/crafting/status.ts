/**
 * crafting/status.ts — PARTIAL: ручная очередь реактора подключена к Game и UI.
 * Авто-крафт, полная V1-лаборатория и дополнительные производственные контуры остаются следующими задачами.
 */
import type { DomainStatus } from '../contracts/ports';

export const CRAFTING_STATUS: DomainStatus = Object.freeze({
  domain: 'crafting',
  status: 'PARTIAL',
  stage: 10.0,
  note: 'ручная очередь реактора и рецепты подключены; авто-крафт и полный V1 производственный контур ещё не завершены',
});
