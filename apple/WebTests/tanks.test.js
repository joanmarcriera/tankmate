// Unit tests for tanks.js (multi-tank model + migration).
// Run:  node --test apple/WebTests/tanks.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../../tanks.js');

function mem() {
  const m = new Map();
  return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), _m: m };
}

test('migration: fresh install gets a registry with the default tank on the legacy key', () => {
  const s = mem();
  const reg = T.ensureRegistry(s);
  assert.deepEqual(reg, { v: 1, active: 'default', tanks: [{ id: 'default', name: T.DEFAULT_NAME }] });
  assert.equal(T.testsKey('default'), 'tankmate.tests.v1');
});

test('migration: existing v1 tests are untouched and idempotent', () => {
  const s = mem();
  const tests = JSON.stringify([{ date: '2026-06-11', no3: 10 }]);
  s.setItem('tankmate.tests.v1', tests);
  T.ensureRegistry(s); T.ensureRegistry(s);
  assert.equal(s.getItem('tankmate.tests.v1'), tests);
  assert.equal(JSON.parse(s.getItem(T.REGISTRY)).tanks.length, 1);
});

test('migration: corrupt registry is repaired, not fatal', () => {
  const s = mem();
  s.setItem(T.REGISTRY, '{nope');
  assert.equal(T.ensureRegistry(s).active, 'default');
  s.setItem(T.REGISTRY, JSON.stringify({ v: 1, active: 'ghost', tanks: [{ id: 'a', name: 'A' }] }));
  const reg = T.ensureRegistry(s);
  assert.equal(reg.active, 'default');
  assert.deepEqual(reg.tanks.map(t => t.id), ['default', 'a']);
});

test('addTank: unique ids, own storage key, becomes active', () => {
  const s = mem();
  const a = T.addTank(s, 'Shrimp Bowl');
  const b = T.addTank(s, 'Shrimp Bowl');
  assert.equal(a.id, 'shrimp-bowl');
  assert.equal(b.id, 'shrimp-bowl-2');
  assert.equal(s.getItem(T.testsKey(a.id)), '[]');
  assert.equal(JSON.parse(s.getItem(T.REGISTRY)).active, 'shrimp-bowl-2');
  assert.throws(() => T.addTank(s, '   '));
});

test('addTank: a tank can never shadow the default tank id', () => {
  const s = mem();
  assert.notEqual(T.addTank(s, 'default').id, 'default');
});

test('effectiveActive: free tier is locked to the default tank, Pro honours the choice', () => {
  const s = mem();
  T.addTank(s, 'Second');
  const reg = T.ensureRegistry(s);
  assert.equal(T.effectiveActive(reg, false), 'default');
  assert.equal(T.effectiveActive(reg, true), 'second');
});

test('setActive ignores unknown ids', () => {
  const s = mem();
  T.addTank(s, 'Second');
  assert.equal(T.setActive(s, 'nope').active, 'second');
  assert.equal(T.setActive(s, 'default').active, 'default');
});

test('registry repair keeps well-formed tanks and drops only malformed ones', () => {
  const s = mem();
  s.setItem(T.REGISTRY, JSON.stringify({ v: 1, active: 'reef', tanks: [{ id: 'default', name: 'A' }, { id: 'reef', name: 'Reef' }, { id: 'bad' }] }));
  const reg = T.ensureRegistry(s);
  assert.deepEqual(reg.tanks.map(t => t.id), ['default', 'reef']);
  assert.equal(reg.active, 'reef');
});

test('addTank never overwrites the tests of an orphaned tank with the same slug', () => {
  const s = mem();
  const orphan = JSON.stringify([{ date: '2026-06-01', no3: 5 }]);
  s.setItem(T.testsKey('reef'), orphan);
  const tank = T.addTank(s, 'Reef');
  assert.notEqual(tank.id, 'reef');
  assert.equal(s.getItem(T.testsKey('reef')), orphan);
});

test('safeStorage: real storage is returned as persistent', () => {
  const real = mem(); real.removeItem = k => real._m.delete(k);
  const r = T.safeStorage({ localStorage: real });
  assert.equal(r.persistent, true);
  assert.equal(r.store, real);
  assert.equal(real._m.has('tankmate.probe'), false, 'probe key is cleaned up');
});

test('safeStorage: a throwing localStorage getter (blocked storage) falls back to memory', () => {
  const root = { get localStorage() { throw new Error('SecurityError'); } };
  const r = T.safeStorage(root);
  assert.equal(r.persistent, false);
  r.store.setItem('a', 1);
  assert.equal(r.store.getItem('a'), '1');
  // The whole multi-tank layer works on top of it.
  const reg = T.ensureRegistry(r.store, 'X');
  assert.equal(reg.tanks[0].id, 'default');
});

test('safeStorage: setItem that throws (quota / private mode) also falls back', () => {
  const root = { localStorage: { getItem: () => null, setItem() { throw new Error('QuotaExceeded'); }, removeItem() {} } };
  assert.equal(T.safeStorage(root).persistent, false);
});

test('safeStorage: full quota on an existing install keeps the readable store (data must not look erased)', () => {
  const real = { getItem: k => k === 'tankmate.tests.v1' ? '[{"date":"2026-01-01"}]' : null, setItem() { throw new Error('QuotaExceeded'); }, removeItem() {} };
  const r = T.safeStorage({ localStorage: real });
  assert.equal(r.store, real);
  assert.doesNotThrow(() => T.ensureRegistry(real, 'X'), 'registry write failure must not crash startup');
  assert.doesNotThrow(() => T.setActive(real, 'default'));
});
