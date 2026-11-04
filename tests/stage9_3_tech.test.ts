/**
 * tests/stage9_3_tech.test.ts — Этап 9.3 (Этап 7 ТЗ): дерево исследований.
 *
 * ТЗ Этап 7: «граф технологий: prerequisites / cost / effects / unlocks; эффекты —
 * типизированные модификаторы; каждый unlock тестируется». Проверяем:
 *  - целостность графа (все prereq существуют, нет-self-cycle, maxLevel);
 *  - стоимости многоуровневых технологий — parity registry.tech.costScaleTable + поздний рост ×1.35;
 *  - команды buyTech: unknown / locked / cost / max / успех со списанием и счётчиком сессии;
 *  - каждый RESOURCE_UNLOCK-unlock открывается индивидуально;
 *  - типизированные модификаторы: yieldMult, veinCooldownMult, veinYieldMult, scanCostMult, cellMaxLevelBonus.
 */
import { describe, it, expect } from 'vitest';
import { makeGame, grant } from './helpers';
import { loadBalance } from '../src/config/loader';
import {
  RESEARCH_DEFS,
  RESEARCH_BY_ID,
  RESEARCH_NAMES,
  RESEARCH_POLICY,
  LEVEL_TECH_MAX,
  levelTechCost,
  researchCost,
  techNodes,
} from '../src/progression/techTree';
import { RESOURCE_UNLOCK } from '../src/contracts/tech';
import { TechState } from '../src/progression/tech';

const section = loadBalance().registry.tech;
const mk = (): TechState => new TechState(section);

describe('Этап 9.3 — целостность дерева исследований (Этап 7 ТЗ)', () => {
  it('все prereq-связи указывают на существующие узлы; узел не требует сам себя', () => {
    for (const def of RESEARCH_DEFS) {
      for (const p of def.prereq) {
        expect(RESEARCH_BY_ID[p], `prereq ${p} для ${def.id}`).toBeDefined();
        expect(p).not.toBe(def.id);
      }
    }
  });

  it('все имена v1 (RESEARCH_NAMES) входят в дерево', () => {
    for (const id of Object.keys(RESEARCH_NAMES)) {
      expect(RESEARCH_BY_ID[id], `узел ${id}`).toBeDefined();
    }
    // 8 level-технологий (LEVEL_TECH_IDS) + все unlock-исследования v1
    expect(RESEARCH_DEFS.length).toBeGreaterThanOrEqual(Object.keys(RESEARCH_NAMES).length + 8);
  });

  it('каждое исследование из RESOURCE_UNLOCK присутствует в дереве', () => {
    for (const [res, req] of Object.entries(RESOURCE_UNLOCK)) {
      if (req) expect(RESEARCH_BY_ID[req], `unlock ${res} ← ${req}`).toBeDefined();
    }
  });

  it('kind/maxLevel: level-технологии до LEVEL_TECH_MAX, unlock — одноразовые; у всех есть имя', () => {
    for (const def of RESEARCH_DEFS) {
      expect(def.name.length).toBeGreaterThan(0);
      expect(typeof def.desc).toBe('string');
      if (def.kind === 'level') expect(def.maxLevel).toBe(LEVEL_TECH_MAX);
      else expect(def.maxLevel).toBe(1);
    }
  });

  it('id уникальны', () => {
    expect(new Set(RESEARCH_DEFS.map((d) => d.id)).size).toBe(RESEARCH_DEFS.length);
  });
});

describe('Этап 9.3 — стоимости (parity v0.0.41)', () => {
  it('уровень 0 — первая строка costScaleTable, ключи e/i/k/c → ledger-ключи', () => {
    expect(levelTechCost(section, 'ironBoost', 0)).toEqual({ energy: 500, iron: 100 });
    expect(levelTechCost(section, 'ironBoost', 1)).toEqual({ energy: 2500, iron: 300 });
  });

  it('после последней строки таблицы — поздний рост ×lateGrowth за уровень', () => {
    const table = section.costScaleTable['ironBoost']!;
    const last = table[table.length - 1]!;
    const growth = section.costCurveLate.lateGrowth;
    const lvl = table.length; // первая строка «за таблицей»
    const cost = levelTechCost(section, 'ironBoost', lvl);
    for (const [key, alias] of Object.entries({ energy: 'e', iron: 'i' })) {
      const base = last[alias];
      if (base !== undefined) expect(cost[key as keyof typeof cost]).toBe(Math.ceil(base * growth));
    }
  });

  it('unlock-исследования — цены единого балансного блока RESEARCH_POLICY (ТЗ §15)', () => {
    expect(researchCost(section, 'unlock_kriogenBoost', 0)).toEqual({ research: 600 });
    expect(researchCost(section, 'unlock_recon', 0)).toEqual(RESEARCH_POLICY.unlockCosts['unlock_recon']);
    expect(researchCost(section, 'recipe_steel', 0)).toEqual({ research: 1500 });
  });

  it('цена не зависит от уровня для unlock и растёт по таблице для level', () => {
    expect(researchCost(section, 'unlock_carbon', 0)).toEqual(researchCost(section, 'unlock_carbon', 5));
    const sum = (x: Readonly<Record<string, number>>): number =>
      Object.values(x).reduce((acc, v) => acc + (v ?? 0), 0);
    const a = levelTechCost(section, 'crystalBoost', 0);
    const b = levelTechCost(section, 'crystalBoost', 3);
    expect(sum(a)).toBeLessThan(sum(b));
  });
});

