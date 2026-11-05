import { describe, expect, it } from 'vitest';
import { buildStarSystemCatalog } from '../src/galaxy/starSystems';
import { buildStarSystemTopology, canNavigateWithinSystem } from '../src/galaxy/systemTopology';

describe('Stage 7.4.2 system topology', () => {
  const catalog = buildStarSystemCatalog({ id: 'ferrum', name: 'Ferrum', seed: 12345, discovered: true });
  it('keeps all orbital bodies attached to their parent system', () => {
    expect(catalog).not.toBeNull();
    const topology = buildStarSystemTopology(catalog!, [], {});
    expect(topology.hostPlanetId).toBe('ferrum');
    expect(topology.star.temperatureK).toBeGreaterThan(0);
    expect(topology.bodies).toHaveLength(5);
    expect(topology.bodies[0]?.eccentricity).toBe(0);
    expect(Number.isFinite(topology.bodies[0]?.orbitalPhase)).toBe(true);
    expect(topology.bodies.every((body) => body.parentSystemId === catalog!.id)).toBe(true);
  });
  it('does not expose unscanned body classes or allow navigation to them', () => {
    const topology = buildStarSystemTopology(catalog!, [], {});
    const unknown = topology.bodies.find((body) => body.orbitIndex > 0)!;
    expect(unknown.bodyClass).toBe('unknown');
    expect(unknown.discovered).toBe(false);
    expect(topology.bodies.filter((body) => body.discovered)).toHaveLength(1);
    expect(topology.bodies.every((body) => Number.isFinite(body.ascendingNode))).toBe(true);
    expect(canNavigateWithinSystem(topology, 'not-a-planet')).toBe(false);
  });
  it('allows navigation only after the body is scanned and activated', () => {
    const candidate = catalog!.bodies.find((body) => body.orbitIndex > 0)!;
    const topology = buildStarSystemTopology(catalog!, [candidate.id], { [candidate.id]: 'planet-new-1' });
    expect(canNavigateWithinSystem(topology, 'planet-new-1')).toBe(true);
    expect(topology.bodies.find((body) => body.bodyId === candidate.id)?.planetId).toBe('planet-new-1');
  });
});
