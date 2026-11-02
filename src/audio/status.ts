/**
 * audio/status.ts — домен вне текущего среза: NOT_IMPLEMENTED (ТЗ §19 — статус обязателен, «молчаливых» доменов нет).
 * Этап 12: звук/музыка (WebAudio).
 */
import type { DomainStatus } from '../contracts/ports';

export const AUDIO_STATUS: DomainStatus = Object.freeze({
  domain: 'audio',
  status: 'NOT_IMPLEMENTED',
  stage: 12,
  note: 'звук/музыка (WebAudio)',
});
