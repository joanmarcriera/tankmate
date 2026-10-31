// Regression tests for the rsync filter rules in .github/workflows/deploy.yml.
//
// An rsync --exclude also protects matching files on the server from --delete,
// so a path excluded after an earlier deploy published it stays live forever.
// The deploy step uses receiver-side 'R' (risk) rules to drop that protection
// for exactly the paths earlier deploys published.
//
// Run with: node --test 'tests/*.test.mjs'
// The end-to-end case needs an rsync binary and is skipped when there is none.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = readFileSync(join(ROOT, '.github/workflows/deploy.yml'), 'utf8');

// Paths that earlier deploys published and that are no longer web content.
const OBSOLETE = ['/README.md', '/CLAUDE.md', '/HANDOFF-2026-09-05.md', '/HANDOFF-2026-09-06.md', '/.vikunja'];

/** The --filter/--exclude arguments of the rsync command, in order, as rsync sees them. */
function rsyncFilterArgs() {
  const start = WORKFLOW.indexOf('rsync -az --delete');
  assert.notEqual(start, -1, 'deploy.yml no longer contains the rsync command');
  const end = WORKFLOW.indexOf('-e "ssh', start);
  const cmd = WORKFLOW.slice(start, end);
  return [...cmd.matchAll(/--(filter|exclude) '([^']*)'/g)].map(m => [`--${m[1]}`, m[2]]);
}

test('every obsolete published path has a risk rule ahead of all excludes', () => {
  const args = rsyncFilterArgs();
  const firstExclude = args.findIndex(([flag]) => flag === '--exclude');
  const risks = args.slice(0, firstExclude).filter(([f, v]) => f === '--filter' && v.startsWith('R ')).map(([, v]) => v.slice(2));
  for (const p of OBSOLETE) assert.ok(risks.includes(p), `missing --filter 'R ${p}' before the excludes`);
});

test('risk rules are exact anchored paths, so nothing else loses protection', () => {
  const risks = rsyncFilterArgs().filter(([f, v]) => f === '--filter' && v.startsWith('R ')).map(([, v]) => v.slice(2));
  for (const r of risks) {
    assert.ok(r.startsWith('/'), `risk rule ${r} is not anchored to the transfer root`);
    assert.doesNotMatch(r, /[*?[]/, `risk rule ${r} is a wildcard`);
  }
  assert.deepEqual([...risks].sort(), [...OBSOLETE].sort());
});

const RSYNC = spawnSync('rsync', ['--version']).status === 0;

test('a deploy removes the obsolete files and keeps everything else as before', { skip: !RSYNC && 'rsync not installed' }, () => {
  const tmp = mkdtempSync(join(tmpdir(), 'tankmate-rsync-'));
  const put = (base, rel) => { const f = join(tmp, base, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, rel); };
  try {
    // The repo checkout.
    for (const f of ['index.html', 'app.js', 'privacy/index.html', 'README.md', 'CLAUDE.md', 'HANDOFF-2026-09-06.md',
      '.vikunja', 'apple/README.md', 'apple/Sources/App.swift', '.github/workflows/deploy.yml', 'tests/x.test.mjs']) put('src', f);
    // The server, as earlier deploys left it.
    for (const f of ['index.html', 'app.js', 'README.md', 'CLAUDE.md', 'HANDOFF-2026-09-05.md', 'HANDOFF-2026-09-06.md',
      '.vikunja', 'old-asset.js', 'server-only.md']) put('dest', f);

    const args = ['-a', '--delete', ...rsyncFilterArgs().flat(), join(tmp, 'src') + '/', join(tmp, 'dest') + '/'];
    const r = spawnSync('rsync', args, { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);

    const live = rel => existsSync(join(tmp, 'dest', rel));
    // Removed: what earlier deploys published and is now excluded.
    for (const p of OBSOLETE) assert.ok(!live(p.slice(1)), `${p} is still live`);
    // Unchanged behaviour: web content is published, non-web content is not sent,
    // stray files are deleted, and unknown excluded files on the server stay protected.
    for (const p of ['index.html', 'app.js', 'privacy/index.html']) assert.ok(live(p), `${p} was not published`);
    for (const p of ['apple', '.github', 'tests']) assert.ok(!live(p), `${p} was published`);
    assert.ok(!live('old-asset.js'), '--delete stopped removing stray files');
    assert.ok(live('server-only.md'), 'an unknown excluded server file lost its protection');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
