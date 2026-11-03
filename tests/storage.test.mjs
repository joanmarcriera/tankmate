// Persistence and seeding (localStorage), plus the esc() HTML escaper.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './_load.mjs';

describe('load / seed', () => {
  test('empty storage seeds the 3 SEED tests and persists them', () => {
    const app = loadApp();
    assert.equal(app.getTests().length, 3);
    assert.equal(JSON.parse(app.localStorage.getItem(app.STORE)).length, 3);
  });
  test('existing tests are loaded instead of SEED', () => {
    const app = loadApp({ tests: [{ date: '2026-01-01', nh3: 0 }] });
    assert.equal(app.getTests().length, 1);
    assert.equal(app.getTests()[0].date, '2026-01-01');
  });
  test('corrupt JSON in storage falls back to SEED instead of crashing', () => {
    const app = loadApp();
    app.localStorage.setItem(app.STORE, '{not json');
    assert.equal(app.load(), null);
  });
  test('save() round-trips through load()', () => {
    const app = loadApp();
    app.save([{ date: '2026-02-02', kh: 6 }]);
    assert.equal(app.load()[0].kh, 6);
  });
  test('NaN does not survive a save/load round-trip (stored as null, then skipped)', () => {
    const app = loadApp();
    app.save([{ date: '2026-02-02', nh3: NaN }]);
    const t = app.load()[0];
    assert.equal(t.nh3, null);
    assert.equal(app.verdictsFor(t).length, 0);
  });
  test('SEED dates are ISO YYYY-MM-DD and in order', () => {
    const { SEED } = loadApp();
    const dates = SEED.map((t) => t.date);
    assert.ok(dates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)));
    assert.deepEqual(Array.from(dates), [...dates].sort());
  });
});

describe('esc()', () => {
  const { esc } = loadApp();
  test('escapes & < > " \'', () => assert.equal(esc(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;'));
  test('leaves plain text alone', () => assert.equal(esc('Fluval Flex 57 L'), 'Fluval Flex 57 L'));
  test('stringifies non-strings', () => assert.equal(esc(42), '42'));
});
