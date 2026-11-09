// Calculation-correctness tests for app.js. Plain node:test, no dependencies.
// Run: node --test tests/
'use strict';
process.env.TZ = 'Europe/Madrid'; // a zone with DST, so DST bugs would show
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadApp(stored) {
  const els = {};
  const el = id => (els[id] ||= {
    id, value: '', innerHTML: '', clientWidth: 300, dataset: {},
    addEventListener() {}, scrollIntoView() {}, reset() {},
    classList: { toggle() {} },
    getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }),
  });
  const mem = new Map(stored ? [['tankmate.tests.v1', JSON.stringify(stored)]] : []);
  const ctx = vm.createContext({
    document: { getElementById: el, querySelectorAll: () => [] },
    localStorage: { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) },
    navigator: {}, window: { addEventListener() {} }, devicePixelRatio: 1, console,
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8'), ctx);
  return { run: c => vm.runInContext(c, ctx), el };
}
const app = loadApp();
const R = app.run('RULES');
const lvl = (k, v) => R[k](v)?.level ?? null;

// ---- verdict thresholds (boundaries) ----
test('ammonia / nitrite: 0 is good, any positive reading is bad', () => {
  for (const k of ['nh3', 'no2']) {
    assert.equal(lvl(k, 0), 'good');
    assert.equal(lvl(k, 0.01), 'bad');
    assert.equal(lvl(k, 0.25), 'bad');
    assert.equal(lvl(k, null), null);
    assert.equal(lvl(k, NaN), null);
  }
});
test('nitrate bands: ≤20 good, ≤40 warn, >40 bad', () => {
  assert.equal(lvl('no3', 0), 'good');
  assert.equal(lvl('no3', 20), 'good');
  assert.equal(lvl('no3', 20.5), 'warn');
  assert.equal(lvl('no3', 40), 'warn');
  assert.equal(lvl('no3', 41), 'bad');
  assert.equal(lvl('no3', 160), 'bad'); // top of common hobby kit charts
});
test('KH bands: ≥7 good, 5–6 warn, ≤4 bad (integer kits, as the Playbook says)', () => {
  assert.equal(lvl('kh', 17), 'good');
  assert.equal(lvl('kh', 7), 'good');
  assert.equal(lvl('kh', 6), 'warn');
  assert.equal(lvl('kh', 5), 'warn');
  assert.equal(lvl('kh', 4), 'bad');
  assert.equal(lvl('kh', 0), 'bad');
});
test('temperature: 23–27 °C inclusive is good, outside warns', () => {
  assert.equal(lvl('temp', 23), 'good');
  assert.equal(lvl('temp', 27), 'good');
  assert.equal(lvl('temp', 22.9), 'warn');
  assert.equal(lvl('temp', 27.1), 'warn');
  // 77 typed as if °F is not silently accepted as fine
  assert.equal(lvl('temp', 77), 'warn');
  assert.match(R.temp(25).tag, /°C/);
});
test('pH and GH are informational only', () => {
  assert.equal(lvl('ph', 7.4), 'good');
  assert.match(R.gh(10).tag, /dGH/);
});

// ---- date arithmetic ----
test('daysBetween: whole days across both DST changes and month/year ends', () => {
  const d = app.run('daysBetween');
  assert.equal(d('2026-03-28', '2026-03-30'), 2);   // EU spring forward (29 Mar)
  assert.equal(d('2026-10-24', '2026-10-26'), 2);   // EU fall back (25 Oct)
  assert.equal(d('2026-03-07', '2026-03-09'), 2);   // US spring forward (8 Mar)
  assert.equal(d('2026-01-31', '2026-03-01'), 29);  // Jan end → Mar 1 (non-leap Feb)
  assert.equal(d('2028-02-28', '2028-03-01'), 2);   // leap year
  assert.equal(d('2025-12-31', '2026-01-01'), 1);   // year end
  assert.equal(d('2026-06-11', '2026-06-11'), 0);
});
test('daysBetween is the same in other time zones', () => {
  for (const tz of ['America/New_York', 'Australia/Sydney', 'UTC']) {
    process.env.TZ = tz;
    assert.equal(app.run('daysBetween')('2026-03-28', '2026-03-30'), 2, tz);
    assert.equal(app.run('daysBetween')('2026-10-03', '2026-10-05'), 2, tz); // AU DST 4 Oct
  }
  process.env.TZ = 'Europe/Madrid';
});

