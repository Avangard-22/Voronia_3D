import type { ResourceAmounts } from './resources';

export interface LogisticsSnapshot {
  readonly cargo: ResourceAmounts;
  readonly cargoMass: number;
  readonly cargoCapacity: number;
  readonly depot: ResourceAmounts;
  readonly depotMass: number;
  readonly depotCapacity: number;
  readonly specializedResources: readonly string[];
  readonly freightCostPerMassDistance: number;
}
export interface LogisticsState {
  readonly cargo: ResourceAmounts;
  readonly depots: Readonly<Record<string, ResourceAmounts>>;
}
