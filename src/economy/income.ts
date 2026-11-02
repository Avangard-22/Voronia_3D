/**
 * economy/income.ts — IncomeService: расчёт дохода в секунду (1.x ce() @123246 + ng() @717304).
 * Parity-срез (fixtures/income_midgame_documented.json): ferrum, compound ×6 (steel 1000), warehouse L0:
 *   energy 42 = Σ(1+L) × 6; iron 0.69 = 0.1 × 1.15(«Каменистый») × 6; research 0.002 = 2×0.001.
 * Цепочки — именованные факторы (ADR-014); хуки поздних этапов (dust/meta/tech/role/echo/seal/event/charge)
 * входят множителем 1 и заменяются доменами на своих этапах.
 */
import type { IncomeSnapshot, MultiplierChain, PlanetIncome } from '../contracts/economy';
import type { LedgerResourceKey, ResourceAmounts } from '../contracts/resources';
import { compoundBonusMult, type CompoundResourceKey } from '../contracts/resources';
import type { BalanceConfig } from '../config/types';
import type { ArmModifiers } from '../contracts/economy';
import type { TechPort } from '../contracts/ports';
import type { PlanetRuntime } from '../contracts/planets';
import type { CellNode, CellState } from '../contracts/cells';

export interface IncomeContext {
  readonly compounds: Readonly<Partial<Record<CompoundResourceKey, number>>>;
  readonly warehouseLevel: number;
  readonly tech: TechPort;
  readonly armFor: (rt: PlanetRuntime) => ArmModifiers | null;
  readonly biomeMultFor: (rt: PlanetRuntime) => number;
  /** Глубокие клетки: 1.x Ws() = 2 (fixtures/veins_audit). */
  readonly deepMult: number;
  readonly gameMs: number;
  /** Хуки поздних этапов (по умолчанию 1). */
  readonly hooks?: Partial<Record<IncomeHook, number>>;
  /** Этап 4: хуки с per-планетным значением (charge/sleep-fm/chargeScience/roleMod...) — перекрывают hooks. */
  readonly planetHooksFor?: (rt: PlanetRuntime) => Partial<Record<IncomeHook, number>>;
  /** Этап 4 (1.x ao(pid,'spc_hidden')): скрытый спец-профиль планеты — все ветви аномалий дают доход (Этап 7; default false). */
  readonly spcHiddenFor?: (rt: PlanetRuntime) => boolean;
}

export type IncomeHook =
  | 'chargeEnergy' | 'chargeScience' | 'scanBonus' | 'sleep' | 'dust' | 'meta' | 'techMods' | 'roleMod' | 'echo' | 'seal' | 'eventEnergy' | 'eventIron' | 'exhaustedResearch'
  /** Этап 4 — литеры бандла за пределами fresh-parity (все =1; состав цепочек — TV-29): */
  | 'energyGlobal' | 'crystalChain' | 'crystalGlobalA' | 'crystalGlobalO' | 'crystalSeal' | 'crystalMult' | 'anomalyBonus'
  /** Этап 5 (1.x mt(pid,'coreEffectMult'), ce @125605): множитель «ядра грани» type7. */
  | 'coreEffect';

export interface IncomeDetail {
  readonly snapshot: IncomeSnapshot;
  readonly chains: readonly MultiplierChain[];
}

const h1 = (ctx: IncomeContext, key: IncomeHook): number => ctx.hooks?.[key] ?? 1;

/** 1.x Ur(): базовый энергетический выход клетки. */
export function energyYieldBase(node: CellNode, st: CellState, balance: BalanceConfig): number {
  switch (node.type) {
    case 0:
      return 1 + st.level;
    case 1:
      return 3;
    case 2:
      return 10;
    case 7:
      return balance.registry.core.baseYield; // Ao()=100 (registry core.baseYield)
    default:
      return 0;
  }
}

