/**
 * tests/stage9_3_reactor.test.ts — Этап 9.3 (Этап 8 ТЗ): реактор и крафт.
 *
 * ТЗ §6: «Реактор в покое…» при пустой очереди; явные правила списания (входы —
 * одна атомарная транзакция на старте run; дефицит ставит run на паузу без потери
 * прогресса; выход — атомарно по завершении); очередь и прогресс сохраняются;
 * UI не «прыгает» при смене рецепта (рендер из снапшота).
 */
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { makeGame, grant, advance } from './helpers';
import { RECIPE_GATE, Reactor } from '../src/crafting/reactor';
import { RESEARCH_BY_ID } from '../src/progression/techTree';
import { renderSnapshot } from '../src/ui/app';
import type { Game } from '../src/core/game';

const unlock = (game: Game, id: string): void => {
  game.tech.setResearch(id, 1);
};

describe('Этап 9.3 — реактор: снапшот и гейты', () => {
  it('свежая игра: idle, пустая очередь, 1 слот, 11 рецептов registry.craft', () => {
    const { game } = makeGame();
    const r = game.snapshot().reactor;
    expect(r.idle).toBe(true);
    expect(r.queue).toEqual([]);
    expect(r.slots).toBe(1);
    expect(r.recipes.length).toBe(11);
    const steel = r.recipes.find((x) => x.id === 'steel')!;
    expect(steel.gate).toBe('recipe_steel');
    expect(steel.unlocked).toBe(false);
    expect(steel.timeSec).toBe(30);
    expect(steel.inputs).toEqual({ carbon: 10, energy: 1000 });
    expect(steel.output).toEqual({ steel: 1 });
  });

  it('выходы рецептов: dataGain → research, resGain → ресурс, иначе 1 единица соединения', () => {
    const { game } = makeGame();
    const r = game.snapshot().reactor;
    expect(r.recipes.find((x) => x.id === 'researchData')!.output).toEqual({ research: 2500 });
    expect(r.recipes.find((x) => x.id === 'researchDataBulk')!.output).toEqual({ research: 1800 });
    expect(r.recipes.find((x) => x.id === 'helium3')!.output).toEqual({ helium3: 50 });
    expect(r.recipes.find((x) => x.id === 'chip')!.output).toEqual({ chip: 1 });
    expect(r.recipes.find((x) => x.id === 'relic')!.output).toEqual({ relic: 1 });
  });

  it('каждый гейт RECIPE_GATE — существующий узел дерева (целостность crafting↔progression)', () => {
    for (const [recipe, gate] of Object.entries(RECIPE_GATE)) {
      expect(RESEARCH_BY_ID[gate], `гейт ${recipe} ← ${gate}`).toBeDefined();
    }
  });

  it('закрытый рецепт → locked (detail с id исследования); после исследования — можно', () => {
    const { game } = makeGame();
    const res = game.dispatch('craftEnqueue', { recipeId: 'steel' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe('locked');
      expect(res.detail ?? '').toContain('recipe_steel');
    }
    unlock(game, 'recipe_steel');
    expect(game.snapshot().reactor.recipes.find((x) => x.id === 'steel')!.unlocked).toBe(true);
    expect(game.dispatch('craftEnqueue', { recipeId: 'steel' }).ok).toBe(true);
  });

  it('неизвестный рецепт → unknown-recipe; отмена несуществующей задачи → unknown-job', () => {
    const { game } = makeGame();
    const r1 = game.dispatch('craftEnqueue', { recipeId: 'unobtainium' });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.reason).toBe('unknown-recipe');
    const r2 = game.dispatch('craftCancel', { jobId: 777 });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toBe('unknown-job');
  });
});

