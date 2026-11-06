/**
 * Этап 5 — type7 «ядро грани», discoverPlanet, setActivePlanet (fixtures/stage5_audit_v0.0.41.json).
 * Золотые: type7 energy = 100×Ws(2) ВСЕГДА (deep-инвариант) + 0.03💎/с; Ur(7)=100 (без _memberCount);
 * discover: seed 777001 → planet_03 «Гелика-Прайм» (frost, f3 octahedron, 22 клетки, награда 1100🔬,
 *   узел x53.0765/y0.232/z21.881, ребро → krios, БЕЗ автосмены активной); 888002 → planet_04 «Ван» (life, 2420);
 *   override geometry/frequency/biome → planet_05 (cube f2 ferrum, iron, 5324);
 * setActive: guard «существует И открыта» (krios locked → false), free V1 switch + On/yy per-planet storage.
 */
import { describe, it, expect } from 'vitest';
import { makeGame, fixture, grant } from './helpers';
import type { CellNode } from '../src/contracts/cells';

interface Stage5Audit {
  config: { baseYield: number; crystalRate: number; Ws: number; hiddenId: string; hiddenWorldIndex: number; ur7: number; ur7_member: number };
  type7: { before: { energyPerSec: number; crystalsPerSec: number }; type7: { energyPerSec: number; crystalsPerSec: number }; deltaEnergy: number; deltaCrystals: number; deepInvariance: boolean };
  discover: {
    before: { Fr: number; unlockedPlanets: string[]; planetsUnlocked: number };
    first: { id: string; planetIndex: number; name: string; biome: string; f: number; geometry: string; seed: number; armId: string; cellCount: number; resourceList: string[]; explored: number[]; startingCellId: number };
    afterFirst: { researchDelta: number; unlockedPlanets: string[]; planetsUnlocked: number; activePlanetId: string; node: { x: number; y: number; z: number; armId: string; discovered: boolean }; edges: [string, string][] };
    second: { id: string; planetIndex: number; name: string; biome: string; armId: string; seed: number };
    secondRewardDelta: number;
    override: { id: string; geometry: string; f: number; biome: string; armId: string; resourceList: string[] };
    overrideRewardDelta: number;
    rewardByIdx: Record<string, number>;
  };
  setActive: { switchToDiscovered: boolean; switchToLockedKrios: boolean; switchToUnknown: boolean; switchBack: boolean; after: { selectedCellId: null; rotX: number; rotY: number } };
  hidden: { id: string; worldIndex: number; seedFormula: string; f: number; geometry: string; biome: string; armId: string };
}
const fx = fixture<Stage5Audit>('stage5_audit_v0.0.41.json');

describe('type7 «ядро грани» (аудит §type7, TV-24)', () => {
  it('константы: baseYield 100, crystalRate .03, Ws 2; Ur(7)=100 независимо от _memberCount', () => {
    const { game } = makeGame(31337);
    expect(game.balance.registry.core.baseYield).toBe(fx.config.baseYield);
    expect(game.balance.registry.core.crystalRate).toBe(fx.config.crystalRate);
    expect(fx.config.ur7).toBe(fx.config.ur7_member); // 100 — memberCount не применяется
  });

  it('мутация s0 → type7: энергия 1 → 200 (100×Ws), кристаллы 0 → 0.03; isDeep НЕ влияет', () => {
    const { game } = makeGame(31337);
    const rt = game.runtime('ferrum')!;
    const inc = () => game.income.computeIncome(game.activeRuntimes(), game.incomeContext()).snapshot;
    const before = inc();
    expect(before.energyPerSec).toBeCloseTo(fx.type7.before.energyPerSec, 9);
    const node = rt.data.cells[0] as CellNode as { type: number; isDeep?: boolean };
    node.type = 7;
    const as7 = inc();
    expect(as7.energyPerSec).toBeCloseTo(fx.type7.type7.energyPerSec, 9);
    expect(as7.crystalsPerSec).toBeCloseTo(fx.type7.type7.crystalsPerSec, 12);
    expect(as7.energyPerSec - before.energyPerSec).toBeCloseTo(fx.type7.deltaEnergy, 9);
    expect(as7.crystalsPerSec - before.crystalsPerSec).toBeCloseTo(fx.type7.deltaCrystals, 12);
    // deep-инвариантность: 1.x умножает Ao×s безусловно (s=Ws, не от isDeep клетки)
    const st = rt.cellStates.get(0)!;
    st.isDeep = true;
    const as7deep = inc();
    expect(as7deep.energyPerSec).toBe(as7.energyPerSec);
    expect(as7deep.crystalsPerSec).toBe(as7.crystalsPerSec);
    expect(fx.type7.deepInvariance).toBe(true);
    node.type = 0;
    st.isDeep = false;
    expect(inc().energyPerSec).toBeCloseTo(before.energyPerSec, 9);
  });

  it('зарядный бафф усиливает и type7 (общая энерго-цепь c charge)', () => {
    const { game } = makeGame(31337);
    const rt = game.runtime('ferrum')!;
    (rt.data.cells[0] as CellNode as { type: number }).type = 7;
    const t1 = rt.data.cells.find((c) => c.type === 1)!;
    rt.explored.add(t1.id);
    game.dispatch('dischargeCell', { pid: 'ferrum', cellId: t1.id });
    const s = game.income.computeIncome(game.activeRuntimes(), game.incomeContext()).snapshot;
    expect(s.energyPerSec).toBeCloseTo(203 * 1.03, 9); // (200 + 3 type1) × 1.03
  });
});

