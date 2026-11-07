/* Tankmate — multi-tank model (pure logic, no DOM).
   Loaded by index.html before app.js; also required by node for the unit tests
   in apple/WebTests/tanks.test.js.

   Storage layout (all localStorage, same origin as before — the key space only grows):
     tankmate.tests.v1            tests of the DEFAULT tank. Unchanged on purpose: the
                                  free tier, the PWA and every existing install keep their
                                  data exactly where it always was; migration never moves
                                  or rewrites a test record.
     tankmate.tank.<id>.tests.v1  tests of every additional tank (Pro).
     tankmate.tanks.v1            registry {v:1, active:<id>, tanks:[{id,name}]}.

   Migration (`ensureRegistry`) is idempotent: with no registry it creates one holding
   the single tank "default" named after the legacy tank name; with one it only repairs
   obviously broken state (missing default, dangling active id). */
(function (root) {
  'use strict';
  const LEGACY_TESTS = 'tankmate.tests.v1';
  const REGISTRY = 'tankmate.tanks.v1';
  const DEFAULT_ID = 'default';
  const DEFAULT_NAME = 'Fluval Flex 57 L';

  const testsKey = (id) => id === DEFAULT_ID ? LEGACY_TESTS : `tankmate.tank.${id}.tests.v1`;

  function readJSON(storage, key) {
    try { return JSON.parse(storage.getItem(key)); } catch { return null; }
  }

  /** Create/repair the registry. Returns it. Never touches test records. */
  function ensureRegistry(storage, legacyName) {
    let reg = readJSON(storage, REGISTRY);
    // Drop malformed entries instead of discarding the whole registry (keeps other tanks reachable).
    if (!reg || !Array.isArray(reg.tanks)) reg = { v: 1, active: DEFAULT_ID, tanks: [] };
    else reg.tanks = reg.tanks.filter(t => t && t.id && t.name);
    if (!reg.tanks.some(t => t.id === DEFAULT_ID)) {
      reg.tanks.unshift({ id: DEFAULT_ID, name: legacyName || DEFAULT_NAME });
    }
    if (!reg.tanks.some(t => t.id === reg.active)) reg.active = DEFAULT_ID;
    storage.setItem(REGISTRY, JSON.stringify(reg));
    return reg;
  }

  function slug(name) {
    return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'tank';
  }

  /** Add a tank (caller is responsible for the entitlement check). Returns the new tank. */
  function addTank(storage, name) {
    const reg = ensureRegistry(storage);
    const clean = String(name || '').trim().slice(0, 40);
    if (!clean) throw new Error('Tank name required');
    let id = slug(clean), n = 2;
    // Also skip ids whose tests key already exists (orphans of a repaired registry): never overwrite them.
    while (reg.tanks.some(t => t.id === id) || id === DEFAULT_ID || storage.getItem(testsKey(id)) !== null) id = `${slug(clean)}-${n++}`;
    const tank = { id, name: clean };
    reg.tanks.push(tank);
    reg.active = id;
    storage.setItem(REGISTRY, JSON.stringify(reg));
    storage.setItem(testsKey(id), '[]');
    return tank;
  }

  function setActive(storage, id) {
    const reg = ensureRegistry(storage);
    if (reg.tanks.some(t => t.id === id)) { reg.active = id; storage.setItem(REGISTRY, JSON.stringify(reg)); }
    return reg;
  }

  /** The tank the UI should show: free tier is locked to the default tank
      (other tanks' data is kept, just not reachable until Pro returns). */
  function effectiveActive(reg, isPro) {
    return isPro ? reg.active : DEFAULT_ID;
  }

  const api = { LEGACY_TESTS, REGISTRY, DEFAULT_ID, DEFAULT_NAME, testsKey, ensureRegistry, addTank, setActive, effectiveActive };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TankStore = api;
})(typeof window !== 'undefined' ? window : globalThis);
