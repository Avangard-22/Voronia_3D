/**
 * economy/production.ts — ProductionService: истощение жил (1.x ta()/tb() в C1-тике) и реактивация ($n/$l/Xs).
 * Parity (fixtures/veins_audit_v0.0.41.json): ta(ferrum cell1 fresh) = 0.1×0.8(рукав)×0.7(«Мёрзлый») = 0.056/с;
 * cooldown = 300000+150000×reactCount (registry cells.reactCooldown*, кап 1800000/20);
 * реактивация = max(40, round(48×(L+1)^1.18 × s × Xs × perkUpgradeCostMult)), s = 1+min(0.35, log10(max(10,maxReserve))×0.06),
 * Xs = min(14, 1+0.55×reactCount) → 65/101/136/172⚡ при ×1.2 (README Этап 2).
 */
import type { ActionResult, ReactivateCellResult } from '../contracts/commands';
import { fail, ok } from '../contracts/commands';
import type { BalanceConfig } from '../config/types';
import type { ArmModifiers } from '../contracts/economy';
import type { EventPort, LedgerPort, TechPort } from '../contracts/ports';
import type { PlanetRuntime } from '../contracts/planets';
import type { CellState } from '../contracts/cells';

export interface ProductionDeps {
  readonly balance: BalanceConfig;
  readonly ledger: LedgerPort;
  readonly bus: EventPort;
  readonly tech: TechPort;
  readonly armFor: (rt: PlanetRuntime) => ArmModifiers | null;
  readonly gameMs: () => number;
  readonly hooks?: { readonly sleep?: number; readonly deepMult?: number; readonly techMods?: number };
  /** Этап 4 (1.x fm(planet)): per-планетный множитель «сна» от power-аномалий — перекрывает hooks.sleep. */
  readonly sleepFor?: (rt: PlanetRuntime) => number;
}

/** 1.x l1(cell) = 1 + max(0, level−9)×0.07 — ускорение истощения высоких жил. */
export function veinLevelDepleteMult(st: CellState): number {
  return 1 + Math.max(0, st.level - 9) * 0.07;
}

/** 1.x Wr(idx): 1 + max(0, idx−start−offset)×step, кап maxMult (registry eco.deplete; Wr(1)=1). */
export function planetIndexDepleteMult(balance: BalanceConfig, planetIndex: number): number {
  const d = balance.registry.eco.deplete;
  const m = 1 + Math.max(0, planetIndex - d.start - d.offset) * d.step;
  return Math.min(d.maxMult, m);
}

export class ProductionService {
  constructor(private readonly deps: ProductionDeps) {}

  /** Скорость истощения жилы в секунду (1.x ta()). */
  depletePerSec(rt: PlanetRuntime, cellId: number): number {
    const node = rt.data.cells[cellId];
    const st = rt.cellStates.get(cellId);
    if (!node || !st) return 0;
    const b = this.deps.balance;
    const base = node.type === 5 ? st.kriogenYield : st.ironYield;
    const arm = this.deps.armFor(rt);
    const deep = st.isDeep ? (this.deps.hooks?.deepMult ?? 2) : 1;
    const mutant = st.mutant && arm ? this.mutantDepleteMult(st.mutant) : 1;
    return (
      base *
      deep *
      veinLevelDepleteMult(st) *
      (arm ? arm.deplete : 1) *
      planetIndexDepleteMult(b, rt.data.planetIndex) *
      rt.data.perks.depletionMult *
      (this.deps.sleepFor?.(rt) ?? this.deps.hooks?.sleep ?? 1) *
      (this.deps.hooks?.techMods ?? 1) *
      mutant
    );
  }

  private mutantDepleteMult(mutantId: string): number {
    for (const m of Object.values(this.deps.balance.registry.planet.mutants)) if (m.id === mutantId) return m.depletionMult;
    return 1;
  }

  veinUnlocked(rt: PlanetRuntime, cellId: number): boolean {
    const node = rt.data.cells[cellId];
    if (!node) return false;
    if (node.type === 5) return this.deps.tech.isUnlocked('kriogen');
    if (node.type === 3) return this.deps.tech.isUnlocked(node.resourceKey ?? 'iron');
    return true;
  }

