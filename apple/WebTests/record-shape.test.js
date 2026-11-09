// Stored-record shape (review lane, drive 2026-11-09-1346). load() only checked that
// `date` is a string and that readings are numbers, so:
//   - a date like '=HYPERLINK("http://x")' or '2026-01-01\n=cmd' reached the iOS CSV export
//     (formula / row injection) and every renderer;
//   - a non-string note (e.g. 5) passed through, and the iOS shell's strict JSON decode of
//     tankmateState() then failed as a whole: charts and reminders silently stopped working.
// Hostile dates are dropped (and backed up); a non-string note is nulled.
// Run:  node --test apple/WebTests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { boot, FakeStorage } = require('./_app-harness');

const KEY = 'tankmate.tests.v1';
const stateWith = recs => {
  const store = new FakeStorage({ [KEY]: JSON.stringify(recs) });
  const app = boot({ storage: store });
  return { tests: app.window.tankmateState().tests, store };
};

test('records whose date could inject a formula or a row are dropped (and backed up)', () => {
  const { tests, store } = stateWith([
    { date: '2026-01-01', no3: 10 },
    { date: '=HYPERLINK("http://x","click")', no3: 1 },
    { date: '2026-01-02\n=cmd', no3: 2 },
    { date: '09/11/2026', no3: 3 },  // typed on a browser without a date picker: kept
  ]);
  assert.equal(JSON.stringify(tests.map(t => t.date)), '["2026-01-01","09/11/2026"]');
  assert.ok(store.keys().some(k => k.startsWith(KEY + '.corrupt-')), 'raw backed up');
});

test('a non-string note becomes null, the record is kept', () => {
  const { tests } = stateWith([{ date: '2026-01-01', no3: 10, note: 5 }]);
  assert.equal(tests.length, 1);
  assert.equal(tests[0].note, null);
});

test('a string note is kept as is', () => {
  const { tests } = stateWith([{ date: '2026-01-01', note: 'added 4 neons' }]);
  assert.equal(tests[0].note, 'added 4 neons');
});

// Second review (sonnet): on a browser without a date picker a typed date like "=x" was saved,
// shown, then silently dropped on the next load. Reject it at submit instead.
test('submit refuses a date that load() would drop, and says why', () => {
  const store = new FakeStorage();
  const app = boot({ storage: store });
  app.submit({ 'f-date': '=x', 'f-no3': '5' });
  assert.equal(app.window.tankmateState().tests.length, 0);
  assert.equal(store.getItem(KEY), '[]');
  assert.match(app.el('verdicts').innerHTML, /role="alert"/);
});
