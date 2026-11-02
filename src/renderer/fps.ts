/**
 * renderer/fps.ts — замер FPS/frame-time (вердикт R1: «СРАЗУ замер FPS на целевом Android»).
 * Скользящее окно (cap 240 кадров): fps = 1000/avg, p95FrameMs — перцентиль frame-time.
 * Чистый класс без DOM — тестируется в node; целевые значения (Приложение B ТЗ): desktop 60, mobile 30, p95 < 33 мс.
 */
export interface FpsStats {
  readonly fps: number;
  readonly avgFrameMs: number;
  readonly p95FrameMs: number;
  readonly frames: number;
}

export class FpsMeter {
  private readonly samples: number[] = [];
  private last: number | null = null;

  constructor(private readonly cap = 240) {}

  /** Вызывать каждый кадр c timestamp (performance.now / RAF-аргумент). */
  sample(nowMs: number): void {
    if (this.last !== null) {
      const dt = nowMs - this.last;
      if (dt > 0 && dt < 10_000) {
        this.samples.push(dt);
        if (this.samples.length > this.cap) this.samples.shift();
      }
    }
    this.last = nowMs;
  }

  stats(): FpsStats {
    if (this.samples.length === 0) return { fps: 0, avgFrameMs: 0, p95FrameMs: 0, frames: 0 };
    const sorted = [...this.samples].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = sum / sorted.length;
    const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? avg;
    return { fps: 1000 / avg, avgFrameMs: avg, p95FrameMs: p95, frames: sorted.length };
  }

  reset(): void {
    this.samples.length = 0;
    this.last = null;
  }
}