describe('Этап 9.3 — реактор: цикл run (время, списания, выходы)', () => {
  it('2 run стали: входы списаны по старту каждого run, выход начислен, очередь пуста', () => {
    const { game } = makeGame();
    unlock(game, 'recipe_steel');
    grant(game, { carbon: 20, energy: 2000 });
    const res = game.dispatch('craftEnqueue', { recipeId: 'steel', runs: 2 });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.queueLength).toBe(1);
    advance(game, 120, 500); // 60 с = 2 × 30 с
    const s = game.snapshot();
    expect(s.resources['steel']).toBe(2);
    expect(s.reactor.idle).toBe(true);
    expect(s.reactor.queue).toEqual([]);
    // атомарность: 2 транзакции списания входов + транзакции выхода
    // (полный журнал ledger — снапшотный journal ограничен последней сотней записей)
    const tx = game.ledger.journal();
    expect(tx.filter((t) => t.reason === 'reactor:steel').length).toBe(2);
    for (const t of tx.filter((x) => x.reason === 'reactor:steel')) {
      expect(t.delta['carbon']).toBe(-10);
      expect(t.delta['energy']).toBe(-1000);
    }
    const outputs = tx.filter((t) => t.reason === 'reactor:output');
    expect(outputs.length).toBeGreaterThanOrEqual(1);
    expect(outputs.reduce((acc, t) => acc + (t.delta['steel'] ?? 0), 0)).toBe(2);
  });

  it('дефицит: run встаёт на паузу (state=deficit, прогресс 0), после довнесения — завершается', () => {
    const { game } = makeGame();
    unlock(game, 'recipe_steel');
    grant(game, { carbon: 10, energy: 1000 }); // ровно один run
    expect(game.dispatch('craftEnqueue', { recipeId: 'steel', runs: 2 }).ok).toBe(true);
    advance(game, 70, 500); // 35 с: run 1 завершён, run 2 — дефицит
    let s = game.snapshot();
    expect(s.resources['steel']).toBe(1);
    const job = s.reactor.queue[0]!;
    expect(job.state).toBe('deficit');
    expect(job.done).toBe(1);
    expect(job.progressPct).toBe(0);
    expect(job.etaSec).toBeNull();
    // прогресс стоит, пока дефицит
    advance(game, 40, 500);
    s = game.snapshot();
    expect(s.reactor.queue[0]!.state).toBe('deficit');
    expect(s.reactor.queue[0]!.done).toBe(1);
    // довнесение — run стартует и завершается
    grant(game, { carbon: 10, energy: 1000 });
    advance(game, 60, 500); // 30 с
    s = game.snapshot();
    expect(s.resources['steel']).toBe(2);
    expect(s.reactor.idle).toBe(true);
  });

  it('etaSec — маленькое число (секунды до готовности), никаких эпохальных величин', () => {
    const { game } = makeGame();
    unlock(game, 'recipe_steel');
    grant(game, { carbon: 10, energy: 1000 });
    game.dispatch('craftEnqueue', { recipeId: 'steel', runs: 1 });
    advance(game, 10, 500); // 5 с из 30
    const job = game.snapshot().reactor.queue[0]!;
    expect(job.state).toBe('running');
    expect(job.etaSec).toBe(25);
    expect(job.progressPct).toBeCloseTo((5 / 30) * 100, 6);
  });

  it('researchData: выход — research (dataGain) одной транзакцией', () => {
    const { game } = makeGame();
    unlock(game, 'recipe_datablock');
    grant(game, { energy: 200_000, silicon: 50_000, carbon: 50_000, steel: 1_000 });
    expect(game.dispatch('craftEnqueue', { recipeId: 'researchData', runs: 1 }).ok).toBe(true);
    advance(game, 40, 500); // 20 с
    const out = game.ledger.journal().filter((t) => t.reason === 'reactor:output');
    expect(out.length).toBe(1);
    expect(out[0]!.delta['research']).toBe(2500);
  });

  it('runs по умолчанию = 1; дробные runs flooring', () => {
    const { game } = makeGame();
    unlock(game, 'recipe_steel');
    const r1 = game.dispatch('craftEnqueue', { recipeId: 'steel' });
    expect(r1.ok).toBe(true);
    expect(game.snapshot().reactor.queue[0]!.runs).toBe(1);
    const r2 = game.dispatch('craftEnqueue', { recipeId: 'steel', runs: 2.7 });
    expect(r2.ok).toBe(true);
    expect(game.snapshot().reactor.queue[1]!.runs).toBe(2);
  });

  it('runs < 1 → отказ (state), очередь не меняется', () => {
    const { game } = makeGame();
    unlock(game, 'recipe_steel');
    const res = game.dispatch('craftEnqueue', { recipeId: 'steel', runs: 0 });
    expect(res.ok).toBe(false);
    expect(game.snapshot().reactor.queue).toEqual([]);
  });
});