describe('discoverPlanet (аудит §discover)', () => {
  it('seed 777001 → planet_03 «Гелика-Прайм»: frost, f3 octahedron, 22 клетки, 1100🔬, узел/ребро, без автосwitch', () => {
    const { game } = makeGame(31337);
    const r = game.dispatch('discoverPlanet', { seed: 777001, name: 'Гелика-Прайм' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const f = fx.discover.first;
    expect(r.value).toMatchObject({ id: f.id, index: f.planetIndex, name: f.name, biome: f.biome, armId: f.armId, researchReward: fx.discover.afterFirst.researchDelta });
    expect(r.value.node.x).toBeCloseTo(fx.discover.afterFirst.node.x, 9);
    expect(r.value.node.y).toBeCloseTo(fx.discover.afterFirst.node.y, 9);
    expect(r.value.node.z).toBeCloseTo(fx.discover.afterFirst.node.z, 9);
    // награда через ledger (1.x — прямое n.research+=; ADR-017)
    expect(game.ledger.balance('research')).toBeCloseTo(fx.discover.afterFirst.researchDelta, 9);
    // мир/рантайм/граф
    const wp = game.worldPlanet('planet_03')!;
    expect(wp).toBeDefined();
    expect(wp.cells.length).toBe(f.cellCount);
    expect(wp.f).toBe(f.f);
    expect(wp.geometry).toBe(f.geometry);
    expect([...wp.resourceList]).toEqual(f.resourceList);
    const rt = game.runtime('planet_03')!;
    expect([...rt.explored]).toEqual(f.explored);
    expect(wp.startingCellId).toBe(f.startingCellId);
    const snap = game.snapshot();
    expect([...snap.unlockedPlanets]).toEqual(fx.discover.afterFirst.unlockedPlanets);
    expect(snap.activePlanetId).toBe(fx.discover.afterFirst.activePlanetId); // ferrum — автосмены нет
    expect(snap.session.planetsUnlocked).toBe(fx.discover.afterFirst.planetsUnlocked);
    const node3 = snap.galaxy.nodes.find((nd) => nd.id === 'planet_03')!;
    expect(node3.discovered).toBe(true);
    expect(node3.armId).toBe(fx.discover.afterFirst.node.armId);
    expect(snap.galaxy.edges.map((e) => [...e])).toEqual(fx.discover.afterFirst.edges.map((e) => [...e]));
    const ev = game.bus.getHistory().filter((e) => e.type === 'planet:discovered');
    expect(ev.length).toBe(1);
  });

  it('seed 888002 → planet_04 c авто-именем «Ван» (life), 2420🔬; override cube/f2/biome ferrum → planet_05, 5324🔬', () => {
    const { game } = makeGame(31337);
    game.dispatch('discoverPlanet', { seed: 777001, name: 'Гелика-Прайм' });
    const r2 = game.dispatch('discoverPlanet', { seed: 888002 });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.value).toMatchObject({ id: fx.discover.second.id, index: fx.discover.second.planetIndex, name: fx.discover.second.name, biome: fx.discover.second.biome, armId: fx.discover.second.armId, researchReward: fx.discover.secondRewardDelta });
    const r3 = game.dispatch('discoverPlanet', { seed: 999003, geometry: 'cube', frequency: 2, biome: 'ferrum' });
    expect(r3.ok).toBe(true);
    if (!r3.ok) return;
    expect(r3.value.id).toBe(fx.discover.override.id);
    expect(r3.value.researchReward).toBe(fx.discover.overrideRewardDelta);
    const wp5 = game.worldPlanet('planet_05')!;
    expect(wp5.geometry).toBe(fx.discover.override.geometry);
    expect(wp5.f).toBe(fx.discover.override.f);
    expect(wp5.biome).toBe(fx.discover.override.biome); // biome ferrum → arm-ресурсы не переназначаются
    expect([...wp5.resourceList]).toEqual(fx.discover.override.resourceList);
    expect(wp5.armId).toBe(fx.discover.override.armId);
    expect(fx.discover.rewardByIdx['idx3']).toBe(1100);
    expect(fx.discover.rewardByIdx['idx5']).toBe(5324);
    expect(fx.discover.rewardByIdx['idx6']).toBe(11712);
  });

  it('детерминизм: одинаковый seed → идентичный мир (id/узел/клетки)', () => {
    const a = makeGame(31337).game;
    const b = makeGame(31337).game;
    const ra = a.dispatch('discoverPlanet', { seed: 424242 });
    const rb = b.dispatch('discoverPlanet', { seed: 424242 });
    expect(ra.ok && rb.ok).toBe(true);
    if (!ra.ok || !rb.ok) return;
    expect(ra.value).toEqual(rb.value);
    const wa = a.worldPlanet(ra.value.id)!;
    const wb = b.worldPlanet(rb.value.id)!;
    expect(wa.cells.length).toBe(wb.cells.length);
    expect(wa.armId).toBe(wb.armId);
    expect(wa.name).toBe(wb.name);
  });

  it('save-roundtrip: спеки реплеятся детерминированно (мир/граф/рантаймы)', () => {
    const { game } = makeGame(31337);
    const r = game.dispatch('discoverPlanet', { seed: 777001, name: 'Гелика-Прайм' });
    expect(r.ok).toBe(true);
    const save = game.collectState();
    expect(save.discoveredSpecs?.length).toBe(1);
    game.applyState(save);
    const snap = game.snapshot();
    expect([...snap.unlockedPlanets]).toContain('planet_03');
    expect(game.runtime('planet_03')).toBeDefined();
    const node3 = snap.galaxy.nodes.find((nd) => nd.id === 'planet_03')!;
    expect(node3.x).toBeCloseTo(fx.discover.afterFirst.node.x, 9);
    expect(node3.armId).toBe('frost');
    expect(snap.galaxy.edges.map((e) => [...e])).toEqual(fx.discover.afterFirst.edges.map((e) => [...e]));
    // повторный applyState того же сейва — стабилен (без дублей спеков)
    game.applyState(game.collectState());
    expect(game.collectState().discoveredSpecs?.length).toBe(1);
  });

  it('скрытый мир (аудит §hidden): константы registry — id/index/формула seed', () => {
    const { game } = makeGame(31337);
    expect(game.balance.registry.planet.hiddenWorldIndex).toBe(fx.hidden.worldIndex);
    expect(fx.hidden.id).toBe('planet_hidden');
    expect(fx.hidden.f).toBe(6);
    expect(fx.hidden.armId).toBe('void');
    expect(fx.hidden.seedFormula).toBe('(gameStartSeed ^ 1212761156) >>> 0');
  });
});

describe('setActivePlanet (V1 parity: audit §setActive)', () => {
  it('free switch: открытая планета → ok; krios locked/unknown → reject; обратно → ok', () => {
    const { game } = makeGame(31337);
    game.dispatch('discoverPlanet', { seed: 777001, name: 'Гелика-Прайм' });
    grant(game, { energy: 1_000_000, iron: 1234, kriogen: 77 });
    const energyBefore = game.ledger.balance('energy');
    const r1 = game.dispatch('setActivePlanet', { pid: 'planet_03' });
    expect(r1.ok).toBe(true);
    expect(game.ledger.balance('energy')).toBe(energyBefore);
    expect(game.ledger.balance('iron')).toBe(0);
    expect(game.ledger.balance('kriogen')).toBe(0);
    expect(game.activePlanetId()).toBe('planet_03');
    const r2 = game.dispatch('setActivePlanet', { pid: 'krios' });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toBe('state');
    expect(game.dispatch('setActivePlanet', { pid: 'nope' }).ok).toBe(false);
    expect(game.dispatch('setActivePlanet', { pid: 'ferrum' }).ok).toBe(true);
    expect(game.ledger.balance('iron')).toBe(1234);
    expect(game.ledger.balance('kriogen')).toBe(77);
    expect(game.bus.getHistory().filter((e) => e.type === 'planet:activated').length).toBe(2);
  });

  it('активная планета в снапшоте остаётся выбранной, а склад принадлежит ей', () => {
    const { game } = makeGame(31337);
    game.dispatch('discoverPlanet', { seed: 777001, name: 'Гелика-Прайм' });
    grant(game, { iron: 1234 });
    expect(game.dispatch('setActivePlanet', { pid: 'planet_03' }).ok).toBe(true);
    const snap = game.snapshot();
    const view = snap.planets.find((p) => p.id === snap.activePlanetId);
    expect(view?.id).toBe('planet_03');
    expect(view?.cells.length).toBe(fx.discover.first.cellCount);
    expect(view?.exploredCount).toBe(1);
    expect(view?.storage.iron).toBe(0);
    expect(snap.charge).toBeNull();
  });
});
