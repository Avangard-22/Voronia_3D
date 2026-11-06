import { describe, expect, it } from 'vitest';
import { cellActionFeedback } from '../src/ui/cellActionFeedback';

describe('Stage 10.0.2 — surface cell action feedback', () => {
  it('returns explicit success messages for direct cell actions', () => {
    expect(cellActionFeedback('scan', { ok: true, value: {} })).toEqual({ ok: true, text: 'Клетка исследована. Новые сигнатуры поверхности раскрыты.' });
    expect(cellActionFeedback('upgrade', { ok: true, value: {} }).ok).toBe(true);
    expect(cellActionFeedback('branch', { ok: true, value: {} }).text).toContain('активирована');
  });

  it('translates common domain rejections into actionable Russian feedback', () => {
    expect(cellActionFeedback('scan', { ok: false, reason: 'energy' })).toEqual({ ok: false, text: 'Недостаточно энергии.' });
    expect(cellActionFeedback('upgrade', { ok: false, reason: 'max' }).text).toContain('максимальный уровень');
    expect(cellActionFeedback('reactivate', { ok: false, reason: 'cooldown' }).text).toContain('восстанавливается');
  });

  it('uses a safe fallback for an unmapped rejection', () => {
    expect(cellActionFeedback('scan', { ok: false, reason: 'not-implemented', detail: 'future' }).text).toBe('Операция отклонена: future');
  });
});
