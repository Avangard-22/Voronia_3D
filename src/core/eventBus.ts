/**
 * core/EventBus.ts — типизированная шина (STAGE1 §1: payload GameEventMap, изоляция ошибок обработчиков,
 * кольцевая история cap из registry bus.historyCap=50).
 */
import type { BusHistoryEntry, GameEventMap, GameEventName, EventHandler, Unsubscribe } from '../contracts/events';
import type { Logger } from './logger';

export interface EventBusOptions {
  readonly historyCap: number;
  readonly logger?: Logger;
  readonly now?: () => number;
}

export class EventBus {
  private readonly handlers = new Map<GameEventName, Set<EventHandler<GameEventName>>>();
  private readonly history: BusHistoryEntry[] = [];
  private readonly historyCap: number;
  private readonly logger: Logger | undefined;
  private readonly now: () => number;

  constructor(opts: EventBusOptions) {
    this.historyCap = opts.historyCap;
    this.logger = opts.logger;
    this.now = opts.now ?? (() => Date.now());
  }

  on<E extends GameEventName>(event: E, handler: EventHandler<E>): Unsubscribe {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as EventHandler<GameEventName>);
    return () => this.off(event, handler);
  }

  once<E extends GameEventName>(event: E, handler: EventHandler<E>): Unsubscribe {
    const off = this.on(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off<E extends GameEventName>(event: E, handler: EventHandler<E>): void {
    this.handlers.get(event)?.delete(handler as EventHandler<GameEventName>);
  }

  emit<E extends GameEventName>(event: E, payload: GameEventMap[E]): void {
    this.history.push({ type: event, at: this.now(), detail: payload });
    while (this.history.length > this.historyCap) this.history.shift();
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        (handler as EventHandler<E>)(payload);
      } catch (err) {
        // изоляция ошибок обработчиков: одна упавшая подписка не рвёт эмиссию
        this.logger?.warn('bus', `обработчик ${event} упал`, { err: String(err) });
      }
    }
  }

  getHistory(): readonly BusHistoryEntry[] {
    return this.history;
  }

  clear(): void {
    this.handlers.clear();
    this.history.length = 0;
  }
}
