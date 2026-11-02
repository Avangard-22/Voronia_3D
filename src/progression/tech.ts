/**
 * progression/tech.ts — TechState: уровни исследований/технологий и предикаты анлоков (1.x ft()/Kt()).
 * Kt parity (fixtures/resources_research_v0.0.41.json): iron → всегда; ресурс с researchUnlock →
 * открыт, если исследование куплено; без researchUnlock → открыт.
 * Полный древо-домен (стоимости/ветки) — Этап 7; здесь — состояние и анлоки для среза Этапа 2.
 */
import type { RegistryTechSection } from '../config/types';
import { FRESH_TECH, RESOURCE_UNLOCK, type TechLevels } from '../contracts/tech';
import type { TechPort } from '../contracts/ports';

export { FRESH_TECH, RESOURCE_UNLOCK };
export type { TechLevels };

export class TechState implements TechPort {
  private levels = new Map<string, number>();
  private tech: TechLevels = FRESH_TECH;

  constructor(private readonly techSection: RegistryTechSection) {}

  /** 1.x ft(id): исследование куплено. */
  hasResearch(id: string): boolean {
    return (this.levels.get(id) ?? 0) > 0;
  }

  /** 1.x Kt(key): ресурс открыт. */
  isUnlocked(resourceKey: string): boolean {
    if (resourceKey === 'iron') return true;
    const req = RESOURCE_UNLOCK[resourceKey];
    if (req === undefined || req === null) return true;
    return this.hasResearch(req);
  }

  /** 1.x Gk() = techCostScaleMult: costScaleCurve[tech.costScale] (fresh → 1.15). */
  costScaleMult(): number {
    const curve = this.techSection.costScaleCurve.costScale;
    const idx = Math.max(0, Math.min(curve.length - 1, this.tech.costScale));
    return curve[idx] ?? 1.15;
  }

  techLevels(): TechLevels {
    return this.tech;
  }

  researchLevels(): ReadonlyMap<string, number> {
    return this.levels;
  }

  setResearch(id: string, level: number): void {
    this.levels.set(id, Math.max(0, level));
  }

  serialize(): { tech: TechLevels; research: Record<string, number> } {
    const research: Record<string, number> = {};
    for (const [k, v] of this.levels) if (v > 0) research[k] = v;
    return { tech: this.tech, research };
  }

  hydrate(s: { tech?: Partial<TechLevels>; research?: Record<string, number> } | undefined): void {
    this.tech = { ...FRESH_TECH, ...(s?.tech ?? {}) };
    this.levels.clear();
    for (const [k, v] of Object.entries(s?.research ?? {})) {
      if (typeof v === 'number' && v > 0) this.levels.set(k, v);
    }
  }
}
