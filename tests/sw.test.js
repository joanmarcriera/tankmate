'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSW, FakeResponse } = require('./harness');

const O = 'https://tank.example';

async function installed(opts) {
  const sw = loadSW({ origin: O, ...opts });
  await sw.dispatch('install');
  await sw.dispatch('activate');
  return sw;
}

test('install precaches the app shell', async () => {
  const sw = await installed();
  const name = sw.run('VERSION');
  for (const f of ['index.html', 'app.js', 'styles.css']) assert.ok(sw.stores.get(name).has(`${O}/${f}`), f);
});

test('cached asset is served, and refreshed in the background (no stale deploys)', async () => {
  const sw = await installed({ network: async () => new FakeResponse('new app.js') });
  const { res } = await sw.dispatch('fetch', { request: sw.request('/app.js') });
  assert.equal(res.body, 'cached:app.js'); // instant, works offline
  const again = await sw.dispatch('fetch', { request: sw.request('/app.js') });
  assert.equal(again.res.body, 'new app.js'); // the deploy has landed
});

test('error responses are not cached', async () => {
  const sw = await installed({ network: async () => new FakeResponse('oops', { status: 500 }) });
  await sw.dispatch('fetch', { request: sw.request('/app.js') });
  const name = sw.run('VERSION');
  assert.equal(sw.stores.get(name).get(`${O}/app.js`).body, 'cached:app.js');
  const { res } = await sw.dispatch('fetch', { request: sw.request('/new.png') });
  assert.equal(res.status, 500);
  assert.equal(sw.stores.get(name).has(`${O}/new.png`), false);
});

test('cross-origin requests are not intercepted or cached', async () => {
  const sw = await installed();
  const r = await sw.dispatch('fetch', { request: sw.request('https://app.lemonsqueezy.com/js/lemon.js') });
  assert.equal(r.responded, false);
});

test('offline: navigations fall back to the shell, other assets fail as themselves', async () => {
  const sw = await installed({ network: async () => { throw new TypeError('offline'); } });
  const nav = await sw.dispatch('fetch', { request: sw.request('/holiday?x=1', { mode: 'navigate' }) });
  assert.equal(nav.res.body, 'cached:index.html');
  const img = await sw.dispatch('fetch', { request: sw.request('/missing.png') });
  assert.equal(img.res.type, 'error'); // before: index.html served as an image
});

test('non-GET requests pass through', async () => {
  const sw = await installed();
  const r = await sw.dispatch('fetch', { request: sw.request('/x', { method: 'POST' }) });
  assert.equal(r.responded, false);
});

test('activate deletes old caches', async () => {
  const sw = loadSW({ origin: O });
  sw.stores.set('tankmate-v1', new Map());
  await sw.dispatch('install'); await sw.dispatch('activate');
  assert.deepEqual([...sw.stores.keys()], [sw.run('VERSION')]);
});
