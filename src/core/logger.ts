/**
 * core/Logger.ts — уровни, кольцевой буфер, sinks (STAGE1 §1).
 */
import type { LogLevel, LogSink } from '../contracts/ports';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface LogEntry {
  readonly at: number;
  readonly level: LogLevel;
  readonly scope: string;
  readonly message: string;
  readonly data?: unknown;
}

export class Logger {
  private readonly buffer: LogEntry[] = [];
  private readonly sinks: LogSink[] = [];

  constructor(
    private level: LogLevel = 'info',
    private readonly cap = 200,
  ) {}

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  addSink(sink: LogSink): void {
    this.sinks.push(sink);
  }

  private write(level: LogLevel, scope: string, message: string, data?: unknown): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.level]) return;
    const entry: LogEntry = { at: Date.now(), level, scope, message, data };
    this.buffer.push(entry);
    while (this.buffer.length > this.cap) this.buffer.shift();
    for (const sink of this.sinks) {
      try {
        sink.write(level, scope, message, data);
      } catch {
        // sink не должен ронять игру
      }
    }
  }

  debug(scope: string, message: string, data?: unknown): void {
    this.write('debug', scope, message, data);
  }
  info(scope: string, message: string, data?: unknown): void {
    this.write('info', scope, message, data);
  }
  warn(scope: string, message: string, data?: unknown): void {
    this.write('warn', scope, message, data);
  }
  error(scope: string, message: string, data?: unknown): void {
    this.write('error', scope, message, data);
  }

  entries(): readonly LogEntry[] {
    return this.buffer;
  }
}

export const consoleSink: LogSink = {
  write(level, scope, message) {
    if (level === 'error') console.error(`[${scope}] ${message}`);
    else if (level === 'warn') console.warn(`[${scope}] ${message}`);
  },
};
