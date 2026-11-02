
/* ============================================================================
 * Voronia · ДОСТИЖЕНИЯ ПРОКАЧКИ (Upgrade Achievements)
 * v17 · внешний классический модуль (inline в сборке)
 * ---------------------------------------------------------------------------
 * Динамически достраивает хвост списка достижений (legacy.ACHIEVEMENTS — тот
 * же массив `un` из замыкания бандла; мутация видна всем потребителям:
 * Bi() проверка, dr() бонусы, md() рендер, ca() бейдж).
 *
 * Шаблоны (по запросу пользователя):
 *   A) «Прокачай 1 ячейку на планете X до 10/25/50/75/100»
 *   B) «Прокачай 5 ячеек на планете X до 10/25/50/75/100»
 *   C) «Прокачай ВСЕ ячейки планеты X до 10/25/50/75/100»
 *   D) «Прокачай все ячейки на 5/10/15/24 планетах до 10/25/50/75/100»
 *
 * Имя планеты в названии/описании маскируется «???» пока планета не открыта
 * (нет в state.unlockedPlanets — т.е. не найдена сонаром). Перестройка списка
 * каждые 3 с — имена раскрываются сразу после открытия мира.
 *
 * «Все ячейки» = все УЛУЧШАЕМЫЕ клетки (type 0/3/5 — те, что качаются zn();
 * аномалии type4 имеют свой предел 5 и в зачёт не входят), без разрушенных.
 * v17.2 · АУДИТ ПОДТВЕРДИЛ: в зачёт идут ТОЛЬКО простые энергетические (type 0)
 * и ресурсные месторождения (type 3/5). Аномалии (4), богатые (1), редкие (2),
 * ячейки исследований (6) и ядра (7) — исключены фильтром в stats()
 * (`if (ty !== 0 && ty !== 3 && ty !== 5) continue;`), причём по истинному
 * cell.type, а не displayType (аномалии маскируются под простые внешне).
 * ==========================================================================*/
