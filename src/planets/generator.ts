/**
 * planets/generator.ts — процедурный генератор планет (Этап 3; порт 1:1 класса `or` и функций
 * Jc/Zc/Jo/wy/Nf/Rf/Qc/Lf/Bf/Of/VorResRoll/VorCrystalEnsure/ni/Dy из бандла v0.0.41, ADR-015).
 *
 * КРИТИЧНО: порядок потребления RNG и арифметика скопированы дословно — любое отклонение ломает
 * байт-паритет с fixtures/planetgen_samples.json. Seed-соли (XOR-константы) — из бандла.
 * Рендер-функции Js/jr (цвета клеток, звёздный фон) в порт не входят — они не меняют данные планеты.
 * Уникальные формы (xf/kf/uy) портированы полностью; настройка uniqueForms по умолчанию true (как в 1.x).
 */
import { mulberry32 } from '../contracts/rng';
import type { ArmModifiers } from '../contracts/economy';
import type { BalanceConfig } from '../config/types';
import { RESOURCE_GEN, RESOURCE_GEN_ORDER } from '../contracts/resources';
import type {
  GeneratedCell,
  GeneratedDescriptors,
  GeneratedPerks,
  GeneratedPlanet,
  PlanetEventType,
  PlanetPalette,
  PlanetSpec,
  Vec3,
} from '../contracts/planets';
import {
  DESCRIPTOR_TABLES,
  EVENT_TYPES_BASE,
  GEOMETRY_TABLES,
  LORE_CONCEPTS,
  LORE_EVENTS,
  LORE_TEMPLATES,
  NAME_SYLLABLES,
  UNIQUE_PLANET_NAMES,
  mixedParamsFor,
  type GeometryTableEntry,
  type PlanetEventBase,
} from './tables';

// ---------------------------------------------------------------------------
// Векторные хелперы (1.x Tr/Qo/Ef/Pf, bundle @54949)
// ---------------------------------------------------------------------------

/** 1.x Tr — нормализация вектора. */
export function normalize(v: readonly number[]): Vec3 {
  const t = Math.hypot(v[0]!, v[1]!, v[2]!);
  return [v[0]! / t, v[1]! / t, v[2]! / t];
}

/** 1.x Qo — скалярное произведение. */
export function dot(a: readonly number[], b: readonly number[]): number {
  return a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
}

