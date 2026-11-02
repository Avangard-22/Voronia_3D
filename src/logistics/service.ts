/** Stage 6.7 — межпланетная логистика: грузовой трюм и локальные планетарные депо. */
import type { ActionResult } from '../contracts/commands';
import { fail, ok } from '../contracts/commands';
import { cargoWeight, LEDGER_RESOURCES, RESOURCE_META, type LedgerResourceKey, type ResourceAmounts } from '../contracts/resources';
import type { LedgerPort } from '../contracts/ports';
import type { LogisticsSnapshot, LogisticsState } from '../contracts/logistics';
export type { LogisticsSnapshot, LogisticsState } from '../contracts/logistics';

export type CargoResource = LedgerResourceKey;
export interface LogisticsPlanetContext {
  readonly exploredCells: number;
  readonly tonsPerCell: number;
  readonly specializedResources: readonly string[];
}
export const LOGISTICS_POLICY = Object.freeze({ baseCargoCapacity: 100, cargoPerWarehouseLevel: 50, depotSpecializationFactor: 0.75, freightCostPerMassDistance: 0.5 });
const TRANSPORTABLE = LEDGER_RESOURCES.filter((key) => Number.isFinite(cargoWeight(key)));
const RESOURCE_SET = new Set<string>(TRANSPORTABLE);

function cleanAmount(value: number): number {
  return Math.floor(value * 1000) / 1000;
}
function massOf(amounts: ResourceAmounts, specialization: readonly string[] = []): number {
  return Object.entries(amounts).reduce((mass, [key, value]) => {
    const weight = cargoWeight(key as LedgerResourceKey);
    if (!Number.isFinite(weight)) return mass;
    const factor = specialization.includes(key) ? LOGISTICS_POLICY.depotSpecializationFactor : 1;
    return mass + Math.max(0, value ?? 0) * weight * factor;
  }, 0);
}

export class LogisticsService {
  private cargoValue: ResourceAmounts = {};
  private depotsValue: Record<string, ResourceAmounts> = {};

  constructor(private readonly ledger: LedgerPort, private readonly gameMs: () => number, private readonly warehouseLevel: () => number) {}

  cargoCapacity(): number {
    return LOGISTICS_POLICY.baseCargoCapacity + this.warehouseLevel() * LOGISTICS_POLICY.cargoPerWarehouseLevel;
  }
  cargoMass(): number { return massOf(this.cargoValue); }
  cargo(): ResourceAmounts { return { ...this.cargoValue }; }
  depot(planetId: string): ResourceAmounts { return { ...(this.depotsValue[planetId] ?? {}) }; }
  depotMass(planetId: string, specialization: readonly string[] = []): number { return massOf(this.depot(planetId), specialization); }
  depotCapacity(context: LogisticsPlanetContext): number { return Math.max(0, context.exploredCells * context.tonsPerCell); }

  load(resource: string, requested: number): ActionResult<{ resource: CargoResource; amount: number; cargoMass: number }> {
    if (!RESOURCE_SET.has(resource)) return fail('type', `Ресурс ${resource} нельзя перевозить`);
    const key = resource as CargoResource;
    const amount = cleanAmount(requested);
    if (!Number.isFinite(requested) || amount <= 0) return fail('cost', 'Количество груза должно быть больше нуля');
    if (this.ledger.balance(key) < amount) return fail('cost', `Недостаточно ресурса ${RESOURCE_META[key].name}`);
    const nextMass = this.cargoMass() + amount * cargoWeight(key);
    if (nextMass > this.cargoCapacity() + 1e-9) return fail('max', `Грузовой трюм заполнен: ${nextMass.toFixed(2)}/${this.cargoCapacity()} т`);
    const tx = this.ledger.tryCommit({ reason: `logistics:load:${key}`, scope: 'global', delta: { [key]: -amount }, gameMs: this.gameMs() });
    if (!tx.ok) return fail('cost', `Недостаточно ресурса ${key}`);
    this.cargoValue = { ...this.cargoValue, [key]: (this.cargoValue[key] ?? 0) + amount };
    return ok({ resource: key, amount, cargoMass: this.cargoMass() });
  }

