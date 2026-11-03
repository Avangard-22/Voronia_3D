/** Runtime, hysteretic LOD policy for surface decoration. Base cell topology is never simplified. */
export type RuntimeSurfaceLod = 'near' | 'mid' | 'far';

export interface RuntimeSurfaceLodState {
  readonly tier: RuntimeSurfaceLod;
  readonly showCellBoundaries: boolean;
  readonly showNeighbourGraph: boolean;
  readonly markerDetail: 'high' | 'low';
  readonly shaderDetail: number;
  readonly animationScale: number;
}

export const RUNTIME_SURFACE_LOD: Readonly<Record<RuntimeSurfaceLod, RuntimeSurfaceLodState>> = {
  near: { tier: 'near', showCellBoundaries: true, showNeighbourGraph: true, markerDetail: 'high', shaderDetail: 1, animationScale: 1 },
  mid: { tier: 'mid', showCellBoundaries: true, showNeighbourGraph: false, markerDetail: 'low', shaderDetail: 0.55, animationScale: 0.65 },
  far: { tier: 'far', showCellBoundaries: false, showNeighbourGraph: false, markerDetail: 'low', shaderDetail: 0.18, animationScale: 0.25 },
};

/** Camera distance thresholds include a dead band to prevent rapid toggling while zooming. */
export class RuntimeSurfaceLodController {
  private current: RuntimeSurfaceLod = 'near';
  constructor(private readonly nearToMid = 3.55, private readonly midToFar = 4.65, private readonly hysteresis = 0.18) {}

  update(distance: number): RuntimeSurfaceLodState {
    if (!Number.isFinite(distance)) return RUNTIME_SURFACE_LOD[this.current];
    if (this.current === 'near') {
      if (distance > this.nearToMid + this.hysteresis) this.current = distance > this.midToFar + this.hysteresis ? 'far' : 'mid';
    } else if (this.current === 'mid') {
      if (distance < this.nearToMid - this.hysteresis) this.current = 'near';
      else if (distance > this.midToFar + this.hysteresis) this.current = 'far';
    } else if (distance < this.midToFar - this.hysteresis) {
      this.current = distance < this.nearToMid - this.hysteresis ? 'near' : 'mid';
    }
    return RUNTIME_SURFACE_LOD[this.current];
  }

  get tier(): RuntimeSurfaceLod { return this.current; }
}
