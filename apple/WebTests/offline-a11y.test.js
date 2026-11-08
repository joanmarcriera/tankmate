// Offline + accessibility guards for the web app (static checks; no browser needed).
//  - every local script/stylesheet index.html loads must be precached by sw.js, or the
//    first offline launch breaks;
//  - keyboard focus must stay visible (the dark theme hides the browser default);
//  - the bottom tab bar is a labelled landmark.
// Run:  node --test apple/WebTests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '../..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

test('sw.js precaches every local asset index.html references', () => {
  const html = read('index.html');
  const sw = read('sw.js');
  const assets = (sw.match(/const ASSETS = \[([^\]]*)\]/) || [])[1] || '';
  const refs = [...html.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="([^"#?]+)"/gi)]
    .map(m => m[1]).filter(u => !/^[a-z]+:|^\/\//i.test(u));
  assert.ok(refs.length >= 4, 'sanity: found local refs');
  for (const ref of refs) {
    assert.ok(assets.includes(`'${ref}'`), `sw.js ASSETS is missing ${ref}`);
  }
});

test('styles.css defines a visible :focus-visible ring for controls', () => {
  const css = read('styles.css');
  assert.match(css, /button:focus-visible/);
  assert.match(css, /:focus-visible\s*\{[^}]*outline:\s*2px/);
});

test('the tab bar landmark is labelled and tab changes are announced', () => {
  assert.match(read('index.html'), /<nav class="tabbar" aria-label="[^"]+"/);
  assert.match(read('index.html'), /id="tabannounce"[^>]*role="status"/);
  assert.match(read('app.js'), /getElementById\('tabannounce'\)/);
});
