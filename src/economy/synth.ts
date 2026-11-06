/**
 * economy/synth.ts — SynthService: синтезатор аномалий ветви 'synth' (Этап 4).
 * Порт 1.x (fixtures/stage4_audit_v0.0.41.json §synth):
 *   el() @75193 — продукт: первый rare-ресурс focus рукава → Py[arm] → focus-фолбэки (iron→silicon, kriogen→titanium) → carbon;
 *   Iy() @75500 — вход: kriogen, если планета его имеет, иначе iron;
 *   ei() @75700 — (1+L)×(isDeep?transport.deepMult:1); Cy() @75800 — basePerSec×ei×Ly();
 *   Ly() @79700 — boost_synth ×1.5, boost_synth2 ×2;
 *   ti() @75900 — статус: out = ΣCy × (0.5+rare(product)) × Co(synthOut) × mt(synthOutMult)×mt(anomalyBonusMult);
 *     locked, если продукт (researchUnlock) или вход не открыт (Kt); spc_hidden-планеты учитывают ВСЕ ветви (хук, Этап 7);
 *   Ty() @76600 — тик: c=min(in×dt, запас входа); −c входа, +c/inputPerOutput продукта; origin.synthesized ($o @74650);
 *   Ay() — offline-вариант (offlineCapMult) — Этап 11.
 * 2.0-отклонение (ADR-016): запасы 1.x per-planet (Me/At) → единый ledger c scope-меткой planet:<pid>;
 * roleMult (Co) и mt-модификаторы — хуки (1 в срезе; роли — Этап 9).
 */
import type { SynthStatus } from '../contracts/anomalies';
import { SYNTH_PRODUCT_BY_ARM, branchOf } from '../contracts/anomalies';
import { RESOURCE_GEN, type LedgerResourceKey } from '../contracts/resources';
import type { BalanceConfig } from '../config/types';
import type { ArmModifiers } from '../contracts/economy';
import type { EventPort, LedgerPort, TechPort } from '../contracts/ports';
import type { PlanetRuntime } from '../contracts/planets';
import type { CellState } from '../contracts/cells';

export interface SynthDeps {
  readonly balance: BalanceConfig;
  readonly ledger: LedgerPort;
  readonly bus: EventPort;
  readonly tech: TechPort;
  readonly armFor: (rt: PlanetRuntime) => ArmModifiers | null;
  readonly gameMs: () => number;
  /** Хуки поздних этапов: spc_hidden (Этап 7), Co(synthOut)/mt (Этап 9) — по умолчанию false/1. */
  readonly hooks?: {
    readonly spcHiddenFor?: (rt: PlanetRuntime) => boolean;
    readonly roleMultFor?: (rt: PlanetRuntime) => number;
    readonly modsFor?: (rt: PlanetRuntime) => number;
  };
}

export type OriginKind = 'mined' | 'delivered' | 'synthesized';

export class SynthService {
  constructor(private readonly deps: SynthDeps) {}

  /** 1.x el(): продукт синтеза планеты. */
  productFor(rt: PlanetRuntime): string {
    const arm = this.deps.armFor(rt);
    const focus = arm ? Object.keys(arm.focus) : [];
    const rareFocus = focus.filter((k) => {
      const g = RESOURCE_GEN[k];
      return g !== undefined && g.rare > 0 && !g.hidden;
    });
    if (rareFocus.length > 0) return rareFocus[0] as string;
    const byArm = arm ? SYNTH_PRODUCT_BY_ARM[arm.id] : undefined;
    if (byArm !== undefined) {
      const g = RESOURCE_GEN[byArm];
      if (g !== undefined && !g.hidden) return byArm;
    }
    if (focus.includes('iron')) return 'silicon';
    if (focus.includes('kriogen')) return 'titanium';
    return 'carbon';
  }

  /** 1.x Iy(): входной ресурс. */
  inputFor(rt: PlanetRuntime): 'iron' | 'kriogen' {
    return rt.data.resourceList.includes('kriogen') ? 'kriogen' : 'iron';
  }

  /** 1.x Ly(): технологический множитель синтеза. */
  lyMult(): number {
    let m = 1;
    if (this.deps.tech.hasResearch('boost_synth')) m *= 1.5;
    if (this.deps.tech.hasResearch('boost_synth2')) m *= 2;
    return m;
  }

  /** 1.x ei(cell): множитель клетки синтеза. */
  cellMult(st: CellState): number {
    return (1 + st.level) * (st.isDeep ? this.deps.balance.registry.transport.config.deepMult : 1);
  }