function chainTotal(factors: Record<string, number>): number {
  let t = 1;
  for (const k of Object.keys(factors)) t *= factors[k] ?? 1;
  return t;
}

export class IncomeService {
  constructor(private readonly balance: BalanceConfig) {}

  computeIncome(planets: readonly PlanetRuntime[], ctx: IncomeContext): IncomeDetail {
    const chains: MultiplierChain[] = [];
    const byPlanet: Record<string, PlanetIncome> = {};
    let energy = 0;
    let iron = 0;
    let kriogen = 0;
    let crystals = 0;
    let research = 0;
    const extra: Record<string, number> = {};

    const compound = compoundBonusMult(ctx.compounds);
    const warehouse = 1 + ctx.warehouseLevel * this.balance.registry.warehouse.bonusPerLevel;

    for (const rt of planets) {
      const arm = ctx.armFor(rt);
      const biome = ctx.biomeMultFor(rt);
      const perks = rt.data.perks;
      const pid = rt.data.id;
      const ph = ctx.planetHooksFor?.(rt);
      const hp = (key: IncomeHook): number => ph?.[key] ?? h1(ctx, key);
      const pIncome: { energy: number; iron: number; kriogen: number; crystals: number; extra: Record<string, number>; energyByType: Record<number, number> } = {
        energy: 0,
        iron: 0,
        kriogen: 0,
        crystals: 0,
        extra: {},
        energyByType: {},
      };

      let planetResearch = 0;
      for (const cellId of rt.explored) {
        const node = rt.data.cells[cellId];
        const st = rt.cellStates.get(cellId);
        if (!node || !st || st.destroyed) continue;

        // — научные клетки и type0-вклад в research (ng parity, ниже — планетный кап)
        if (node.type === 6) {
          const perLevel = this.balance.baseline.researchCell.yieldPerLevel;
          const cap = this.balance.registry.cells.researchMaxLevel;
          planetResearch += perLevel * Math.min(cap, st.level);
          continue;
        }
        if (node.type === 0) planetResearch += this.balance.baseline.cells.researchPerType0Cell;

        // — энергетические типы 0/1/2/7 (ce parity). type7 «ядро грани» (Этап 5, TV-24, ce @125605):
        //   энергия = core.baseYield(100) × Ws(2) ВСЕГДА (deep-флаг не важен — аудит §type7.deepInvariance)
        //   × общая энерго-цепь (c event ue) × oh(coreEffectMult); кристаллы — отдельная линия ниже.
        if (node.type === 0 || node.type === 1 || node.type === 2 || node.type === 7) {
          const base = energyYieldBase(node, st, this.balance);
          if (base <= 0) continue;
          const factors: Record<string, number> = {
            deep: node.type === 7 ? ctx.deepMult : this.isDeep(st) ? ctx.deepMult : 1,
            charge: hp('chargeEnergy'),
            scanBonus: hp('scanBonus'),
            sleep: hp('sleep'),
            biome,
            perkEnergy: perks.energyBonus,
            armEnergy: arm ? arm.energy : 1,
            compound,
            warehouse,
            dust: hp('dust'),
            meta: hp('meta'),
            tech: hp('techMods'),
            role: hp('roleMod'),
            echo: hp('echo'),
            seal: hp('seal'),
            event: hp('eventEnergy'),
            coreEffect: node.type === 7 ? hp('coreEffect') : 1,
          };
          const inc = base * chainTotal(factors);
          pIncome.energy += inc;
          pIncome.energyByType[node.type] = (pIncome.energyByType[node.type] ?? 0) + inc;
          // 1.x: type0 isDeep → +0.05💎/с × кристальная цепочка (_pOA/Qt/ut/hu — хуки, fresh=1; TV-29)
          if (node.type === 0 && st.isDeep) {
            pIncome.crystals += this.balance.baseline.anomalyIncome.type0DeepCrystal * hp('crystalChain') * hp('crystalGlobalO') * hp('crystalSeal') * hp('crystalMult');
          }
          // 1.x ce @125605 type7: crystals += Ys×b×V×_pOA×Qt×ut×hu×oh (fresh-аудит §type7: ровно 0.03)
          if (node.type === 7) {
            pIncome.crystals +=
              this.balance.registry.core.crystalRate *
              hp('crystalChain') * hp('crystalGlobalO') * hp('crystalMult') *
              hp('roleMod') * hp('techMods') * hp('coreEffect');
          }
          chains.push({ name: `energy:${pid}#${cellId}`, factors, total: chainTotal(factors) });
          continue;
        }

        // — жилы (type3/5): доход, пока резерв > 0, cooldown истёк и ресурс открыт (1.x gt/tb)
        if (node.type === 3 || node.type === 5) {
          if (!this.veinActive(rt, cellId, ctx)) continue;
          const isKriogen = node.type === 5;
          const base = isKriogen ? st.kriogenYield : st.ironYield;
          if (base <= 0) continue;
          const perk = isKriogen ? perks.kriogenBonus : perks.ironBonus;
          const armRes = arm ? (isKriogen ? arm.kriogen : arm.iron) : 1;
          const focus = arm?.focus[(isKriogen ? 'kriogen' : node.resourceKey) ?? 'iron'] ?? 1;
          const mutant = st.mutant && arm ? this.mutantYieldMult(arm.id, st.mutant) : 1;
          const factors: Record<string, number> = {
            deep: this.isDeep(st) ? ctx.deepMult : 1,
            perk,
            scanBonus: hp('scanBonus'),
            arm: armRes,
            focus,
            compound,
            warehouse,
            mutant,
            dust: hp('dust'),
            meta: hp('meta'),
            tech: hp('techMods'),
            seal: hp('seal'),
            event: hp('eventIron'),
          };
          const inc = base * chainTotal(factors);
          if (isKriogen) pIncome.kriogen += inc;
          else {
            const key: LedgerResourceKey = (node.resourceKey ?? 'iron') as LedgerResourceKey;
            if (key === 'iron') pIncome.iron += inc;
            else {
              pIncome.extra[key] = (pIncome.extra[key] ?? 0) + inc;
              extra[key] = (extra[key] ?? 0) + inc;
            }
          }
          chains.push({ name: `vein:${pid}#${cellId}`, factors, total: chainTotal(factors) });
          continue;
        }

        // — type4 аномалия (Этап 4; 1.x ce @129995): power → 4×(1+L)×dc ⚡/с, resonance → 0.005×(1+L)×dc 💎/с.
        //    synth пассивного дохода не даёт (синтезатор — economy/synth.ts). Отличие цепи power от обычной
        //    энергетической: БЕЗ event(ue), но × _pRA(Rg → хук energyGlobal) × rh(anomalyBonusMult).
        if (node.type === 4) {
          const branch = st.anomalyType ?? 'synth';
          const spc = ctx.spcHiddenFor?.(rt) ?? false;
          const ai = this.balance.baseline.anomalyIncome;
          const dc = st.isDeep ? ai.deepMult : 1;
          if (spc || branch === 'power') {
            const base = ai.powerBase * (1 + st.level) * dc;
            const factors: Record<string, number> = {
              charge: hp('chargeEnergy'),
              scanBonus: hp('scanBonus'),
              sleep: hp('sleep'),
              biome,
              perkEnergy: perks.energyBonus,
              armEnergy: arm ? arm.energy : 1,
              compound,
              warehouse,
              anomalyBonus: hp('anomalyBonus'),
              energyGlobal: hp('energyGlobal'),
              dust: hp('dust'),
              meta: hp('meta'),
              tech: hp('techMods'),
              role: hp('roleMod'),
              echo: hp('echo'),
              seal: hp('seal'),
            };
            const inc = base * chainTotal(factors);
            pIncome.energy += inc;
            pIncome.energyByType[4] = (pIncome.energyByType[4] ?? 0) + inc;
            chains.push({ name: `anomaly-power:${pid}#${cellId}`, factors, total: chainTotal(factors) });
          }
          if (spc || branch === 'resonance') {
            const base = ai.resonanceBase * (1 + st.level) * dc;
            const factors: Record<string, number> = {
              crystalChain: hp('crystalChain'),
              crystalGlobal: hp('crystalGlobalA'),
              anomalyBonus: hp('anomalyBonus'),
              crystalMult: hp('crystalMult'),
            };
            const inc = base * chainTotal(factors);
            pIncome.crystals += inc;
            chains.push({ name: `anomaly-resonance:${pid}#${cellId}`, factors, total: chainTotal(factors) });
          }
          continue;
        }
      }

      // планетный кап research: (batchEnergy + batchIron×planetIndex) — 1.x ng();
      // × буст заряда C (chargeScience) × roleMod × techMods × echoMods (fixtures/stage4_audit §s0: boost 1.2)
      const cap = this.balance.registry.dispatch.batchEnergy + this.balance.registry.dispatch.batchIron * rt.data.planetIndex;
      planetResearch = Math.min(planetResearch, cap) * hp('chargeScience') * hp('roleMod') * hp('techMods') * hp('echo');
      research += planetResearch;

      energy += pIncome.energy;
      iron += pIncome.iron;
      kriogen += pIncome.kriogen;
      crystals += pIncome.crystals;
      for (const [k, v] of Object.entries(pIncome.extra)) extra[k] = (extra[k] ?? 0) + v;
      byPlanet[pid] = pIncome;
    }

    // глобальный множитель research: 1.x Yu() (fresh = 1; prestige/dust/meta — Этапы 7/10/11); истощение ×0.15
    research *= h1(ctx, 'exhaustedResearch');

    const snapshot: IncomeSnapshot = { energyPerSec: energy, ironPerSec: iron, kriogenPerSec: kriogen, crystalsPerSec: crystals, researchPerSec: research, extraPerSec: extra, byPlanet };
    return { snapshot, chains };
  }

