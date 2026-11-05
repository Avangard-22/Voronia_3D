import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const appSource = readFileSync(resolve(process.cwd(), 'src/ui/app.ts'), 'utf8');
const mainSource = readFileSync(resolve(process.cwd(), 'src/main.ts'), 'utf8');
const styleSource = readFileSync(resolve(process.cwd(), 'src/ui/styles.ts'), 'utf8');

describe('Stage 9.10 planet-first interface', () => {
  it('promotes the planet renderer to a full-viewport background layer', () => {
    expect(mainSource).toContain("root.classList.add('game-mode')");
    expect(styleSource).toContain('#app.game-mode .scene3d:not(.title-backdrop)');
    expect(styleSource).toContain('position:fixed; inset:0; z-index:0; width:100vw; height:100dvh');
  });

  it('places HUD, scene switching and cell actions above the planet', () => {
    expect(styleSource).toContain('#app.game-mode #game-hud { position:fixed');
    expect(styleSource).toContain('#app.game-mode .scene-switch {');
    expect(styleSource).toContain('#app.game-mode .cell-dock {');
    expect(styleSource).toContain('#app.game-mode .legacy-bottom-nav { z-index:60');
  });

  it('keeps the title logo on one line and uses the compact wordmark', () => {
    expect(mainSource).toContain('<div class="title-logo">VORONIA</div>');
    expect(styleSource).toContain('white-space:nowrap');
  });

  it('patches existing UI nodes to avoid periodic panel rebuilds and scroll jumps', () => {
    expect(appSource).toContain('function patchDomNode(');
    expect(appSource).toContain('patchDom(root, templateRoot.innerHTML)');
    expect(appSource).toContain('patchDom(root, markup)');
    expect(appSource).not.toContain('root.innerHTML = cell');
  });
});
