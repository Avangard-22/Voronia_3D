/**
 * persistence/saveManager.ts — сохранение/загрузка/экспорт/импорт + автосейв (registry hygiene.autosaveMs).
 * Round-trip-инвариант (README Этап 2): save → load → save даёт байт-идентичный payload (тест persistence.roundtrip).
 * Legacy v39 обнаруживается по полю version и мигрируется (persistence/schema.ts).
 */
import type { EventPort, LogPort, StoragePort } from '../contracts/ports';
import { SAVE_VERSION, LEGACY_SAVE_VERSION, migrateLegacyV39, validateSaveV2, type SaveGameV2 } from './schema';
import { LEGACY_SAVE_KEY, SAVE_KEY } from './storage';

/** Контракт между SaveManager и Game-фасадом (Game — единственный сборщик, ADR-012). */
export interface SaveSource {
  collectState(): SaveGameV2;
  applyState(save: SaveGameV2, offlineElapsedMs?: number): void;
}

export interface SaveManagerDeps {
  readonly storage: StoragePort;
  readonly bus: EventPort;
  readonly logger?: LogPort;
  readonly autosaveMs?: number;
  readonly now?: () => number;
}

export type LoadResult = { readonly ok: true; readonly migrated: boolean; readonly sizeBytes: number } | { readonly ok: false; readonly reason: 'empty' | 'corrupt' | 'invalid'; readonly detail?: string };

export class SaveManager {
  private autosaveTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly deps: SaveManagerDeps,
    private readonly source: SaveSource,
  ) {}

  serialize(): string {
    return JSON.stringify(this.source.collectState());
  }

  save(): { sizeBytes: number } {
    const payload = this.serialize();
    this.deps.storage.setItem(SAVE_KEY, payload);
    // LocalStorage may silently reject writes (quota/private mode); verify durable read-back.
    if (this.deps.storage.getItem(SAVE_KEY) !== payload) throw new Error('Сохранение не подтверждено хранилищем');
    this.deps.bus.emit('game:saved', { saveVersion: SAVE_VERSION, at: this.now() });
    return { sizeBytes: payload.length };
  }

  private now(): number {
    return this.deps.now ? this.deps.now() : Date.now();
  }

  parse(raw: string): SaveGameV2 | null {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
    if (typeof data !== 'object' || data === null) return null;
    const version = (data as Record<string, unknown>)['version'];
    if (version === LEGACY_SAVE_VERSION) {
      try {
        return migrateLegacyV39(data);
      } catch (err) {
        this.deps.logger?.warn('save', 'миграция v39 не удалась', { err: String(err) });
        return null;
      }
    }
    const v = validateSaveV2(data);
    if (!v.ok) {
      this.deps.logger?.warn('save', 'сейв невалиден', { problems: v.problems });
      return null;
    }
    return data as SaveGameV2;
  }

  load(): LoadResult {
    const own = this.deps.storage.getItem(SAVE_KEY);
    const legacyRaw = own === null ? this.deps.storage.getItem(LEGACY_SAVE_KEY) : null;
    const raw = own ?? legacyRaw;
    if (!raw) return { ok: false, reason: 'empty' };
    const parsed = this.parse(raw);
    if (!parsed) return { ok: false, reason: this.isJson(raw) ? 'invalid' : 'corrupt' };
    const savedAt = Number.isFinite(parsed.savedAt) ? parsed.savedAt : this.now();
    const offlineElapsedMs = Math.max(0, this.now() - savedAt);
    this.source.applyState(parsed, offlineElapsedMs);
    // Re-anchor the save immediately: a repeated load must not grant the same offline interval twice.
    this.save();
    this.deps.bus.emit('game:loaded', { saveVersion: parsed.version });
    return { ok: true, migrated: legacyRaw !== null, sizeBytes: raw.length };
  }

  private isJson(raw: string): boolean {
    try {
      JSON.parse(raw);
      return true;
    } catch {
      return false;
    }
  }

  exportString(): string {
    return this.serialize();
  }

  importString(payload: string): { sizeBytes: number } | null {
    const parsed = this.parse(payload);
    if (!parsed) return null;
    // Explicit import restores a snapshot now; elapsed time before export is not credited.
    this.source.applyState(parsed, 0);
    this.save();
    this.deps.bus.emit('game:loaded', { saveVersion: parsed.version });
    return { sizeBytes: payload.length };
  }

  startAutosave(): void {
    if (this.autosaveTimer) return;
    const ms = this.deps.autosaveMs ?? 30000;
    if (ms <= 0) return;
    this.autosaveTimer = setInterval(() => this.save(), ms);
  }

  stopAutosave(): void {
    if (this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
      this.autosaveTimer = null;
    }
  }
}
