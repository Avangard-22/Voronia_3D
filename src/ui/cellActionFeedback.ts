import type { ActionResult } from '../contracts/commands';

const REJECT_LABELS: Readonly<Record<string, string>> = {
  state: 'Это действие сейчас недоступно для клетки.',
  energy: 'Недостаточно энергии.',
  cost: 'Недостаточно ресурсов для операции.',
  max: 'Достигнут максимальный уровень.',
  type: 'Для этого типа клетки действие не предусмотрено.',
  cooldown: 'Клетка ещё восстанавливается. Попробуйте позже.',
  hidden: 'Сначала необходимо обнаружить клетку.',
  'unknown-cell': 'Клетка больше не существует в текущем состоянии планеты.',
  locked: 'Сначала изучите необходимую технологию.',
};

export function cellActionFeedback(action: string, result: ActionResult<unknown>): { readonly ok: boolean; readonly text: string } {
  if (!result.ok) {
    const detail = result.detail?.trim();
    return { ok: false, text: REJECT_LABELS[result.reason] ?? (detail ? `Операция отклонена: ${detail}` : 'Операция не выполнена.') };
  }
  const labels: Readonly<Record<string, string>> = {
    scan: 'Клетка исследована. Новые сигнатуры поверхности раскрыты.',
    upgrade: 'Уровень клетки повышен. Производство пересчитано.',
    reactivate: 'Месторождение реактивировано.',
    discharge: 'Энергия клетки успешно разряжена.',
    anomaly: 'Аномальная структура усилена.',
    branch: 'Ветка аномалии активирована.',
  };
  return { ok: true, text: labels[action] ?? 'Действие выполнено.' };
}
