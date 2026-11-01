// Verdict engine: RULES thresholds, verdictsFor() ordering, worst().
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './_load.mjs';

const { RULES, verdictsFor, worst } = loadApp();
// Arrays built inside the vm belong to another realm; copy before deepEqual.
const arr = (a) => Array.from(a);
const level = (k, v) => RULES[k](v)?.level ?? null;

describe('NH3 ammonia: only 0 is good, anything visible is bad', () => {
  test('0 ppm is good', () => assert.equal(level('nh3', 0), 'good'));
  test('0.25 ppm (first kit colour) is bad', () => assert.equal(level('nh3', 0.25), 'bad'));
  test('0.01 ppm is bad', () => assert.equal(level('nh3', 0.01), 'bad'));
  test('8 ppm is bad and says water change TODAY', () => {
    const r = RULES.nh3(8);
    assert.equal(r.level, 'bad');
    assert.match(r.action, /water change TODAY/);
  });
  test('good verdict carries no action', () => assert.equal(RULES.nh3(0).action, undefined));
  test('negative ammonia is rejected rather than called toxic',
    { todo: 'no input validation: -1 ppm is reported as "-1 ppm — toxic"' },
    () => assert.equal(level('nh3', -1), null));
});

describe('NO2 nitrite: only 0 is good, anything visible is bad', () => {
  test('0 ppm is good', () => assert.equal(level('no2', 0), 'good'));
  test('0.25 ppm is bad', () => assert.equal(level('no2', 0.25), 'bad'));
  test('0.5 ppm (seed spike) is bad and says water changes until 0', () => {
    const r = RULES.no2(0.5);
    assert.equal(r.level, 'bad');
    assert.match(r.action, /until it reads 0/);
  });
});

describe('NO3 nitrate: good <=20, warn <=40, bad above', () => {
  test('0 ppm is good', () => assert.equal(level('no3', 0), 'good'));
  test('20 ppm (upper edge of green zone) is good', () => assert.equal(level('no3', 20), 'good'));
  test('20.1 ppm is warn', () => assert.equal(level('no3', 20.1), 'warn'));
  test('21 ppm is warn', () => assert.equal(level('no3', 21), 'warn'));
  test('40 ppm ("don\'t let it pass ~40") is still warn', () => assert.equal(level('no3', 40), 'warn'));
  test('40.1 ppm is bad', () => assert.equal(level('no3', 40.1), 'bad'));
  test('160 ppm is bad', () => assert.equal(level('no3', 160), 'bad'));
  test('negative nitrate is rejected rather than called green',
    { todo: 'no input validation: -5 ppm is reported as "-5 ppm — green zone"' },
    () => assert.equal(level('no3', -5), null));
});

describe('KH buffer: good >=7, warn 5-6, bad <=4', () => {
  test('7 dKH is good', () => assert.equal(level('kh', 7), 'good'));
  test('17 dKH (hard tap) is good', () => assert.equal(level('kh', 17), 'good'));
  test('6.9 dKH is warn', () => assert.equal(level('kh', 6.9), 'warn'));
  test('6 dKH is warn', () => assert.equal(level('kh', 6), 'warn'));
  test('5 dKH is warn', () => assert.equal(level('kh', 5), 'warn'));
  test('4 dKH is bad and says SAME DAY (matches playbook "KH <= 4")', () => {
    const r = RULES.kh(4);
    assert.equal(r.level, 'bad');
    assert.match(r.action, /SAME DAY/);
  });
  test('3 dKH (seed reading) is bad', () => assert.equal(level('kh', 3), 'bad'));
  test('0 dKH is bad', () => assert.equal(level('kh', 0), 'bad'));
  test('4.5 dKH follows the playbook threshold "KH <= 4" (would be warn)',
    { todo: 'code uses v>=5 for warn, so 4.1-4.9 dKH is "danger / water change SAME DAY" though the playbook card says KH <= 4' },
    () => assert.equal(level('kh', 4.5), 'warn'));
});

describe('Temperature: good 23-27 °C inclusive, warn outside', () => {
  test('23 °C is good', () => assert.equal(level('temp', 23), 'good'));
  test('27 °C is good', () => assert.equal(level('temp', 27), 'good'));
  test('25 °C is good', () => assert.equal(level('temp', 25), 'good'));
  test('22.9 °C is warn', () => assert.equal(level('temp', 22.9), 'warn'));
  test('27.1 °C is warn', () => assert.equal(level('temp', 27.1), 'warn'));
  test('0 °C is warn (never bad)', () => assert.equal(level('temp', 0), 'warn'));
  test('40 °C is warn with heater action', () => {
    const r = RULES.temp(40);
    assert.equal(r.level, 'warn');
    assert.match(r.action, /heater/);
  });
});

