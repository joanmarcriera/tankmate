// Loads the browser scripts (app.js, sw.js) into a Node vm with minimal stubs,
// so the verdict engine and service worker can be tested without a browser or
// any dependency. Top-level const/function declarations are reachable through
// ctx.run('<expression>').
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function makeElement(id) {
  const attrs = {};
  const el = {
    id, value: '', innerHTML: '', clientWidth: 300, width: 0, height: 0, dataset: {},
    listeners: {},
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    insertAdjacentHTML(_pos, html) { this.innerHTML = html + this.innerHTML; },
    scrollIntoView() {}, reset() {},
    setAttribute(k, v) { attrs[k] = String(v); }, removeAttribute(k) { delete attrs[k]; },
    getAttribute(k) { return k in attrs ? attrs[k] : null; },
    classList: { _s: new Set(), toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    getContext() { return new Proxy({}, { get: () => () => {}, set: () => true }); },
  };
  return el;
}

function memoryStorage(initial = {}, { failWrites = false } = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (failWrites) throw new Error('QuotaExceededError'); m.set(k, String(v)); },
    removeItem: k => m.delete(k),
    _map: m,
  };
}

function loadApp({ storage = memoryStorage(), consoleSink = [] } = {}) {
  const els = {};
  const tabs = ['log', 'trends', 'feed', 'playbook', 'holiday'].map(t => {
    const b = makeElement('btn-' + t); b.dataset.tab = t; return b;
  });
  const document = {
    getElementById: id => (els[id] ||= makeElement(id)),
    querySelectorAll: sel => (sel === '.tabbar button' ? tabs : []),
  };
  const log = (level) => (...a) => consoleSink.push([level, a.map(String).join(' ')]);
  const context = vm.createContext({
    document, localStorage: storage, navigator: {}, window: { addEventListener() {}, print() {} },
    devicePixelRatio: 1, console: { log: log('log'), warn: log('warn'), error: log('error') },
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8'), context, { filename: 'app.js' });
    // els.<id> returns the same stub element the app sees (created on first use).
  const elProxy = new Proxy({}, { get: (_t, id) => document.getElementById(String(id)) });
  // Values are JSON round-tripped so assert.deepEqual is not tripped by vm realms.
  const run = code => { const r = vm.runInContext(code, context); return r !== null && typeof r === 'object' && !('innerHTML' in r) ? JSON.parse(JSON.stringify(r)) : r; };
  return { run, els: elProxy, tabs, storage, consoleSink };
}

// --- service worker -------------------------------------------------------
class FakeResponse {
  constructor(body, { status = 200, type = 'basic' } = {}) { this.body = body; this.status = status; this.type = type; }
  get ok() { return this.status >= 200 && this.status < 300; }
  clone() { return new FakeResponse(this.body, { status: this.status, type: this.type }); }
  static error() { return new FakeResponse(null, { status: 0, type: 'error' }); }
}

function loadSW({ origin = 'https://tank.example', network = async () => new FakeResponse('net') } = {}) {
  const stores = new Map(); // cacheName -> Map(url -> response)
  const keyOf = (r) => (typeof r === 'string' ? new URL(r, origin + '/').href : r.url);
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const s = stores.get(name);
      return {
        async put(r, res) { s.set(keyOf(r), res); },
        async addAll(list) { for (const u of list) s.set(keyOf(u), new FakeResponse('cached:' + u)); },
      };
    },
    async match(r, opts = {}) {
      let k = keyOf(r);
      if (opts.ignoreSearch) k = k.split('?')[0];
      for (const s of stores.values()) if (s.has(k)) return s.get(k);
      return undefined;
    },
    async keys() { return [...stores.keys()]; },
    async delete(n) { return stores.delete(n); },
  };
  const handlers = {};
  const self = {
    location: new URL(origin + '/sw.js'),
    addEventListener: (t, fn) => { handlers[t] = fn; },
    skipWaiting: async () => {}, clients: { claim: async () => {} },
  };
  const consoleSink = [];
  const context = vm.createContext({
    self, caches, fetch: (req) => network(req), Response: FakeResponse, URL, Promise,
    console: { warn: (...a) => consoleSink.push(a.join(' ')), log() {}, error() {} },
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), context, { filename: 'sw.js' });

  async function dispatch(type, extra = {}) {
    const waits = []; let responded;
    const ev = { ...extra, waitUntil: p => waits.push(p), respondWith: p => { responded = p; } };
    handlers[type](ev);
    const res = responded === undefined ? undefined : await responded;
    await Promise.all(waits);
    return { res, responded: responded !== undefined };
  }
  const request = (url, { method = 'GET', mode = 'cors' } = {}) => ({ url: new URL(url, origin + '/').href, method, mode });
  return { dispatch, request, stores, run: c => vm.runInContext(c, context), FakeResponse, consoleSink };
}

module.exports = { loadApp, loadSW, memoryStorage, FakeResponse };
