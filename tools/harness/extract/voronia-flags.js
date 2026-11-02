/* Voronia · ранние флаги (исполняется ДО основного бандла) */
(function () {
  var ls = null;
  try { ls = window.localStorage; } catch (e) {}
  var q = String(location.search || '') + String(location.hash || '');
  var wantOn = /[?&#]debug=1\b/.test(q) || /[?&#]voronia_debug=1\b/.test(q);
  var wantOff = /[?&#]debug=0\b/.test(q);
  try {
    if (wantOn && ls) ls.setItem('voronia_debug', '1');
    if (wantOff && ls) ls.removeItem('voronia_debug');
  } catch (e) {}
  var stored = false;
  try { stored = !!ls && ls.getItem('voronia_debug') === '1'; } catch (e) {}
  window.__VORONIA_DEBUG = !!(wantOn || (stored && !wantOff));

  /* Глубокий клон значений реестра баланса: объект из VORONIA_BALANCE копируется,
     чтобы игра не могла случайно изменить эталон; функции переносятся по ссылке. */
  window.__VBALCLONE = function clone(o) {
    if (o === null || typeof o !== 'object') return o;
    if (Array.isArray(o)) { var a = new Array(o.length); for (var i = 0; i < o.length; i++) a[i] = clone(o[i]); return a; }
    var r = {};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = clone(o[k]);
    return r;
  };
  /* BALC(path) =.resolve по пути + глубокий клон (используется игровым бандлом) */
  window.__VBALC = function (path) { return window.__VBALCLONE(window.__VBALGET(path)); };
  window.__VBALGET = function (path) {
    var cur = window.VORONIA_BALANCE, parts = String(path).split('.');
    for (var i = 0; i < parts.length; i++) { if (cur == null) return undefined; cur = cur[parts[i]]; }
    return cur;
  };
  /* Ключи «Раскола», которые нельзя сносить при «Новой игре» и импорте сейва:
     cosmicClickerV19_shared (общий слой), _u<N> (сейвы других вселенных), _swapbak. */
  window.__VORONIA_SHARDS_KEEP = function (k) {
    return /^cosmicClickerV19_(shared|swapbak|u\d+)$/.test(String(k || ''));
  };

  /* Ленивая установка debug-API (пункт 1 плана): бандл отдаёт контракт из живых
     биндингов, а сам код ~60 КБ лежит в js/debug.js и грузится только здесь. */
  window.__VORONIA_INSTALL_DEBUG_API = function (api) {
    try { window.__V = window.__V || {}; window.__V.debugApi = api; } catch (e) {}
    try {
      var s = document.createElement('script');
      s.src = 'js/debug.js';
      s.async = false;
      s.onload = function () {
        try {
          var n = Object.keys(window.__ccDebug || {}).length;
          console.info('[Voronia] Debug-API подключён из js/debug.js: __ccDebug.* (' + n + ' методов). Сводка: __ccDebug.v12Report()');
        } catch (e) {}
      };
      s.onerror = function () {
        window.__VORONIA_DEBUG_MISS = 1;
        try { console.warn('[Voronia] js/debug.js не найден рядом с HTML — debug-API недоступен. Игра работает штатно.'); } catch (e) {}
      };
      (document.head || document.documentElement).appendChild(s);
    } catch (e) {}
    return api;
  };

  /* число -> текст для UI в русской нотации (1.8 -> «1,8») */
  window.__VBALFMT = function (v) { return String(v).replace('.', ','); };
})();
