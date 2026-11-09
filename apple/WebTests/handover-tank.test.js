// Regression (review lane, drive 2026-11-09-1346): the holiday handover sheet hard-coded
// "Tank: Fluval Flex 57 L", so with Tankmate Pro's multiple tanks every tank's sheet named
// the owner's tank. It must name the active tank, escaped (names are user input).
// Run:  node --test apple/WebTests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { boot, FakeStorage } = require('./_app-harness');

function proApp(name) {
  const store = new FakeStorage({
    'tankmate.tanks.v1': JSON.stringify({ v: 1, active: 'cube', tanks: [{ id: 'default', name: 'Fluval Flex 57 L' }, { id: 'cube', name }] }),
    'tankmate.tank.cube.tests.v1': '[]',
  });
  const app = boot({ storage: store });
  app.window.tankmateApplyNative({ isPro: true });
  app.el('h-days').value = '5';
  app.el('h-gen').onclick();
  return app.el('handover').innerHTML;
}

test('handover names the active tank', () => {
  const html = proApp('Shrimp cube');
  assert.match(html, /Tank: <b>Shrimp cube<\/b>/);
  assert.ok(!html.includes('Fluval'), 'still names the default tank');
});

test('handover escapes the tank name', () => {
  const html = proApp('<img src=x onerror=alert(1)>');
  assert.ok(!html.includes('<img'), html.slice(0, 300));
});

test('free tier keeps the default tank name', () => {
  const app = boot();
  app.el('h-gen').onclick();
  assert.match(app.el('handover').innerHTML, /Tank: <b>Fluval Flex 57 L<\/b>/);
});
