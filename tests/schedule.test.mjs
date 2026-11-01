// Feeding rotation, holiday-handover visit maths and today's-date default,
// with fixed clocks in UK local time so month and DST boundaries are exercised.
process.env.TZ = 'Europe/London';

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './_load.mjs';

const tonight = (now) => loadApp({ now }).document.getElementById('feed-today').innerHTML;
const todayRow = (now) => loadApp({ now }).document.getElementById('rotation').innerHTML
  .match(/class="rot today"><span class="day">(\w+)</)?.[1];

describe('feeding rotation follows the local weekday', () => {
  test('ROTATION has 7 days starting on Sunday', () => {
    const { ROTATION } = loadApp();
    assert.equal(ROTATION.length, 7);
    assert.equal(ROTATION[0].day, 'Sun');
    assert.equal(ROTATION[6].day, 'Sat');
  });
  test('Sunday 1 Nov 2026 → pleco spirulina wafer', () =>
    assert.match(tonight('2026-11-01T18:00:00Z'), /Pleco spirulina wafer/));
  test('Friday 30 Oct 2026 → veg night', () =>
    assert.match(tonight('2026-10-30T18:00:00Z'), /Veg night/));
  test('Wednesday → Repashy Soilent Green', () =>
    assert.match(tonight('2026-10-28T18:00:00Z'), /Repashy Soilent Green/));
  test('month boundary: Sat 31 Oct → Sun 1 Nov moves the highlighted row', () => {
    assert.equal(todayRow('2026-10-31T20:00:00Z'), 'Sat');
    assert.equal(todayRow('2026-11-01T08:00:00Z'), 'Sun');
  });
  test('BST: 23:30 UTC on Sat 13 Jun is already Sunday locally', () =>
    assert.equal(todayRow('2026-06-13T23:30:00Z'), 'Sun'));
  test('autumn DST night (25 Oct 2026, 01:30 BST) is Sunday', () =>
    assert.equal(todayRow('2026-10-25T00:30:00Z'), 'Sun'));
  test('spring DST night (29 Mar 2026, 03:30 BST) is Sunday', () =>
    assert.equal(todayRow('2026-03-29T02:30:00Z'), 'Sun'));
  test('exactly one row is highlighted', () => {
    const html = loadApp({ now: '2026-11-04T12:00:00Z' }).document.getElementById('rotation').innerHTML;
    assert.equal(html.match(/rot today/g).length, 1);
  });
});

describe('test-form date default', () => {
  test('midday: date field defaults to the local date', () =>
    assert.equal(loadApp({ now: '2026-07-01T12:00:00Z' }).document.getElementById('f-date').value, '2026-07-01'));
  test('00:30 BST: date field defaults to the local date, matching the feeding day',
    { todo: 'f-date uses toISOString() (UTC), so between midnight and 01:00 BST it pre-fills yesterday while Feeding already shows today' },
    () => assert.equal(loadApp({ now: '2026-07-01T23:30:00Z' }).document.getElementById('f-date').value, '2026-07-02'));
});

describe('holiday handover: one pill compartment per ~3 days', () => {
  function sheet(days, tests) {
    const app = loadApp({ tests });
    app.document.getElementById('h-days').value = String(days);
    app.document.getElementById('h-friend').value = '';
    app.renderHandover();
    return app.document.getElementById('handover').innerHTML;
  }
  const visits = (html) => Number(html.match(/<b>(\d+) pill-organiser compartment/)[1]);
  test('1 day → 1 compartment (singular)', () => {
    const h = sheet(1);
    assert.equal(visits(h), 1);
    assert.match(h, /compartment \(one per visit/);
  });
  test('3 days → 1 compartment', () => assert.equal(visits(sheet(3)), 1));
  test('4 days → 2 compartments (plural)', () => {
    const h = sheet(4);
    assert.equal(visits(h), 2);
    assert.match(h, /compartments \(one per visit/);
  });
  test('7 days → 3 compartments', () => assert.equal(visits(sheet(7)), 3));
  test('14 days → 5 compartments', () => assert.equal(visits(sheet(14)), 5));
  test('empty or 0 days falls back to 7 days', () => {
    assert.match(sheet(''), /handover — 7 days/);
    assert.match(sheet(0), /handover — 7 days/);
  });
  test('friend name is HTML-escaped', () => {
    const app = loadApp();
    app.document.getElementById('h-days').value = '7';
    app.document.getElementById('h-friend').value = '<img src=x onerror=alert(1)>';
    app.renderHandover();
    assert.doesNotMatch(app.document.getElementById('handover').innerHTML, /<img/);
  });
  test('latest test bad → sheet says "see notes", not "healthy"', () =>
    assert.match(sheet(7, [{ date: '2026-06-01', nh3: 0 }, { date: '2026-06-08', nh3: 0.5 }]), /everything was see notes/));
  test('latest test good → sheet says "healthy"', () =>
    assert.match(sheet(7, [{ date: '2026-06-08', nh3: 0, kh: 8 }]), /everything was healthy/));
  test('negative days are rejected rather than printed',
    { todo: 'typed values bypass min="1": -3 days prints "handover — -3 days" with 1 compartment' },
    () => assert.doesNotMatch(sheet(-3), /— -3 days/));
});
