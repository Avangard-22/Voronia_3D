/**
 * core/GameClock.ts — централизованное игровое время: пауза/скорость, кламп огромного dt
 * (throttling/сон → stalledRealMs в фонд офлайн-расчёта Этапа 11), драйверы Raf/Manual, serialize/hydrate.
 * Паритет клампа: 1.x C1 — dt = (e − lastTime)/1000, t > 0.5 → t = 0.5.
 */
import type { ClockDriver } from '../contracts/ports';

export interface GameClockSnapshot {
  readonly gameMs: number;
  readonly paused: boolean;
  readonly speed: number;
  readonly stalledRealMs: number;
}

export type TickListener = (dtMs: number, gameMs: number) => void;

const DT_CLAMP_MS = 500;
const STALL_THRESHOLD_MS = 2000;

export class GameClock {
  private gameMs = 0;
  private pausedFlag = false;
  private speedValue = 1;
  private stalled = 0;
  private lastRealMs: number | null = null;
  private readonly listeners: TickListener[] = [];

  constructor(private readonly driver: ClockDriver) {}

  start(): void {
    this.driver.start((nowMs) => this.frame(nowMs));
  }

  stop(): void {
    this.driver.stop();
  }

  onTick(listener: TickListener): () => void {
    this.listeners.push(listener);
    return () => {
      const i = this.listeners.indexOf(listener);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  /** Ручной прогон кадра (тесты/ManualDriver). */
  frame(nowMs: number): void {
    if (this.lastRealMs === null) {
      this.lastRealMs = nowMs;
      return;
    }
    let realDt = nowMs - this.lastRealMs;
    this.lastRealMs = nowMs;
    if (realDt <= 0) return;
    if (realDt > STALL_THRESHOLD_MS) {
      // сон вкладки/тrotтлинг: избыток — в фонд офлайн (Этап 11), в игру идёт кламп
      this.stalled += realDt - DT_CLAMP_MS;
      realDt = DT_CLAMP_MS;
    }
    realDt = Math.min(realDt, DT_CLAMP_MS);
    if (this.pausedFlag) return;
    const dt = realDt * this.speedValue;
    this.gameMs += dt;
    for (const l of [...this.listeners]) l(dt, this.gameMs);
  }

  paused(): boolean {
    return this.pausedFlag;
  }
  setPaused(v: boolean): void {
    this.pausedFlag = v;
  }
  speed(): number {
    return this.speedValue;
  }
  setSpeed(v: number): void {
    this.speedValue = Math.max(0.25, Math.min(4, v));
  }
  get gameMsNow(): number {
    return this.gameMs;
  }
  get stalledRealMs(): number {
    return this.stalled;
  }
  takeStalled(): number {
    const s = this.stalled;
    this.stalled = 0;
    return s;
  }

  serialize(): GameClockSnapshot {
    return { gameMs: this.gameMs, paused: this.pausedFlag, speed: this.speedValue, stalledRealMs: this.stalled };
  }

  hydrate(s: GameClockSnapshot): void {
    this.gameMs = s.gameMs;
    this.pausedFlag = s.paused;
    this.speedValue = s.speed;
    this.stalled = s.stalledRealMs;
    this.lastRealMs = null;
  }
}

/** Браузерный драйвер (requestAnimationFrame). */
export class RafDriver implements ClockDriver {
  private raf = 0;
  private running = false;

  start(onFrame: (nowMs: number) => void): void {
    if (this.running) return;
    this.running = true;
    const loop = (t: number) => {
      if (!this.running) return;
      onFrame(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
}

/** Тестовый драйвер: кадр вызывается вручную. */
export class ManualDriver implements ClockDriver {
  private onFrameFn: ((nowMs: number) => void) | null = null;

  start(onFrame: (nowMs: number) => void): void {
    this.onFrameFn = onFrame;
  }
  stop(): void {
    this.onFrameFn = null;
  }
  advance(ms: number, nowMs: number): void {
    void ms;
    this.onFrameFn?.(nowMs);
  }
}
