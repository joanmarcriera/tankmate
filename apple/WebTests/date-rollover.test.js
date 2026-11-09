// Regression (review lane, drive 2026-11-09-1346): the date field's max and default value
// were set once at startup. An installed PWA is resumed from memory for days, so after
// midnight today's date was above max: picking it made the form invalid and the browser
// blocked the submit, and the untouched default silently logged the test under yesterday.
// Run:  node --test apple/WebTests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { boot } = require('./_app-harness');

test('resuming after midnight moves the date max and an untouched default to the new day', () => {
  const app = boot({ now: '2026-11-09T23:50:00' });
  assert.equal(app.el('f-date').max, '2026-11-09');
  app.setNow('2026-11-10T08:00:00');
  for (const f of app.listeners['doc:visibilitychange'] || []) f({});
  assert.equal(app.el('f-date').max, '2026-11-10');
  assert.equal(app.el('f-date').value, '2026-11-10');
});

test('a date the user picked on purpose is kept on resume', () => {
  const app = boot({ now: '2026-11-09T23:50:00' });
  app.el('f-date').value = '2026-11-01';
  app.setNow('2026-11-10T08:00:00');
  for (const f of app.listeners['doc:visibilitychange'] || []) f({});
  assert.equal(app.el('f-date').max, '2026-11-10');
  assert.equal(app.el('f-date').value, '2026-11-01');
});

test('after a save the form date resets to the current day', () => {
  const app = boot({ now: '2026-11-09T23:50:00' });
  app.setNow('2026-11-10T08:00:00');
  app.submit({ 'f-no3': '10' });
  assert.equal(app.el('f-date').max, '2026-11-10');
  assert.equal(app.el('f-date').value, '2026-11-10');
});
