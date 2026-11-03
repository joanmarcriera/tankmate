// Trends tab: nitrate rate (ppm/week) over the last interval and the KH watch card.
// renderTrends() writes HTML, so the tests read the rate and level back out of it.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './_load.mjs';

function trend(tests) {
  const app = loadApp({ tests });
  const html = app.document.getElementById('trend-cards').innerHTML;
  const m = html.match(/var\(--(good|warn|bad)\)">([+-]?[\d.]+|NaN) <small>ppm\/week/);
  return { html, level: m?.[1], rate: m?.[2] };
}
const two = (d1, n1, d2, n2) => [{ date: d1, no3: n1 }, { date: d2, no3: n2 }];

describe('nitrate rate maths', () => {
  test('+10 ppm over 7 days is +10.0 ppm/week', () =>
    assert.equal(trend(two('2026-06-01', 10, '2026-06-08', 20)).rate, '+10.0'));
  test('+10 ppm over 14 days is +5.0 ppm/week', () =>
    assert.equal(trend(two('2026-06-01', 10, '2026-06-15', 20)).rate, '+5.0'));
  test('only the last two tests count, in date order not insertion order', () => {
    const t = [{ date: '2026-06-15', no3: 40 }, { date: '2026-06-01', no3: 0 }, { date: '2026-06-08', no3: 40 }];
    assert.equal(trend(t).rate, '0.0');
  });
  test('falling nitrate shows a negative rate without a plus sign', () => {
    const r = trend(two('2026-06-01', 40, '2026-06-08', 10));
    assert.equal(r.rate, '-30.0');
    assert.match(r.html, /Flat or falling/);
  });
  test('two tests on the same day use a 1-day floor, not divide by zero', () =>
    assert.equal(trend(two('2026-06-01', 10, '2026-06-01', 12)).rate, '+14.0'));
  test('interval across a month boundary (31 May → 7 Jun) is 7 days', () =>
    assert.equal(trend(two('2026-05-31', 10, '2026-06-07', 17)).rate, '+7.0'));
  test('interval across the spring DST change (22 → 29 Mar) is exactly 7 days', () =>
    assert.equal(trend(two('2026-03-22', 10, '2026-03-29', 17)).rate, '+7.0'));
  test('interval across the autumn DST change (24 → 31 Oct) is exactly 7 days', () =>
    assert.equal(trend(two('2026-10-24', 10, '2026-10-31', 17)).rate, '+7.0'));
  test('interval across a year boundary (28 Dec → 4 Jan) is 7 days', () =>
    assert.equal(trend(two('2025-12-28', 10, '2026-01-04', 17)).rate, '+7.0'));
  test('tests without a nitrate reading are ignored', () => {
    const t = [...two('2026-06-01', 10, '2026-06-08', 15), { date: '2026-06-20', no3: null, kh: 7 }];
    assert.equal(trend(t).rate, '+5.0');
  });
  test('a tiny fall is not shown as "-0.0"',
    { todo: 'toFixed(1) of a small negative rate renders "-0.0 ppm/week"' },
    () => assert.equal(trend(two('2026-06-01', 10, '2026-06-08', 9.99)).rate, '0.0'));
});

describe('nitrate rate levels: good <=5, warn <=10, bad >10 ppm/week', () => {
  test('+5.0/week is good ("gentle, normal")', () => {
    const r = trend(two('2026-06-01', 10, '2026-06-08', 15));
    assert.equal(r.level, 'good');
    assert.match(r.html, /Gentle, normal accumulation/);
  });
  test('+6.0/week is warn ("mild climb")', () => {
    const r = trend(two('2026-06-01', 10, '2026-06-08', 16));
    assert.equal(r.level, 'warn');
    assert.match(r.html, /Mild climb/);
  });
  test('+10.0/week is warn (threshold is strictly greater than 10)', () =>
    assert.equal(trend(two('2026-06-01', 10, '2026-06-08', 20)).level, 'warn'));
  test('+11.0/week is bad ("climbing fast")', () => {
    const r = trend(two('2026-06-01', 10, '2026-06-08', 21));
    assert.equal(r.level, 'bad');
    assert.match(r.html, /Climbing fast/);
  });
  test('0.0/week is good and "flat or falling"', () => {
    const r = trend(two('2026-06-01', 10, '2026-06-08', 10));
    assert.equal(r.level, 'good');
    assert.match(r.html, /Flat or falling/);
  });
});

describe('trend card preconditions and KH watch', () => {
  test('fewer than two nitrate readings asks for more tests', () =>
    assert.match(trend([{ date: '2026-06-01', no3: 10 }]).html, /Log at least two tests/));
  test('KH watch uses the most recent KH reading and its rule', () => {
    const r = trend([{ date: '2026-06-01', kh: 8 }, { date: '2026-06-08', kh: 4 }]);
    assert.match(r.html, /var\(--bad\)">4 <small>dKH/);
    assert.match(r.html, /SAME DAY/);
  });
  test('KH watch on a healthy buffer shows the meaning (no action)', () =>
    assert.match(trend([{ date: '2026-06-08', kh: 9 }]).html, /var\(--good\)">9 <small>dKH.*Comfortable buffer/s));
  test('seed data: last interval 20 → 10 ppm over 12 days is -5.8/week', () =>
    assert.equal(trend(null).rate, '-5.8'));
});
