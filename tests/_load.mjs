// Loads the browser script app.js into a Node vm context with just enough DOM
// stubs for it to run, then hands back its top-level bindings by name.
// app.js is not modified: its `const`/`let` bindings are not properties of the
// context, so a one-line export expression is evaluated after the script in the
// same vm script (top-level lexical scope is shared within one script).

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** An inert element: records innerHTML/value, ignores everything else. */
function makeElement(id) {
  const el = {
    id, innerHTML: '', value: '', width: 0, height: 0, clientWidth: 300, dataset: {},
    classList: { toggle() {}, add() {}, remove() {} },
    addEventListener() {}, scrollIntoView() {}, reset() {},
    getContext: () => new Proxy({}, { get: () => () => {} }),
  };
  return el;
}

function makeDocument() {
  const els = new Map();
  return {
    els,
    getElementById(id) { if (!els.has(id)) els.set(id, makeElement(id)); return els.get(id); },
    querySelector(sel) { return makeElement(sel); },
    querySelectorAll() { return []; },
  };
}

function makeLocalStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    map: m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    clear: () => m.clear(),
  };
}

/** A Date whose zero-arg constructor / Date.now() return `iso`. */
export function fixedDate(iso) {
  const RealDate = Date;
  const fixed = new RealDate(iso).getTime();
  class FakeDate extends RealDate {
    constructor(...a) { super(...(a.length ? a : [fixed])); }
    static now() { return fixed; }
  }
  return FakeDate;
}

const EXPORTS = ['STORE', 'SEED', 'RULES', 'LABEL', 'verdictsFor', 'worst', 'esc', 'load', 'save',
  'ROTATION', 'PLAYBOOK', 'renderTrends', 'renderFeeding', 'renderHandover', 'renderHistory', 'renderVerdicts'];

/**
 * @param {object} [opts]
 * @param {Array|null} [opts.tests] records to pre-seed in localStorage (null = empty storage → SEED)
 * @param {string} [opts.now] ISO timestamp the app sees as "now"
 */
export function loadApp({ tests = null, now } = {}) {
  const src = readFileSync(join(ROOT, 'app.js'), 'utf8');
  const document = makeDocument();
  const localStorage = makeLocalStorage(tests ? { 'tankmate.tests.v1': JSON.stringify(tests) } : {});
  const window = { addEventListener() {}, print() {} };
  const ctx = {
    window, document, localStorage, navigator: {}, devicePixelRatio: 1, console,
  };
  if (now) ctx.Date = fixedDate(now);
  vm.createContext(ctx);
  const code = `${src}\n;globalThis.__exports = { ${EXPORTS.join(', ')}, getTests: () => tests };`;
  vm.runInContext(code, ctx, { filename: 'app.js' });
  return { ...ctx.__exports, document, localStorage };
}
