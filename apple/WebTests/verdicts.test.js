// Direct tests for the verdict engine (RULES / verdictsFor / worst) and the stored-data
// loader in app.js. Closes the Codex "tests" findings 1 and 2 (task 6104): thresholds and
// severity order were only covered indirectly, and unusable saved data had no test.
// The pieces are extracted from app.js and run in a vm (no DOM needed).
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
const line = (prefix) => { const l = src.split('\n').find(x => x.startsWith(prefix)); assert.ok(l, prefix); return l; };

// RULES .. worst (everything up to renderVerdicts)
const engine = vm.createContext({});
vm.runInContext(between('const RULES', 'function renderVerdicts') + '\nthis.RULES=RULES;this.verdictsFor=verdictsFor;this.worst=worst;', engine);
const { RULES, verdictsFor, worst } = engine;

test('NH3 and NO2: 0 is good, any positive value is bad with an action', () => {
  for (const k of ['nh3', 'no2']) {
    assert.equal(RULES[k](0).level, 'good');
    assert.equal(RULES[k](0.25).level, 'bad');
    assert.ok(RULES[k](0.25).action, k);
  }
});

test('null / NaN / undefined readings are omitted, not judged', () => {
  for (const k of Object.keys(RULES)) for (const v of [null, undefined, NaN]) assert.equal(RULES[k](v), null, `${k} ${v}`);
  assert.equal(verdictsFor({ date: '2026-01-01', nh3: null, no3: NaN }).length, 0);
});

test('NO3 boundaries: 20 good, 20.1 warn, 40 warn, 40.1 bad', () => {
  assert.equal(RULES.no3(20).level, 'good');
  assert.equal(RULES.no3(20.1).level, 'warn');
  assert.equal(RULES.no3(40).level, 'warn');
  assert.equal(RULES.no3(40.1).level, 'bad');
});

test('KH boundaries: 7 good, 6.9 warn, 5 warn, 4.9 bad (4 is the same-day water change)', () => {
  assert.equal(RULES.kh(7).level, 'good');
  assert.equal(RULES.kh(6.9).level, 'warn');
  assert.equal(RULES.kh(5).level, 'warn');
  assert.equal(RULES.kh(4.9).level, 'bad');
  assert.equal(RULES.kh(4).level, 'bad');
  assert.match(RULES.kh(4).action, /SAME DAY/);
});

test('temperature: 23..27 good, outside warn', () => {
  for (const v of [23, 25, 27]) assert.equal(RULES.temp(v).level, 'good');
  for (const v of [22.9, 27.1]) assert.equal(RULES.temp(v).level, 'warn');
});

test('pH and GH are informational (always good)', () => {
  assert.equal(RULES.ph(5).level, 'good');
  assert.equal(RULES.gh(30).level, 'good');
});

test('mixed verdicts sort bad -> warn -> good and keep their actions', () => {
  const vs = verdictsFor({ nh3: 0, no3: 30, kh: 3, temp: 25 });
  assert.equal(vs.map(v => v.level).join(), 'bad,warn,good,good');
  assert.equal(vs[0].key, 'kh');
  assert.equal(vs[1].key, 'no3');
  assert.ok(vs[0].action && vs[1].action);
  assert.equal(worst({ nh3: 0, no3: 30, kh: 3 }), 'bad');
  assert.equal(worst({ nh3: 0 }), 'good');
  assert.equal(worst({}), 'good');
});

// ---- stored-data loader (load) ----
function loadWith(raw) {
  const store = new Map(raw === undefined ? [] : [['k', raw]]);
  const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
  const c = vm.createContext({ storage, STORE_NOW: () => 'k', JSON, Date, Array, Object, Number, isFinite });
  vm.runInContext([line('const NUMERIC'), line('const BAD_DATE'), between('const cleanTest', 'const load'), between('const load', '/* Local calendar date')].join('\n') + '\nthis.load=load;', c);
  return { result: c.load(), store };
}

test('load: a JSON object (not an array) is unusable -> null, stored bytes untouched', () => {
  const { result, store } = loadWith('{}');
  assert.equal(result, null);
  assert.equal(store.get('k'), '{}');
});

test('load: malformed JSON is unusable -> null, original bytes untouched', () => {
  const { result, store } = loadWith('{broken');
  assert.equal(result, null);
  assert.equal(store.get('k'), '{broken');
});

test('load: records without a string date are dropped and the raw array is backed up', () => {
  const raw = JSON.stringify([{ date: '2026-01-01', kh: 7, nh3: 'x' }, { kh: 5 }, null]);
  const { result, store } = loadWith(raw);
  assert.equal(result.length, 1);
  assert.equal(result[0].kh, 7);
  assert.equal(result[0].nh3, null, 'non-numeric reading nulled');
  const backup = [...store.keys()].find(k => k.startsWith('k.corrupt-'));
  assert.ok(backup, 'backup key written');
  assert.equal(store.get(backup), raw);
});
