import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const appSource = readFileSync(resolve(process.cwd(), 'src/ui/app.ts'), 'utf8');
const styleSource = readFileSync(resolve(process.cwd(), 'src/ui/styles.ts'), 'utf8');

describe('Stage 9.8 legacy UI parity and interaction polish', () => {
  it('exposes accessible tab semantics and linked panels for all four legacy sections', () => {
    for (const tab of ['planet', 'galaxy', 'science', 'meta']) {
      expect(appSource).toContain(`id="nav-tab-${tab}"`);
      expect(appSource).toContain('section.id = `nav-panel-${key}`');
    }
    expect(appSource).toContain('role="tablist"');
    expect(appSource).toContain("setAttribute('aria-selected', String(selected))");
  });

  it('supports keyboard navigation and synchronizes the fullscreen control state', () => {
    expect(appSource).toContain("event.key === 'ArrowRight'");
    expect(appSource).toContain("event.key === 'ArrowLeft'");
    expect(appSource).toContain("event.key === 'Home'");
    expect(appSource).toContain("event.key === 'End'");
    expect(appSource).toContain("document.addEventListener('fullscreenchange'");
    expect(appSource).toContain("button.setAttribute('aria-pressed', String(active))");
  });

  it('keeps reduced-motion support and adds visible active/focus feedback', () => {
    expect(styleSource).toContain('.legacy-bottom-nav button.active::before');
    expect(styleSource).toContain('.hud-quick-actions button[aria-pressed="true"]');
    expect(styleSource).toContain('@media(prefers-reduced-motion:reduce)');
    expect(styleSource).toContain('.legacy-nav-panel[hidden]');
  });
});
