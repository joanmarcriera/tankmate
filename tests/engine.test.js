'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
// Pin a zone east of UTC so the localDate test fails if toISOString() comes back.
process.env.TZ = 'Europe/Madrid';
const { loadApp } = require('./harness');

const app = loadApp();
const v = (k, x) => app.run(`verdict(${JSON.stringify(k)}, ${x})`);
const levels = (t) => app.run(`verdictsFor(${JSON.stringify(t)})`).map(r => `${r.key}:${r.level}`);

test('known-good thresholds are unchanged', () => {
  assert.equal(v('nh3', 0).level, 'good');
  assert.equal(v('nh3', 0.25).level, 'bad');
  assert.equal(v('no2', 0.5).level, 'bad');
  assert.equal(v('no3', 20).level, 'good');
  assert.equal(v('no3', 21).level, 'warn');
  assert.equal(v('no3', 41).level, 'bad');
  assert.equal(v('kh', 7).level, 'good');
  assert.equal(v('kh', 5).level, 'warn');
  assert.equal(v('kh', 4).level, 'bad');
  assert.equal(v('temp', 25).level, 'good');
  assert.equal(v('temp', 29).level, 'warn');
});

test('missing / NaN / empty readings are skipped, not judged', () => {
  for (const x of ['null', 'undefined', 'NaN', '""', '"abc"']) {
    assert.equal(v('nh3', x), null, `nh3(${x})`);
    assert.equal(v('kh', x), null, `kh(${x})`);
  }
  assert.deepEqual(levels({ date: '2026-01-01' }), []);
});

test('empty string is not read as toxic ammonia', () => {
  // Before: RULES.nh3('') returned "bad — toxic" ('' == null is false, isNaN('') is false).
  assert.equal(v('nh3', '""'), null);
  assert.equal(v('no2', '""'), null);
});

test('numeric strings from stored/imported data are coerced', () => {
  // Before: "0" !== 0, so a stored "0" ammonia read as toxic.
  assert.equal(v('nh3', '"0"').level, 'good');
  assert.equal(v('no2', '"0"').level, 'good');
  assert.equal(v('kh', '"7"').level, 'good');
});

test('negative readings get a check-reading verdict, not a chemical one', () => {
  // Before: nh3 -1 → "toxic", no3 -5 → "green zone", kh -1 → "danger".
  for (const k of ['nh3', 'no2', 'no3', 'kh', 'gh', 'ph', 'temp']) {
    const r = v(k, -1);
    assert.equal(r.level, 'warn', k);
    assert.match(r.tag, /check reading/, k);
    assert.ok(r.action, k);
  }
});

test('impossible values (pH > 14, Infinity, °F typed as °C extremes) are flagged', () => {
  assert.match(v('ph', 74).tag, /check reading/); // missing decimal point
  assert.match(v('nh3', 'Infinity').tag, /check reading/);
  assert.match(v('temp', 120).tag, /check reading/);
  assert.equal(v('ph', 7.4).level, 'good');
  assert.equal(v('ph', 0).level, 'good');
  assert.equal(v('ph', 14).level, 'good');
});

test('worst-first ordering, check-reading sits with warnings', () => {
  assert.deepEqual(levels({ date: 'x', nh3: 0, kh: 3, no3: 30 }), ['kh:bad', 'no3:warn', 'nh3:good']);
  assert.equal(app.run(`worst({date:'x', nh3:-2})`), 'warn');
});

test('verdict tags are HTML-escaped when rendered', () => {
  const el = { innerHTML: '' };
  app.run('globalThis.__el = {innerHTML:""}');
  app.run(`renderVerdicts({date:'<img src=x onerror=1>', nh3:0}, __el)`);
  const html = app.run('__el.innerHTML');
  assert.ok(!html.includes('<img'), html);
  assert.ok(html.includes('&lt;img'));
  void el;
});

test('nitrate rate: per week, never "-0.0"', () => {
  assert.equal(app.run(`nitrateRate({date:'2026-01-01',no3:10},{date:'2026-01-08',no3:20})`), '10.0');
  assert.equal(app.run(`nitrateRate({date:'2026-01-01',no3:10},{date:'2026-01-01',no3:10})`), '0.0');
  assert.equal(app.run(`nitrateRate({date:'2026-01-01',no3:10},{date:'2026-03-01',no3:9.99})`), '0.0');
});

test('handover days: whole days ≥ 1, fallback 7', () => {
  const d = x => app.run(`handoverDays(${JSON.stringify(x)})`);
  assert.equal(d('10'), 10);
  assert.equal(d(''), 7);
  assert.equal(d('-3'), 7); // before: "-3 days" sheet
  assert.equal(d('0'), 7);
  assert.equal(d('2.6'), 3);
  assert.equal(d('abc'), 7);
  assert.equal(d('100000'), 365);
});

test('localDate uses the local calendar day, not UTC', () => {
  // 00:30 on 5 Jan local time. With toISOString() this is 4 Jan anywhere east of UTC.
  assert.equal(app.run('localDate(new Date(2026, 0, 5, 0, 30))'), '2026-01-05');
  assert.equal(app.run('localDate(new Date(2026, 11, 31, 23, 59))'), '2026-12-31');
});
