import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const appSource = readFileSync(resolve(process.cwd(), 'src/ui/app.ts'), 'utf8');
const styleSource = readFileSync(resolve(process.cwd(), 'src/ui/styles.ts'), 'utf8');

describe('Stage 9.9 interface reconstruction', () => {
  it('removes the transaction journal from every visible UI entry point', () => {
    expect(appSource).not.toContain('Журнал транзакций');
    expect(appSource).not.toContain('data-modal-open="journal"');
    expect(appSource).not.toContain("kind === 'journal'");
    expect(appSource).not.toContain('journalRows');
    expect(styleSource).not.toContain('.journal {');
    expect(styleSource).not.toContain('.tx {');
  });

  it('preserves the transaction ledger as domain state rather than rendering it', () => {
    expect(appSource).toContain('game.snapshot()');
    expect(appSource).not.toContain('s.journal');
  });

  it('keeps the four primary legacy navigation destinations', () => {
    for (const tab of ['planet', 'galaxy', 'science', 'meta']) {
      expect(appSource).toContain(`data-nav-tab="${tab}"`);
    }
  });
});
