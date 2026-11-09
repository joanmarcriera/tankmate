// Regression: the iOS bundle must be self-consistent. index.html references scripts
// (tanks.js, nudge.js, app.js); every local <script src> must exist in the bundle,
// otherwise WKWebView 404s the request on launch.
// Run:  node --test apple/WebTests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '../..');
const script = path.join(root, 'apple/scripts/prepare-web-bundle.py');

function bundle() {
  const dest = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tm-bundle-')), 'web');
  const r = spawnSync('python3', [script, root, dest], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return dest;
}

test('every local script/stylesheet referenced by the bundled index.html is in the bundle', () => {
  const dest = bundle();
  const html = fs.readFileSync(path.join(dest, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="([^"#?]+)"/gi)]
    .map(m => m[1]).filter(u => !/^[a-z]+:|^\/\//i.test(u));
  assert.ok(refs.includes('app.js'), 'sanity: app.js referenced');
  for (const ref of refs) {
    assert.ok(fs.existsSync(path.join(dest, ref)), `bundled index.html references missing ${ref}`);
  }
});
