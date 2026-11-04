/**
 * progression/scanPricing.ts — цена скана (1.x ln() @132442 + рост TV-3).
 * charge = floor(currentCost × perkScanMult × armScan); ferrum/core: ×1.0 ×0.9 → 9/9/10 (GS-03).
 * Рост ПОСЛЕ скана: currentCost = min(1e30, max(cur+1, floor(cur×growth))) — floor НА ШАГЕ (TV-3).
 * growth = clamp(techCostScaleMult, 1.03, 1.3) — live 1.15 = costScaleCurve[0] (fixtures/resources_research).
 */
import type { BalanceConfig } from '../config/types';
import type { PlanetRuntime } from '../contracts/planets';
import type { ArmModifiers } from '../contracts/economy';
import type { ScanPricingPort, TechPort } from '../contracts/ports';

export class ScanPricing implements ScanPricingPort {
  private currentCost: number;

  constructor(
    private readonly balance: BalanceConfig,
    private readonly tech: TechPort,
    private readonly armFor: (rt: PlanetRuntime) => ArmModifiers | null,
    startCost?: number,
  ) {
    this.currentCost = startCost ?? balance.baseline.scan.baseCost;
  }

  /** 1.x LvScanGrowth(): clamp(Gk(), 1.03, 1.3). */
  growth(): number {
    const b = this.balance.baseline.scan;
    return Math.max(b.growthMin, Math.min(b.growthMax, this.tech.costScaleMult()));
  }

  /** 1.x ln(): floor(currentCost × perk × arm.scan × [hooks]); free-сканы после престижа — Этап 11 (hook). */
  chargeFor(rt: PlanetRuntime): number {
    const perk = rt.data.perks.scanCostMult;
    const arm = this.armFor(rt);
    const armScan = arm ? arm.scan : 1;
    // Этап 9.3: recon снижает цену скана (пол задан RESEARCH_POLICY).
    return Math.floor(this.currentCost * perk * armScan * this.tech.scanCostMult());
  }

  /** Наука за скан (неаномальные): min(10, 1+floor(charge/1000)). */
  scienceFor(charge: number): number {
    const b = this.balance.baseline.scan;
    return Math.min(b.scienceMax, 1 + Math.floor(charge / b.scienceFromChargeDivisor));
  }

  /** TV-3: шаг ПОСЛЕ успешного скана. */
  advanceCurrentCost(): number {
    const b = this.balance.baseline.scan;
    const next = Math.max(this.currentCost + b.costStepFloorIncrement, Math.floor(this.currentCost * this.growth()));
    this.currentCost = Math.min(b.costCap, next);
    return this.currentCost;
  }

  getCurrentCost(): number {
    return this.currentCost;
  }

  setCurrentCost(v: number): void {
    this.currentCost = Math.max(1, Math.floor(v));
  }
}