  /** 1.x Cy(cell): выход клетки в секунду. */
  cellRate(st: CellState): number {
    return this.deps.balance.registry.transport.config.basePerSec * this.cellMult(st) * this.lyMult();
  }

  /** synth-клетки планеты (1.x Ds: spc_hidden → все ветви, иначе только 'synth'). */
  synthCells(rt: PlanetRuntime): number[] {
    const spc = this.deps.hooks?.spcHiddenFor?.(rt) ?? false;
    const out: number[] = [];
    for (const cellId of rt.explored) {
      const node = rt.data.cells[cellId];
      const st = rt.cellStates.get(cellId);
      if (!node || !st || node.type !== 4 || st.destroyed) continue;
      if (spc || branchOf(node, st) === 'synth') out.push(cellId);
    }
    return out;
  }

  /** 1.x ti(pid): статус синтезатора. */
  status(rt: PlanetRuntime): SynthStatus {
    const cells = this.synthCells(rt);
    if (cells.length === 0) return { out: 0, in: 0, product: null, input: null, anomalies: 0, locked: false };
    const product = this.productFor(rt);
    const input = this.inputFor(rt);
    if (!this.deps.tech.isUnlocked(product) || !this.deps.tech.isUnlocked(input)) {
      return { out: 0, in: 0, product, input, anomalies: cells.length, locked: true };
    }
    let l = 0;
    for (const cellId of cells) {
      const st = rt.cellStates.get(cellId);
      if (st) l += this.cellRate(st);
    }
    const rare = RESOURCE_GEN[product]?.rare ?? 0.2;
    l *= this.deps.balance.baseline.synth.rareOffset + rare;
    l *= this.deps.hooks?.roleMultFor?.(rt) ?? 1;
    l *= this.deps.hooks?.modsFor?.(rt) ?? 1;
    return { out: l, in: l * this.deps.balance.registry.transport.config.inputPerOutput, product, input, anomalies: cells.length, locked: false };
  }

  /** 1.x $o/tr: происхождение ресурсов планеты. */
  addOrigin(rt: PlanetRuntime, res: string, kind: OriginKind, amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const rec = (rt.origin[res] ??= { mined: 0, delivered: 0, synthesized: 0 });
    rec[kind] += amount;
  }

  originOf(rt: PlanetRuntime, res: string, kind: OriginKind): number {
    return rt.origin[res]?.[kind] ?? 0;
  }

  /** 1.x Ty(dt): live tick; Game передаёт только активную планету, чьи локальные запасы находятся в ledger. */
  tick(planets: readonly PlanetRuntime[], dtSec: number): boolean {
    return this.tickScaled(planets, dtSec, 1, 'synth');
  }

  /** 1.x Ay(): отдельный offline path. offlineCapMult масштабирует только синтезаторный интервал.
   * Вызов идемпотентен на уровне загрузки: Game сохраняет новое savedAt после recovery.
   */
  tickOffline(planets: readonly PlanetRuntime[], elapsedSec: number): boolean {
    if (!Number.isFinite(elapsedSec) || elapsedSec <= 0) return false;
    const capMult = Math.max(0, this.deps.balance.registry.transport.config.offlineCapMult);
    return this.tickScaled(planets, elapsedSec, capMult, 'synth:offline');
  }

  private tickScaled(planets: readonly PlanetRuntime[], dtSec: number, scale: number, reasonPrefix: string): boolean {
    if (!Number.isFinite(dtSec) || dtSec <= 0 || !Number.isFinite(scale) || scale <= 0) return false;
    const scaledDtSec = dtSec * scale;
    const cfg = this.deps.balance.registry.transport.config;
    let ran = false;
    for (const rt of planets) {
      const s = this.status(rt);
      if (s.out <= 0 || s.product === null || s.input === null) continue;
      const input = s.input as LedgerResourceKey;
      const product = s.product as LedgerResourceKey;
      const stock = this.deps.ledger.balance(input);
      if (stock <= 0) continue;
      const c = Math.min(s.in * scaledDtSec, stock);
      const produced = c / cfg.inputPerOutput;
      if (produced <= 0) continue;
      const commit = this.deps.ledger.tryCommit({
        reason: `${reasonPrefix}:${rt.data.id}`, 
        scope: `planet:${rt.data.id}`,
        delta: { [input]: -c, [product]: produced },
        gameMs: this.deps.gameMs(),
      });
      if (!commit.ok) continue;
      this.addOrigin(rt, s.product, 'synthesized', produced);
      this.deps.bus.emit('synth:produced', { pid: rt.data.id, product: s.product, amount: produced, inputConsumed: c });
      ran = true;
    }
    return ran;
  }
}
