/**
 * economy/charge.ts — ChargeService: заряды жил type1/2 (Этап 4).
 * Порт 1.x (bundle v0.0.41, см. fixtures/stage4_audit_v0.0.41.json):
 *   i0() @120300 — ручной разряд: mult=min(neighborMax,1+neighbors×neighborBonus), pct+=basePct×mult (cap buffCap),
 *     dur=baseDur+neighbors×neighborDurBonusSec, science=round(cfg.science×mult) → ledger, sciencePct-стек (cap scienceCap),
 *     cooldown=cfg.cd, type2 → +1 сонар-заряд (cap sonar.chargeMax), событие 'cell:discharged' (имя шины 1.x);
 *   s0() @119794 — множитель энергии планеты: 1+pct, пока until>now;
 *   a0()/ll() @119900 — статус/очистка;
 *   surge v0.0.39.0 @122100 — авто-выброс: nextAt=rand(45..120s|90..240s), bonus=basePct×(0.65|1.15), dur 20|25с,
 *     БЕЗ науки/сонара, событие 'cell:surge' (1.x Math.random → инжект-детерминизм 2.0, ADR-016).
 * Отказ-причины 1.x 'destroyed'/'unexplored' → закрытый набор 2.0 'state' + detail (ТЗ §3.1).
 * Время — gameMs (GameClock); баффы не персистятся в save v2 (короткоживущие; расширение — Этап 6).
 */
import type { ActionResult } from '../contracts/commands';
import { fail, ok } from '../contracts/commands';
import type { ChargeBuffState, ChargeStatus, DischargeResult } from '../contracts/anomalies';
import type { BalanceConfig } from '../config/types';
import type { EventPort, LedgerPort, RngPort } from '../contracts/ports';
import type { PlanetRuntime } from '../contracts/planets';

export interface ChargeDeps {
  readonly balance: BalanceConfig;
  readonly ledger: LedgerPort;
  readonly bus: EventPort;
  readonly gameMs: () => number;
  /** 1.x Jf(1): +1 сонар-заряд (cap — Game); возвращает true, если начислен. */
  readonly addSonarCharge: () => boolean;
}

export class ChargeService {
  private buffs = new Map<string, ChargeBuffState>();

  constructor(private readonly deps: ChargeDeps) {}

  reset(): void {
    this.buffs.clear();
  }

  private buff(pid: string): ChargeBuffState {
    let b = this.buffs.get(pid);
    if (!b) {
      b = { pct: 0, until: 0, sciencePct: 0, scienceUntil: 0 };
      this.buffs.set(pid, b);
    }
    return b;
  }

  /** 1.x s0(pid): множитель энергии (IncomeService-хук chargeEnergy). */
  multFor(pid: string): number {
    const b = this.buffs.get(pid);
    const now = this.deps.gameMs();
    if (!b || !(b.until > now)) return 1;
    return 1 + (b.pct || 0);
  }

  /** 1.x C в ng(): буст науки зарядами (IncomeService-хук chargeScience). */
  scienceBoostFor(pid: string): number {
    const b = this.buffs.get(pid);
    const now = this.deps.gameMs();
    if (!b || !(b.scienceUntil > now)) return 1;
    return 1 + (b.sciencePct || 0);
  }

  /** 1.x a0(pid): статус для UI. */
  status(pid: string): ChargeStatus | null {
    const b = this.buffs.get(pid);
    if (!b) return null;
    const now = this.deps.gameMs();
    const active = b.until > now;
    const sciActive = b.scienceUntil > now;
    if (!active && !sciActive) return null;
    return {
      pct: active ? b.pct || 0 : 0,
      leftSec: active ? Math.ceil((b.until - now) / 1000) : 0,
      sciPct: sciActive ? b.sciencePct || 0 : 0,
      sciLeftSec: sciActive ? Math.ceil((b.scienceUntil - now) / 1000) : 0,
    };
  }

  /** 1.x ll(): удалить истёкшие баффы. */
  cleanup(): void {
    const now = this.deps.gameMs();
    for (const [pid, b] of this.buffs) {
      if (!(b.until > now) && !(b.scienceUntil > now)) this.buffs.delete(pid);
    }
  }

  buffsSnapshot(): ReadonlyMap<string, Readonly<ChargeBuffState>> {
    return this.buffs;
  }

