import { describe, expect, it } from 'vitest';
import { estimateSurfaceTransferBytes } from '../src/renderer/surfaceWorkerPipeline';

describe('Stage 8.0.14 surface worker memory budget', () => {
  it('accounts for every vertex attribute and face-cell mapping', () => {
    const bytes = estimateSurfaceTransferBytes({ triangles: 10, attributeComponentsPerVertex: 15 });
    expect(bytes).toBe(10 * (3 * 15 * 4 + 4));
  });
  it('reports zero for an empty partition', () => {
    expect(estimateSurfaceTransferBytes({ triangles: 0, attributeComponentsPerVertex: 15 })).toBe(0);
  });
});