// ---- nitrate rate ----
test('nitrate rate = Δppm / days × 7', () => {
  const r = app.run('nitrateRatePerWeek');
  assert.equal(r({ date: '2026-06-01', no3: 10 }, { date: '2026-06-08', no3: 20 }), 10);
  assert.equal(r({ date: '2026-06-01', no3: 10 }, { date: '2026-06-15', no3: 20 }), 5);
  assert.equal(r({ date: '2026-06-01', no3: 20 }, { date: '2026-06-08', no3: 10 }), -10);
  assert.equal(r({ date: '2026-03-28', no3: 10 }, { date: '2026-03-30', no3: 12 }).toFixed(1), '7.0'); // across DST
});
test('nitrate interval skips same-day retests instead of inventing a weekly rate', () => {
  const iv = s => JSON.parse(JSON.stringify(app.run('nitrateInterval')(s)));
  const a = { date: '2026-06-01', no3: 10 }, b = { date: '2026-06-08', no3: 10 }, c = { date: '2026-06-08', no3: 20 };
  assert.deepEqual(iv([a, b, c]), [a, c]);       // compare against the earlier DAY
  assert.equal(iv([b, c]), null);                 // only one day of data → no trend
  assert.equal(iv([a]), null);
  assert.equal(iv([]), null);
});
test('Trends card: same-day retest no longer shows +70 ppm/week', () => {
  const a = loadApp([{ date: '2026-06-08', no3: 10 }, { date: '2026-06-08', no3: 20 }]);
  assert.match(a.el('trend-cards').innerHTML, /different days/);
  assert.doesNotMatch(a.el('trend-cards').innerHTML, /ppm\/week/);
  const b = loadApp([{ date: '2026-06-01', no3: 10 }, { date: '2026-06-08', no3: 20 }]);
  assert.match(b.el('trend-cards').innerHTML, /\+10\.0 <small>ppm\/week/);
});
test('seed data: 20 → 10 ppm over 12 days reads -5.8 ppm/week', () => {
  const a = loadApp();
  assert.match(a.el('trend-cards').innerHTML, /-5\.8 <small>ppm\/week/);
});

// ---- chart axis ----
test('chart x positions are proportional to elapsed time', () => {
  const xs = app.run('chartXs');
  const p = Array.from(xs(['2026-01-01', '2026-01-02', '2026-01-11'], 120, 10));
  assert.deepEqual(p, [10, 20, 110]);                      // 1 day vs 9 days
  assert.deepEqual(Array.from(xs(['2026-06-01', '2026-06-01'], 120, 10)), [10, 110]); // all same day: spread by index
  assert.deepEqual(Array.from(xs(['2026-06-01'], 120, 10)), [10]);
});
test('chart legend states the unit of each series (they share one axis)', () => {
  const a = loadApp(); a.run('drawChart()');
  assert.match(a.el('legend').innerHTML, /nitrate \(ppm\)/);
  assert.match(a.el('legend').innerHTML, /KH buffer \(dKH\)/);
});

// ---- feeding rotation and holiday handover ----
test('feeding rotation index matches Date.getDay() (0 = Sunday)', () => {
  const rot = app.run('ROTATION.map(r=>r.day)');
  assert.deepEqual(Array.from(rot), ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  assert.equal(new Date(2026, 10, 9).getDay(), 1); // 9 Nov 2026 is a Monday
});
test('holiday visits = ceil(days / 3), at least 1', () => {
  const cases = { 1: 1, 3: 1, 4: 2, 7: 3, 14: 5, 30: 10 };
  for (const [days, visits] of Object.entries(cases)) {
    const a = loadApp();
    a.el('h-days').value = String(days);
    a.run('renderHandover()');
    assert.match(a.el('handover').innerHTML, new RegExp(`<b>${visits} pill-organiser compartment`), `days=${days}`);
  }
  const a = loadApp(); a.el('h-days').value = ''; a.run('renderHandover()');
  assert.match(a.el('handover').innerHTML, /— 7 days/); // blank falls back to a week
});