  /** 1.x i0(cell, planet): ручной разряд. */
  discharge(rt: PlanetRuntime, cellId: number): ActionResult<DischargeResult> {
    const node = rt.data.cells[cellId];
    const st = rt.cellStates.get(cellId);
    if (!node || !st) return fail('unknown-cell', `${rt.data.id}#${cellId}`);
    if (node.type !== 1 && node.type !== 2) return fail('type', `type ${node.type}`);
    if (st.destroyed) return fail('state', 'destroyed');
    if (!rt.explored.has(cellId)) return fail('state', 'unexplored');
    const cfg = this.deps.balance.registry.charge;
    const c = cfg.config[String(node.type)];
    if (!c) return fail('state', `no charge config for type ${node.type}`);
    const now = this.deps.gameMs();
    if ((st.chargeCooldownUntil ?? 0) > now) {
      return fail('cooldown', `${Math.ceil(((st.chargeCooldownUntil ?? 0) - now) / 1000)}s left`);
    }
    // соседи: тот же тип, не разрушена, исследована, не на кулдауне (1.x: порядок условий значим только для счёта)
    let s = 0;
    for (const nb of node.neighbors) {
      const nbNode = rt.data.cells[nb];
      const nbSt = rt.cellStates.get(nb);
      if (!nbNode || !nbSt || nbNode.type !== node.type || nbSt.destroyed) continue;
      if (!rt.explored.has(nb)) continue;
      if ((nbSt.chargeCooldownUntil ?? 0) > now) continue;
      s++;
    }
    const mult = Math.min(cfg.neighborMax, 1 + s * cfg.neighborBonus);
    const pct = c.basePct * mult;
    const dur = c.baseDur + s * cfg.neighborDurBonusSec;
    const b = this.buff(rt.data.id);
    const active = b.until > now;
    b.pct = Math.min(cfg.buffCap, (active ? b.pct : 0) + pct);
    b.until = Math.max(active ? b.until : 0, now + dur * 1000);
    const atCap = b.pct >= cfg.buffCap - 1e-9;
    const science = Math.round((c.science || 0) * mult);
    if (science > 0) {
      this.deps.ledger.tryCommit({ reason: `discharge:${rt.data.id}#${cellId}`, scope: 'global', delta: { research: science }, gameMs: now });
    }
    const sciActive = b.scienceUntil > now;
    b.sciencePct = Math.min(cfg.scienceCap, (sciActive ? b.sciencePct : 0) + (c.sciencePct || 0) * mult);
    b.scienceUntil = Math.max(sciActive ? b.scienceUntil : 0, now + dur * 1000);
    this.deps.bus.emit('cell:discharged', { pid: rt.data.id, cellId, type: node.type, science, buffPct: c.sciencePct || 0 });
    st.chargedAt = now;
    st.chargedEver = true;
    st.chargeCooldownUntil = now + c.cd * 1000;
    const sonarChargeGained = node.type === 2 ? this.deps.addSonarCharge() : false;
    return ok({
      pid: rt.data.id,
      cellId,
      type: node.type,
      pct,
      pctTotal: b.pct,
      dur,
      mult,
      neighbors: s,
      atCap,
      science,
      sonarChargeGained,
      leftSec: c.cd,
    });
  }

  /**
   * 1.x v0.0.39.0 surge-планировщик (один шаг; 1.x — setInterval 2000 по реальной активности,
   * 2.0 — каждый тик игры: семантика порогов nextAt идентична). Только АКТИВНАЯ планета (1.x: n.activePlanetId).
   */
  surgeTick(rt: PlanetRuntime, rng: RngPort): void {
    const now = this.deps.gameMs();
    const s = this.deps.balance.baseline.surge;
    const cfg = this.deps.balance.registry.charge;
    let fired = false;
    for (const cellId of rt.explored) {
      const node = rt.data.cells[cellId];
      const st = rt.cellStates.get(cellId);
      if (!node || !st || (node.type !== 1 && node.type !== 2) || st.destroyed) continue;
      const min = node.type === 1 ? s.nextAtMinType1 : s.nextAtMinType2;
      const max = node.type === 1 ? s.nextAtMaxType1 : s.nextAtMaxType2;
      const randRange = (): number => min + rng.next() * (max - min);
      if (st.surgeNextAt === undefined) {
        st.surgeNextAt = now + randRange();
      }
      if (now < st.surgeNextAt) continue;
      st.surgeNextAt = now + randRange();
      const durMs = node.type === 1 ? s.durationMsType1 : s.durationMsType2;
      st.surgeUntil = now + durMs;
      st.chargedAt = now;
      st.chargedEver = true;
      st.chargeCooldownUntil = st.surgeUntil;
      const c = cfg.config[String(node.type)];
      const base = c && Number.isFinite(c.basePct) ? c.basePct : s.basePctFallback;
      const bonus = base * (node.type === 1 ? s.bonusMultType1 : s.bonusMultType2);
      const b = this.buff(rt.data.id);
      const active = b.until > now;
      b.pct = Math.min(cfg.buffCap || s.buffCapFallback, (active ? b.pct : 0) + bonus);
      b.until = Math.max(active ? b.until : 0, st.surgeUntil);
      this.deps.bus.emit('cell:surge', { pid: rt.data.id, cellId, type: node.type, duration: durMs / 1000, pct: bonus });
      fired = true;
    }
    void fired;
  }
}