describe('Этап 9.3 — реактор: отмена и лимит очереди', () => {
  it('отмена до старта: снимаются все run', () => {
    const { game } = makeGame();
    unlock(game, 'recipe_steel');
    const res = game.dispatch('craftEnqueue', { recipeId: 'steel', runs: 3 });
    expect(res.ok).toBe(true);
    let jobId = -1;
    if (res.ok) jobId = res.value.jobId;
    const c = game.dispatch('craftCancel', { jobId });
    expect(c.ok).toBe(true);
    if (c.ok) expect(c.value.removedRuns).toBe(3);
    expect(game.snapshot().reactor.idle).toBe(true);
  });

  it('отмена после старта: текущий оплаченный run невозвратен, остальные снимаются', () => {
    const { game } = makeGame();
    unlock(game, 'recipe_steel');
    grant(game, { carbon: 100, energy: 10_000 });
    const res = game.dispatch('craftEnqueue', { recipeId: 'steel', runs: 3 });
    let jobId = -1;
    if (res.ok) jobId = res.value.jobId;
    advance(game, 2, 500); // run 1 оплачен и идёт
    const c = game.dispatch('craftCancel', { jobId });
    expect(c.ok).toBe(true);
    if (c.ok) expect(c.value.removedRuns).toBe(2); // 3 − 0 завершённых − 1 оплаченный текущий
    expect(game.snapshot().reactor.idle).toBe(true);
    // вход за текущий run уже списан атомарно — не возвращаем
    const paid = game.ledger.journal().filter((t) => t.reason === 'reactor:steel');
    expect(paid.length).toBe(1);
  });

  it('лимит очереди queueCapBase=50 → queue-full', () => {
    const { game } = makeGame();
    unlock(game, 'recipe_steel');
    for (let i = 0; i < 50; i++) {
      expect(game.dispatch('craftEnqueue', { recipeId: 'steel', runs: 1 }).ok).toBe(true);
    }
    const res = game.dispatch('craftEnqueue', { recipeId: 'steel', runs: 1 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('queue-full');
    expect(game.snapshot().reactor.queue.length).toBe(50);
  });
});

describe('Этап 9.3 — реактор: персистентность (ТЗ §6)', () => {
  it('export→import сохраняет очередь, прогресс run и nextJobId; крафт продолжается', () => {
    const { game } = makeGame();
    unlock(game, 'recipe_steel');
    grant(game, { carbon: 100, energy: 10_000 });
    expect(game.dispatch('craftEnqueue', { recipeId: 'steel', runs: 4 }).ok).toBe(true);
    advance(game, 30, 500); // 15 с — половина первого run
    const src = game.snapshot().reactor.queue[0]!;
    expect(src.progressPct).toBeCloseTo(50, 6);

    const exp = game.dispatch('exportSave', {});
    expect(exp.ok).toBe(true);
    let payload = '';
    if (exp.ok) payload = exp.value.payload;

    const { game: g2 } = makeGame();
    expect(g2.dispatch('importSave', { payload }).ok).toBe(true);
    const q2 = g2.snapshot().reactor.queue;
    expect(q2.length).toBe(1);
    expect(q2[0]!.recipeId).toBe('steel');
    expect(q2[0]!.runs).toBe(4);
    expect(q2[0]!.done).toBe(0);
    expect(q2[0]!.progressPct).toBeCloseTo(50, 6);

    // вторая игра доваривает очередь (входы из сейва уже частично потрачены — довносим)
    grant(g2, { carbon: 100, energy: 20_000 });
    advance(g2, 240, 500); // 120 с ≥ 15 + 3×30
    expect(g2.snapshot().resources['steel']).toBe(4);
    expect(g2.snapshot().reactor.idle).toBe(true);
  });

  it('hydrate отбрасывает задачи неизвестных рецептов и завершённые', () => {
    const { game } = makeGame();
    game.reactor.hydrate({
      jobs: [
        { id: 5, recipeId: 'unobtainium', runs: 1, done: 0, progressMs: 0, paidForCurrent: false },
        { id: 6, recipeId: 'steel', runs: 2, done: 2, progressMs: 0, paidForCurrent: false },
        { id: 7, recipeId: 'steel', runs: 3, done: 1, progressMs: 12_000, paidForCurrent: true },
      ],
      nextJobId: 9,
    });
    const v = game.reactor.view();
    expect(v.queue.length).toBe(1);
    expect(v.queue[0]!.id).toBe(7);
    expect(v.queue[0]!.done).toBe(1);
    // nextJobId продолжается
    unlock(game, 'recipe_steel');
    const res = game.dispatch('craftEnqueue', { recipeId: 'steel', runs: 1 });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.jobId).toBe(9);
  });

  it('newGame очищает очередь реактора', () => {
    const { game } = makeGame();
    unlock(game, 'recipe_steel');
    game.dispatch('craftEnqueue', { recipeId: 'steel', runs: 2 });
    expect(game.snapshot().reactor.queue.length).toBe(1);
    game.dispatch('newGame', { seed: 42 });
    expect(game.snapshot().reactor.idle).toBe(true);
    expect(game.tech.hasResearch('recipe_steel')).toBe(false);
  });
});

describe('Этап 9.3 — реактор в UI (ТЗ §6: «Реактор в покое…», без скачков)', () => {
  const fakeRoot = (): HTMLElement => document.createElement('div');

  it('idle: точный текст «Реактор в покое…», панели технологий и реактора на месте', () => {
    const { game } = makeGame();
    const root = fakeRoot();
    renderSnapshot(game, root as unknown as HTMLElement);
    expect(root.innerHTML).toContain('Реактор в покое…');
    expect(root.innerHTML).toContain('🔬 Технологии');
    expect(root.innerHTML).toContain('🏭 Реактор');
    expect(root.innerHTML).toContain('data-act="buy-tech"');
    // закрытый рецепт показывает замок, а не кнопку
    expect(root.innerHTML).not.toContain('data-recipe="steel"');
  });

  it('очередь: рецепт, прогресс-бар, отмена; idle-текст исчезает', () => {
    const { game } = makeGame();
    unlock(game, 'recipe_steel');
    grant(game, { carbon: 10, energy: 1000 });
    game.dispatch('craftEnqueue', { recipeId: 'steel', runs: 1 });
    advance(game, 10, 500);
    const root = fakeRoot();
    renderSnapshot(game, root as unknown as HTMLElement);
    expect(root.innerHTML).not.toContain('Реактор в покое…');
    expect(root.innerHTML).toContain('Сталь');
    expect(root.innerHTML).toContain('craft-bar');
    expect(root.innerHTML).toContain('data-act="craft-cancel"');
    expect(root.innerHTML).toContain('⏳');
    // время — маленькие секунды run, не эпоха
    expect(root.innerHTML).not.toMatch(/⏳ ~\d{7,}/);
  });

  it('дефицит подсвечен в UI', () => {
    const { game } = makeGame();
    unlock(game, 'recipe_steel');
    game.dispatch('craftEnqueue', { recipeId: 'steel', runs: 1 });
    advance(game, 4, 500); // оплата не прошла (нет carbon/energy) → дефицит
    const root = fakeRoot();
    renderSnapshot(game, root as unknown as HTMLElement);
    expect(root.innerHTML).toContain('Дефицит ресурсов');
  });

  it('рендер стабилен при смене содержимого очереди (нет «прыжков» структуры — ТЗ §6)', () => {
    const { game } = makeGame();
    unlock(game, 'recipe_steel');
    unlock(game, 'recipe_datablock');
    const root = fakeRoot();
    renderSnapshot(game, root as unknown as HTMLElement);
    const panelsBefore = (root.innerHTML.match(/<h2>/g) ?? []).length;
    grant(game, { carbon: 10, energy: 200_000, silicon: 50_000, steel: 1_000 });
    game.dispatch('craftEnqueue', { recipeId: 'steel', runs: 1 });
    renderSnapshot(game, root as unknown as HTMLElement);
    const panelsAfter = (root.innerHTML.match(/<h2>/g) ?? []).length;
    expect(panelsAfter).toBe(panelsBefore);
  });
});

describe('Этап 9.3 — Reactor unit: слоты и лимиты из registry.craft', () => {
  it('slots() = baseSlots (1), queueCap = queueCapBase (50)', () => {
    const { game } = makeGame();
    expect(game.reactor.slots()).toBe(1);
    // приватный queueCap наблюдаем через поведение (тест лимита выше) и view.slots
    expect(game.reactor.view().slots).toBe(1);
  });

  it('Reactor переносит пустую/битую секцию craft (защитные дефолты)', () => {
    const { game } = makeGame();
    const noopTech = game.tech;
    const r = new Reactor({}, {}, noopTech, game.ledger, () => 0);
    expect(r.slots()).toBe(1);
    expect(r.recipeIds()).toEqual([]);
    expect(r.view().idle).toBe(true);
    expect(r.tick(1000).completed).toBe(0);
  });
});