describe('Этап 9.3 — команда buyTech', () => {
  it('неизвестное исследование → unknown-tech', () => {
    const { game } = makeGame();
    const res = game.dispatch('buyTech', { id: 'nope' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('unknown-tech');
  });

  it('не выполнен prerequisite → locked (kriogenBoost требует «Криогеника»)', () => {
    const { game } = makeGame();
    grant(game, { energy: 1e6, iron: 1e6, research: 1e6 });
    const res = game.dispatch('buyTech', { id: 'kriogenBoost' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('locked');
  });

  it('недостаточно ресурсов → cost, баланс не меняется', () => {
    const { game } = makeGame();
    const before = game.snapshot().resources['research'] ?? 0;
    const res = game.dispatch('buyTech', { id: 'unlock_kriogenBoost' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('cost');
    expect(game.snapshot().resources['research'] ?? 0).toBe(before);
    expect(game.tech.hasResearch('unlock_kriogenBoost')).toBe(false);
  });

  it('успех: атомарное списание, уровень +1, ресурс открыт, счётчик сессии, prereq-ветка открыта', () => {
    const { game } = makeGame();
    grant(game, { research: 600 });
    const before = game.snapshot().resources['research'] ?? 0;
    const res = game.dispatch('buyTech', { id: 'unlock_kriogenBoost' });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toEqual({ techId: 'unlock_kriogenBoost', level: 1 });
    expect(game.snapshot().resources['research'] ?? 0).toBeCloseTo(before - 600, 6);
    expect(game.tech.hasResearch('unlock_kriogenBoost')).toBe(true);
    expect(game.tech.isUnlocked('kriogen')).toBe(true);
    expect(game.snapshot().session.techsBought).toBe(1);
    // ветка kriogenBoost теперь не locked (может быть cost — ресурсов нет, но не locked)
    const next = game.dispatch('buyTech', { id: 'kriogenBoost' });
    if (!next.ok) expect(next.reason).not.toBe('locked');
    // транзакция в журнале — одна, атомарная
    expect(game.snapshot().journal.some((tx) => tx.reason === 'tech:unlock_kriogenBoost')).toBe(true);
  });

  it('одноразовое исследование повторно → max', () => {
    const { game } = makeGame();
    grant(game, { research: 5000 });
    expect(game.dispatch('buyTech', { id: 'unlock_kriogenBoost' }).ok).toBe(true);
    const res = game.dispatch('buyTech', { id: 'unlock_kriogenBoost' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('max');
    expect(game.tech.level('unlock_kriogenBoost')).toBe(1);
  });

  it('многоуровневая технология: каждый уровень списывает свою строку таблицы', () => {
    const { game } = makeGame();
    grant(game, { energy: 100_000, iron: 100_000 });
    const energy0 = game.snapshot().resources['energy'] ?? 0;
    expect(game.dispatch('buyTech', { id: 'ironBoost' }).ok).toBe(true); // 500e/100i
    expect(game.tech.level('ironBoost')).toBe(1);
    expect(game.dispatch('buyTech', { id: 'ironBoost' }).ok).toBe(true); // 2500e/300i
    expect(game.tech.level('ironBoost')).toBe(2);
    const energy2 = game.snapshot().resources['energy'] ?? 0;
    expect(energy0 - energy2).toBe(3000);
  });

  it('costScale зеркалится в legacy TechLevels — costScaleMult (v1 Gk) меняется', () => {
    const { game } = makeGame();
    const before = game.tech.costScaleMult();
    grant(game, { energy: 1e9, iron: 1e9, kriogen: 1e9, crystals: 1e9, research: 1e9 });
    expect(game.dispatch('buyTech', { id: 'costScale' }).ok).toBe(true);
    expect(game.tech.level('costScale')).toBe(1);
    expect(game.tech.techLevels().costScale).toBe(1);
    expect(game.tech.costScaleMult()).not.toBe(before);
  });
});

describe('Этап 9.3 — типизированные модификаторы (effects)', () => {
  it('boost-технологии: +25% дохода за уровень (iron/crystal/kriogen)', () => {
    const t = mk();
    expect(t.yieldMult('iron')).toBe(1);
    t.setResearch('ironBoost', 2);
    expect(t.yieldMult('iron')).toBeCloseTo(1.5, 9);
    t.setResearch('crystalBoost', 1);
    expect(t.yieldMult('crystal')).toBeCloseTo(1.25, 9);
    t.setResearch('kriogenBoost', 4);
    expect(t.yieldMult('kriogen')).toBeCloseTo(2, 9);
  });

  it('therm: −10% кулдауна жил за уровень, пол 0.4', () => {
    const t = mk();
    expect(t.veinCooldownMult()).toBe(1);
    t.setResearch('therm', 1);
    expect(t.veinCooldownMult()).toBeCloseTo(0.9, 9);
    t.setResearch('therm', 3);
    expect(t.veinCooldownMult()).toBeCloseTo(0.729, 9);
    t.setResearch('therm', 50);
    expect(t.veinCooldownMult()).toBeCloseTo(RESEARCH_POLICY.effects.thermCooldownFloor, 9);
  });

  it('hyperdrill: +20% дохода жил за уровень', () => {
    const t = mk();
    expect(t.veinYieldMult()).toBe(1);
    t.setResearch('hyperdrill', 3);
    expect(t.veinYieldMult()).toBeCloseTo(1.6, 9);
  });

  it('recon: −5% цены скана за уровень, пол 0.5', () => {
    const t = mk();
    expect(t.scanCostMult()).toBe(1);
    t.setResearch('recon', 1);
    expect(t.scanCostMult()).toBeCloseTo(0.95, 9);
    t.setResearch('recon', 40);
    expect(t.scanCostMult()).toBeCloseTo(RESEARCH_POLICY.effects.reconScanFloor, 9);
  });

  it('maxLevel: +1 к потолку уровня клетки за уровень', () => {
    const t = mk();
    expect(t.cellMaxLevelBonus()).toBe(0);
    t.setResearch('maxLevel', 3);
    expect(t.cellMaxLevelBonus()).toBe(3);
  });

  it('каждый unlock RESOURCE_UNLOCK открывает свой ресурс — индивидуально (Этап 7 ТЗ)', () => {
    for (const [res, req] of Object.entries(RESOURCE_UNLOCK)) {
      if (!req) continue;
      const t = mk();
      expect(t.isUnlocked(res), `${res} закрыт до исследования`).toBe(false);
      t.setResearch(req, 1);
      expect(t.isUnlocked(res), `${res} открыт после ${req}`).toBe(true);
    }
    expect(mk().isUnlocked('iron')).toBe(true); // железо открыто всегда (1.x Kt)
  });

  it('интеграция: recon реально снижает цену скана в снапшоте', () => {
    const { game } = makeGame();
    const before = game.snapshot().scan.charge;
    grant(game, { research: 1e6, energy: 1e6, iron: 1e6, kriogen: 1e6, crystals: 1e6 });
    expect(game.dispatch('buyTech', { id: 'unlock_recon' }).ok).toBe(true);
    expect(game.dispatch('buyTech', { id: 'recon' }).ok).toBe(true);
    expect(game.snapshot().scan.charge).toBeLessThan(before);
  });

  it('интеграция: ironBoost повышает доход железа (yieldMult в агрегаторе дохода)', () => {
    const { game } = makeGame();
    grant(game, { energy: 1e6, iron: 1e6 });
    const perSec0 = game.snapshot().perSec.iron;
    expect(game.dispatch('buyTech', { id: 'ironBoost' }).ok).toBe(true);
    const perSec1 = game.snapshot().perSec.iron;
    expect(perSec1).toBeCloseTo(perSec0 * 1.25, 6);
  });
});

describe('Этап 9.3 — techNodes (срез дерева для снапшота/UI)', () => {
  it('available/cost/level отражают состояние', () => {
    const t = mk();
    const nodes = techNodes(t, section);
    const iron = nodes.find((n) => n.id === 'ironBoost')!;
    expect(iron.available).toBe(true);
    expect(iron.cost).toEqual({ energy: 500, iron: 100 });
    expect(iron.level).toBe(0);
    const krio = nodes.find((n) => n.id === 'kriogenBoost')!;
    expect(krio.available).toBe(false);
    t.setResearch('unlock_kriogenBoost', 1);
    const after = techNodes(t, section);
    expect(after.find((n) => n.id === 'kriogenBoost')!.available).toBe(true);
    expect(after.find((n) => n.id === 'unlock_kriogenBoost')!.bought).toBe(true);
    expect(after.find((n) => n.id === 'unlock_kriogenBoost')!.available).toBe(false); // maxLevel 1
    expect(after.find((n) => n.id === 'unlock_kriogenBoost')!.cost).toEqual({});
  });

  it('снапшот игры содержит дерево и оно рендер-пригодно', () => {
    const { game } = makeGame();
    const snap = game.snapshot();
    expect(snap.tech.nodes.length).toBe(RESEARCH_DEFS.length);
    for (const n of snap.tech.nodes) {
      expect(typeof n.name).toBe('string');
      expect(n.level).toBeGreaterThanOrEqual(0);
    }
  });
});
