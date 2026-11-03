/**
 * Детерминизм (README Этап 2: «детерминизм по seed»): одинаковый seed + одинаковый скрипт →
 * идентичные снапшоты (включая rng-зависимые: наука аномалии, роллы мутантов).
 * GS-исключение: gameStartSeed по умолчанию — временной, здесь фиксируем seed.
 */
import { describe, it, expect } from 'vitest';
import { makeGame, grant, advance } from './helpers';
import type { Game } from '../src/core/game';
import { Rng } from '../src/core/rng';

function playScript(game: Game): void {
  grant(game, { energy: 100000, iron: 10000, steel: 500 });
  // детерминированная политика: сканируем наименьший раскрытый неисследованный id, пока хватает энергии
  for (let step = 0; step < 12; step++) {
    const rt = game.runtime('ferrum')!;
    const next = rt.data.cells.find((c) => rt.revealed.has(c.id) && !rt.explored.has(c.id));
    if (!next) break;
    const res = game.dispatch('scanCell', { pid: 'ferrum', cellId: next.id });
    if (!res.ok) break;
  }
  game.dispatch('upgradeCell', { pid: 'ferrum', cellId: 0 });
  game.dispatch('upgradeCell', { pid: 'ferrum', cellId: 0 });
  game.dispatch('upgradeCell', { pid: 'ferrum', cellId: 0 });
  advance(game, 20, 500);
}

function comparableSnapshot(game: Game): unknown {
  const s = game.snapshot();
  // startTime — wall-clock (GS-исключение «gameStartSeed»): вне детерминизма по seed
  const { startTime: _startTime, ...session } = s.session;
  void _startTime;
  return {
    resources: s.resources,
    perSec: s.perSec,
    scan: s.scan,
    warehouse: s.warehouse,
    session,
    gameMs: s.gameMs,
    planets: s.planets.map((p) => ({
      id: p.id,
      exploredCount: p.exploredCount,
      cells: p.cells.map((c) => ({ id: c.id, status: c.status, level: c.level, reserve: c.reserve, mutant: c.mutant, anomalyType: c.anomalyType })),
    })),
    rng: game.rng.state(),
  };
}

describe('детерминизм по seed', () => {
  it('два прогона с seed 15929600 → идентичные снапшоты', () => {
    const a = makeGame(15929600);
    const b = makeGame(15929600);
    playScript(a.game);
    playScript(b.game);
    expect(JSON.stringify(comparableSnapshot(a.game))).toBe(JSON.stringify(comparableSnapshot(b.game)));
  });

  it('разные seed → различаются rng-зависимые поля (наука аномалии / мутанты), детерминизм сохраняется внутри сида', () => {
    const a1 = makeGame(111);
    const a2 = makeGame(111);
    const b1 = makeGame(222);
    playScript(a1.game);
    playScript(a2.game);
    playScript(b1.game);
    expect(JSON.stringify(comparableSnapshot(a1.game))).toBe(JSON.stringify(comparableSnapshot(a2.game)));
    // как минимум rng-состояние различается
    expect(a1.game.rng.state()).not.toBe(b1.game.rng.state());
  });

  it('rng fork детерминирован: одинаковый seed+label → одинаковая последовательность', () => {
    const r1 = new Rng(42);
    const r2 = new Rng(42);
    const f1 = r1.fork('scan:ferrum:3');
    const f2 = r2.fork('scan:ferrum:3');
    const seq1 = [f1.next(), f1.next(), f1.nextInt(10, 25)];
    const seq2 = [f2.next(), f2.next(), f2.nextInt(10, 25)];
    expect(seq1).toEqual(seq2);
    const f3 = r1.fork('scan:ferrum:4');
    expect(f3.next()).not.toBe(seq1[0]);
  });
});
