'use strict';
// Keyboard, screen-reader and PWA checks (cloud audit, 9 Nov 2026).
// Plain node:test, no dependencies: app.js runs in a vm with a tiny DOM stub.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

function el(id) {
  const attrs = {};
  return {
    id, value: '', innerHTML: '', clientWidth: 300, dataset: {}, listeners: {}, focused: 0, scrolls: [],
    addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); },
    scrollIntoView(o) { this.scrolls.push(o); }, reset() {}, focus() { this.focused++; },
    setAttribute(k, v) { attrs[k] = String(v); }, getAttribute(k) { return k in attrs ? attrs[k] : null; },
    removeAttribute(k) { delete attrs[k]; },
    classList: { toggle() {} },
    getContext() { return new Proxy({}, { get: () => () => {}, set: () => true }); },
  };
}

function loadApp({ reducedMotion = false, storage: storageApi } = {}) {
  const els = {};
  const get = (id) => (els[id] ||= el(id));
  const tabs = ['log', 'trends', 'feed', 'playbook', 'holiday'].map((t) => { const b = el('btn-' + t); b.dataset.tab = t; return b; });
  const headings = {};
  const document = {
    getElementById: get,
    querySelectorAll: (s) => (s === '.tabbar button' ? tabs : []),
    querySelector: (s) => { const m = /^#tab-(\w+) h1$/.exec(s); return m ? (headings[m[1]] ||= el('h1-' + m[1])) : null; },
  };
  const mem = new Map();
  const ctx = vm.createContext({
    document, console,
    localStorage: { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) },
    navigator: storageApi ? { storage: storageApi } : {},
    window: { addEventListener() {}, print() {} },
    matchMedia: (q) => ({ matches: reducedMotion && q.includes('prefers-reduced-motion: reduce') }),
    devicePixelRatio: 1,
  });
  vm.runInContext(read('app.js'), ctx, { filename: 'app.js' });
  return { els: new Proxy({}, { get: (_t, id) => get(String(id)) }), tabs, headings, run: (c) => vm.runInContext(c, ctx) };
}

test('choosing a tab moves focus to that tab\'s heading', () => {
  const app = loadApp();
  for (const b of app.tabs) {
    b.onclick();
    assert.equal(app.headings[b.dataset.tab].focused, 1, b.dataset.tab);
  }
});

test('every tab heading is programmatically focusable (tabindex=-1)', () => {
  const html = read('index.html');
  for (const t of ['log', 'trends', 'feed', 'playbook', 'holiday']) {
    const sec = html.split(`id="tab-${t}"`)[1].split('</section>')[0];
    assert.match(sec, /<h1 tabindex="-1">/, t);
  }
});

test('history verdict is not conveyed by colour alone', () => {
  const app = loadApp();
  const h = app.els.history.innerHTML;
  assert.match(h, /class="dot \w+" aria-hidden="true"/);
  assert.match(h, /<span class="sr-only">(all good|needs attention|act now)<\/span>/);
  // seed: latest test is healthy, the older two had nitrite / low KH
  assert.ok(h.includes('sr-only">all good<') && h.includes('sr-only">act now<'), h);
});

test("tonight's rotation row is marked for assistive tech, not only highlighted", () => {
  const app = loadApp();
  const rows = app.els.rotation.innerHTML.match(/<div class="rot[^>]*>/g);
  assert.equal(rows.length, 7);
  const today = rows.filter((r) => r.includes('aria-current="date"'));
  assert.equal(today.length, 1);
  assert.ok(today[0].includes('today'));
  assert.match(app.els.rotation.innerHTML, /sr-only"> \(tonight\)/);
});

test('handover sheet heading follows the page h1 (h2, not h3) and the print button is a plain button', () => {
  const app = loadApp();
  app.els['h-days'].value = '7';
  app.run('renderHandover()');
  const s = app.els.handover.innerHTML;
  assert.match(s, /<h2>/);
  assert.ok(!/<h3/.test(s));
  assert.match(s, /<button type="button" class="print"/);
});

test('saving a test scrolls smoothly, or instantly when reduced motion is requested', () => {
  for (const [reducedMotion, want] of [[false, 'smooth'], [true, 'auto']]) {
    const app = loadApp({ reducedMotion });
    app.els['f-nh3'].value = '0';
    app.els.testform.listeners.submit[0]({ preventDefault() {}, target: { reset() {} } });
    assert.equal(app.els.verdicts.scrolls.at(-1).behavior, want, `reducedMotion=${reducedMotion}`);
  }
});

test('asks the browser to keep storage persistent, once, and tolerates refusal / absence', async () => {
  const calls = [];
  const api = (persisted) => ({ persisted: async () => (calls.push('persisted'), persisted), persist: async () => (calls.push('persist'), false) });
  loadApp({ storage: api(false) });
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(calls, ['persisted', 'persist']);
  calls.length = 0;
  loadApp({ storage: api(true) });
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(calls, ['persisted']);
  loadApp({ storage: { persisted: async () => { throw new Error('nope'); }, persist() {} } }); // no unhandled rejection
  loadApp(); // no navigator.storage at all
  await new Promise((r) => setImmediate(r));
});

test('manifest is valid for install: separate any / maskable icons that exist, scope and id', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  for (const k of ['name', 'short_name', 'start_url', 'display', 'theme_color', 'background_color', 'id', 'scope']) assert.ok(m[k], k);
  assert.ok(['standalone', 'fullscreen', 'minimal-ui'].includes(m.display));
  const purposes = m.icons.map((i) => i.purpose);
  assert.ok(purposes.includes('any') && purposes.includes('maskable'));
  assert.ok(!purposes.some((p) => /any maskable|maskable any/.test(p)), 'one icon for both purposes gets cropped or padded badly');
  for (const i of m.icons) assert.ok(fs.existsSync(path.join(ROOT, i.src)), i.src);
  assert.match(read('index.html'), /<meta name="theme-color" content="#0b3d4f">/);
  assert.equal(m.theme_color, '#0b3d4f');
});

test('every same-origin asset index.html loads is precached by the service worker', () => {
  const html = read('index.html');
  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1])
    .filter((u) => !/^(https?:|mailto:|#|\.\.\/|privacy\/|support\/)/.test(u));
  const assets = vm.runInNewContext(read('sw.js').match(/const ASSETS = (\[[^\]]*\])/)[1]);
  for (const r of refs) assert.ok(assets.includes(r), `${r} missing from sw.js ASSETS`);
});

test('colour pairs meet WCAG 2.2 AA', () => {
  const css = read('styles.css');
  const tok = Object.fromEntries([...css.matchAll(/--([\w-]+):(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
  const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  for (const fg of ['ink', 'mut', 'good', 'warn', 'bad', 'acc']) for (const bg of ['bg', 'panel', 'panel2'])
    assert.ok(ratio(tok[fg], tok[bg]) >= 4.5, `${fg} on ${bg}: ${ratio(tok[fg], tok[bg]).toFixed(2)}`);
  for (const bg of ['panel', 'panel2']) assert.ok(ratio(tok.field, tok[bg]) >= 3, `field outline on ${bg}`);
  assert.match(css, /(^|\n|\})a\{color:var\(--acc\)\}/, 'links must not fall back to default blue (1.98:1 on --bg)');
  assert.match(css, /--field/);
  assert.match(css, /input,textarea,select\{[^}]*border:1px solid var\(--field\)/);
});

test('focused elements are not hidden under the sticky header / fixed tab bar', () => {
  const css = read('styles.css');
  assert.match(css, /html\{scroll-padding-top:[^;]+;scroll-padding-bottom:[^}]+\}/);
});
