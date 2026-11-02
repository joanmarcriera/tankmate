'use strict';
// Loads the web app's app.js, unmodified, into a node:vm context with just
// enough window/document/localStorage stubs for its top-level wiring to run,
// then hands back the verdict engine (RULES, verdictsFor, worst).
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const APP_JS = path.join(__dirname, '..', '..', 'app.js');

function stubElement() {
  const el = {
    value: '', innerHTML: '', onclick: null, width: 0, height: 0, clientWidth: 300,
    dataset: {}, classList: { toggle() {}, add() {}, remove() {} },
    addEventListener() {}, scrollIntoView() {}, reset() {},
    getContext() {
      return new Proxy({}, { get: () => () => {} });
    },
  };
  return el;
}

function loadApp({ stored = null } = {}) {
  const elements = new Map();
  const store = new Map();
  if (stored !== null) store.set('tankmate.tests.v1', JSON.stringify(stored));
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
  };
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, stubElement());
      return elements.get(id);
    },
    querySelectorAll() { return []; },
  };
  const sandbox = {
    console, localStorage, document, navigator: {}, devicePixelRatio: 1,
    addEventListener() {}, print() {},
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(APP_JS, 'utf8'), context, { filename: APP_JS });
  // Top-level const/function declarations live in the context's global
  // lexical scope, so a second script in the same context can read them.
  const api = vm.runInContext('({ RULES, verdictsFor, worst })', context);
  return { ...api, elements, store };
}

module.exports = { loadApp };
