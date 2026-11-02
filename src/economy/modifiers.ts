/**
 * economy/modifiers.ts — цепочки модификаторов (ADR-014): типизированные контексты с ИМЕНОВАННЫМИ множителями.
 * Порядок из 1.x ce()/ln()/zn(): каждый ресурс — произведение факторов; baseline ferrum подтверждён runtime-аудитом:
 *   ×0.9 скана = рукав «ЯДРО» (arm.scan), ×1.2 апгрейда = дескриптор «Мёрзлый» (perk upgradeCostMult),
 *   ×1.15 железа = «Каменистый» (perk ironBonus), ×6 дохода = compound-бонус (кап Fa()).
 */
import { compoundBonusMult } from '../contracts/resources';
import type { CompoundResourceKey } from '../contracts/resources';
import type { PlanetRuntime } from '../contracts/planets';
import type { ArmModifiers } from '../contracts/economy';

export type { ArmModifiers };

export interface ModifierSources {
  /** Соединения игрока (compound-бонус, кап ×6). */
  readonly compounds: Readonly<Partial<Record<CompoundResourceKey, number>>>;
  /** Уровень склада (Gi = 1+0.05L). */
  readonly warehouseLevel: number;
  /** Таблица рукавов: core/inter/spiral (fixtures/galaxy_arms_full.json). */
  readonly armFor: (pid: string) => ArmModifiers | null;
  /** Биом-множитель Xc (planet.biomeMults: ferrum 1, krios 0.6, hidden 0.8, frozen 0.7, scorched 1.2, toxic 0.9). */
  readonly biomeMultFor: (rt: PlanetRuntime) => number;
}

export const CORE_ARM: ArmModifiers = Object.freeze({ id: 'core', name: 'ЯДРО', energy: 1, iron: 1, kriogen: 1, rare: 0.8, deplete: 0.8, scan: 0.9, event: 0.75, focus: {} });
export const INTER_ARM: ArmModifiers = Object.freeze({ id: 'inter', name: 'МЕЖРУКАВЬЕ', energy: 1, iron: 1, kriogen: 1, rare: 0.85, deplete: 0.9, scan: 1, event: 0.85, focus: {} });

/** Именованная цепочка: факторы × произведение (для provenance/отладки — STAGE2 parity-таблицы). */
export interface NamedChain {
  readonly factors: Record<string, number>;
  total(): number;
}

export function chain(name: string, factors: Record<string, number>): NamedChain & { readonly name: string } {
  return {
    name,
    factors,
    total(): number {
      let t = 1;
      for (const k of Object.keys(factors)) t *= factors[k] ?? 1;
      return t;
    },
  };
}

export function compoundFactor(src: ModifierSources): number {
  return compoundBonusMult(src.compounds);
}

export function warehouseFactor(src: ModifierSources): number {
  return 1 + src.warehouseLevel * 0.05;
}
