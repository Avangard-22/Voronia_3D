/**
 * persistence/storage.ts — StoragePort-адаптеры: Memory (тесты/SSR) и LocalStorage (браузер).
 * Ключ 2.0 — свой (voronia2.save.v2); legacy-ключ 1.x (cosmicClickerV19) читается ТОЛЬКО для миграции.
 */
import type { StoragePort } from '../contracts/ports';

export const SAVE_KEY = 'voronia2.save.v2';
export const LEGACY_SAVE_KEY = 'cosmicClickerV19';

export class MemoryStorage implements StoragePort {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  keys(): string[] {
    return [...this.map.keys()];
  }
}

export class LocalStorageAdapter implements StoragePort {
  constructor(private readonly storage: Storage) {}

  static create(): LocalStorageAdapter | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      return new LocalStorageAdapter(localStorage);
    } catch {
      return null;
    }
  }

  getItem(key: string): string | null {
    try {
      return this.storage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      this.storage.setItem(key, value);
    } catch {
      /* квота/приватный режим — молча (autosave не критичен) */
    }
  }

  removeItem(key: string): void {
    try {
      this.storage.removeItem(key);
    } catch {
      /* noop */
    }
  }

  keys(): string[] {
    try {
      const out: string[] = [];
      for (let i = 0; i < this.storage.length; i++) {
        const k = this.storage.key(i);
        if (k) out.push(k);
      }
      return out;
    } catch {
      return [];
    }
  }
}
