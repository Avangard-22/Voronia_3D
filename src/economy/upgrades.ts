/**
 * economy/upgrades.ts — CellUpgradeService: апгрейды клеток (1.x zn() @120467 — цена, Ni() — эффекты, x0() — научные).
 * GS-04 parity (fixtures/gs04_upgrade_curve.json): кривая g0=registry cells.upgradeCurve (20 записей),
 * продолжение yl(): ×curveGrowth(1.13)^n до cap(25), далее ×curveGrowthAfterCap(1.025); БЕЗ round в кривой,
 * round только в цене: energy=round(e×r), iron=round(a×r), r=perkUpgradeCostMult(1.2 «Мёрзлый»).
 * Trail: 0/96/336/840/1680⚡, 12/26/60/108/180⛏ (L0→1 … L4→5). MAX_LEVEL=100.
 * Эффекты (Ni/ml/Vr/b0/_0/hcApply): yield=1+L; maxReserve=round(base×reserveMult[L]); deep при L≥8;
 * levelRewards L≥10 (registry cells.levelRewards); hardcore-compounds c L16 (registry cells.hardcore).
 */
import type { ActionResult, UpgradeCellResult } from '../contracts/commands';
import { fail, ok } from '../contracts/commands';
import type { UpgradeAnomalyResult } from '../contracts/anomalies';
import type { CellUpgradeCost } from '../contracts/economy';
import type { LedgerResourceKey, ResourceAmounts } from '../contracts/resources';
import type { BalanceConfig, UpgradeCurveEntry } from '../config/types';
import type { EventPort, LedgerPort, TechPort } from '../contracts/ports';
import type { PlanetRuntime } from '../contracts/planets';
import type { CellNode, CellState } from '../contracts/cells';

export interface UpgradeDeps {
  readonly balance: BalanceConfig;
  readonly ledger: LedgerPort;
  readonly bus: EventPort;
  readonly tech: TechPort;
  readonly gameMs: () => number;
  /** Хуки поздних этапов (mt/seal/r0/To/Ig/q0 = 1 в срезе). */
  readonly costHooks?: { readonly techMods?: number; readonly seal?: number; readonly global?: number; readonly planetIndex?: number; readonly sleep?: number };
}

/** 1.x yl(): запись кривой с продолжением за последним уровнем (raw, без округления). */
export function curveEntry(balance: BalanceConfig, level: number, deep: boolean): UpgradeCurveEntry | null {
  const cells = balance.registry.cells;
  const curve = deep ? cells.deepUpgradeCurve : cells.upgradeCurve;
  const L = Math.max(0, level);
  const last = curve.length - 1;
  if (L <= last) return curve[L] ?? null;
  const s = curve[last];
  if (!s) return null;
  const cap = cells.curveGrowthCap;
  const after = cells.curveGrowthAfterCap;
  const growth = cells.curveGrowth;
  const n = L - last;
  const d = Math.log(cap) / Math.log(growth);
  const c = n <= d ? Math.pow(growth, n) : cap * Math.pow(after, n - d);
  return { e: s.e * c, a: s.a * c, b: s.b * c, g: s.g * c, x: s.x * c };
}

/** 1.x Vr(): профиль уровня — yieldMult/reserveMult (baseline cells.levelProfile, за L25 — vein*Growth^s). */
export function levelProfile(balance: BalanceConfig, level: number): { yieldMult: number; reserveMult: number } {
  const p = balance.baseline.cells.levelProfile;
  const t = Math.max(0, level);
  if (t < p.yieldMult.length) return { yieldMult: p.yieldMult[t] ?? 1, reserveMult: p.reserveMult[t] ?? 1 };
  const s = t - (p.yieldMult.length - 1);
  const yg = balance.registry.cells.veinYieldGrowth;
  const rg = balance.registry.cells.veinReserveGrowth;
  const yLast = p.yieldMult[p.yieldMult.length - 1] ?? 1;
  const rLast = p.reserveMult[p.reserveMult.length - 1] ?? 1;
  return { yieldMult: yLast * Math.pow(yg, s), reserveMult: rLast * Math.pow(rg, s) };
}

/** 1.x li(): цена апгрейда научной клетки (type6). */
export function researchCellCost(balance: BalanceConfig, level: number): ResourceAmounts {
  const g = balance.registry.cells.researchCellCost;
  const t = Math.max(0, level);
  const cost: ResourceAmounts = {
    energy: Math.round(Math.max(1, g.energyBase * Math.pow(g.energyGrowth, t))),
    crystals: Math.round(Math.max(1, g.crystalsBase * Math.pow(g.crystalsGrowth, t))),
    research: Math.round(Math.max(1, g.researchBase * Math.pow(g.researchGrowth, t))),
  };
  if (t >= g.siliconFromLevel) cost.silicon = Math.round(Math.max(1, g.siliconBase * Math.pow(g.siliconGrowth, t - g.siliconFromLevel)));
  return cost;
}

