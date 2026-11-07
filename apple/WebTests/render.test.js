// Rendering regressions pulled out of app.js (no DOM needed: the pieces are extracted
// and run in a vm with a fake document).
//   - t.date from storage is escaped everywhere it is rendered (stored XSS)
//   - the history status dot has screen-reader text and is hidden from the a11y tree
//   - chart x-axis date labels
// Run:  node --test apple/WebTests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '../../app.js'), 'utf8');
const line = (prefix) => { const l = src.split('\n').find(x => x.startsWith(prefix)); assert.ok(l, prefix); return l; };
const block = (head) => { const i = src.indexOf(head); assert.ok(i >= 0, head); return src.slice(i, src.indexOf('\n}\n', i) + 3); };

function ctx(tests) {
  const el = { innerHTML: '', insertAdjacentHTML(_, h) { this.innerHTML = h + this.innerHTML; } };
  const c = vm.createContext({
    tests, storagePersistent: true,
    document: { getElementById: () => el },
    verdictsFor: () => [{ level: 'good', label: 'KH', tag: 'ok', meaning: 'm' }],
    worst: (t) => t.level || 'good',
  });
  vm.runInContext([line('const esc'), line('const DOT_TEXT'), block('function renderHistory'), block('function renderVerdicts'),
    line('const MONTHS'), line('function shortDate'), line('function chartLabelIdx')].join('\n'), c);
  return { c, el };
}

const EVIL = '2026-01-01"><img src=x onerror=alert(1)>';

test('renderHistory escapes t.date', () => {
  const { c, el } = ctx([{ date: EVIL }]);
  vm.runInContext('renderHistory()', c);
  assert.ok(!el.innerHTML.includes('<img'), el.innerHTML);
  assert.ok(el.innerHTML.includes('&lt;img'));
});

test('renderVerdicts escapes t.date', () => {
  const { c } = ctx([]);
  const out = { innerHTML: '' };
  c.t = { date: EVIL }; c.out = out;
  vm.runInContext('renderVerdicts(t, out)', c);
  assert.ok(!out.innerHTML.includes('<img'), out.innerHTML);
});

test('history dot: decorative dot hidden, state spoken', () => {
  const { c, el } = ctx([{ date: '2026-01-01', level: 'bad' }]);
  vm.runInContext('renderHistory()', c);
  assert.match(el.innerHTML, /class="dot bad" aria-hidden="true"/);
  assert.match(el.innerHTML, /class="sr-only"> — action needed</);
});

test('storage blocked: history says readings will not be kept', () => {
  const { c, el } = ctx([]);
  c.storagePersistent = false;
  vm.runInContext('renderHistory()', c);
  assert.match(el.innerHTML, /storage is blocked/i);
});

test('shortDate / chartLabelIdx', () => {
  const { c } = ctx([]);
  assert.equal(vm.runInContext("shortDate('2026-06-11')", c), '11 Jun');
  assert.equal(vm.runInContext("shortDate('garbage')", c), 'garbage');
  assert.deepEqual(Array.from(vm.runInContext('chartLabelIdx(2)', c)), [0, 1]);
  assert.deepEqual(Array.from(vm.runInContext('chartLabelIdx(3)', c)), [0, 1, 2]);
  assert.deepEqual(Array.from(vm.runInContext('chartLabelIdx(10)', c)), [0, 3, 6, 9]);
});

test('renderHandover escapes the last test date', () => {
  const els = { 'h-days': { value: '7' }, 'h-friend': { value: '' }, handover: { innerHTML: '' } };
  const c = vm.createContext({ tests: [{ date: EVIL }], document: { getElementById: id => els[id] }, esc: null, worst: () => 'good' });
  vm.runInContext(line('const esc') + '\n' + block('function renderHandover'), c);
  vm.runInContext('renderHandover()', c);
  assert.ok(!els.handover.innerHTML.includes('<img'), els.handover.innerHTML);
});

test('load(): drops records without a string date, nulls non-numeric readings, backs up the raw string', () => {
  const store = new Map([['k', JSON.stringify([{ date: '2026-01-01', kh: 'abc', no3: 10 }, { date: 5 }, null])]]);
  const c = vm.createContext({ storage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, v) }, STORE_NOW: () => 'k', Date });
  vm.runInContext(line('const NUMERIC') + '\n' + line('const cleanTest') .replace(/$/, '') + '\n' + src.slice(src.indexOf('  ? Object.fromEntries'), src.indexOf('\n', src.indexOf('  ? Object.fromEntries'))) + '\n' + block('const load'), c);
  const out = vm.runInContext('load()', c);
  assert.equal(out.length, 1);
  assert.equal(out[0].kh, null);
  assert.equal(out[0].no3, 10);
  assert.ok([...store.keys()].some(k => k.startsWith('k.corrupt-')), 'raw string backed up');
});
