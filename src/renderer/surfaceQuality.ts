/** Адаптивный профиль качества поверхности: чистая логика без Three.js/DOM. */
export type SurfaceQualityTier = 'low' | 'balanced' | 'high';

export interface SurfaceQualityProfile {
  readonly tier: SurfaceQualityTier;
  /** Множитель к DPR устройства; итоговый DPR дополнительно ограничивается cap. */
  readonly pixelRatioCap: number;
  /** Уровень процедурных деталей в шейдере: 0 отключает дорогой шум. */
  readonly shaderDetail: number;
  /** Множитель амплитуды геологической анимации. */
  readonly animationScale: number;
}

export const SURFACE_QUALITY: Readonly<Record<SurfaceQualityTier, SurfaceQualityProfile>> = Object.freeze({
  low: { tier: 'low', pixelRatioCap: 1, shaderDetail: 0, animationScale: 0.35 },
  balanced: { tier: 'balanced', pixelRatioCap: 1.5, shaderDetail: 0.55, animationScale: 0.7 },
  high: { tier: 'high', pixelRatioCap: 2, shaderDetail: 1, animationScale: 1 },
});

/**
 * Гистерезисный регулятор качества. Понижает качество быстро при просадке,
 * повышает медленно после устойчивого запаса производительности.
 */
export class AdaptiveSurfaceQuality {
  private readonly samples: number[] = [];
  private lastDecisionAt = 0;
  private fastHeadroomSince: number | null = null;
  private current: SurfaceQualityTier = 'balanced';

  constructor(private readonly sampleWindow = 90) {}

  get tier(): SurfaceQualityTier { return this.current; }

  update(nowMs: number, frameMs: number): SurfaceQualityTier {
    if (!Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 1000) return this.current;
    this.samples.push(frameMs);
    if (this.samples.length > this.sampleWindow) this.samples.shift();
    if (this.samples.length < Math.min(30, this.sampleWindow) || nowMs - this.lastDecisionAt < 1200) return this.current;

    const sorted = [...this.samples].sort((a, b) => a - b);
    const average = this.samples.reduce((sum, value) => sum + value, 0) / this.samples.length;
    const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? average;
    this.lastDecisionAt = nowMs;

    if (p95 > 30 || average > 23) {
      this.current = this.current === 'high' ? 'balanced' : 'low';
      this.fastHeadroomSince = null;
      return this.current;
    }

    if (p95 < 17 && average < 15) {
      this.fastHeadroomSince ??= nowMs;
      if (nowMs - this.fastHeadroomSince >= 5000) {
        this.current = this.current === 'low' ? 'balanced' : 'high';
        this.fastHeadroomSince = nowMs;
      }
    } else {
      this.fastHeadroomSince = null;
    }
    return this.current;
  }

  reset(): void {
    this.samples.length = 0;
    this.lastDecisionAt = 0;
    this.fastHeadroomSince = null;
    this.current = 'balanced';
  }
}

export function surfacePixelRatio(devicePixelRatio: number, viewportWidth: number, tier: SurfaceQualityTier): number {
  const native = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const profile = SURFACE_QUALITY[tier];
  const deviceCap = viewportWidth < 700 ? 1.5 : 2;
  return Math.max(0.75, Math.min(native, profile.pixelRatioCap, deviceCap));
}
