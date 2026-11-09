// Boots the REAL tanks.js + app.js in a node vm with a minimal fake DOM and a fake
// localStorage (optionally with a byte quota), so tests can exercise the startup path,
// form submit and the native bridge end to end instead of extracting fragments.
// Not a test file itself (no .test.js suffix): required by the *.test.js files.
//
//   const { boot, FakeStorage } = require('./_app-harness');
//   const store = new FakeStorage({ 'tankmate.tests.v1': '[...]' }, { quota: 2000 });
//   const app = boot({ storage: store, now: '2026-11-09T10:00:00' });
//   app.el('history').innerHTML; app.submit({ 'f-no3': '10' }); app.window.tankmateApplyNative({isPro:true});
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '../..');
const SRC = ['tanks.js', 'app.js'].map(f => [f, fs.readFileSync(path.join(root, f), 'utf8')]);

/** localStorage stand-in. `quota` (chars of keys+values) makes setItem throw like a full browser store. */
class FakeStorage {
  constructor(init = {}, { quota = Infinity } = {}) { this.m = new Map(Object.entries(init)); this.quota = quota; this.writes = 0; }
  used(except) { let n = 0; for (const [k, v] of this.m) if (k !== except) n += k.length + v.length; return n; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) {
    v = String(v);
    if (this.used(k) + k.length + v.length > this.quota) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
    this.m.set(k, v); this.writes++;
  }
  removeItem(k) { this.m.delete(k); }
  keys() { return [...this.m.keys()]; }
}

function fakeElement(id) {
  const handlers = {};
  const classes = new Set(id === 'tab-log' ? ['active'] : []);
  return {
    id, innerHTML: '', textContent: id === 'tankname' ? 'Fluval Flex 57 L' : '', value: '', max: '', hidden: false,
    dataset: {}, style: {}, tabIndex: 0, handlers,
    classList: { toggle: (c, on) => (on ?? !classes.has(c)) ? classes.add(c) : classes.delete(c), contains: c => classes.has(c), add: c => classes.add(c), remove: c => classes.delete(c) },
    addEventListener(t, f) { handlers[t] = f; },
    insertAdjacentHTML(_where, h) { this.innerHTML = h + this.innerHTML; },
    setAttribute() {}, removeAttribute() {}, querySelector() { return null; },
    scrollIntoView() {}, focus() {}, reset() { this.resets = (this.resets || 0) + 1; },
  };
}

/** Boot the app. `now` fixes the clock (ISO local time) for today(); `storage` is the localStorage. */
function boot({ storage = new FakeStorage(), now = '2026-11-09T10:00:00' } = {}) {
  const els = {};
  const el = id => els[id] || (els[id] = fakeElement(id));
  const RealDate = Date;
  let clock = new RealDate(now).getTime();
  class FixedDate extends RealDate {
    constructor(...a) { super(...(a.length ? a : [clock])); }
    static now() { return clock; }
  }
  const listeners = {};
  const document = {
    getElementById: id => (id === 'chart' ? null : el(id)),
    querySelector: () => null, querySelectorAll: () => [],
    body: el('body'), visibilityState: 'visible',
    addEventListener(t, f) { (listeners['doc:' + t] = listeners['doc:' + t] || []).push(f); },
  };
  const ctx = {
    document, localStorage: storage, navigator: {}, console, Date: FixedDate,
    matchMedia: () => ({ matches: false }), requestAnimationFrame: f => f(), scrollTo() {}, devicePixelRatio: 1,
    addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const [name, code] of SRC) vm.runInContext(code, ctx, { filename: name });
  return {
    window: ctx, storage, el, listeners,
    /** Move the fake clock (ISO local time). */
    setNow(iso) { clock = new RealDate(iso).getTime(); },
    /** Fill the form fields given as {id: value} and fire the submit handler. */
    submit(fields = {}) {
      for (const [id, v] of Object.entries(fields)) el(id).value = v;
      el('testform').handlers.submit({ preventDefault() {}, target: el('testform') });
    },
    fire(name) { for (const f of listeners[name] || []) f({}); },
  };
}

module.exports = { boot, FakeStorage };
