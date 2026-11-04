/**
 * progression/tech.ts — TechState: уровни исследований/технологий и предикаты анлоков (1.x ft()/Kt()).
 * Kt parity (fixtures/resources_research_v0.0.41.json): iron → всегда; ресурс с researchUnlock →
 * открыт, если исследование куплено; без researchUnlock → открыт.
 * Полный древо-домен (стоимости/ветки) — Этап 7; здесь — состояние и анлоки для среза Этапа 2.
 */
import type { RegistryTechSection } from '../config/types';
import { FRESH_TECH, RESOURCE_UNLOCK, type TechLevels } from '../contracts/tech';
import type { TechPort } from '../contracts/ports';
import { RESEARCH_BY_ID, RESEARCH_POLICY } from './techTree';

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

  /** Текущий уровень исследования (0 — не куплено). */
  level(id: string): number {
    return this.levels.get(id) ?? 0;
  }

  // ——— Этап 9.3 (Этап 7 ТЗ): типизированные модификаторы технологий (ADR-021) ———
  yieldMult(kind: 'iron' | 'crystal' | 'kriogen'): number {
    const per = kind === 'iron'
      ? RESEARCH_POLICY.effects.ironBoostPerLevel
      : kind === 'crystal'
        ? RESEARCH_POLICY.effects.crystalBoostPerLevel
        : RESEARCH_POLICY.effects.kriogenBoostPerLevel;
    const id = kind === 'iron' ? 'ironBoost' : kind === 'crystal' ? 'crystalBoost' : 'kriogenBoost';
    return 1 + per * this.level(id);
  }

  veinCooldownMult(): number {
    const e = RESEARCH_POLICY.effects;
    return Math.max(e.thermCooldownFloor, Math.pow(1 - e.thermCooldownPerLevel, this.level('therm')));
  }

  veinYieldMult(): number {
    return 1 + RESEARCH_POLICY.effects.hyperdrillYieldPerLevel * this.level('hyperdrill');
  }

  scanCostMult(): number {
    const e = RESEARCH_POLICY.effects;
    return Math.max(e.reconScanFloor, 1 - e.reconScanPerLevel * this.level('recon'));
  }

  cellMaxLevelBonus(): number {
    return RESEARCH_POLICY.effects.maxLevelPerLevel * this.level('maxLevel');
  }

  researchLevels(): ReadonlyMap<string, number> {
    return this.levels;
  }

  /** Этап 9.3 (Этап 7 ТЗ): доступна ли покупка следующего уровня (требования + потолок). */
  canResearch(id: string): { ok: true } | { ok: false; reason: 'unknown-tech' | 'locked' | 'max' } {
    const def = RESEARCH_BY_ID[id];
    if (!def) return { ok: false, reason: 'unknown-tech' };
    if (def.maxLevel > 0 && this.level(id) >= def.maxLevel) return { ok: false, reason: 'max' };
    for (const p of def.prereq) if (!this.hasResearch(p)) return { ok: false, reason: 'locked' };
    return { ok: true };
  }

  /** Этап 9.3: применить покупку — уровень +1; для ключей v1 TechLevels зеркалим в legacy-хранилище (parity costScaleMult). */
  applyResearch(id: string): number {
    const next = this.level(id) + 1;
    this.levels.set(id, next);
    if (id in this.tech) this.tech = { ...this.tech, [id]: next };
    return next;
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
