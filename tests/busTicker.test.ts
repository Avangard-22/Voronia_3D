/**
 * EventBus (GS-12: история cap 50 из registry, изоляция ошибок обработчиков) +
 * EconomyTicker/GameClock (кламп dt ≤ 500 мс — parity 1.x C1, stalledRealMs в фонд офлайн-расчёта Этапа 11).
 */
import { describe, it, expect } from 'vitest';
import { EventBus } from '../src/core/eventBus';
import { GameClock, ManualDriver } from '../src/core/gameClock';
import { loadBalance } from '../src/config/loader';
import { makeGame, advance } from './helpers';

describe('EventBus', () => {
  it('historyCap = registry bus.historyCap = 50', () => {
    const balance = loadBalance();
    expect(balance.registry.bus.historyCap).toBe(50);
    const bus = new EventBus({ historyCap: balance.registry.bus.historyCap });
    for (let i = 0; i < 60; i++) bus.emit('game:tick', { dtMs: 16, gameMs: i });
    expect(bus.getHistory()).toHaveLength(50);
    expect(bus.getHistory()[0]!.detail).toMatchObject({ gameMs: 10 });
  });

  it('изолятор ошибок: упавший обработчик не рвёт эмиссию и не ломает остальных', () => {
    const bus = new EventBus({ historyCap: 10 });
    const seen: number[] = [];
    bus.on('warehouse:upgraded', () => {
      throw new Error('boom');
    });
    bus.on('warehouse:upgraded', (p) => seen.push(p.level));
    expect(() => bus.emit('warehouse:upgraded', { level: 3 })).not.toThrow();
    expect(seen).toEqual([3]);
  });

  it('once срабатывает один раз; off отписывает', () => {
    const bus = new EventBus({ historyCap: 10 });
    let n = 0;
    bus.once('game:tick', () => n++);
    bus.emit('game:tick', { dtMs: 1, gameMs: 1 });
    bus.emit('game:tick', { dtMs: 1, gameMs: 2 });
    expect(n).toBe(1);
    const off = bus.on('game:tick', () => n++);
    off();
    bus.emit('game:tick', { dtMs: 1, gameMs: 3 });
    expect(n).toBe(1);
  });
});

describe('GameClock / EconomyTicker', () => {
  it('тик начисляет доход: fresh eps=1 → +0.5⚡ за тик 500 мс', () => {
    const { game } = makeGame(13);
    expect(game.ledger.balance('energy')).toBe(0);
    advance(game, 1, 500);
    expect(game.ledger.balance('energy')).toBeCloseTo(0.5, 9);
    advance(game, 3, 500);
    expect(game.ledger.balance('energy')).toBeCloseTo(2, 9);
    expect(game.ledger.balance('research')).toBeCloseTo(0.002, 12);
  });

  it('кламп dt ≤ 500 мс (parity C1): скачок 5000 мс → один тик 500 мс, избыток в stalledRealMs', () => {
    const driver = new ManualDriver();
    const clock = new GameClock(driver);
    const ticks: number[] = [];
    clock.onTick((dt) => ticks.push(dt));
    clock.start();
    driver.advance(0, 1000);
    driver.advance(5000, 6000);
    expect(ticks).toEqual([500]);
    expect(clock.gameMsNow).toBe(500);
    expect(clock.stalledRealMs).toBe(4500);
    expect(clock.takeStalled()).toBe(4500);
    expect(clock.stalledRealMs).toBe(0);
  });

  it('пауза: тики не начисляются; скорость масштабирует dt', () => {
    const driver = new ManualDriver();
    const clock = new GameClock(driver);
    const ticks: number[] = [];
    clock.onTick((dt) => ticks.push(dt));
    clock.start();
    driver.advance(0, 0);
    clock.setPaused(true);
    driver.advance(100, 100);
    expect(ticks).toEqual([]);
    clock.setPaused(false);
    clock.setSpeed(2);
    driver.advance(100, 200);
    expect(ticks).toEqual([200]);
  });

  it('game:tick эмитится каждый шаг; журнал ledger содержит tick:income', () => {
    const { game } = makeGame(13);
    let ticks = 0;
    game.bus.on('game:tick', () => ticks++);
    advance(game, 5, 500);
    expect(ticks).toBe(5);
    expect(game.ledger.journal().some((tx) => tx.reason === 'tick:income')).toBe(true);
  });
});
