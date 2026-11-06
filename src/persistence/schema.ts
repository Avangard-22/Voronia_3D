/**
 * persistence/schema.ts — схема сейва 2.0 (v2) + миграция legacy v39 (1.x cosmicClickerV19) + валидатор.
 * v2 хранит ТОЛЬКО то, что владеет срез Этапа 2: ledger-балансы, состояние планет (explored/revealed/cellStates),
 * pricing, tech, warehouse, session, rng/clock. Домены поздних этапов добавляют свои секции на своих этапах.
 * Структура legacy — fixtures/golden_save_fresh_v0.0.41.json (version 39, 20 ресурсов: 7 top + 8 extra + 5 compounds).
 */
import type { CellState } from '../contracts/cells';
import { emptyCellState } from '../contracts/cells';
import type { LedgerResourceKey, PlanetStorageResourceKey } from '../contracts/resources';
import { LEDGER_RESOURCES, PLANET_STORAGE_RESOURCES } from '../contracts/resources';
import { freshSession, type SessionStats } from '../contracts/snapshot';
import type { TechLevels } from '../contracts/tech';
import { FRESH_TECH } from '../contracts/tech';
import type { LogisticsState } from '../contracts/logistics';

export type { SessionStats };
export { freshSession };

export const SAVE_VERSION = 2;
export const LEGACY_SAVE_VERSION = 39;

export interface SerializedCellState extends CellState {
  readonly id: number;
}

export interface SerializedPlanetState {
  readonly explored: readonly number[];
  readonly revealed: readonly number[];
  readonly cellStates: readonly SerializedCellState[];
}

/**
 * Этап 5 (ADR-017): спек открытого мира — детерминированный реплей вместо полного дампа
 * (buildPlanet/Yf/initStart/ni воспроизводятся из seed+f+geometry+biome+порядка).
 */
export interface DiscoverySpec {
  readonly id: string;
  readonly name: string | null;
  readonly seed: number;
  readonly f: number;
  readonly geometry: string;
  readonly biome: string;
  readonly planetIndex: number;
}

export interface SaveGameV2 {
  readonly version: typeof SAVE_VERSION;
  readonly savedAt: number;
  readonly gameStartSeed: number;
  readonly rngState: number;
  readonly gameMs: number;
  readonly ledger: { readonly balances: Readonly<Record<string, number>>; readonly nextId: number };
  readonly activePlanetId: string;
  readonly unlockedPlanets: readonly string[];
  readonly planets: Readonly<Record<string, SerializedPlanetState>>;
  /** V1 On/yy storage, keyed by planet; optional for backward compatibility with earlier v2 saves. */
  readonly planetResources?: Readonly<Record<string, Readonly<Partial<Record<PlanetStorageResourceKey, number>>>>>;
  readonly pricing: { readonly currentCost: number };
  readonly tech: { readonly levels: TechLevels; readonly research: Readonly<Record<string, number>> };
  readonly warehouseLevel: number;
  /** Stage 6.7: грузовой трюм и локальные депо планет; опционально для совместимости с сейвами v2 до 6.7. */
  readonly logistics?: LogisticsState;
  /** Этап 9.3 (ТЗ §6): очередь реактора и прогресс run — опционально для сейвов v2 до 9.3. */
  readonly reactor?: {
    readonly jobs?: readonly { id?: number; recipeId?: string; runs?: number; done?: number; progressMs?: number; paidForCurrent?: boolean; deficit?: boolean }[];
    readonly nextJobId?: number;
  };
  readonly session: SessionStats;
  /** Этап 4 (опц.): сонар-заряды (1.x n.sonarCharges, cap sonar.chargeMax). */
  readonly sonarCharges?: number;
  /** Этап 6.1: счётчик пересборок текущей следующей сигнатуры. */
  readonly sonarRerolls?: number;
  /** Stage 6.5: завершённые аномальные экспедиции (id планет), защищает от повторного получения наград. */
  readonly resolvedAnomalyIds?: readonly string[];
  /** Этап 6: активный бонус сонарного сканирования (время wall-clock, переживает перезапуск). */
  readonly sonarBonus?: { readonly planetId: string; readonly mult: number; readonly until: number; readonly accuracy: number };
  /** Этап 5 (опц.): спеки открытых миров (реплей при загрузке; ADR-017). */
  readonly discoveredSpecs?: readonly DiscoverySpec[];
  /** Stage 7.4: состояние орбитальных исследований и связь тела с созданной планетой. */
  readonly orbitalExploration?: Readonly<Record<string, { readonly scannedBodyIds: readonly string[]; readonly activatedBodies: Readonly<Record<string, string>> }>>;
}