  /** Тик истощения всех активных жил (доменное состояние, не ledger). */
  tick(planets: readonly PlanetRuntime[], dtSec: number): void {
    const gameMs = this.deps.gameMs();
    for (const rt of planets) {
      for (const cellId of rt.explored) {
        const node = rt.data.cells[cellId];
        const st = rt.cellStates.get(cellId);
        if (!node || !st || st.destroyed) continue;
        if (node.type !== 3 && node.type !== 5) continue;
        if (st.reserve <= 0) continue;
        if (st.cooldownUntil > gameMs) continue;
        if (!this.veinUnlocked(rt, cellId)) continue;
        st.reserve -= this.depletePerSec(rt, cellId) * dtSec;
        if (st.reserve <= 0) {
          st.reserve = 0;
          // 1.x C1: cooldownUntil = now + $l(q) — по ТЕКУЩЕМУ reactCount, затем reactCount++
          st.cooldownUntil = gameMs + this.cooldownMs(st);
          st.reactCount = Math.max(0, st.reactCount) + 1;
          this.deps.bus.emit('cell:depleted', { pid: rt.data.id, cellId, cooldownUntil: st.cooldownUntil });
        }
      }
    }
  }

  /** 1.x $l(): 300000+150000×reactCount, кап registry (maxMs 1800000, cntCap 20). */
  cooldownMs(st: CellState): number {
    const c = this.deps.balance.registry.cells;
    const cnt = Math.min(c.reactCooldownCntCap, Math.max(0, st.reactCount));
    return Math.min(c.reactCooldownMaxMs, c.reactCooldownBaseMs + c.reactCooldownPerCntMs * cnt) * this.deps.tech.veinCooldownMult();
  }

  /** 1.x Xs(): min(14, 1+0.55×reactCount) — рост выхода/цены реактивации. */
  reactYieldMult(st: CellState): number {
    const r = this.deps.balance.registry.core.reactivate;
    return Math.min(r.max, 1 + r.step * Math.max(0, st.reactCount));
  }

  /** 1.x $n(): цена реактивации. */
  reactivationCost(rt: PlanetRuntime, cellId: number): number {
    const node = rt.data.cells[cellId];
    const st = rt.cellStates.get(cellId);
    if (!node || !st) return Number.POSITIVE_INFINITY;
    const b = this.deps.balance.baseline.veins;
    const s = 1 + Math.min(b.reactivationReserveScaleMax, Math.log10(Math.max(10, st.maxReserve)) * b.reactivationReserveScaleK);
    const raw = b.reactivationBaseEnergy * Math.pow(st.level + 1, b.reactivationLevelPow) * s * this.reactYieldMult(st) * rt.data.perks.upgradeCostMult;
    return Math.max(b.reactivationMinEnergy, Math.round(raw));
  }

  reactivate(rt: PlanetRuntime, cellId: number): ActionResult<ReactivateCellResult> {
    const node = rt.data.cells[cellId];
    const st = rt.cellStates.get(cellId);
    if (!node || !st) return fail('unknown-cell', `${rt.data.id}#${cellId}`);
    if (node.type !== 3 && node.type !== 5) return fail('type', `type ${node.type}`);
    if (!rt.explored.has(cellId)) return fail('state', 'not explored');
    const gameMs = this.deps.gameMs();
    if (st.cooldownUntil > gameMs) return fail('cooldown', `${st.cooldownUntil - gameMs}ms left`);
    if (!this.veinUnlocked(rt, cellId)) return fail('state', 'resource locked');
    const cost = this.reactivationCost(rt, cellId);
    const commit = this.deps.ledger.tryCommit({ reason: `reactivate:${rt.data.id}#${cellId}`, scope: 'global', delta: { energy: -cost }, gameMs });
    if (!commit.ok) return fail(commit.insufficient.includes('energy') ? 'energy' : 'cost', commit.insufficient.join(','));
    // 1.x: резерв восстанавливается полностью, cooldown сбрасывается (reactCount сохранён — растёт при истощении)
    st.reserve = st.maxReserve;
    st.cooldownUntil = 0;
    this.deps.bus.emit('cell:reactivated', { pid: rt.data.id, cellId, reactCount: st.reactCount, cost });
    return ok({ pid: rt.data.id, cellId, reactCount: st.reactCount, cost });
  }
}
