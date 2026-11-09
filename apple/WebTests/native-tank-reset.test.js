// Regression: readings typed for one tank must never be saved into another, including
// when the NATIVE shell changes the active tank by pushing a new entitlement
// (Pro lapses -> active tank falls back to the default). Found by the sonnet review of 7dac329.
// Run:  node --test apple/WebTests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '../../app.js'), 'utf8');
const between = (from, to) => {
  const i = src.indexOf(from), j = src.indexOf(to, i);
  assert.ok(i >= 0 && j > i, from);
  return src.slice(i, j);
};

function setup(effectiveActive) {
  let resets = 0;
  const c = vm.createContext({
    window: {}, isPro: true, activeId: 'tank2', registry: {}, tests: [],
    TankStore: { effectiveActive },
    load: () => [], repaint: () => {}, today: () => '2026-01-01',
    document: { getElementById: (id) => id === 'testform' ? { reset() { resets++; } } : { value: '' } },
  });
  vm.runInContext(between('function resetEntryForm', '// Native has already checked') , c);
  return { c, resets: () => resets };
}

test('tankmateApplyNative clears the entry form when the active tank changes', () => {
  const { c, resets } = setup((_r, pro) => (pro ? 'tank2' : 'default'));
  c.window.tankmateApplyNative({ isPro: false }); // lapse: tank2 -> default
  assert.equal(resets(), 1);
});

test('tankmateApplyNative leaves the form alone when the active tank is unchanged', () => {
  const { c, resets } = setup(() => 'tank2');
  c.window.tankmateApplyNative({ isPro: true });
  assert.equal(resets(), 0);
});