/** 1.x _0(): levelRewards c L10 (за пределами таблицы — ×1.18^min(40, L−last)). */
export function levelReward(balance: BalanceConfig, newLevel: number): { key: string; amount: number } | null {
  const table = balance.registry.cells.levelRewards;
  if (newLevel < 10) return null;
  const last = table.length - 1;
  const row = table[Math.min(last, newLevel)];
  if (!row) return null;
  let amount = row.amount;
  if (newLevel > last) amount = Math.ceil(amount * Math.pow(1.18, Math.min(40, newLevel - last)));
  return row.key && row.key !== 'iron' ? { key: row.key, amount } : null;
}

export class CellUpgradeService {
  constructor(private readonly deps: UpgradeDeps) {}

  maxLevel(): number {
    return this.deps.balance.baseline.upgrade.maxLevel;
  }

  /** Первичный/вторичный ресурс планеты (1.x ii/h0): ferrum → iron, вторичного нет. */
  primaryResource(rt: PlanetRuntime): LedgerResourceKey {
    return (rt.data.resourceList[0] ?? 'iron') as LedgerResourceKey;
  }

  secondaryResource(rt: PlanetRuntime): LedgerResourceKey | null {
    const list = rt.data.resourceList;
    const primary = list[0];
    const other = list.find((k) => k !== primary);
    if (other) return other as LedgerResourceKey;
    if (primary === 'iron' && list.includes('kriogen')) return 'kriogen';
    if (primary === 'kriogen' && list.includes('iron')) return 'iron';
    return null;
  }

  /** 1.x zn(): цена следующего уровня. null — если достигнут MAX_LEVEL. */
  costFor(rt: PlanetRuntime, cellId: number): CellUpgradeCost | null {
    const node = rt.data.cells[cellId];
    const st = rt.cellStates.get(cellId);
    if (!node || !st) return null;
    if (st.level >= this.maxLevel()) return null;
    if (node.type === 6) {
      const c = researchCellCost(this.deps.balance, st.level);
      return { energy: c.energy ?? 0, resources: c.silicon ? { silicon: c.silicon } : {}, global: { crystals: c.crystals ?? 0, research: c.research ?? 0 }, compounds: {} };
    }
    const w = curveEntry(this.deps.balance, st.level, st.isDeep);
    if (!w) return null;
    const hooks = this.deps.costHooks ?? {};
    const r = rt.data.perks.upgradeCostMult * (hooks.techMods ?? 1) * (hooks.seal ?? 1);
    const l = (hooks.planetIndex ?? 1) * (hooks.global ?? 1);
    const q0 = hooks.sleep ?? 1;
    const energy = Math.round(w.e * r * l * q0);
    const primary = this.primaryResource(rt);
    const resources: ResourceAmounts = {};
    if (w.a > 0) resources[primary] = Math.round(w.a * r * l);
    const sec = this.secondaryResource(rt);
    if (w.b > 0 && sec) resources[sec] = Math.round(w.b * r * l);
    const global: ResourceAmounts = {};
    // дополнительная цена research c L16 (registry cells.researchCost*)
    const rc = this.deps.balance.registry.cells;
    if (typeof rc.researchCostFromLevel === 'number' && st.level + 1 >= rc.researchCostFromLevel) {
      const rb = rc.researchCostBase ?? 250;
      const rg = rc.researchCostGrowth ?? 1.14;
      global.research = Math.max(1, Math.round(rb * Math.pow(rg, st.level + 1 - rc.researchCostFromLevel)));
    }
    const compounds = this.hardcoreCompounds(st.level);
    return { energy, resources, global, compounds };
  }

  /** 1.x hcApply(): hardcore-составные в цене c L16 (gated: только купленные рецепты). */
  private hardcoreCompounds(level: number): ResourceAmounts {
    const hc = this.deps.balance.registry.cells.hardcore;
    const out: ResourceAmounts = {};
    const L = level + 1;
    if (!hc || L < hc.fromLevel) return out;
    for (const [key, cfg] of Object.entries(hc.compounds)) {
      if (L < cfg.from) continue;
      if (cfg.research && !this.deps.tech.hasResearch(cfg.research)) continue;
      let v = cfg.base * Math.pow(cfg.growth, L - cfg.from);
      v = Math.max(1, Math.round(v));
      if (cfg.cap > 0) v = Math.min(cfg.cap, v);
      out[key as LedgerResourceKey] = v;
    }
    return out;
  }

