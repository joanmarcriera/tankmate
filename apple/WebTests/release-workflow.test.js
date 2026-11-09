// iOS release workflow hardening (review lane, drive 2026-11-09-1346).
//   - least-privilege GITHUB_TOKEN (contents: read)
//   - the App Store Connect .p8 key is written only after archive + export, so the project's
//     build scripts that run during the archive never have it on disk.
// Run:  node --test apple/WebTests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const wf = fs.readFileSync(process.env.TM_RELEASE_WF || path.join(__dirname, '../../.github/workflows/release-appstore-ios.yml'), 'utf8');
const at = name => { const i = wf.indexOf(`- name: ${name}`); assert.ok(i >= 0, name); return i; };

test('release workflow token is read-only', () => {
  assert.match(wf, /^permissions:\n  contents: read$/m);
});

test('API key is installed after the archive and export, right before the upload', () => {
  const key = at('Install App Store Connect API key');
  assert.ok(key > at('Archive'), 'key on disk during the archive');
  assert.ok(key > at('Export the .ipa'), 'key on disk during the export');
  assert.ok(key < at('Upload to App Store Connect'), 'upload needs the key');
});

test('key material is always removed', () => {
  assert.match(wf, /if: always\(\)\n\s+run: \|\n[\s\S]*rm -f "\$HOME\/\.appstoreconnect\/private_keys\/AuthKey_/);
});