export interface SaveValidation {
  readonly ok: boolean;
  readonly problems: readonly string[];
}

export function validateSaveV2(raw: unknown): SaveValidation {
  const problems: string[] = [];
  if (typeof raw !== 'object' || raw === null) return { ok: false, problems: ['сейв не объект'] };
  const s = raw as Record<string, unknown>;
  if (s['version'] !== SAVE_VERSION) problems.push(`version=${JSON.stringify(s['version'])}, ожидалось ${SAVE_VERSION}`);
  const finiteNonNegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  if (!finiteNonNegative(s['savedAt']) || (s['savedAt'] as number) <= 0) problems.push('savedAt невалиден');
  if (!finiteNonNegative(s['gameMs'])) problems.push('gameMs невалиден');
  if (!finiteNonNegative(s['gameStartSeed'])) problems.push('gameStartSeed невалиден');
  if (!finiteNonNegative(s['rngState'])) problems.push('rngState невалиден');
  if (!finiteNonNegative(s['warehouseLevel'])) problems.push('warehouseLevel невалиден');
  const led = s['ledger'] as Record<string, unknown> | undefined;
  if (!led || typeof led !== 'object') problems.push('нет ledger');
  else {
    const balances = led['balances'] as Record<string, unknown> | undefined;
    if (!balances || typeof balances !== 'object') problems.push('нет ledger.balances');
    else {
      for (const k of LEDGER_RESOURCES) {
        const v = balances[k];
        if (v !== undefined && (typeof v !== 'number' || !Number.isFinite(v) || v < 0)) problems.push(`ledger.balances.${k}=${JSON.stringify(v)}`);
      }
    }
  }
  const planets = s['planets'] as Record<string, unknown> | undefined;
  if (!planets || typeof planets !== 'object' || Array.isArray(planets)) problems.push('нет planets');
  else {
    for (const [pid, p] of Object.entries(planets)) {
      const pr = p as Record<string, unknown>;
      if (!Array.isArray(pr['explored'])) problems.push(`${pid}.explored не массив`);
      if (!Array.isArray(pr['revealed'])) problems.push(`${pid}.revealed не массив`);
      if (!Array.isArray(pr['cellStates'])) problems.push(`${pid}.cellStates не массив`);
      for (const key of ['explored', 'revealed'] as const) {
        const ids = pr[key];
        if (Array.isArray(ids) && (ids.some((id) => !Number.isInteger(id) || (id as number) < 0) || new Set(ids).size !== ids.length)) problems.push(`${pid}.${key}: некорректные или повторяющиеся id`);
      }
      const cellIds = new Set<number>();
      for (const cs of (Array.isArray(pr['cellStates']) ? pr['cellStates'] : []) as Record<string, unknown>[]) {
        if (!cs || typeof cs !== 'object') { problems.push(`${pid}.cellStates: запись не объект`); continue; }
        if (!Number.isInteger(cs['id']) || (cs['id'] as number) < 0) problems.push(`${pid}.cellStates: id невалиден`);
        else if (cellIds.has(cs['id'] as number)) problems.push(`${pid}.cellStates: повтор id ${String(cs['id'])}`);
        else cellIds.add(cs['id'] as number);
        for (const key of ['level', 'yield', 'reserve', 'maxReserve', 'cooldownUntil', 'reactCount', 'ironYield', 'kriogenYield', 'chargedAt', 'chargeCooldownUntil', 'surgeNextAt', 'surgeUntil'] as const) {
          const value = cs[key];
          if (value !== undefined && !finiteNonNegative(value)) problems.push(`${pid}.cellStates#${String(cs['id'])}.${key}: невалидное число`);
        }
      }
    }
  }
  if (typeof s['activePlanetId'] !== 'string') problems.push('activePlanetId не строка');
  const unlocked = s['unlockedPlanets'];
  if (!Array.isArray(unlocked) || unlocked.length === 0 || unlocked.some((id) => typeof id !== 'string') || new Set(unlocked).size !== unlocked.length) problems.push('unlockedPlanets невалиден');
  else if (typeof s['activePlanetId'] === 'string' && !unlocked.includes(s['activePlanetId'])) problems.push('activePlanetId отсутствует в unlockedPlanets');
  if (s['planetResources'] !== undefined) {
    const stocks = s['planetResources'];
    if (!stocks || typeof stocks !== 'object' || Array.isArray(stocks)) problems.push('planetResources не объект');
    else for (const [pid, stock] of Object.entries(stocks as Record<string, unknown>)) {
      if (!stock || typeof stock !== 'object' || Array.isArray(stock)) { problems.push(`planetResources.${pid} не объект`); continue; }
      for (const [key, value] of Object.entries(stock as Record<string, unknown>)) {
        if (!(PLANET_STORAGE_RESOURCES as readonly string[]).includes(key)) problems.push(`planetResources.${pid}.${key}: неизвестный ресурс`);
        else if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) problems.push(`planetResources.${pid}.${key}: невалидный запас`);
      }
    }
  }
  if (s['orbitalExploration'] !== undefined) {
    const systems = s['orbitalExploration'] as Record<string, unknown>;
    const unlocked = new Set(Array.isArray(s['unlockedPlanets']) ? s['unlockedPlanets'].filter((id): id is string => typeof id === 'string') : []);
    const specs = new Set(Array.isArray(s['discoveredSpecs']) ? (s['discoveredSpecs'] as unknown[]).flatMap((item) => item && typeof item === 'object' && typeof (item as Record<string, unknown>)['id'] === 'string' ? [(item as Record<string, unknown>)['id'] as string] : []) : []);
    if (!systems || typeof systems !== 'object' || Array.isArray(systems)) problems.push('orbitalExploration невалиден');
    else for (const [hostId, value] of Object.entries(systems)) {
      const state = value as Record<string, unknown>;
      if (!state || !Array.isArray(state['scannedBodyIds']) || !state['activatedBodies'] || typeof state['activatedBodies'] !== 'object' || Array.isArray(state['activatedBodies'])) {
        problems.push(`orbitalExploration.${hostId} невалиден`);
        continue;
      }
      const scanned = state['scannedBodyIds'] as unknown[];
      const activated = state['activatedBodies'] as Record<string, unknown>;
      if (!unlocked.has(hostId)) problems.push(`orbitalExploration.${hostId}: родительская планета не открыта`);
      if (scanned.some((id) => typeof id !== 'string' || !id.startsWith(`body:${hostId}:`))) problems.push(`orbitalExploration.${hostId}: неверный идентификатор сканирования`);
      if (new Set(scanned).size !== scanned.length) problems.push(`orbitalExploration.${hostId}: повторяющиеся scannedBodyIds`);
      const mappedPlanets = new Set<string>();
      for (const [bodyId, planetId] of Object.entries(activated)) {
        if (typeof planetId !== 'string' || !bodyId.startsWith(`body:${hostId}:`) || !scanned.includes(bodyId)) {
          problems.push(`orbitalExploration.${hostId}.${bodyId}: активация не соответствует исследованному телу`);
          continue;
        }
        if (!unlocked.has(planetId)) problems.push(`orbitalExploration.${hostId}.${bodyId}: планета ${planetId} не открыта`);
        if (!specs.has(planetId)) problems.push(`orbitalExploration.${hostId}.${bodyId}: отсутствует DiscoverySpec для ${planetId}`);
        if (mappedPlanets.has(planetId)) problems.push(`orbitalExploration.${hostId}: планета ${planetId} привязана к нескольким телам`);
        mappedPlanets.add(planetId);
      }
    }
  }
  if (s['resolvedAnomalyIds'] !== undefined && (!Array.isArray(s['resolvedAnomalyIds']) || s['resolvedAnomalyIds'].some((id) => typeof id !== 'string'))) problems.push('resolvedAnomalyIds невалиден');
  if (s['sonarBonus'] !== undefined) {
    const b = s['sonarBonus'] as Record<string, unknown>;
    if (!b || typeof b !== 'object' || typeof b['planetId'] !== 'string' || typeof b['mult'] !== 'number' || !Number.isFinite(b['mult']) || b['mult'] < 1 || typeof b['until'] !== 'number' || !Number.isFinite(b['until']) || typeof b['accuracy'] !== 'number' || b['accuracy'] < 0 || b['accuracy'] > 100) problems.push('sonarBonus невалиден');
  }
  if (s['logistics'] !== undefined) {
    const logistics = s['logistics'] as Record<string, unknown>;
    if (!logistics || typeof logistics !== 'object' || typeof logistics['cargo'] !== 'object' || logistics['cargo'] === null || typeof logistics['depots'] !== 'object' || logistics['depots'] === null) problems.push('logistics невалиден');
    else {
      const validateAmounts = (amounts: unknown, path: string): void => {
        if (typeof amounts !== 'object' || amounts === null || Array.isArray(amounts)) { problems.push(`${path} не объект`); return; }
        for (const [key, value] of Object.entries(amounts)) {
          if (!LEDGER_RESOURCES.includes(key as LedgerResourceKey) || typeof value !== 'number' || !Number.isFinite(value) || value < 0) problems.push(`${path}.${key} невалиден`);
        }
      };
      validateAmounts(logistics['cargo'], 'logistics.cargo');
      for (const [pid, depot] of Object.entries(logistics['depots'] as Record<string, unknown>)) validateAmounts(depot, `logistics.depots.${pid}`);
    }
  }
  const pricing = s['pricing'] as Record<string, unknown> | undefined;
  if (!pricing || typeof pricing['currentCost'] !== 'number' || (pricing['currentCost']) < 1) problems.push('pricing.currentCost невалиден');
  return { ok: problems.length === 0, problems };
}