  upgradeCell(rt: PlanetRuntime, cellId: number): ActionResult<UpgradeCellResult> {
    const node = rt.data.cells[cellId];
    const st = rt.cellStates.get(cellId);
    if (!node || !st) return fail('unknown-cell', `${rt.data.id}#${cellId}`);
    if (!rt.explored.has(cellId)) return fail('state', 'not explored');
    if (st.destroyed) return fail('state', 'destroyed');
    if (node.type === 6 && st.level >= this.deps.balance.registry.cells.researchMaxLevel) return fail('max', `research cap ${this.deps.balance.registry.cells.researchMaxLevel}`);
    if (st.level >= this.maxLevel()) return fail('max', `MAX_LEVEL ${this.maxLevel()}`);
    const cost = this.costFor(rt, cellId);
    if (!cost) return fail('state', 'no curve');

    // одна агрегированная транзакция: стоимости (−) и награды уровня (+) — ADR-013
    const delta: ResourceAmounts = {};
    const addNeg = (amounts: Readonly<ResourceAmounts>): void => {
      for (const [k, v] of Object.entries(amounts)) {
        const key = k as LedgerResourceKey;
        delta[key] = (delta[key] ?? 0) - (v ?? 0);
      }
    };
    addNeg({ energy: cost.energy });
    addNeg(cost.resources);
    addNeg(cost.global);
    addNeg(cost.compounds);

    const newLevel = st.level + 1;
    // 1.x Ni(): исследование за апгрейд = min(25, 1+floor(energyCost/2500)) — GS-04: +1🔬 ×5 шагов
    let researchGained = 0;
    if (node.type !== 6) {
      const b = this.deps.balance.baseline.upgrade;
      researchGained = Math.min(b.researchPerUpgradeMax, 1 + Math.floor(cost.energy / b.researchPerUpgradeDivisor));
      if (researchGained > 0) delta.research = (delta.research ?? 0) + researchGained;
    }
    const reward = levelReward(this.deps.balance, newLevel);
    if (reward) delta[reward.key as LedgerResourceKey] = (delta[reward.key as LedgerResourceKey] ?? 0) + reward.amount;

    const commit = this.deps.ledger.tryCommit({ reason: `upgrade:${rt.data.id}#${cellId}`, scope: 'global', delta, gameMs: this.deps.gameMs() });
    if (!commit.ok) return fail(commit.insufficient.includes('energy') && commit.insufficient.length === 1 ? 'energy' : 'cost', commit.insufficient.join(','));

    // эффекты (Ni/ml/b0 parity)
    st.level = newLevel;
    if (node.type === 0) st.yield = 1 + newLevel;
    this.applyLevelProfile(rt, node, st);
    const wasDeep = st.isDeep;
    let deepUnlocked = false;
    if (!wasDeep && newLevel >= this.deps.balance.registry.cells.deepLevelThreshold) {
      st.isDeep = true;
      deepUnlocked = true;
    }
    this.deps.bus.emit('cell:upgraded', { pid: rt.data.id, cellId, level: newLevel, type: node.type, deepUnlocked });

    const spent: ResourceAmounts = {};
    for (const [k, v] of Object.entries(delta)) if ((v ?? 0) < 0) spent[k as LedgerResourceKey] = -(v ?? 0);
    return ok({ pid: rt.data.id, cellId, level: newLevel, cost: spent, researchGained });
  }

  /** 1.x ml(): maxReserve/ironYield от профиля уровня; reserve доливается на прирост максимума. */
  applyLevelProfile(rt: PlanetRuntime, node: CellNode, st: CellState): void {
    const prof = levelProfile(this.deps.balance, st.level);
    if (node.type === 3 || node.type === 5) {
      const baseMax = node.reserve ?? 0;
      const oldMax = Math.max(0, st.maxReserve);
      st.maxReserve = Math.max(1, Math.round(baseMax * prof.reserveMult));
      const baseYield = node.type === 5 ? this.deps.balance.baseline.veins.baseIronYieldOnScan : this.deps.balance.baseline.veins.baseIronYieldOnScan;
      if (node.type === 3) st.ironYield = baseYield * prof.yieldMult;
      else st.kriogenYield = baseYield * prof.yieldMult;
      st.reserve = Math.min(st.maxReserve, st.reserve + Math.max(0, st.maxReserve - oldMax));
    } else if (node.type === 0) {
      // type0: базовый «резерв» 1 (fixtures GS-04: L1-2 → 1/1, L3+ → 2/2)
      const oldMax = st.maxReserve;
      st.maxReserve = Math.max(1, Math.round(1 * prof.reserveMult));
      st.reserve = Math.min(st.maxReserve, st.reserve + Math.max(0, st.maxReserve - oldMax));
    }
    void rt;
  }
}

