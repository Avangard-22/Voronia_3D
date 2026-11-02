/* Voronia 2.0 · harness — DOM-заглушки для запуска монолита v0.0.41 в node+vm.
 * Восстановлен по мотивам утраченного build_harness.py (Этап 0).
 * Принцип: максимум no-op через Proxy, минимум реального состояния (style/classList/dataset/children),
 * всё оборачивающее игровые вызовы живёт снаружи в try/catch — бандл сам глубоко защищён.
 */
'use strict';

function makeEnv(opts = {}) {
  const listeners = new Map(); // targetKey -> {type: [fn]}
  const rafQueue = [];
  const timeouts = [];

  function mkClassList(el) {
    const set = new Set();
    return {
      _set: set,
      add: (...c) => c.forEach((x) => set.add(x)),
      remove: (...c) => c.forEach((x) => set.delete(x)),
      toggle: (c, f) => {
        const on = f === undefined ? !set.has(c) : !!f;
        if (on) set.add(c); else set.delete(c);
        return on;
      },
      contains: (c) => set.has(c),
      replace: (a, b) => { if (set.delete(a)) set.add(b); },
      get length() { return set.size; },
      item: (i) => [...set][i] ?? null,
    };
  }

  function ctx2dStub(canvas) {
    const grad = { addColorStop() {} };
    const target = {
      canvas,
      measureText: (t) => ({ width: String(t ?? '').length * 6, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
      createLinearGradient: () => grad,
      createRadialGradient: () => grad,
      createPattern: () => null,
      getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }),
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }),
      putImageData() {},
      setTransform() {}, getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
      isPointInPath: () => false,
    };
    return new Proxy(target, {
      get(t, p) {
        if (p in t) return t[p];
        if (typeof p === 'symbol') return undefined;
        // любое неизвестное свойство — noop-функция (fillRect, drawImage, ...)
        return () => {};
      },
      set(t, p, v) { t[p] = v; return true; },
    });
  }

  let elCount = 0;
  function mkElement(tag = 'div', id = null) {
    const el = {
      _isEl: true,
      _n: ++elCount,
      tagName: String(tag).toUpperCase(),
      nodeName: String(tag).toUpperCase(),
      nodeType: 1,
      id: id || '',
      className: '',
      innerHTML: '',
      outerHTML: '',
      textContent: '',
      value: '',
      checked: false,
      disabled: false,
      hidden: false,
      width: 300,
      height: 150,
      clientWidth: 800,
      clientHeight: 600,
      offsetWidth: 800,
      offsetHeight: 600,
      scrollWidth: 800,
      scrollHeight: 600,
      scrollTop: 0,
      scrollLeft: 0,
      children: [],
      childNodes: [],
      parentNode: null,
      parentElement: null,
      firstChild: null,
      lastChild: null,
      nextSibling: null,
      previousSibling: null,
      attributes: {},
      dataset: {},
      _handlers: {},
    };
    el.style = new Proxy({}, { get: (t, p) => (p in t ? t[p] : ''), set: (t, p, v) => ((t[p] = v), true) });
    el.classList = mkClassList(el);
    // динамические связи дерева (firstChild и т.п. — геттеры, иначе removeChild(firstChild)-циклы в 1.x зависают)
    Object.defineProperties(el, {
      firstChild: { get: () => el.children[0] || null, enumerable: false },
      lastChild: { get: () => el.children[el.children.length - 1] || null, enumerable: false },
      firstElementChild: { get: () => el.children[0] || null, enumerable: false },
      lastElementChild: { get: () => el.children[el.children.length - 1] || null, enumerable: false },
      childElementCount: { get: () => el.children.length, enumerable: false },
    });
    const relink = () => {
      for (let i = 0; i < el.children.length; i++) {
        const c = el.children[i];
        if (c && typeof c === 'object') {
          c.previousSibling = el.children[i - 1] || null;
          c.nextSibling = el.children[i + 1] || null;
          c.parentNode = el; c.parentElement = el;
        }
      }
    };
    const proto = {
      appendChild(c) { if (c) { el.children.push(c); el.childNodes = el.children; relink(); } return c; },
      append(...cs) { cs.forEach((c) => proto.appendChild(c)); },
      prepend(...cs) { cs.forEach((c) => { if (c) { el.children.unshift(c); } }); el.childNodes = el.children; relink(); },
      insertBefore(c, ref) {
        if (!c) return c;
        const i = ref ? el.children.indexOf(ref) : -1;
        if (i >= 0) el.children.splice(i, 0, c); else el.children.push(c);
        el.childNodes = el.children; relink();
        return c;
      },
      removeChild(c) {
        if (!c) return null;
        const i = el.children.indexOf(c);
        if (i >= 0) { el.children.splice(i, 1); el.childNodes = el.children; relink(); if (c && typeof c === 'object') { c.parentNode = null; c.parentElement = null; } }
        return c;
      },
      remove() { if (el.parentNode && el.parentNode.removeChild) el.parentNode.removeChild(el); },
      replaceChildren(...cs) { el.children.length = 0; cs.forEach((c) => proto.appendChild(c)); },
      setAttribute(k, v) { el.attributes[k] = String(v); if (k === 'id') el.id = String(v); },
      getAttribute(k) { return el.attributes[k] ?? null; },
      removeAttribute(k) { delete el.attributes[k]; },
      hasAttribute(k) { return k in el.attributes; },
      addEventListener(type, fn) { (el._handlers[type] = el._handlers[type] || []).push(fn); },
      removeEventListener(type, fn) { if (el._handlers[type]) el._handlers[type] = el._handlers[type].filter((f) => f !== fn); },
      dispatchEvent(ev) { const hs = el._handlers[ev && ev.type] || []; hs.forEach((f) => f.call(el, ev)); return true; },
      click() { proto.dispatchEvent({ type: 'click', target: el, preventDefault() {}, stopPropagation() {} }); },
      focus() {}, blur() {},
      getBoundingClientRect: () => ({ x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }),
      querySelector: () => mkElement('div'),
      querySelectorAll: () => [],
      getElementsByClassName: () => [],
      getElementsByTagName: () => [],
      closest: () => null,
      matches: () => false,
      scrollIntoView() {}, scrollTo() {},
      animate: () => ({ finished: Promise.resolve(), cancel() {}, onfinish: null }),
      getAnimations: () => [],
      getContext(type) {
        if (type === '2d') return (el._ctx2d = el._ctx2d || ctx2dStub(el));
        return null; // webgl недоступен — 3D-ветки деградируют штатно
      },
      toDataURL: () => 'data:image/png;base64,',
      play: () => Promise.resolve(), pause() {}, load() {},
      setVolume(v) { el.volume = v; },
    };
    return new Proxy(el, {
      get(t, p) {
        if (p in t) return t[p];
        if (p in proto) return proto[p];
        if (typeof p === 'symbol') return undefined;
        return undefined;
      },
      set(t, p, v) { t[p] = v; return true; },
    });
  }

  const byId = new Map();
  function byIdGet(id) {
    if (!byId.has(id)) byId.set(id, mkElement('div', id));
    return byId.get(id);
  }

  const document = {
    _isDocument: true,
    readyState: 'complete',
    visibilityState: 'visible',
    hidden: false,
    title: 'Voronia harness',
    location: { href: 'http://localhost/', search: '', hash: '' },
    documentElement: mkElement('html'),
    head: mkElement('head'),
    body: mkElement('body'),
    fonts: { ready: Promise.resolve(), load: () => Promise.resolve(), add() {} },
    getElementById: (id) => byIdGet(id),
    createElement: (tag) => mkElement(tag),
    createElementNS: (ns, tag) => mkElement(tag),
    createTextNode: (t) => ({ nodeType: 3, textContent: String(t) }),
    createDocumentFragment: () => mkElement('fragment'),
    querySelector: (sel) => mkElement('div'),
    querySelectorAll: () => [],
    getElementsByClassName: () => [],
    getElementsByTagName: (t) => (t === 'canvas' ? [] : []),
    addEventListener(type, fn) { (listeners.has('document') || listeners.set('document', {}), listeners.get('document')[type] = listeners.get('document')[type] || []).push(fn); },
    removeEventListener() {},
    dispatchEvent(ev) {
      const hs = (listeners.get('document') || {})[ev && ev.type] || [];
      hs.forEach((f) => f(ev));
      return true;
    },
    exitPointerLock() {}, exitFullscreen: () => Promise.resolve(),
  };

  function mkStorage() {
    const m = new Map();
    return {
      _map: m,
      getItem: (k) => (m.has(String(k)) ? m.get(String(k)) : null),
      setItem: (k, v) => void m.set(String(k), String(v)),
      removeItem: (k) => void m.delete(String(k)),
      clear: () => m.clear(),
      key: (i) => [...m.keys()][i] ?? null,
      get length() { return m.size; },
    };
  }

  const env = {
    document,
    localStorage: mkStorage(),
    sessionStorage: mkStorage(),
    navigator: { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) VoroniaHarness/1.0', language: 'ru-RU', languages: ['ru'], platform: 'Linux', maxTouchPoints: 0, hardwareConcurrency: 4, deviceMemory: 8, vibrate: () => true, clipboard: { writeText: () => Promise.resolve() } },
    location: { href: 'http://localhost/', protocol: 'http:', host: 'localhost', hostname: 'localhost', pathname: '/', search: '', hash: '', origin: 'http://localhost', reload() {} },
    history: { pushState() {}, replaceState() {}, back() {} },
    performance: { now: () => Date.now() + (env.__nowOffsetVal || 0) - env.__bootTime, mark() {}, measure() {}, getEntriesByType: () => [] },
    requestAnimationFrame(fn) { rafQueue.push(fn); return rafQueue.length; },
    cancelAnimationFrame() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    getComputedStyle: () => new Proxy({}, { get: () => '' }),
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } },
    MutationObserver: class { observe() {} disconnect() {} takeRecords() { return []; } },
    Image: class { constructor() { this._ok = false; } set src(v) { this._src = v; if (this.onload) setTimeout(() => this.onload({ target: this }), 0); } get src() { return this._src; } },
    Audio: class { play() { return Promise.resolve(); } pause() {} load() {} addEventListener() {} set src(v) {} },
    AudioContext: class { createGain() { return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} }; } createOscillator() { return { frequency: { value: 440, setValueAtTime() {} }, type: 'sine', connect() {}, start() {}, stop() {} }; } resume() { return Promise.resolve(); } get destination() { return {}; } get currentTime() { return 0; } get state() { return 'running'; } },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve('') }),
    XMLHttpRequest: class { open() {} send() {} setRequestHeader() {} addEventListener() {} },
    WebSocket: class { send() {} close() {} addEventListener() {} },
    Worker: class { postMessage() {} terminate() {} addEventListener() {} },
    devicePixelRatio: 1,
    innerWidth: 1280,
    innerHeight: 720,
    outerWidth: 1280,
    outerHeight: 720,
    screen: { width: 1280, height: 720, availWidth: 1280, availHeight: 720 },
    alert() {}, confirm: () => true, prompt: () => null,
    scrollTo() {}, scrollBy() {},
    open: () => null, close() {},
    postMessage() {},
    addEventListener(type, fn) { (listeners.has('window') || listeners.set('window', {}), listeners.get('window')[type] = listeners.get('window')[type] || []).push(fn); },
    removeEventListener() {},
    dispatchEvent(ev) { const hs = (listeners.get('window') || {})[ev && ev.type] || []; hs.forEach((f) => f(ev)); return true; },
    // служебное для харнесса
    __rafQueue: rafQueue,
    __bootTime: Date.now(),
    __nowOffsetVal: 0,
    __timeShift(ms) { env.__nowOffsetVal += ms; },
    __timeSet(absMs) { env.__nowOffsetVal = absMs - Date.now(); },
    __now() { return Date.now() + (env.__nowOffsetVal || 0); },
    __flushRaf(n = 1, dtMs = 16) {
      for (let i = 0; i < n; i++) {
        const q = rafQueue.splice(0, rafQueue.length);
        const t = Date.now();
        q.forEach((fn) => { try { fn(t); } catch (e) { if (opts.strictRaf) throw e; } });
      }
    },
    __listeners: listeners,
    __byId: byId,
    __fireDoc(type, ev = {}) { document.dispatchEvent({ type, ...ev }); },
    __fireWin(type, ev = {}) { env.dispatchEvent({ type, ...ev }); },
  };
  env.window = env;
  env.self = env;
  env.globalThis = env;
  env.top = env;
  env.parent = env;
  env.frames = env;
  return env;
}

module.exports = { makeEnv };