  /** 1.x gt()+reserve+cooldown: жила даёт доход. */
  veinActive(rt: PlanetRuntime, cellId: number, ctx: IncomeContext): boolean {
    const node = rt.data.cells[cellId];
    const st = rt.cellStates.get(cellId);
    if (!node || !st || st.destroyed) return false;
    if (st.reserve <= 0) return false;
    if (st.cooldownUntil > ctx.gameMs) return false;
    if (node.type === 5) return ctx.tech.isUnlocked('kriogen');
    return ctx.tech.isUnlocked(node.resourceKey ?? 'iron');
  }

  isDeep(st: CellState): boolean {
    return st.isDeep;
  }

  mutantYieldMult(armId: string, mutantId: string): number {
    const table = this.balance.registry.planet.mutants;
    for (const m of Object.values(table)) if (m.id === mutantId) return m.yieldMult;
    void armId;
    return 1;
  }

  /** Дельты тика (одна агрегированная транзакция — README Этап 2). */
  tickDelta(snap: IncomeSnapshot, dtSec: number): ResourceAmounts {
    const delta: ResourceAmounts = {};
    if (snap.energyPerSec > 0) delta.energy = snap.energyPerSec * dtSec;
    if (snap.ironPerSec > 0) delta.iron = snap.ironPerSec * dtSec;
    if (snap.kriogenPerSec > 0) delta.kriogen = snap.kriogenPerSec * dtSec;
    if (snap.crystalsPerSec > 0) delta.crystals = snap.crystalsPerSec * dtSec;
    if (snap.researchPerSec > 0) delta.research = snap.researchPerSec * dtSec;
    for (const [k, v] of Object.entries(snap.extraPerSec)) if (v > 0) delta[k as LedgerResourceKey] = v * dtSec;
    return delta;
  }
}