/** 1.x nr() @76900: цена апгрейда аномалии {iron: round(50×3^L×To(idx)), energy: round(300×3^L×To(idx))}. */
export function anomalyUpgradeCost(balance: BalanceConfig, level: number, planetIndex: number): { iron: number; energy: number } {
  const a = balance.baseline.anomalyUpgrade;
  const to = planetIndex <= a.indexMultFrom ? 1 : Math.pow(a.indexMultGrowth, planetIndex - a.indexMultFrom);
  const L = Math.max(0, level);
  return {
    iron: Math.round(a.ironBase * Math.pow(a.growth, L) * to),
    energy: Math.round(a.energyBase * Math.pow(a.growth, L) * to),
  };
}

/**
 * AnomalyUpgradeService — 1.x tl() @77100 (Этап 4): апгрейд аномалии type4.
 * Цена (fixtures/stage4_audit §deep): energy = nr.energy (БЕЗ ×ucm), материал = round(nr.iron×ucm);
 * материал: biome ferrum → iron, иначе kriogen (фолбэк — другой, 1.x Wt(h)||Wt(m)).
 * На maxLevel (transport.config.maxLevel=5): deep-конверсия — round(4000×ucm)⚡ + round(500×ucm) материала,
 * isDeep=true (доход ×2, «ЯДРО ×2!» 1.x); повтор → отказ 'max'.
 */
export class AnomalyUpgradeService {
  constructor(private readonly deps: UpgradeDeps) {}

  upgrade(rt: PlanetRuntime, cellId: number): ActionResult<UpgradeAnomalyResult> {
    const node = rt.data.cells[cellId];
    const st = rt.cellStates.get(cellId);
    if (!node || !st) return fail('unknown-cell', `${rt.data.id}#${cellId}`);
    if (node.type !== 4) return fail('type', `type ${node.type}`);
    if (!rt.explored.has(cellId)) return fail('state', 'unexplored');
    const cfg = this.deps.balance.registry.transport.config;
    const ucm = rt.data.perks.upgradeCostMult;
    const h: LedgerResourceKey = rt.data.biome === 'ferrum' ? 'iron' : 'kriogen';
    const m: LedgerResourceKey = h === 'iron' ? 'kriogen' : 'iron';
    const now = this.deps.gameMs();
    const pid = rt.data.id;

    if (st.level >= cfg.maxLevel) {
      if (st.isDeep) return fail('max', 'anomaly limit reached');
      const eCost = Math.round(this.deps.balance.baseline.anomalyUpgrade.deepEnergy * ucm);
      const mCost = Math.round(this.deps.balance.baseline.anomalyUpgrade.deepMaterial * ucm);
      const reason = `anomaly:deep:${pid}#${cellId}`;
      let delta: ResourceAmounts = { energy: -eCost, [h]: -mCost };
      let commit = this.deps.ledger.tryCommit({ reason, scope: 'global', delta, gameMs: now });
      if (!commit.ok) {
        delta = { energy: -eCost, [m]: -mCost };
        commit = this.deps.ledger.tryCommit({ reason, scope: 'global', delta, gameMs: now });
        if (!commit.ok) return fail(commit.insufficient.includes('energy') ? 'energy' : 'cost', commit.insufficient.join(','));
      }
      st.isDeep = true;
      this.deps.bus.emit('cell:anomalyUpgraded', { pid, cellId, level: st.level, deepConverted: true });
      const spent: Record<string, number> = { energy: eCost };
      for (const [k, v] of Object.entries(delta)) if ((v ?? 0) < 0) spent[k] = -(v ?? 0);
      return ok({ pid, cellId, level: st.level, deepConverted: true, cost: spent });
    }

    const w = anomalyUpgradeCost(this.deps.balance, st.level, rt.data.planetIndex);
    const mCost = Math.round(w.iron * ucm);
    const reason = `anomaly:upgrade:${pid}#${cellId}`;
    let delta: ResourceAmounts = { energy: -w.energy, [h]: -mCost };
    let commit = this.deps.ledger.tryCommit({ reason, scope: 'global', delta, gameMs: now });
    if (!commit.ok) {
      delta = { energy: -w.energy, [m]: -mCost };
      commit = this.deps.ledger.tryCommit({ reason, scope: 'global', delta, gameMs: now });
      if (!commit.ok) return fail(commit.insufficient.includes('energy') ? 'energy' : 'cost', commit.insufficient.join(','));
    }
    const newLevel = st.level + 1;
    st.level = newLevel;
    this.deps.bus.emit('cell:anomalyUpgraded', { pid, cellId, level: newLevel, deepConverted: false });
    const spent: Record<string, number> = { energy: w.energy };
    for (const [k, v] of Object.entries(delta)) if ((v ?? 0) < 0) spent[k] = -(v ?? 0);
    return ok({ pid, cellId, level: newLevel, deepConverted: false, cost: spent });
  }
}