  unload(planetId: string, resource: string, requested: number, context: LogisticsPlanetContext): ActionResult<{ planetId: string; resource: CargoResource; amount: number; depotMass: number }> {
    if (!RESOURCE_SET.has(resource)) return fail('type', `Ресурс ${resource} нельзя выгрузить`);
    const key = resource as CargoResource;
    const available = this.cargoValue[key] ?? 0;
    const amount = cleanAmount(requested);
    if (!Number.isFinite(requested) || amount <= 0 || amount > available + 1e-9) return fail('cost', `В трюме доступно ${available} ${key}`);
    const current = this.depot(planetId);
    const next = { ...current, [key]: (current[key] ?? 0) + amount };
    const nextMass = massOf(next, context.specializedResources);
    const capacity = this.depotCapacity(context);
    if (nextMass > capacity + 1e-9) return fail('max', `Депо заполнено: ${nextMass.toFixed(2)}/${capacity.toFixed(2)} т`);
    this.cargoValue = { ...this.cargoValue, [key]: cleanAmount(available - amount) };
    this.depotsValue[planetId] = next;
    return ok({ planetId, resource: key, amount, depotMass: nextMass });
  }

  withdraw(planetId: string, resource: string, requested: number): ActionResult<{ planetId: string; resource: CargoResource; amount: number }> {
    if (!RESOURCE_SET.has(resource)) return fail('type', `Ресурс ${resource} нельзя забрать`);
    const key = resource as CargoResource;
    const current = this.depot(planetId);
    const available = current[key] ?? 0;
    const amount = cleanAmount(requested);
    if (!Number.isFinite(requested) || amount <= 0 || amount > available + 1e-9) return fail('cost', `В депо доступно ${available} ${key}`);
    const tx = this.ledger.tryCommit({ reason: `logistics:withdraw:${planetId}:${key}`, scope: 'global', delta: { [key]: amount }, gameMs: this.gameMs() });
    if (!tx.ok) return fail('state', 'Не удалось вернуть ресурс в общий запас');
    this.depotsValue[planetId] = { ...current, [key]: cleanAmount(available - amount) };
    return ok({ planetId, resource: key, amount });
  }

  snapshot(planetId: string, context: LogisticsPlanetContext): LogisticsSnapshot {
    const depot = this.depot(planetId);
    return {
      cargo: this.cargo(), cargoMass: this.cargoMass(), cargoCapacity: this.cargoCapacity(),
      depot, depotMass: massOf(depot, context.specializedResources), depotCapacity: this.depotCapacity(context),
      specializedResources: [...context.specializedResources], freightCostPerMassDistance: LOGISTICS_POLICY.freightCostPerMassDistance,
    };
  }

  serialize(): LogisticsState {
    return { cargo: { ...this.cargoValue }, depots: Object.fromEntries(Object.entries(this.depotsValue).map(([pid, depot]) => [pid, { ...depot }])) };
  }
  hydrate(state?: Partial<LogisticsState>): void {
    const sanitize = (input: ResourceAmounts | undefined): ResourceAmounts => {
      const out: ResourceAmounts = {};
      for (const key of TRANSPORTABLE) {
        const value = input?.[key];
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) out[key] = cleanAmount(value);
      }
      return out;
    };
    this.cargoValue = sanitize(state?.cargo);
    this.depotsValue = {};
    for (const [pid, amounts] of Object.entries(state?.depots ?? {})) if (pid) this.depotsValue[pid] = sanitize(amounts);
    // Сейв может быть создан на старом уровне склада: избыточный груз не теряем, но не разрешаем его наращивать.
  }
  reset(): void { this.cargoValue = {}; this.depotsValue = {}; }
}
