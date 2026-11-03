'use strict';
// Verdict engine tests. Run from the repo root: node --test apple/WebTests/
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./load-app.js');

const { RULES, verdictsFor, worst } = loadApp();
const level = (key, v) => { const r = RULES[key](v); return r ? r.level : null; };

test('app.js boots in the stub and seeds localStorage on first visit', () => {
  const app = loadApp();
  const saved = JSON.parse(app.store.get('tankmate.tests.v1'));
  assert.ok(Array.isArray(saved) && saved.length > 0);
});

test('NO3 boundaries: 20 good, 21 warn, 40 warn, 41 bad', () => {
  assert.equal(level('no3', 20), 'good');
  assert.equal(level('no3', 21), 'warn');
  assert.equal(level('no3', 40), 'warn');
  assert.equal(level('no3', 41), 'bad');
});

test('KH boundaries: 4 bad, 5 warn, 7 good', () => {
  assert.equal(level('kh', 4), 'bad');
  assert.equal(level('kh', 5), 'warn');
  assert.equal(level('kh', 7), 'good');
});

test('KH matches the Playbook: bad <= 4, warn 4-7, good >= 7', () => {
  assert.equal(level('kh', 4), 'bad');
  assert.equal(level('kh', 4.1), 'warn');
  assert.equal(level('kh', 6.9), 'warn');
  assert.equal(level('kh', 7), 'good');
});

test('temp extremes are bad: < 20 or > 30 C', () => {
  assert.equal(level('temp', 19.9), 'bad');
  assert.equal(level('temp', 20), 'warn');
  assert.equal(level('temp', 30), 'warn');
  assert.equal(level('temp', 30.1), 'bad');
  assert.ok(RULES.temp(19.9).action);
  assert.ok(RULES.temp(30.1).action);
});

test('temp boundaries: 22 warn, 23 good, 27 good, 28 warn', () => {
  assert.equal(level('temp', 22), 'warn');
  assert.equal(level('temp', 23), 'good');
  assert.equal(level('temp', 27), 'good');
  assert.equal(level('temp', 28), 'warn');
});

for (const key of ['nh3', 'no2']) {
  test(`${key.toUpperCase()}: 0 is good, 0.25 is bad (toxic)`, () => {
    assert.equal(level(key, 0), 'good');
    const r = RULES[key](0.25);
    assert.equal(r.level, 'bad');
    assert.match(r.tag, /toxic/);
    assert.ok(r.action);
  });
}

test('null, undefined and NaN give no verdict for every parameter', () => {
  for (const key of Object.keys(RULES)) {
    for (const v of [null, undefined, NaN]) assert.equal(RULES[key](v), null, `${key}(${v})`);
  }
});

test('verdictsFor skips missing values and sorts worst first', () => {
  const vs = verdictsFor({ date: '2026-01-01', nh3: 0, no2: null, no3: 30, kh: 3, ph: 7.4, gh: NaN, temp: 25 });
  assert.deepEqual([...vs].map(v => v.key), ['kh', 'no3', 'nh3', 'ph', 'temp']);
  assert.deepEqual([...vs].map(v => v.level), ['bad', 'warn', 'good', 'good', 'good']);
  const rank = { bad: 0, warn: 1, good: 2 };
  for (let i = 1; i < vs.length; i++) assert.ok(rank[vs[i - 1].level] <= rank[vs[i].level]);
  assert.ok(vs.every(v => typeof v.label === 'string' && v.label.length > 0));
});

test('worst() returns the most severe level, and good for an empty test', () => {
  assert.equal(worst({ nh3: 0, no3: 10, kh: 7 }), 'good');
  assert.equal(worst({ nh3: 0, no3: 30, kh: 7 }), 'warn');
  assert.equal(worst({ nh3: 0.25, no3: 30, kh: 7 }), 'bad');
  assert.equal(worst({}), 'good');
  assert.equal(worst({ nh3: null, no3: NaN }), 'good');
});

/* ---- defects: string inputs and negative readings ---- */

test('numeric strings are parsed: "0" reads as good, "0.25" as toxic', () => {
  for (const key of ['nh3', 'no2']) {
    assert.equal(level(key, '0'), 'good', `${key}("0")`);
    assert.equal(level(key, '0.25'), 'bad', `${key}("0.25")`);
  }
  assert.equal(level('no3', '41'), 'bad');
  assert.equal(level('kh', ' 7 '), 'good');
});

test('empty and blank strings give no verdict', () => {
  for (const key of Object.keys(RULES)) {
    for (const v of ['', '   ', 'abc']) assert.equal(RULES[key](v), null, `${key}(${JSON.stringify(v)})`);
  }
});

test('non-finite values give no verdict', () => {
  for (const key of Object.keys(RULES)) {
    for (const v of [Infinity, -Infinity, 'Infinity']) assert.equal(RULES[key](v), null, `${key}(${v})`);
  }
});

test('negative readings give no verdict (not "toxic"/"danger")', () => {
  for (const key of Object.keys(RULES)) assert.equal(RULES[key](-1), null, `${key}(-1)`);
  assert.equal(worst({ nh3: -1, no2: -1, kh: -1 }), 'good');
});

test('a stored negative KH does not crash the Trends KH card at boot', () => {
  assert.doesNotThrow(() => loadApp({ stored: [{ date: '2026-01-01', kh: -1, no3: 10 }] }));
});
