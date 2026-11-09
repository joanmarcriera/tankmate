// Data-loss regressions in the stored-tests startup path (review lane, drive 2026-11-09-1346).
//   1. A record that cleanTest drops is backed up under a .corrupt- key. That backup must be
//      written once per distinct content, not on every app open: a new full copy per launch
//      fills the ~5 MB origin quota and then every later save fails.
//   2. Unreadable stored tests must never be replaced by [] unless a backup of the raw
//      string exists. With a full quota the backup write fails, but writing "[]" over the
//      (larger) original still succeeds, so the user's only copy was destroyed.
// Run:  node --test apple/WebTests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { boot, FakeStorage } = require('./_app-harness');

const KEY = 'tankmate.tests.v1';
const backups = s => s.keys().filter(k => k.startsWith(KEY + '.corrupt-'));

test('a dropped record is backed up once, not on every app open', () => {
  const raw = JSON.stringify([{ date: '2026-01-01', no3: 10 }, { no3: 99 /* no date */ }]);
  const store = new FakeStorage({ [KEY]: raw });
  for (const t of ['2026-11-09T08:00:00', '2026-11-10T08:00:00', '2026-11-11T08:00:00']) boot({ storage: store, now: t });
  assert.equal(backups(store).length, 1, backups(store).join(', '));
  assert.equal(store.getItem(backups(store)[0]), raw);
});

test('unreadable tests are not overwritten with [] when the backup cannot be written (full quota)', () => {
  const raw = '[{"date":"2026-01-01","no3":10},' + 'x'.repeat(500); // truncated / hand-edited JSON
  const store = new FakeStorage({ [KEY]: raw }, { quota: KEY.length + raw.length + 5 });
  const app = boot({ storage: store });
  const survives = [...store.m.values()].includes(raw);
  assert.ok(survives, 'the only copy of the unreadable history was destroyed');
  // and the first save after that must not destroy it either
  app.submit({ 'f-no3': '5' });
  assert.ok([...store.m.values()].includes(raw), 'a later save destroyed the unreadable history');
});

test('unreadable tests with room to spare: backed up, then the app starts empty', () => {
  const raw = '{"not":"an array"}';
  const store = new FakeStorage({ [KEY]: raw });
  boot({ storage: store });
  assert.equal(backups(store).length, 1);
  assert.equal(store.getItem(backups(store)[0]), raw);
});