type Json = Record<string, unknown>;

function legacyNum(o: Json, key: string): number {
  const v = o[key];
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

function legacyDeadlineToGameMs(value: number, savedAt: number): number {
  if (!(value > 0)) return 0;
  // V1 хранит эти дедлайны в Date.now() (epoch); V2 использует gameMs от нуля.
  // Переносим только оставшееся время на игровую шкалу, а не абсолютный timestamp.
  if (value > 1e11) return Math.max(0, value - savedAt);
  return Math.max(0, value);
}

function legacyOptionalDeadline(cs: Json, keys: readonly string[], savedAt: number): number | undefined {
  for (const key of keys) {
    const value = cs[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return legacyDeadlineToGameMs(value, savedAt);
  }
  return undefined;
}

function legacyElapsedToGameMs(value: number): number {
  // chargedAt используется только для кратковременной визуальной индикации.
  // Epoch V1 не имеет прямого аналога на шкале gameMs; не переносим его как огромный timestamp.
  return value > 1e11 ? 0 : Math.max(0, value);
}

function cellStateFromLegacy(cs: Json, savedAt: number): SerializedCellState {
  const base = emptyCellState();
  return {
    ...base,
    id: typeof cs['id'] === 'number' ? cs['id'] : -1,
    level: Math.max(0, legacyNum(cs, 'level')),
    isDeep: cs['isDeep'] === true,
    yield: legacyNum(cs, 'yield'),
    ironYield: legacyNum(cs, 'ironYield'),
    kriogenYield: legacyNum(cs, 'kriogenYield'),
    reserve: legacyNum(cs, 'reserve'),
    maxReserve: legacyNum(cs, 'maxReserve'),
    // Этап 9.3: v1 хранил кулдауны в wall-clock мс (Date.now()); игровой时钟 v2 относителен.
    // 1e11 мс ≈ 3.2 года игрового времени — недостижимо; всё, что выше, — epoch v1 → считаем истёкшим.
    cooldownUntil: legacyGameMs(legacyNum(cs, 'cooldownUntil')),
    reactCount: Math.max(0, legacyNum(cs, 'reactCount')),
    anomalyType: (cs['anomalyType'] === 'synth' || cs['anomalyType'] === 'power' || cs['anomalyType'] === 'resonance' ? cs['anomalyType'] : null),
    // V1 special-cell state: keep branch, manual-charge history/cooldown and v0.0.39 surge schedule.
    chargedAt: legacyElapsedToGameMs(legacyNum(cs, '_chargedAt') || legacyNum(cs, 'chargedAt')),
    chargedEver: cs['_chargedEver'] === true || cs['chargedEver'] === true,
    chargeCooldownUntil: legacyDeadlineToGameMs(legacyNum(cs, '_chargeCooldown') || legacyNum(cs, 'chargeCooldownUntil') || legacyNum(cs, 'chargeCooldown'), savedAt),
    surgeNextAt: legacyOptionalDeadline(cs, ['_v039SurgeNextAt', 'surgeNextAt'], savedAt),
    surgeUntil: legacyDeadlineToGameMs(legacyNum(cs, '_v039SurgeUntil') || legacyNum(cs, 'surgeUntil'), savedAt),
    mutant: typeof cs['mutant'] === 'string' ? cs['mutant'] : null,
    destroyed: cs['destroyed'] === true || cs['_destroyed'] === true,
  };
}

/**
 * Этап 9.3: миграция epoch-меток v1 в игровую шкалу v2.
 * Без неё клетки из legacy-сейва вечно «остывают» (на экране были числа ~1.79e9 с).
 */
function legacyGameMs(value: number): number {
  return value > 1e11 ? 0 : Math.max(0, value);
}

/** Миграция legacy v39 → v2. Неизвестные/поздние секции 1.x (dustPerks, extensions, boss…) отбрасываются — домены вернут их на своих этапах. */
export function migrateLegacyV39(raw: unknown): SaveGameV2 {
  if (typeof raw !== 'object' || raw === null) throw new Error('legacy-сейв не объект');
  const s = raw as Json;
  const ver = s['version'];
  if (ver !== LEGACY_SAVE_VERSION) throw new Error(`ожидался legacy version ${LEGACY_SAVE_VERSION}, получено ${JSON.stringify(ver)}`);

  const balances: Record<string, number> = {};
  for (const k of LEDGER_RESOURCES) balances[k] = 0;
  for (const k of ['energy', 'iron', 'kriogen', 'crystals', 'research', 'dust', 'essence'] as const) balances[k] = legacyNum(s, k);
  const extra = (s['extraResources'] ?? {}) as Json;
  for (const k of ['carbon', 'silicon', 'titanium', 'uranium', 'helium3', 'biomass', 'platinum', 'darkMatter'] as const) balances[k] = legacyNum(extra, k);
  const comp = (s['compoundResources'] ?? {}) as Json;
  for (const k of ['steel', 'chip', 'alloy', 'core', 'relic'] as const) balances[k] = legacyNum(comp, k);

  const savedAt = legacyNum(s, 'timestamp') || Date.now();
  const planetsOut: Record<string, SerializedPlanetState> = {};
  const planets = (s['planets'] ?? {}) as Json;
  for (const [pid, pv] of Object.entries(planets)) {
    const p = pv as Json;
    const explored = Array.isArray(p['explored']) ? (p['explored'] as number[]).filter((x) => typeof x === 'number') : [];
    const revealed = Array.isArray(p['revealed']) ? (p['revealed'] as number[]).filter((x) => typeof x === 'number') : [];
    const cellStates = Array.isArray(p['cellStates']) ? (p['cellStates'] as Json[]).map((cell) => cellStateFromLegacy(cell, savedAt)).filter((c) => c.id >= 0) : [];
    planetsOut[pid] = { explored, revealed, cellStates };
  }

  // Legacy On/yy: inactive planet stocks live in planets[pid].storage; active stock lives in top-level fields.
  const activePlanetId = typeof s['activePlanetId'] === 'string' ? s['activePlanetId'] : 'ferrum';
  const planetResources: Record<string, Partial<Record<PlanetStorageResourceKey, number>>> = {};
  for (const [pid, pv] of Object.entries(planets)) {
    const storage = ((pv as Json)['storage'] ?? {}) as Json;
    const stock: Partial<Record<PlanetStorageResourceKey, number>> = {};
    for (const key of PLANET_STORAGE_RESOURCES) stock[key] = legacyNum(storage, key);
    planetResources[pid] = stock;
  }
  const activeStock: Partial<Record<PlanetStorageResourceKey, number>> = {};
  for (const key of PLANET_STORAGE_RESOURCES) activeStock[key] = balances[key] ?? 0;
  planetResources[activePlanetId] = activeStock;

  const techLegacy = (s['tech'] ?? {}) as Json;
  const techDraft: { -readonly [K in keyof TechLevels]: number } = { ...FRESH_TECH };
  for (const k of Object.keys(techDraft) as (keyof TechLevels)[]) {
    const v = techLegacy[k];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) techDraft[k] = v;
  }
  const tech: TechLevels = techDraft;

  const unlocked = Array.isArray(s['unlockedPlanets']) ? (s['unlockedPlanets'] as string[]).filter((x) => typeof x === 'string') : ['ferrum'];

  return {
    version: SAVE_VERSION,
    savedAt,
    gameStartSeed: typeof s['gameStartSeed'] === 'number' ? s['gameStartSeed'] >>> 0 : 0,
    rngState: 0,
    gameMs: 0,
    ledger: { balances, nextId: 1 },
    activePlanetId,
    unlockedPlanets: unlocked,
    planets: planetsOut,
    planetResources,
    pricing: { currentCost: Math.max(1, Math.floor(legacyNum(s, 'currentCost') || 10)) },
    tech: { levels: tech, research: {} },
    warehouseLevel: Math.max(0, Math.floor(legacyNum(s, 'warehouseLevel'))),
    session: freshSession(Date.now()),
  };
}

export function freshSaveV2(seed: number, now: number): SaveGameV2 {
  const balances: Record<string, number> = {};
  for (const k of LEDGER_RESOURCES) balances[k] = 0;
  return {
    version: SAVE_VERSION,
    savedAt: now,
    gameStartSeed: seed >>> 0,
    rngState: seed >>> 0,
    gameMs: 0,
    ledger: { balances, nextId: 1 },
    activePlanetId: 'ferrum',
    unlockedPlanets: ['ferrum'],
    planets: {},
    pricing: { currentCost: 10 },
    tech: { levels: FRESH_TECH, research: {} },
    warehouseLevel: 0,
    session: freshSession(now),
  };
}

export function ledgerKeys(): readonly LedgerResourceKey[] {
  return LEDGER_RESOURCES;
}