describe('pH and GH are informational (always good)', () => {
  test('pH 4 is good/informational', () => assert.equal(level('ph', 4), 'good'));
  test('pH 9 is good/informational', () => assert.equal(level('ph', 9), 'good'));
  test('GH 0 is good/informational', () => assert.equal(level('gh', 0), 'good'));
  test('GH 30 is good/informational', () => assert.equal(level('gh', 30), 'good'));
});

describe('missing and non-numeric readings are skipped', () => {
  for (const k of ['nh3', 'no2', 'no3', 'kh', 'ph', 'gh', 'temp']) {
    test(`${k}: null, undefined and NaN give no verdict`, () => {
      assert.equal(RULES[k](null), null);
      assert.equal(RULES[k](undefined), null);
      assert.equal(RULES[k](NaN), null);
    });
  }
  test('non-numeric string "abc" gives no verdict', () => assert.equal(RULES.nh3('abc'), null));
  test('empty string gives no verdict',
    { todo: 'isNaN("") is false, so "" reaches the rule and reads " ppm — toxic"; the form maps "" to null so only stored/imported data can hit this' },
    () => assert.equal(RULES.nh3(''), null));
  test('string "0" ammonia is good',
    { todo: 'nh3/no2 use v===0, so a string "0" (e.g. from imported or hand-edited data) reads "0 ppm — toxic"' },
    () => assert.equal(level('nh3', '0'), 'good'));
  test('verdict tags never contain NaN for any numeric input', () => {
    for (const k of Object.keys(RULES)) for (const v of [0, 1, 4.5, 20, 1e6, -1]) {
      assert.doesNotMatch(RULES[k](v).tag, /NaN|undefined/, `${k}(${v})`);
    }
  });
});

describe('verdictsFor(): labels, skipping and worst-first ordering', () => {
  test('a full healthy test gives 7 good verdicts with labels', () => {
    const vs = verdictsFor({ nh3: 0, no2: 0, no3: 10, kh: 7, ph: 7.4, gh: 12, temp: 25 });
    assert.equal(vs.length, 7);
    assert.ok(vs.every((v) => v.level === 'good'));
    assert.equal(vs.find((v) => v.key === 'kh').label, 'KH buffer');
  });
  test('parameters left blank are omitted', () => {
    const vs = verdictsFor({ nh3: 0, no2: null, no3: 10 });
    assert.deepEqual(arr(vs.map((v) => v.key)), ['nh3', 'no3']);
  });
  test('bad sorts before warn before good', () => {
    const vs = verdictsFor({ nh3: 0, no3: 30, kh: 3, temp: 25 });
    assert.deepEqual(arr(vs.map((v) => v.level)), ['bad', 'warn', 'good', 'good']);
    assert.equal(vs[0].key, 'kh');
  });
  test('within the same level the canonical order nh3,no2,... is kept', () => {
    const vs = verdictsFor({ temp: 30, no3: 25, no2: 0.5, nh3: 1 });
    assert.deepEqual(arr(vs.map((v) => v.key)), ['nh3', 'no2', 'no3', 'temp']);
  });
  test('unknown keys are ignored', () => assert.equal(verdictsFor({ foo: 99, nh3: 0 }).length, 1));
  test('calling twice does not share verdict objects', () => {
    const a = verdictsFor({ nh3: 0 })[0];
    const b = verdictsFor({ nh3: 0 })[0];
    assert.notEqual(a, b);
  });
});

describe('worst(): most severe level wins', () => {
  test('one bad among goods → bad', () => assert.equal(worst({ nh3: 0, no2: 0, no3: 10, kh: 4 }), 'bad'));
  test('warn among goods → warn', () => assert.equal(worst({ nh3: 0, no3: 25, kh: 7 }), 'warn'));
  test('bad beats warn regardless of key order', () => assert.equal(worst({ temp: 30, no3: 30, nh3: 0.25 }), 'bad'));
  test('all good → good', () => assert.equal(worst({ nh3: 0, no2: 0, no3: 10, kh: 7, temp: 25 }), 'good'));
  test('seed history reads bad, bad, good', () => {
    const { SEED } = loadApp();
    assert.deepEqual(arr(SEED.map((t) => worst(t))), ['bad', 'bad', 'good']);
  });
  test('a test with no readings is not reported as healthy',
    { todo: 'worst({}) returns "good", so an empty form submit shows a green dot and the holiday sheet says "everything was healthy"' },
    () => assert.notEqual(worst({}), 'good'));
});
