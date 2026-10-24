// Unit tests for cycling.js (new-tank cycling state). Spec: docs/market/CYCLING-SPEC.md
// Run:  node --test apple/WebTests/cycling.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../cycling.js');

const pass = (date) => ({ date, nh3: 0, no2: 0, no3: 5, dose: 2, hoursSinceDose: 24 });

test('no tests -> no-data, never safe', () => {
  const r = C.cyclingState([]);
  assert.equal(r.state, 'no-data');
  assert.equal(r.safeToAddFish, false);
});

test('undefined/garbage input does not throw', () => {
  assert.equal(C.cyclingState(undefined).state, 'no-data');
  assert.equal(C.cyclingState([null, {}]).state, 'no-data');
});

test('missing nitrite in latest test -> no-data (fail closed)', () => {
  const r = C.cyclingState([{ date: '2026-10-01', nh3: 0, no2: null, no3: 5 }]);
  assert.equal(r.state, 'no-data');
  assert.equal(r.safeToAddFish, false);
});

test('ammonia present, nitrite 0 -> ammonia phase', () => {
  const r = C.cyclingState([{ date: '2026-10-01', nh3: 1, no2: 0, no3: 0 }]);
  assert.equal(r.state, 'ammonia');
  assert.equal(r.safeToAddFish, false);
});

test('any nitrite -> nitrite phase, even with ammonia 0 and nitrate present', () => {
  const r = C.cyclingState([{ date: '2026-10-10', nh3: 0, no2: 0.25, no3: 10 }]);
  assert.equal(r.state, 'nitrite');
  assert.equal(r.safeToAddFish, false);
});

test('nitrite beats ammonia when both are above 0', () => {
  assert.equal(C.cyclingState([{ date: '2026-10-10', nh3: 0.5, no2: 1, no3: 0 }]).state, 'nitrite');
});

test('zeros with no nitrate -> clearing (nothing converted yet)', () => {
  const r = C.cyclingState([{ date: '2026-10-01', nh3: 0, no2: 0, no3: 0 }]);
  assert.equal(r.state, 'clearing');
  assert.equal(r.safeToAddFish, false);
});

test('zeros with nitrate but no dose test -> unconfirmed, not safe', () => {
  const r = C.cyclingState([{ date: '2026-10-20', nh3: 0, no2: 0, no3: 10 }]);
  assert.equal(r.state, 'unconfirmed');
  assert.equal(r.safeToAddFish, false);
  assert.equal(r.passes, 0);
});

test('one passing 24 h dose test is unconfirmed', () => {
  const r = C.cyclingState([pass('2026-10-20')]);
  assert.equal(r.state, 'unconfirmed');
  assert.equal(r.passes, 1);
  assert.equal(r.safeToAddFish, false);
});

test('two passing dose tests on different dates -> ready and safe', () => {
  const r = C.cyclingState([pass('2026-10-20'), pass('2026-10-21')]);
  assert.equal(r.state, 'ready');
  assert.equal(r.safeToAddFish, true);
  assert.equal(r.passes, 2);
});

test('two passes on the SAME date count once', () => {
  const r = C.cyclingState([pass('2026-10-20'), pass('2026-10-20')]);
  assert.equal(r.passes, 1);
  assert.equal(r.safeToAddFish, false);
});

test('a dose below 2 ppm or read after 24 h is not a pass', () => {
  assert.equal(C.isPass({ ...pass('d'), dose: 1 }), false);
  assert.equal(C.isPass({ ...pass('d'), hoursSinceDose: 30 }), false);
  assert.equal(C.isPass({ ...pass('d'), hoursSinceDose: null }), false);
  assert.equal(C.isPass({ ...pass('d'), no3: 0 }), false);
  assert.equal(C.isPass(pass('d')), true);
});

test('a later bad test overrides earlier passes (latest reading rules)', () => {
  const r = C.cyclingState([pass('2026-10-20'), pass('2026-10-21'),
    { date: '2026-10-22', nh3: 0, no2: 0.5, no3: 8 }]);
  assert.equal(r.state, 'nitrite');
  assert.equal(r.safeToAddFish, false);
});

test('unsorted input is ordered by date', () => {
  const r = C.cyclingState([pass('2026-10-21'), { date: '2026-10-01', nh3: 2, no2: 0, no3: 0 }, pass('2026-10-20')]);
  assert.equal(r.state, 'ready');
});

test('stale latest test withdraws "safe"', () => {
  const r = C.cyclingState([pass('2026-10-20'), pass('2026-10-21')], { today: '2026-10-30' });
  assert.equal(r.stale, true);
  assert.equal(r.safeToAddFish, false);
  assert.match(r.reason, /retest/);
});

test('fresh latest test within 3 days stays safe', () => {
  const r = C.cyclingState([pass('2026-10-20'), pass('2026-10-21')], { today: '2026-10-24' });
  assert.equal(r.stale, false);
  assert.equal(r.safeToAddFish, true);
});

test('only "ready" is ever safe: sweep of every non-ready fixture', () => {
  const fixtures = [
    [], [{ date: '2026-10-01', nh3: 1, no2: 0 }], [{ date: '2026-10-01', nh3: 0, no2: 1, no3: 5 }],
    [{ date: '2026-10-01', nh3: 0, no2: 0, no3: 0 }], [pass('2026-10-20')],
  ];
  for (const f of fixtures) assert.equal(C.cyclingState(f).safeToAddFish, false);
});