/** 1.x Ef — векторное произведение. */
export function cross(a: readonly number[], b: readonly number[]): Vec3 {
  return [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
}

/** 1.x Pf — сумма векторов. */
export function add3(a: readonly number[], b: readonly number[]): Vec3 {
  return [a[0]! + b[0]!, a[1]! + b[1]!, a[2]! + b[2]!];
}

// ---------------------------------------------------------------------------
// Контекст генератора
// ---------------------------------------------------------------------------

export interface VeinProfile {
  readonly yieldMult: number;
  readonly reserveMult: number;
}

export interface GeneratorCtx {
  readonly balance: BalanceConfig;
  /** Таблица рукавов (baseline galaxy.arms: core/inter/forge/frost/life/void — 1.x Po). */
  readonly arms: Readonly<Record<string, ArmModifiers>>;
  /** 1.x n.settings.uniqueForms (по умолчанию true); false отключает деформацию уникальных миров. */
  readonly uniqueForms?: boolean;
  /** 1.x Vr (economy.levelProfile) — для ni(); в потоке генерации уровни всегда 0. */
  readonly veinProfile?: (level: number) => VeinProfile;
}

function veinProfileOf(ctx: GeneratorCtx): (level: number) => VeinProfile {
  return ctx.veinProfile ?? ((_level: number) => ({ yieldMult: 1, reserveMult: 1 }));
}

/** 1.x: Nn + IIFE-оверрайд BAL.planet.geometryTuning (weight/minFrequency/maxFrequency). */
function geomEntry(geometry: string, ctx?: GeneratorCtx): GeometryTableEntry {
  const base = GEOMETRY_TABLES[geometry] ?? GEOMETRY_TABLES['icosahedron']!;
  const t = ctx?.balance.registry.planet.geometryTuning?.[geometry];
  if (!t) return base;
  return {
    ...base,
    weight: t.weight ?? base.weight,
    minFrequency: t.minFrequency ?? base.minFrequency,
    maxFrequency: t.maxFrequency ?? base.maxFrequency,
  };
}

function armById(ctx: GeneratorCtx, armId: string | null): ArmModifiers | null {
  if (!armId) return null;
  return ctx.arms[armId] ?? ctx.arms['inter'] ?? null;
}

// ---------------------------------------------------------------------------
// Выбор геометрии/частоты/уникальности (1.x Jc/Zc/Jo/wy/Nf)
// ---------------------------------------------------------------------------

/** 1.x Jc: idx<=2 → icosahedron; иначе weighted-ролл по Object.entries(Nn) (порядок вставки!). */
export function pickGeometry(seed: number, idx: number, ctx: GeneratorCtx): string {
  if (idx <= 2) return 'icosahedron';
  const o = mulberry32((seed >>> 0) ^ Math.imul(idx, 2654435769));
  const r = Object.keys(GEOMETRY_TABLES);
  let s = o() * r.reduce((c, k) => c + geomEntry(k, ctx).weight, 0);
  for (const k of r) {
    s -= geomEntry(k, ctx).weight;
    if (s < 0) return k;
  }
  return 'icosahedron';
}

/** 1.x Zc: idx1 → 1, idx2 → 3; иначе minF+floor(rng×(maxF−minF+1)); unique → min(maxF+1, f+1). */
export function pickFrequency(geometry: string, seed: number, idx: number, ctx: GeneratorCtx): number {
  const r = geomEntry(geometry, ctx);
  if (idx === 1) return 1;
  if (idx === 2) return 3;
  const s = mulberry32((seed >>> 0) ^ Math.imul(idx + 17, 2246822507));
  let c = r.minFrequency + Math.floor(s() * (r.maxFrequency - r.minFrequency + 1));
  if (isUniquePlanet(seed, idx, ctx)) c = Math.min(r.maxFrequency + 1, c + 1);
  return c;
}

/** 1.x Jo: idx<=2 → false; иначе qe(seed^1431193937)() < uniqueChance. */
export function isUniquePlanet(seed: number, idx: number, ctx: GeneratorCtx): boolean {
  if (!idx || idx <= 2) return false;
  return mulberry32((seed >>> 0) ^ 1431193937)() < ctx.balance.registry.planet.uniqueChance;
}

/** 1.x wy: тир по tierThresholds [2,8,15]. */
export function planetTier(idx: number, ctx: GeneratorCtx): number {
  const t = ctx.balance.registry.planet.tierThresholds;
  if (!idx || idx <= (t[0] ?? 2)) return 1;
  if (idx < (t[1] ?? 8)) return 2;
  if (idx < (t[2] ?? 15)) return 3;
  return 4;
}

/** 1.x Nf: тир + 2 за уникальность. */
export function planetTierFinal(seed: number, idx: number, ctx: GeneratorCtx): number {
  let o = planetTier(idx, ctx);
  if (isUniquePlanet(seed, idx, ctx)) o += 2;
  return o;
}

// ---------------------------------------------------------------------------
// Имя / дескрипторы / палитра / лор / события (1.x Rf/Qc/Lf/Bf/Of + y2)
// ---------------------------------------------------------------------------

/** 1.x Rf: уникальные — 25% шанс имени из Af; иначе 1–2 слога из $f + опциональный суффикс -N. */
export function genName(seed: number, isUnique: boolean): string {
  if (isUnique) {
    const u = mulberry32((seed >>> 0) ^ 1448038990);
    if (u() < 0.25) return UNIQUE_PLANET_NAMES[Math.floor(u() * UNIQUE_PLANET_NAMES.length)]!;
  }
  const o = mulberry32((seed >>> 0) ^ 1312902469);
  const r = Object.keys(NAME_SYLLABLES);
  const s = NAME_SYLLABLES[r[Math.floor(o() * r.length)]!]!;
  const c = 1 + Math.floor(o() * 2);
  let l = '';
  for (let u = 0; u < c; u++) {
    l += s.start[Math.floor(o() * s.start.length)]!;
    l += s.mid[Math.floor(o() * s.mid.length)]!;
    l += s.end[Math.floor(o() * s.end.length)]!;
  }
  l = l.charAt(0).toUpperCase() + l.slice(1).toLowerCase();
  if (o() < 0.55) l += '-' + (1 + Math.floor(o() * 9));
  return l;
}

/** 1.x Qc: climate всегда; surface — crystal только idx>=3; anomaly — шанс-ролл idx>=3. Один RNG-поток. */
export function genDescriptors(seed: number, idx: number): GeneratedDescriptors {
  const o = mulberry32((seed >>> 0) ^ 1413564243);
  const climate = DESCRIPTOR_TABLES.climate[Math.floor(o() * DESCRIPTOR_TABLES.climate.length)]!;
  // v0.0.21 План 33 баг №2 (вариант C): crystal-поверхность только там, где возможна редкая руда (idx>=3)
  const surfacePool = idx < 3 ? DESCRIPTOR_TABLES.surface.filter((v) => v.id !== 'crystal') : DESCRIPTOR_TABLES.surface;
  const surface = surfacePool[Math.floor(o() * (idx < 3 ? DESCRIPTOR_TABLES.surface.length - 1 : DESCRIPTOR_TABLES.surface.length))]!;
  let anomaly = DESCRIPTOR_TABLES.anomaly[0]!;
  if (idx >= 3) {
    const h = o();
    let m = 0;
    for (const g of DESCRIPTOR_TABLES.anomaly) {
      if (g.chance) {
        m += g.chance;
        if (h < m) {
          anomaly = g;
          break;
        }
      }
    }
  }
  const l: Record<string, number> = {};
  const u = (h: Readonly<Record<string, number>>): void => {
    for (const m in h) l[m] = (l[m] || 1) * h[m]!;
  };
  u(climate.effects);
  u(surface.effects);
  u(anomaly.effects);
  const f: (string | null)[] = [climate.name, surface.name];
  if (anomaly.name) f.push('(' + anomaly.name + ')');
  return { climate, surface, anomaly, effects: l, displayName: f.filter(Boolean).join(' ') };
}

/** 1.x Lf: ferrum/krios — фиксированные палитры; иначе HSL из 4 роллов одного потока. */
export function genPalette(seed: number, biome: string): PlanetPalette {
  const o = mulberry32((seed >>> 0) ^ 1346456645);
  if (biome === 'ferrum') {
    return {
      bg1: '#1a0d08',
      bg2: '#050308',
      explored: { 0: '#8a6448', 1: '#2d8a52', 2: '#8a2a86', 3: '#b8501a', 4: '#eaf6ff', 5: '#2a9cca' },
      unexplored: { 0: '#28576d', 1: '#368f4d', 2: '#8f3388', 3: '#6b7278', 5: '#2a7a9c' },
      border: '#c0a080',
    };
  }
  if (biome === 'krios') {
    return {
      bg1: '#08172a',
      bg2: '#03080d',
      explored: { 0: '#2a5a82', 1: '#2d8a52', 2: '#8a2a86', 3: '#a85428', 4: '#eaf6ff', 5: '#2a9cca' },
      unexplored: { 0: '#28576d', 1: '#368f4d', 2: '#8f3388', 3: '#6b7278', 5: '#2a7a9c' },
      border: '#80b8d8',
    };
  }
  const r = o() * 360;
  const s = (r + 120 + o() * 120) % 360;
  const c = 0.4 + o() * 0.5;
  const l = 0.25 + o() * 0.25;
  const u = (f: number, h: number, m: number): string => `hsl(${Math.round(f)}, ${Math.round(h * 100)}%, ${Math.round(m * 100)}%)`;
  return {
    bg1: u(r, c * 0.6, 0.07),
    bg2: u(r, c * 0.8, 0.02),
    explored: {
      0: u(r, c, l),
      1: u(r + 30, Math.min(1, c + 0.2), l + 0.1),
      2: u(s, Math.min(1, c + 0.3), l),
      3: u((r + 320) % 360, c, l + 0.05),
      4: '#eaf6ff',
      5: u(s, c, l + 0.15),
    },
    unexplored: {
      0: u(r, c * 0.5, l * 0.6),
      1: u(r + 30, c * 0.6, l * 0.7),
      2: u(s, c * 0.6, l * 0.6),
      3: u((r + 320) % 360, c * 0.5, l * 0.6),
      5: u(s, c * 0.5, l * 0.7),
    },
    border: u(r, 0.6, 0.6),
  };
}

/** 1.x Bf: шаблон + концепт + событие + число, replace в порядке {concept} → {event} → {number}. */
export function genLore(seed: number): string {
  const t = mulberry32((seed >>> 0) ^ 1280266821);
  const o = LORE_TEMPLATES[Math.floor(t() * LORE_TEMPLATES.length)]!;
  const r = LORE_CONCEPTS[Math.floor(t() * LORE_CONCEPTS.length)]!;
  const s = LORE_EVENTS[Math.floor(t() * LORE_EVENTS.length)]!;
  const c = 100 + Math.floor(t() * 9900);
  return o.replace('{concept}', r).replace('{event}', s).replace('{number}', String(c));
}

/** 1.x Of + y2(): 3 события без возврата (splice-ролл) + оверлей polarity/weight из реестра. */
export function genEvents(seed: number, ctx: GeneratorCtx): PlanetEventType[] {
  const t = mulberry32((seed >>> 0) ^ 1163284052);
  const o: PlanetEventBase[] = [...EVENT_TYPES_BASE];
  const r: PlanetEventBase[] = [];
  while (r.length < 3 && o.length) {
    const s = Math.floor(t() * o.length);
    r.push(o.splice(s, 1)[0]!);
  }
  const pw = ctx.balance.registry.events.polarityWeights;
  return r.map((e) => ({ ...e, ...(pw[e.id] ?? { polarity: 'positive', weight: 0.8 }) }));
}

// ---------------------------------------------------------------------------
// Пул ресурсов (1.x VorResRoll / VorCrystalEnsure)
// ---------------------------------------------------------------------------

export interface ResourceRollResult {
  readonly list: string[];
  readonly unique: boolean;
  readonly barren: boolean;
}

/** 1.x VorResRoll: iron/kriogen + редкие (rare>0, minPlanetIndex<=idx, пеня по глубине, focus рукава ×1.8). */
export function rollResources(seed: number, idx: number, armId: string | null, ctx: GeneratorCtx): ResourceRollResult {
  const rd = ctx.balance.registry.planet.resourceDist;
  const nv = (v: number | undefined, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const rnd = mulberry32((seed >>> 0) ^ 725188);
  const arm = armById(ctx, armId);
  const focus: Readonly<Record<string, number>> = arm?.focus ?? {};
  const isUniq = isUniquePlanet(seed, idx, ctx);
  let pool: { k: string; w: number }[] = [];
  pool.push({ k: 'iron', w: nv(rd?.ironWeight, 1) });
  pool.push({ k: 'kriogen', w: nv(rd?.kriogenWeight, 0.7) });
  for (const K of RESOURCE_GEN_ORDER) {
    const E = RESOURCE_GEN[K]!;
    if (E.hidden || E.legacy || !(E.rare > 0) || !E.minPlanetIndex) continue;
    if (idx < E.minPlanetIndex) continue;
    const d = Math.max(0, idx - E.minPlanetIndex);
    const pen = 1 + Math.log10(1 + d / nv(rd?.depthScale, 4)) * nv(rd?.depthPenalty, 0.5);
    const fb = focus[K] ? nv(rd?.focusBonus, 1.8) : 1;
    pool.push({ k: K, w: (E.rare * fb) / pen });
  }
  pool = pool.filter((x) => x.w > 0);
  const tbl: readonly (readonly [number, number])[] = rd?.slots ?? [[5, 1], [9, 2], [14, 3], [999, 4]];
  let slots = 1;
  for (let i = 0; i < tbl.length; i++) {
    if (idx <= tbl[i]![0]) {
      slots = tbl[i]![1];
      break;
    }
  }
  const extraPct = Math.min(nv(rd?.extraSlotMax, 0.25), nv(rd?.extraSlotPct, 0.1) + Math.max(0, idx - 3) * nv(rd?.extraSlotDepthPct, 0.01));
  if (rnd() < extraPct) slots++;
  const fill = nv(rd?.slotFillPct, 0.6);
  const target = slots;
  slots = 1;
  for (let K = 1; K < target; K++) if (rnd() < fill) slots++;
  if (isUniq) slots += nv(rd?.uniqueBonus, 1);
  slots = Math.max(0, Math.min(nv(rd?.maxSlots, 5), slots));
  const barren = !isUniq && idx >= nv(rd?.barrenMinIndex, 5) && rnd() < nv(rd?.barrenChance, 0.1);
  if (barren || !pool.length) return { list: [], unique: isUniq, barren };
  const picked: string[] = [];
  const tmp = pool.slice();
  while (picked.length < slots && tmp.length) {
    let tot = 0;
    for (let i = 0; i < tmp.length; i++) tot += tmp[i]!.w;
    if (!(tot > 0)) break;
    const roll = rnd() * tot;
    let acc = 0;
    let idxPick = tmp.length - 1;
    for (let i = 0; i < tmp.length; i++) {
      acc += tmp[i]!.w;
      if (roll <= acc) {
        idxPick = i;
        break;
      }
    }
    picked.push(tmp[idxPick]!.k);
    tmp.splice(idxPick, 1);
  }
  return { list: picked, unique: isUniq, barren: false };
}

/** 1.x VorCrystalEnsure: crystal-поверхность гарантирует редкую руду (v0.0.21 План 33 баг №2 вариант A). */
export function crystalEnsure(list: string[], descriptors: GeneratedDescriptors | null, seed: number, idx: number): string[] {
  if (!list || !list.length || !descriptors || descriptors.surface.id !== 'crystal') return list;
  for (const s of list) {
    const c = RESOURCE_GEN[s];
    if (c && c.rare > 0) return list;
  }
  const l: string[] = [];
  for (const s of RESOURCE_GEN_ORDER) {
    const c = RESOURCE_GEN[s]!;
    if (!c.hidden && !c.legacy && c.rare > 0 && c.minPlanetIndex && c.minPlanetIndex <= idx) l.push(s);
  }
  if (!l.length) return list;
  const u = mulberry32((seed >>> 0) ^ 3735928559)();
  const f = l[Math.min(l.length - 1, Math.floor(u * l.length))]!;
  return list.length < 5 ? list.concat([f]) : (() => {
    const copy = list.slice();
    copy[copy.length - 1] = f;
    return copy;
  })();
}

// ---------------------------------------------------------------------------
// Perks (1.x _biomePerks)
// ---------------------------------------------------------------------------

export function computeBiomePerks(biome: string, descriptors: GeneratedDescriptors): GeneratedPerks {
  let t: GeneratedPerks;
  if (biome === 'krios') {
    t = { depletionMult: 0.5, scanCostMult: 0.5, upgradeCostMult: 2, badge: '❄ ВЕЧНАЯ МЕРЗЛОТА', desc: 'Истощение ×0.5 · Скан ×0.5 · Апгрейд клеток ×2', energyBonus: 1, ironBonus: 1, kriogenBonus: 1, meteorRate: 1, rareChance: 1, anomalyChance: 1 };
  } else {
    t = { depletionMult: 1, scanCostMult: 1, upgradeCostMult: 1, badge: '🔥 СТАНДАРТ', desc: 'Без модификаторов', energyBonus: 1, ironBonus: 1, kriogenBonus: 1, meteorRate: 1, rareChance: 1, anomalyChance: 1 };
  }
  const o = descriptors.effects || {};
  if (o['depletionMult']) t.depletionMult *= o['depletionMult'];
  if (o['scanCostMult']) t.scanCostMult *= o['scanCostMult'];
  if (o['upgradeCostMult']) t.upgradeCostMult *= o['upgradeCostMult'];
  t.energyBonus = o['energyBonus'] || 1;
  t.ironBonus = o['ironBonus'] || 1;
  t.kriogenBonus = o['kriogenBonus'] || 1;
  t.meteorRate = o['meteorRate'] || 1;
  t.rareChance = o['rareChance'] || 1;
  t.anomalyChance = o['anomalyChance'] || 1;
  t.badge = descriptors.displayName.toUpperCase();
  t.desc = 'Процедурный мир · ' + descriptors.climate.name + ' / ' + descriptors.surface.name;
  return t;
}

// ---------------------------------------------------------------------------
// Уникальные формы (1.x xf/uy/kf, bundle @25532; settings.uniqueForms по умолчанию true)
// ---------------------------------------------------------------------------

export type UniqueForm = 'ring' | 'split' | 'twin' | 'noise';

/** 1.x xf — выбор формы уникального мира по seed. */
export function uniqueForm(seed: number): UniqueForm {
  const t = mulberry32((seed ^ 57072) >>> 0)();
  return t < 0.33 ? 'ring' : t < 0.5 ? 'split' : t < 0.66 ? 'twin' : 'noise';
}

/** 1.x uy — детерминированный хеш вершины (1e4-округление компонентов) → [0,1). */
export function vertexHash(v: readonly number[], seed: number): number {
  let o = seed >>> 0;
  const r = [Math.round(v[0]! * 1e4), Math.round(v[1]! * 1e4), Math.round(v[2]! * 1e4)];
  for (const s of r) {
    o ^= s + 2654435769;
    o = Math.imul(o ^ (o >>> 15), 2246822507);
    o ^= o >>> 13;
  }
  return ((o >>> 0) % 1000) / 1000;
}

/**
 * 1.x kf — деформация вершины. ring/split меняют направление; twin/noise — равномерный масштаб,
 * который гасится последующей нормализацией Tr (так в 1.x — воспроизводим дословно).
 */
export function deformVertex(v: readonly number[], seed: number, form: UniqueForm): Vec3 {
  if (form === 'ring') return [v[0]! * 0.85, v[1]! * 0.7, v[2]! * 0.85];
  if (form === 'split') {
    const s = v[1]! > 0 ? 1 : -1;
    return [v[0]! * 0.9, v[1]! * 0.95 + s * 0.04, v[2]! * 0.9];
  }
  if (form === 'twin') return [v[0]! * 0.7, v[1]! * 0.7, v[2]! * 0.7];
  const r = 0.92 + vertexHash(v, seed) * 0.12;
  return [v[0]! * r, v[1]! * r, v[2]! * r];
}

// ---------------------------------------------------------------------------
// Сборка планеты (1.x конструктор or + _build/_geometry/_neighbors/_findStart/_biomes/_sortPoly/_validate)
// ---------------------------------------------------------------------------

const STORAGE_KEYS = ['energy', 'iron', 'kriogen', 'crystals', 'carbon', 'silicon', 'titanium', 'uranium', 'helium3', 'biomass', 'platinum', 'darkMatter'] as const;

export function buildPlanet(spec: PlanetSpec, ctx: GeneratorCtx): GeneratedPlanet {
  const lv = ctx.balance.registry.planet.lastVoronia;
  const seed = spec.seed >>> 0;
  const isUnique = isUniquePlanet(seed, spec.planetIndex, ctx);
  const descriptors = genDescriptors(seed, spec.planetIndex);
  const planet: GeneratedPlanet = {
    armId: spec.armId ?? null,
    role: null,
    id: spec.id,
    seed,
    f: spec.f,
    biome: spec.biome,
    geometry: spec.geometry,
    geometryName: geomEntry(spec.geometry, ctx).name,
    planetIndex: spec.planetIndex,
    isUnique,
    name: spec.name ?? (lv && spec.planetIndex === lv.index ? 'Последняя Ворония' : genName(seed, isUnique)),
    descriptors,
    palette: genPalette(seed, spec.biome),
    lore: genLore(seed),
    availableEvents: genEvents(seed, ctx),
    perks: computeBiomePerks(spec.biome, descriptors),
    storage: Object.fromEntries(STORAGE_KEYS.map((k) => [k, 0])),
    origin: {},
    scanBonus: null,
    resourceList: [],
    verts: [],
    faces: [],
    cells: [],
    revealed: new Set<number>(),
    explored: new Set<number>(),
    startingCellId: -1,
    _visited: spec.id === 'ferrum',
    _mixed: false,
  };
  buildPlanetBody(planet, ctx);
  return planet;
}

/** 1.x _build: до 5 попыток; провал _validate → seed++ и повтор (name/descriptors НЕ пересчитываются). */
export function buildPlanetBody(planet: GeneratedPlanet, ctx: GeneratorCtx): void {
  let t = 0;
  const o = 5;
  while (t < o) {
    planet.verts = [];
    planet.faces = [];
    planet.cells = [];
    planet.revealed = new Set<number>();
    planet.explored = new Set<number>();
    buildGeometry(planet, ctx);
    buildNeighbors(planet);
    findStart(planet);
    assignBiomes(planet, ctx);
    assignPlanetResources(planet, ctx, planet._deserializing === true);
    sortPoly(planet);
    if (!validateTopology(planet, ctx)) return;
    planet.seed = planet.seed + 1;
    t++;
  }
  // 1.x: console.warn после исчерпания попыток — сборка остаётся невалидной (на практике не наблюдалось).
}

/** 1.x _geometry: барицентрическая субдивидация граней, дедуп вершин по normalize→toFixed(7). */
export function buildGeometry(planet: GeneratedPlanet, ctx: GeneratorCtx): void {
  const t = planet.f;
  const o = new Map<string, number>();
  const r = geomEntry(planet.geometry, ctx);
  const s = r.vertices;
  const c = r.faces;
  const l = (u: readonly number[]): number => {
    const f = normalize(u);
    const h = f.map((m) => m.toFixed(7)).join(',');
    if (!o.has(h)) {
      o.set(h, planet.verts.length);
      planet.verts.push(f);
    }
    return o.get(h)!;
  };
  for (const u of c) {
    const f = s[u[0]]!;
    const h = s[u[1]]!;
    const m = s[u[2]]!;
    const g: number[][] = [];
    for (let b = 0; b <= t; b++) {
      g[b] = [];
      for (let w = 0; w <= t - b; w++) {
        const E = t - b - w;
        g[b]![w] = l([(f[0] * b + h[0] * w + m[0] * E) / t, (f[1] * b + h[1] * w + m[1] * E) / t, (f[2] * b + h[2] * w + m[2] * E) / t]);
      }
    }
    for (let b = 0; b < t; b++) {
      for (let w = 0; w < t - b; w++) {
        const E = g[b]![w]!;
        const _ = g[b + 1]![w]!;
        const R = g[b]![w + 1]!;
        planet.faces.push([E, _, R]);
        if (w < t - b - 1) planet.faces.push([_, g[b + 1]![w + 1]!, R]);
      }
    }
  }
  if (planet.isUnique && (ctx.uniqueForms ?? true)) {
    // 1.x: xf(seed) → форма, kf деформирует каждую вершину, затем повторная нормализация Tr
    const u = uniqueForm(planet.seed);
    planet._uniqueForm = u;
    for (let f = 0; f < planet.verts.length; f++) planet.verts[f] = normalize(deformVertex(planet.verts[f]!, planet.seed, u));
  }
  planet.cells = planet.verts.map((u, f) => ({
    id: f,
    center: u,
    poly: [],
    neighbors: [],
    type: 0,
    yield: 1,
    ironYield: 0,
    kriogenYield: 0,
    level: 0,
    isDeep: false,
    displayType: 0,
    reserve: 0,
    maxReserve: 0,
    cooldownUntil: 0,
    reactCount: 0,
    resourceKey: 'iron',
    anomalyType: null,
    _exploredAt: 0,
    _lastYieldAt: 0,
    _chargedAt: 0,
    _chargedEver: false,
    _chargeCooldown: 0,
  }));
  planet.faces.forEach((u) => {
    const f = planet.verts[u[0]]!;
    const h = planet.verts[u[1]]!;
    const m = planet.verts[u[2]]!;
    const g = normalize(add3(add3(f, h), m));
    for (const b of u) planet.cells[b]!.poly.push(g);
  });
}

/** 1.x _neighbors: уникальные рёбра из faces (Map, порядок вставки), двунаправленно. */
export function buildNeighbors(planet: GeneratedPlanet): void {
  const t = new Map<string, [number, number]>();
  planet.faces.forEach((o) => {
    for (let r = 0; r < 3; r++) {
      const s = o[r]!;
      const c = o[(r + 1) % 3]!;
      const l = s < c ? s + '_' + c : c + '_' + s;
      if (!t.has(l)) t.set(l, [s, c]);
    }
  });
  t.forEach(([o, r]) => {
    planet.cells[o]!.neighbors.push(r);
    planet.cells[r]!.neighbors.push(o);
  });
}

/** 1.x _findStart: клетка с максимальным center[2] (строгое >). */
export function findStart(planet: GeneratedPlanet): void {
  let t = 0;
  let o = -Infinity;
  for (let r = 0; r < planet.cells.length; r++) {
    const s = planet.cells[r]!.center[2];
    if (s > o) {
      o = s;
      t = r;
    }
  }
  planet.startingCellId = t;
}

interface BiomeSpec {
  readonly t: number;
  readonly y: number;
  readonly ir?: number;
  readonly kr?: number;
  readonly pct?: number;
  readonly min?: number;
  readonly cnt?: number;
}

/** 1.x _biomes: ОДИН поток qe(seed); пул по спекам → trunc до o−1 → Fisher-Yates → раздача → жилы → старт → research. */
export function assignBiomes(planet: GeneratedPlanet, ctx: GeneratorCtx): void {
  const t = mulberry32(planet.seed);
  const o = planet.cells.length;
  const makePool = (specs: readonly BiomeSpec[]): { t: number; y: number; ir: number; kr: number }[] => {
    const h: { t: number; y: number; ir: number; kr: number }[] = [];
    for (const m of specs) {
      const g = m.cnt !== undefined ? m.cnt : Math.max(m.min || 0, Math.floor(o * (m.pct || 0)));
      for (let b = 0; b < g; b++) h.push({ t: m.t, y: m.y, ir: m.ir || 0, kr: m.kr || 0 });
    }
    while (h.length < o - 1) h.push({ t: 0, y: 1, ir: 0, kr: 0 });
    h.length = o - 1;
    for (let m = h.length - 1; m > 0; m--) {
      const g = Math.floor(t() * (m + 1));
      [h[m], h[g]] = [h[g]!, h[m]!];
    }
    return h;
  };
  let s: readonly BiomeSpec[];
  if (planet.biome === 'ferrum') {
    s = [
      { t: 4, y: 0, cnt: 1 },
      { t: 3, y: 0, ir: 0.1, cnt: 2 },
      { t: 1, y: 3, cnt: 1 },
      { t: 2, y: 10, cnt: 1 },
    ];
  } else if (planet.biome === 'krios') {
    s = [
      { t: 4, y: 0, pct: 0.04, min: 1 },
      { t: 5, y: 0, kr: 0.1, pct: 0.4, min: 8 },
      { t: 3, y: 0, ir: 0.1, pct: 0.15, min: 4 },
      { t: 1, y: 3, pct: 0.1, min: 3 },
      { t: 2, y: 10, pct: 0.05, min: 2 },
    ];
  } else {
    const f = planet.perks.rareChance || 1;
    s = [
      { t: 4, y: 0, pct: 0.02 * (planet.perks.anomalyChance || 1), min: 1 },
      { t: 3, y: 0, ir: 0.1, pct: 0.12, min: 2 },
      { t: 1, y: 3, pct: 0.12, min: 2 },
      { t: 2, y: 10, pct: 0.06 * f, min: 1 },
    ];
  }
  const c = makePool(s);
  let l = 0;
  for (let f = 0; f < o; f++) {
    if (f === planet.startingCellId) continue;
    const h = planet.cells[f]!;
    const m = c[l++]!;
    h.type = m.t;
    h.yield = m.y;
    h.ironYield = m.ir;
    h.kriogenYield = m.kr;
    h.displayType = h.type === 4 ? 0 : h.type;
    if (h.type === 3) {
      h.maxReserve = 100 + Math.floor(t() * 100);
      h.reserve = h.maxReserve;
    } else if (h.type === 5) {
      h.maxReserve = 80 + Math.floor(t() * 70);
      h.reserve = h.maxReserve;
    }
  }
  const u = planet.cells[planet.startingCellId]!;
  u.type = 0;
  u.yield = 1;
  u.ironYield = 0;
  u.kriogenYield = 0;
  u.level = 0;
  u.isDeep = false;
  u.displayType = 0;
  if (planet.biome === 'ferrum') {
    const f = planet.cells[planet.startingCellId]!.neighbors;
    if (!f.some((m) => planet.cells[m]!.type === 3)) {
      const m = planet.cells.find((b) => b.type === 3 && b.id !== planet.startingCellId);
      const g = f[0];
      if (m && g !== undefined) {
        const b = planet.cells[g]!;
        const w = { type: b.type, yield: b.yield, ironYield: b.ironYield, kriogenYield: b.kriogenYield, displayType: b.displayType };
        b.type = m.type;
        b.yield = m.yield;
        b.ironYield = m.ironYield;
        b.kriogenYield = m.kriogenYield;
        b.displayType = m.displayType;
        m.type = w.type;
        m.yield = w.yield;
        m.ironYield = w.ironYield;
        m.kriogenYield = w.kriogenYield;
        m.displayType = w.displayType;
      }
    }
  }
  if (((planet.planetIndex || 0) >= 3 || planet.biome === 'hidden') && planet.biome !== 'ferrum' && planet.biome !== 'krios') {
    const m = mulberry32((planet.seed ^ 6221079) >>> 0);
    const g = planet.biome === 'hidden' ? 1 : ctx.balance.registry.planet.specialCellChance;
    if (m() < g) {
      const b = planet.cells.filter((w) => w.type === 0 && w.id !== planet.startingCellId);
      if (b.length) {
        const w = b[Math.floor(m() * b.length) % b.length]!;
        w.type = 6;
        w.displayType = 6;
        w.yield = 0;
        w.ironYield = 0;
        w.kriogenYield = 0;
        w.level = 0;
        w.isDeep = false;
        w.maxReserve = 0;
        w.reserve = 0;
      }
    }
  }
}

/** 1.x _sortPoly: сортировка poly по atan2 в плоскости наименьшей абсолютной оси центра. */
export function sortPoly(planet: GeneratedPlanet): void {
  planet.cells.forEach((t) => {
    const o = normalize(t.center);
    const r = Math.abs(o[0]);
    const s = Math.abs(o[1]);
    const c = Math.abs(o[2]);
    const l: Vec3 = r <= s && r <= c ? [1, 0, 0] : s <= c ? [0, 1, 0] : [0, 0, 1];
    const u = normalize(cross(o, l));
    const f = normalize(cross(o, u));
    t.poly.sort((h, m) => Math.atan2(dot(h, f), dot(h, u)) - Math.atan2(dot(m, f), dot(m, u)));
  });
}

/** 1.x _validate: число клеток = V + E×(f−1) + F×(f−1)(f−2)/2; строка-ошибка или null. */
export function validateTopology(planet: GeneratedPlanet, ctx: GeneratorCtx): string | null {
  if (planet._mixed || planet._skipValidate) return null;
  const t = geomEntry(planet.geometry, ctx);
  const o = new Set<string>();
  t.faces.forEach((s) => {
    for (let c = 0; c < 3; c++) {
      const l = s[c]!;
      const u = s[(c + 1) % 3]!;
      o.add(l < u ? l + '_' + u : u + '_' + l);
    }
  });
  const r = t.vertices.length + o.size * (planet.f - 1) + t.faces.length * ((planet.f - 1) * (planet.f - 2)) / 2;
  return planet.cells.length !== r ? 'wrong cell count' : null;
}

// ---------------------------------------------------------------------------
// Ресурсы планеты (1.x _assignResources)
// ---------------------------------------------------------------------------

/**
 * 1.x _assignResources(deserializing). Вызывается ТРИЖДЫ для генерируемых планет:
 * в _build (armId=null), в Yf (armId известен) и после ni() (мёрж-клетки) — порядок обязателен.
 */
export function assignPlanetResources(planet: GeneratedPlanet, ctx: GeneratorCtx, deserializing = false): void {
  planet.resourceList = [];
  if (planet.biome === 'ferrum') {
    planet.resourceList = ['iron'];
    return;
  }
  if (planet.biome === 'krios') {
    planet.resourceList = ['kriogen'];
    return;
  }
  if (planet.biome === 'hidden') {
    planet.resourceList = ['titanium', 'platinum', 'uranium', 'helium3', 'biomass', 'carbon'];
    // v0.0.21: гарантии жил — как в основной ветке (своя соль 1013904223)
    let t3h = 0;
    for (const E of planet.cells) if (E.type === 3) t3h++;
    let ndh = planet.resourceList.length - t3h;
    if (ndh > 0) {
      const rn = mulberry32((planet.seed >>> 0) ^ 1013904223);
      const cd: GeneratedCell[] = [];
      for (const E of planet.cells) if (E.type === 0 && E.id !== planet.startingCellId) cd.push(E);
      while (ndh > 0 && cd.length) {
        const E = cd.splice(Math.floor(rn() * cd.length), 1)[0]!;
        E.type = 3;
        E.displayType = 3;
        E.yield = 0;
        E.ironYield = 0.1;
        E.kriogenYield = 0;
        E.maxReserve = 100 + Math.floor(rn() * 100);
        E.reserve = E.maxReserve;
        E.cooldownUntil = 0;
        E.reactCount = 0;
        ndh--;
      }
    }
    let w = 0;
    for (const E of planet.cells) {
      if (E.type === 3) {
        const _ = planet.resourceList[w % planet.resourceList.length]!;
        w++;
        E.ironYield = 0.1;
        E.resourceKey = _;
      }
    }
    return;
  }
  if (deserializing) return;
  const r = planet.planetIndex || 1;
  const LVv = ctx.balance.registry.planet.lastVoronia ?? null;
  const LVw = !(!LVv || r !== LVv.index);
  const RR = LVw ? null : rollResources(planet.seed, r, planet.armId, ctx);
  if (LVw) {
    planet.isUnique = true;
    planet.resourceList = (LVv.resources || []).slice();
  } else {
    planet.isUnique = RR!.unique;
    planet.resourceList = RR!.list.slice();
  }
  if (!planet.resourceList.length) {
    for (const w of planet.cells) {
      if (w.type === 3) {
        w.type = 0;
        w.displayType = 0;
        w.yield = 1;
        w.ironYield = 0;
        w.kriogenYield = 0;
        w.maxReserve = 0;
        w.reserve = 0;
        w.cooldownUntil = 0;
        w.reactCount = 0;
      }
    }
    return;
  }
  // v0.0.21 План 33 баг №2 (вариант A): кристаллический мир — с редкой рудой
  planet.resourceList = crystalEnsure(planet.resourceList, planet.descriptors, planet.seed, r);
  // v0.0.21 План 33 баг №1: жил под каждый заявленный ресурс хватает всегда
  let t3 = 0;
  for (const w of planet.cells) if (w.type === 3) t3++;
  const nd = planet.resourceList.length - t3;
  if (nd > 0) {
    const rn = mulberry32((planet.seed >>> 0) ^ 305419896);
    const cd: GeneratedCell[] = [];
    for (const w of planet.cells) if (w.type === 0 && w.id !== planet.startingCellId) cd.push(w);
    let remaining = nd;
    while (remaining > 0 && cd.length) {
      const w = cd.splice(Math.floor(rn() * cd.length), 1)[0]!;
      w.type = 3;
      w.displayType = 3;
      w.yield = 0;
      w.ironYield = 0.1;
      w.kriogenYield = 0;
      w.maxReserve = 100 + Math.floor(rn() * 100);
      w.reserve = w.maxReserve;
      w.cooldownUntil = 0;
      w.reactCount = 0;
      remaining--;
    }
  }
  let b = 0;
  for (const w of planet.cells) {
    if (w.type === 3) {
      const E = planet.resourceList[b % planet.resourceList.length]!;
      b++;
      if (E === 'iron') {
        w.ironYield = 0.1;
        w.resourceKey = 'iron';
      } else if (E === 'kriogen') {
        w.kriogenYield = 0.1;
        w.resourceKey = 'kriogen';
      } else {
        w.ironYield = 0.1;
        w.resourceKey = E;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Старт (1.x initStart)
// ---------------------------------------------------------------------------

/** 1.x initStart: explored=[start], revealed=[start, ...соседи]; перк пыли reveal_start → соседи и explored. */
export function initPlanetStart(planet: GeneratedPlanet, revealStartPerk = false): void {
  planet.revealed.add(planet.startingCellId);
  planet.explored.add(planet.startingCellId);
  for (const t of planet.cells[planet.startingCellId]!.neighbors) planet.revealed.add(t);
  if (revealStartPerk) {
    for (const t of planet.cells[planet.startingCellId]!.neighbors) {
      planet.revealed.add(t);
      planet.explored.add(t);
    }
  }
}

// ---------------------------------------------------------------------------
// Смешанные миры (1.x ni + Dy + pl)
// ---------------------------------------------------------------------------

/** 1.x pl(): ленивый расчёт _base* по level-множителям (нужен ni для мёрж-клеток). */
export function ensureBaseFields(cell: GeneratedCell, veinProfile: (level: number) => VeinProfile): void {
  if (!Number.isFinite(cell._baseMaxReserve)) {
    const t = Math.max(0, Number(cell.level) || 0);
    const o = veinProfile(t);
    cell._baseMaxReserve = Math.max(1, (Number(cell.maxReserve) || 0) / o.reserveMult);
  }
  if (!Number.isFinite(cell._baseIronYield)) {
    const t = Math.max(0, Number(cell.level) || 0);
    const o = veinProfile(t);
    cell._baseIronYield = Math.max(0, (Number(cell.ironYield) || 0) / o.yieldMult);
  }
  if (!Number.isFinite(cell._baseKriogenYield)) {
    const t = Math.max(0, Number(cell.level) || 0);
    const o = veinProfile(t);
    cell._baseKriogenYield = Math.max(0, (Number(cell.kriogenYield) || 0) / o.yieldMult);
  }
}

/**
 * 1.x ni(): mixed-миры — пространственные кластеры одногруппных клеток (idx>=3, cells>=20,
 * не ferrum/krios/hidden). Аномалии (t4) и исследования (t6) — всегда синглтоны.
 * Клетки заменяются мёрж-клетками (_mixedRep/_oldIds); граф/explored/revealed пересчитываются.
 */
export function applyMixedClusters(planet: GeneratedPlanet, ctx: GeneratorCtx): boolean {
  if (!planet || planet._mixed) return false;
  if ((planet.planetIndex || 0) < 3) return false;
  if (planet.biome === 'ferrum' || planet.biome === 'krios' || planet.biome === 'hidden') return false;
  if (!planet.cells || planet.cells.length < 20) return false;
  const vp = veinProfileOf(ctx);
  const o = mulberry32((planet.seed >>> 0) ^ 1296652357);
  const r = planet.cells.length;
  const s = planet.cells;
  const c = mixedParamsFor(planet.descriptors?.climate?.id);
  const l = c.hotMin + Math.floor(o() * (c.hotMax - c.hotMin + 1));
  const u: { dir: Vec3; rKeep: number; rMerge: number }[] = [];
  for (let I = 0; I < l; I++) {
    const N = o() * Math.PI * 2;
    const U = Math.acos(2 * o() - 1);
    u.push({
      dir: [Math.sin(U) * Math.cos(N), Math.sin(U) * Math.sin(N), Math.cos(U)],
      rKeep: (0.28 + o() * 0.22) * c.rKeepMul,
      rMerge: (0.75 + o() * 0.55) * c.rMergeMul,
    });
  }
  const f = new Float64Array(r);
  for (let I = 0; I < r; I++) {
    const N = s[I]!.center;
    let U = -1;
    for (const W of u) {
      const j = Math.acos(Math.max(-1, Math.min(1, dot(N, W.dir))));
      let K: number;
      if (j < W.rKeep) K = 1 - (j / W.rKeep) * 0.3;
      else if (j < W.rMerge) K = 0.7 - ((j - W.rKeep) / (W.rMerge - W.rKeep)) * 0.95;
      else K = 0.3;
      if (K > U) U = K;
    }
    f[I] = U + (o() - 0.5) * c.scoreNoise;
  }
  const h = c.joinDist;
  const m = c.maxCluster;
  let g = new Int32Array(r).fill(-1);
  const b = (I: GeneratedCell): string => (I.type === 4 ? 'a4_' + I.id : I.type === 6 ? 'a6_' + I.id : I.type === 3 ? 'r3_' + (I.resourceKey || 'iron') : 't' + I.type);
  const w = new Map<string, number[]>();
  for (let I = 0; I < r; I++) {
    const N = b(s[I]!);
    if (!w.has(N)) w.set(N, []);
    w.get(N)!.push(I);
  }
  for (const [I, N] of w) {
    if (I.startsWith('a4_') || I.startsWith('a6_')) {
      for (const j of N) g[j] = j;
      continue;
    }
    N.sort((j, K) => f[K]! - f[j]!);
    const U: number[] = [];
    const W = new Map<number, number>();
    for (const j of N) {
      if (!(f[j]! > 0.5) && U.length) {
        let ne = -1;
        let J = Infinity;
        const ue = s[j]!.center;
        for (const Pe of U) {
          if ((W.get(Pe) || 0) >= m) continue;
          const Ue = Math.acos(Math.max(-1, Math.min(1, dot(ue, s[Pe]!.center))));
          if (Ue < J) {
            J = Ue;
            ne = Pe;
          }
        }
        if (ne !== -1 && J <= h) {
          g[j] = ne;
          W.set(ne, (W.get(ne) || 0) + 1);
          continue;
        }
      }
      g[j] = j;
      U.push(j);
      W.set(j, 1);
    }
  }
  const forced = planet._forcedClusters;
  if (forced) {
    const fc = new Int32Array(r).fill(-1);
    let fok = true;
    let fcnt = 0;
    for (let fi = 0; fi < forced.length && fok; fi++) {
      const N = forced[fi];
      if (!N || !N.length) {
        fok = false;
        break;
      }
      const rp = N[0];
      if (rp === undefined || !(rp >= 0 && rp < r && fc[rp] === -1)) {
        fok = false;
        break;
      }
      for (let mi = 0; mi < N.length; mi++) {
        const W = N[mi];
        if (W === undefined || !(W >= 0 && W < r && fc[W] === -1)) {
          fok = false;
          break;
        }
        fc[W] = rp;
        fcnt++;
      }
    }
    if (fok && fcnt === r) g = fc;
  }
  const E = planet.startingCellId;
  if (!planet._forcedClusters && E >= 0 && g[E] !== E) {
    const I = g[E]!;
    for (let N = 0; N < r; N++) if (g[N] === I) g[N] = E;
    g[E] = E;
  }
  const _ = new Map<number, number[]>();
  for (let I = 0; I < r; I++) {
    const N = g[I]!;
    if (!_.has(N)) _.set(N, []);
    _.get(N)!.push(I);
  }
  const R = [..._.keys()].sort((I, N) => I - N);
  const A = new Map<number, number>();
  R.forEach((I, N) => A.set(I, N));
  const T: GeneratedCell[] = [];
  for (let I = 0; I < R.length; I++) {
    const N = R[I]!;
    const U = _.get(N)!;
    const W = s[N]!;
    const K = [N, ...U.filter((Mt) => Mt !== N)].map((Mt) => s[Mt]!.poly.slice());
    const ne = K[0]!;
    for (const Mt of U) ensureBaseFields(s[Mt]!, vp);
    let J = 0;
    let ue = false;
    let Pe = 0;
    let Ue = 0;
    let Dt = 0;
    let Je = 0;
    let wt = 0;
    let Qt = 0;
    const ut: number[] = [];
    for (const Mt of U) {
      const pt = s[Mt]!;
      if ((pt.level || 0) > J) J = pt.level || 0;
      if (pt.isDeep) ue = true;
      if ((pt.reactCount || 0) > Pe) Pe = pt.reactCount || 0;
      Ue += Math.max(0, pt.reserve || 0);
      Dt += Math.max(0, pt._baseMaxReserve || 0);
      Je += Math.max(0, pt._baseIronYield || 0);
      wt += Math.max(0, pt._baseKriogenYield || 0);
      Qt += Math.max(0, Number(pt.yield) || 0);
      if ((pt.cooldownUntil || 0) > 0) ut.push(pt.cooldownUntil);
    }
    const We = vp(J);
    const bn = Math.max(0, Math.round(Dt * We.reserveMult));
    T.push({
      id: I,
      center: W.center,
      poly: ne,
      _polys: K,
      neighbors: [],
      type: W.type,
      yield: W.type === 0 ? 1 + J : Qt,
      ironYield: Je * We.yieldMult,
      kriogenYield: wt * We.yieldMult,
      level: J,
      isDeep: ue,
      displayType: W.displayType,
      reserve: bn > 0 ? Math.min(Ue, bn) : 0,
      maxReserve: bn,
      cooldownUntil: ut.length ? Math.min(...ut) : 0,
      reactCount: Pe,
      resourceKey: W.resourceKey,
      anomalyType: W.anomalyType,
      _exploredAt: 0,
      _lastYieldAt: 0,
      _baseMaxReserve: Math.max(0, Dt),
      _baseIronYield: Je,
      _baseKriogenYield: wt,
      _mixedCluster: U.length > 1,
      _memberCount: U.length,
      _mixedRep: N,
      _oldIds: U.slice(),
    });
  }
  const O = new Map<number, number>();
  for (const [I, N] of A) for (const U of _.get(I)!) O.set(U, N);
  for (let I = 0; I < T.length; I++) {
    const N = new Set<number>();
    for (const U of T[I]!._oldIds!) {
      for (const W of s[U]!.neighbors) {
        const j = O.get(W);
        if (j !== undefined && j !== I) N.add(j);
      }
    }
    T[I]!.neighbors = [...N];
  }
  const V = new Set<number>();
  for (const I of planet.explored) {
    const N = O.get(I);
    if (N !== undefined) V.add(N);
  }
  const q = new Set<number>();
  for (const I of planet.revealed) {
    const N = O.get(I);
    if (N !== undefined) q.add(N);
  }
  for (const I of [...V]) for (const N of T[I]!.neighbors) q.add(N);
  planet.cells = T;
  planet.verts = T.map((I) => I.center);
  planet.faces = [];
  planet.explored = V;
  planet.revealed = q;
  planet.startingCellId = O.get(E) ?? 0;
  planet._mixed = true;
  planet._mixedVer = 2;
  planet._skipValidate = true;
  planet._oldCentroids = s.map((I) => I.center);
  return true;
}

// ---------------------------------------------------------------------------
// Награда за открытие (1.x discoverPlanet)
// ---------------------------------------------------------------------------

/** 1.x: floor(500 × 2.2^max(0, idx−2)) 🔬 (TV-6). */
export function discoverReward(planetIndex: number): number {
  return Math.floor(500 * Math.pow(2.2, Math.max(0, (planetIndex || 1) - 2)));
}
