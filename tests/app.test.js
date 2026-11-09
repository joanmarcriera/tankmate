'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, memoryStorage } = require('./harness');
const STORE = 'tankmate.tests.v1';

test('first run seeds history and renders without errors', () => {
  const app = loadApp();
  assert.equal(app.run('tests.length'), 3);
  assert.ok(app.els.history.innerHTML.includes('2026-06-11'));
  assert.match(app.els['trend-cards'].innerHTML, /ppm\/week/);
});

test('corrupt stored data is backed up, not silently overwritten by the seed', () => {
  const storage = memoryStorage({ [STORE]: '[{"date":"2026-01-01","nh3":0},' }); // truncated JSON
  const sink = [];
  loadApp({ storage, consoleSink: sink });
  assert.equal(storage.getItem(STORE + '.corrupt'), '[{"date":"2026-01-01","nh3":0},');
  assert.ok(sink.some(([lvl]) => lvl === 'warn'), 'the failure is logged, not swallowed');
});

test('non-array stored JSON does not crash the app', () => {
  const storage = memoryStorage({ [STORE]: '{"date":"2026-01-01"}' });
  const app = loadApp({ storage });
  assert.equal(app.run('Array.isArray(tests)'), true);
  assert.equal(storage.getItem(STORE + '.corrupt'), '{"date":"2026-01-01"}');
});

test('records without a date are dropped instead of crashing the sort', () => {
  const storage = memoryStorage({ [STORE]: JSON.stringify([{ nh3: 0 }, { date: '2026-02-01', nh3: 0, kh: 7, no3: 10 }]) });
  const app = loadApp({ storage });
  assert.equal(app.run('tests.length'), 1);
});

test('NaN / out-of-range stored readings do not break Trends', () => {
  const storage = memoryStorage({ [STORE]: JSON.stringify([
    { date: '2026-01-01', no3: 10, kh: 7 },
    { date: '2026-01-08', no3: 'abc', kh: 'abc' },
    { date: '2026-01-09', no3: -4, kh: -1 },
    { date: '2026-01-15', no3: 20, kh: 6 },
  ]) });
  const app = loadApp({ storage });
  const html = app.els['trend-cards'].innerHTML;
  assert.ok(!html.includes('NaN'), html);
  assert.match(html, /\+5\.0 <small>ppm\/week/); // 10 → 20 over 14 days
  assert.match(html, /6 <small>dKH/);
});

test('a failed save is reported to the user, not swallowed', () => {
  const storage = memoryStorage({ [STORE]: '[]' }, { failWrites: true });
  const sink = [];
  const app = loadApp({ storage, consoleSink: sink });
  app.els['f-nh3'].value = '0';
  const submit = app.els.testform.listeners.submit[0];
  submit({ preventDefault() {}, target: { reset() {} } });
  assert.match(app.els.verdicts.innerHTML, /Not saved/);
  assert.ok(sink.some(([lvl]) => lvl === 'error'));
});

test('tab switching exposes the current tab to assistive tech', () => {
  const app = loadApp();
  app.run('show("trends")');
  const byTab = Object.fromEntries(app.tabs.map(b => [b.dataset.tab, b.getAttribute('aria-current')]));
  assert.equal(byTab.trends, 'page');
  assert.equal(byTab.log, null);
});
