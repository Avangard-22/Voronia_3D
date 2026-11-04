/**
 * tests/stage9_3_migration.test.ts — Этап 9.3: регрессия миграции legacy v39.
 *
 * Баг со скриншота пользователя: карточки показывали «⏳ 1700000000 с» — миграция
 * переносила epoch-мс (Date.now()-шкала, ~1.7e12) в игровые мсcooldownUntil, и UI
 * считал кулдаун «игровыми секундами» эпохального масштаба. Фикс: legacyGameMs()
 * в schema.ts — значение > 1e11 (заведомо больше любых игровых мс) → 0.
 */
import { describe, it, expect } from 'vitest';
import { migrateLegacyV39 } from '../src/persistence/schema';
import { fixture } from './helpers';

const golden = fixture<Record<string, unknown>>('golden_save_fresh_v0.0.41.json');

function withCooldown(value: unknown): Record<string, unknown> {
  const copy = JSON.parse(JSON.stringify(golden)) as Record<string, unknown>;
  const planets = copy['planets'] as Record<string, { cellStates: Record<string, unknown>[] }>;
  planets['ferrum']!.cellStates[0]!['cooldownUntil'] = value;
  return copy;
}

describe('Этап 9.3 — миграция cooldownUntil (фикс эпохальных секунд)', () => {
  it('epoch-мс (шкала Date.now, ~1.7e12) → 0, а не эпохальные «игровые секунды»', () => {
    const v2 = migrateLegacyV39(withCooldown(1_700_000_000_000));
    expect(v2.planets['ferrum']!.cellStates[0]!.cooldownUntil).toBe(0);
  });

  it('пограничное эпохальное значение (> 1e11) → 0', () => {
    const v2 = migrateLegacyV39(withCooldown(1e11 + 1));
    expect(v2.planets['ferrum']!.cellStates[0]!.cooldownUntil).toBe(0);
  });

  it('обычные игровые мс сохраняются как есть', () => {
    const v2 = migrateLegacyV39(withCooldown(45_000));
    expect(v2.planets['ferrum']!.cellStates[0]!.cooldownUntil).toBe(45_000);
  });

  it('отрицательные и нечисловые значения → 0', () => {
    expect(migrateLegacyV39(withCooldown(-5)).planets['ferrum']!.cellStates[0]!.cooldownUntil).toBe(0);
    expect(migrateLegacyV39(withCooldown('oops')).planets['ferrum']!.cellStates[0]!.cooldownUntil).toBe(0);
    expect(migrateLegacyV39(withCooldown(null)).planets['ferrum']!.cellStates[0]!.cooldownUntil).toBe(0);
  });

  it('UI-следствие: снапшот загруженного legacy-сейва не содержит эпохальных кулдаунов', async () => {
    const { Game } = await import('../src/core/game');
    const { ManualDriver } = await import('../src/core/gameClock');
    const { MemoryStorage, LEGACY_SAVE_KEY } = await import('../src/persistence');
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_SAVE_KEY, JSON.stringify(withCooldown(1_700_000_000_000)));
    const game = new Game({ storage, clockDriver: new ManualDriver(), rngSeed: 1 });
    expect(game.saves.load().ok).toBe(true);
    const snap = game.snapshot();
    const planet = snap.planets.find((p) => p.id === 'ferrum')!;
    for (const c of planet.cells) {
      const cd = (c as unknown as { cooldownUntil?: number }).cooldownUntil ?? 0;
      expect(cd).toBeLessThan(1e11);
    }
  });
});
