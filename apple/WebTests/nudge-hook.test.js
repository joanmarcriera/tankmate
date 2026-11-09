// Regression for task 5024 (nudgeAfterSave recursed forever when nudge.js was absent, because the
// global function declaration IS window.nudgeAfterSave) and task 5481 (the old test ran a copied
// line, so it never exercised the real installer or body.has-nudge).
// This runs the REAL app.js (and tanks.js / nudge.js) in a vm with a minimal permissive DOM stub.
// Run:  node --test apple/WebTests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '../..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

/** An element stand-in: real hidden/textContent/value/classList, everything else a no-op. */
function el() {
  const classes = new Set();
  const base = {
    hidden: false, textContent: '', value: '', innerHTML: '', width: 0, clientWidth: 300, dataset: {},
    classList: {
      toggle(c, force) { const on = force === undefined ? !classes.has(c) : !!force; on ? classes.add(c) : classes.delete(c); return on; },
      add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c),
    },
    addEventListener() {}, getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }),
  };
  return new Proxy(base, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
}

/** Load app.js for real. opts.nudge=false mimics the iOS bundle (no nudge.js). */
function load({ nudge = true } = {}) {
  const els = {};
  const store = new Map();
  const win = { addEventListener() {}, devicePixelRatio: 1 };
  const c = Object.assign(win, {
    window: win, devicePixelRatio: 1, console,
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    navigator: { userAgent: 'node', maxTouchPoints: 0 },
    document: {
      body: el(),
      getElementById: id => (els[id] = els[id] || (id === 'tankname' ? Object.assign(el(), { textContent: 'My tank' }) : el())),
      querySelectorAll: () => [], createElement: () => el(), addEventListener() {},
    },
  });
  vm.createContext(c);
  vm.runInContext(read('tanks.js'), c);
  if (nudge) vm.runInContext(read('nudge.js'), c);
  vm.runInContext(read('app.js'), c);
  return { c, els, body: c.document.body, store };
}

test('nudge.js absent: nudgeAfterSave returns without recursing or throwing', () => {
  const { c } = load({ nudge: false });
  assert.equal(c.tankmateNudgeSaved, undefined);
  assert.doesNotThrow(() => vm.runInContext('nudgeAfterSave()', c));
});

test('nudge.js present: the installer defines the hook the app calls', () => {
  const { c } = load();
  assert.equal(typeof c.tankmateNudgeSaved, 'function');
});

test('first render shows nothing: no saved test yet', () => {
  const { els, body } = load();
  assert.equal(els.installnudge.hidden, true);
  assert.equal(body.classList.contains('has-nudge'), false);
});

test('nudgeAfterSave() records the saved flag, un-hides the bar and sets body.has-nudge', () => {
  const { c, els, body, store } = load();
  // iOS Safari UA: install is manual, so a mode exists once a test is saved.
  c.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Version/17.0 Mobile Safari/604';
  vm.runInContext('nudgeAfterSave()', c);
  assert.equal(store.get(c.InstallNudge.FLAG_SAVED), '1');
  assert.equal(els.installnudge.hidden, false);
  assert.equal(body.classList.contains('has-nudge'), true);
  assert.match(els['nudge-text'].textContent, /Add to Home Screen/);
});

test('dismissing the bar hides it and clears body.has-nudge', () => {
  const { c, els, body, store } = load();
  c.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Version/17.0 Mobile Safari/604';
  vm.runInContext('nudgeAfterSave()', c);
  els['nudge-close'].onclick();
  assert.equal(store.get(c.InstallNudge.FLAG_DISMISSED), '1');
  assert.equal(els.installnudge.hidden, true);
  assert.equal(body.classList.contains('has-nudge'), false);
});