(function () {
  'use strict';

  var PREFIX = 'vup_';
  var LEVELS = [10, 25, 50, 75, 100];
  var WORLDS = [5, 10, 15, 24];

  function L() { return (window.__V && window.__V.legacy) || {}; }
  function S() { return (window.__V && window.__V.state) || {}; }

  /* ---------------------------------------------------------- stats cache */
  var cache = new Map();
  var TTL = 700;
  function stats(pid) {
    var now = Date.now();
    var c = cache.get(pid);
    if (c && now - c.t < TTL) return c.s;
    var P = L().PLANETS || {};
    var pl = P[pid];
    var s = { max: 0, counts: {}, totalUp: 0 };
    if (pl && pl.cells) {
      for (var i = 0; i < pl.cells.length; i++) {
        var cell = pl.cells[i];
        if (!cell || cell._destroyed) continue;
        var ty = cell.type;
        if (ty !== 0 && ty !== 3 && ty !== 5) continue;
        s.totalUp++;
        var lv = Number(cell.level) || 0;
        if (lv > s.max) s.max = lv;
        for (var k = 0; k < LEVELS.length; k++) {
          var Lv = LEVELS[k];
          if (lv >= Lv) s.counts[Lv] = (s.counts[Lv] || 0) + 1;
        }
      }
    }
    cache.set(pid, { t: now, s: s });
    return s;
  }

  function planetIds() {
    var P = L().PLANETS || {};
    return Object.keys(P);
  }
  function isUnlocked(pid) {
    var u = S().unlockedPlanets;
    return !!(u && u.has && u.has(pid));
  }
  function pname(pid) {
    var pl = (L().PLANETS || {})[pid];
    if (!pl) return '???';
    if (isUnlocked(pid)) return pl.name || pid;
    return '???';
  }
  function planetsFull(Lv) {
    var n = 0;
    var ids = planetIds();
    for (var i = 0; i < ids.length; i++) {
      var s = stats(ids[i]);
      if (s.totalUp > 0 && (s.counts[Lv] || 0) >= s.totalUp) n++;
    }
    return n;
  }

  /* ------------------------------------------------------------- bonuses */
  var BA = { 10: 0.0004, 25: 0.0006, 50: 0.0008, 75: 0.001, 100: 0.0012 };  /* energy */
  var BB = { 10: 0.0004, 25: 0.0006, 50: 0.0008, 75: 0.001, 100: 0.0012 };  /* iron   */
  var BC = { 10: 0.0002, 25: 0.0003, 50: 0.0005, 75: 0.0007, 100: 0.001 };  /* all    */
  function bD(N, Lv) { return Math.round(4e-4 * (N / 5) * (Lv / 25) * 1e6) / 1e6; } /* dust */

  /* --------------------------------------------------------------- build */
  function build() {
    var out = [];
    var ids = planetIds();
    for (var q = 0; q < ids.length; q++) {
      var pid = ids[q];
      var nm = pname(pid);
      for (var k = 0; k < LEVELS.length; k++) {
        var Lv = LEVELS[k];
        (function (pid2, nm2, Lv2) {
          out.push({
            id: PREFIX + 'one_' + pid2 + '_' + Lv2, cat: 'vupg', icon: '⛰',
            name: nm2 + ' · вершина ' + Lv2,
            desc: 'Прокачай 1 ячейку на планете ' + nm2 + ' до ' + Lv2 + ' уровня',
            goal: function () { return stats(pid2).max; },
            target: Lv2, bonus: { energy: BA[Lv2] }
          });
          out.push({
            id: PREFIX + 'five_' + pid2 + '_' + Lv2, cat: 'vupg', icon: '⬆',
            name: nm2 + ' · пятёрка ' + Lv2,
            desc: 'Прокачай 5 ячеек на планете ' + nm2 + ' до ' + Lv2 + ' уровня',
            goal: function () { return stats(pid2).counts[Lv2] || 0; },
            target: 5, bonus: { iron: BB[Lv2] }
          });
          var tot = Math.max(1, stats(pid2).totalUp);
          out.push({
            id: PREFIX + 'all_' + pid2 + '_' + Lv2, cat: 'vupg', icon: '🌟',
            name: nm2 + ' · совершенство ' + Lv2,
            desc: 'Прокачай ВСЕ ячейки планеты ' + nm2 + ' до ' + Lv2 + ' уровня (' + tot + ' улучшаемых)',
            goal: function () { return stats(pid2).counts[Lv2] || 0; },
            target: tot, bonus: { all: BC[Lv2] }
          });
        })(pid, nm, Lv);
      }
    }
    for (var w = 0; w < WORLDS.length; w++) {
      for (var k2 = 0; k2 < LEVELS.length; k2++) {
        (function (N, Lv) {
          out.push({
            id: PREFIX + 'worlds_' + N + '_' + Lv, cat: 'vupg', icon: '🌐',
            name: N + ' миров · совершенство ' + Lv,
            desc: 'Прокачай все ячейки на ' + N + ' планетах до ' + Lv + ' уровня',
            goal: function () { return planetsFull(Lv); },
            target: N, bonus: { dust: bD(N, Lv) }
          });
        })(WORLDS[w], LEVELS[k2]);
      }
    }
    return out;
  }

  /* ---------------------------------------------------------------- sync */
  function sync() {
    var un = L().ACHIEVEMENTS;
    if (!un || !Array.isArray(un)) return 0;
    for (var i = un.length - 1; i >= 0; i--) {
      if (String((un[i] && un[i].id) || '').indexOf(PREFIX) === 0) un.splice(i, 1);
    }
    var fresh = build();
    for (var j = 0; j < fresh.length; j++) un.push(fresh[j]);
    return fresh.length;
  }

  function boot() {
    try { sync(); } catch (e) { console.warn('[vup-ach]', e); }
    setInterval(function () {
      try { if (S().started) sync(); } catch (e) {}
    }, 3000);
    window.__vorUpgradeAchievements = {
      version: '17.2', sync: sync, stats: stats, build: build,
      invalidate: function () { cache.clear(); },
      planetsFull: planetsFull, PREFIX: PREFIX, LEVELS: LEVELS, WORLDS: WORLDS
    };
    try { console.info('[vup-ach] достижения прокачки: ' + (L().ACHIEVEMENTS || []).filter(function (a) { return String(a.id).indexOf(PREFIX) === 0; }).length + ' шт. __vorUpgradeAchievements'); } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 600); });
  else setTimeout(boot, 600);
})();

