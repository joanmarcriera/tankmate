// Security regression checks (no dependencies; `node --test` from the repo root).
// The browser check at the end uses the sandbox's preinstalled Playwright when it
// is available and skips itself otherwise.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const PAGES = ['index.html', 'privacy/index.html', 'support/index.html'];

// Minimal DOM stub: enough for app.js to boot and render the handover sheet.
function bootApp(stored) {
  const els = {};
  const el = (id) => (els[id] ||= {
    id, value: '', innerHTML: '', clientWidth: 300, dataset: {}, listeners: {},
    addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); },
    scrollIntoView() {}, reset() {},
    classList: { toggle() {} },
    getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }),
  });
  const mem = new Map(stored ? [['tankmate.tests.v1', JSON.stringify(stored)]] : []);
  const printed = [];
  const ctx = vm.createContext({
    document: { getElementById: el, querySelectorAll: () => [] },
    localStorage: { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) },
    navigator: {}, devicePixelRatio: 1, console,
    window: { addEventListener() {}, print: () => printed.push(1) },
  });
  vm.runInContext(read('app.js'), ctx, { filename: 'app.js' });
  return { els: new Proxy({}, { get: (_t, id) => el(String(id)) }), run: (c) => vm.runInContext(c, ctx), printed };
}

test('handover sheet escapes the stored test date', () => {
  const evil = '2099-01-01<img src=x onerror=alert(1)>';
  const app = bootApp([{ date: evil, nh3: 0, no2: 0, no3: 10, kh: 7 }]);
  app.run('renderHandover()');
  const html = app.els.handover.innerHTML;
  assert.ok(!html.includes('<img'), 'raw markup from storage must not reach innerHTML');
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
});

test('handover print button works without an inline handler', () => {
  const app = bootApp();
  app.run('renderHandover()');
  assert.ok(!/\sonclick=/i.test(app.els.handover.innerHTML));
  const clicks = app.els['h-print'].listeners.click || [];
  assert.equal(clicks.length, 1);
  clicks[0]();
  assert.equal(app.printed.length, 1);
});

test('no inline event-handler attributes in pages or rendered templates', () => {
  // Inline handlers (onclick=, onerror=...) block a strict Content-Security-Policy.
  for (const f of [...PAGES, 'app.js']) assert.ok(!/<[^>]+\son[a-z]+\s*=/i.test(read(f)), f);
});

test('third-party resources are limited to the known Lemon Squeezy checkout', () => {
  const allowed = new Set(['app.lemonsqueezy.com', 'marcriera.lemonsqueezy.com', 'www.lemonsqueezy.com',
    'tankmate.joanmarcriera.es']);
  for (const f of PAGES) {
    const html = read(f);
    for (const m of html.matchAll(/<(script|link|img|iframe)\b[^>]*\b(?:src|href)="(https?:)?\/\/([^/"]+)/gi)) {
      assert.ok(allowed.has(m[3].toLowerCase()), `${f}: unexpected third-party ${m[1]} from ${m[3]}`);
    }
    for (const m of html.matchAll(/\bhref="https?:\/\/([^/"]+)/gi)) {
      assert.ok(allowed.has(m[1].toLowerCase()), `${f}: unexpected outbound link to ${m[1]}`);
    }
    assert.ok(!/src="http:/i.test(html), `${f}: plain-http subresource`);
  }
});

test('privacy and support pages carry a script-free Content-Security-Policy', () => {
  for (const f of ['privacy/index.html', 'support/index.html']) {
    const html = read(f);
    const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
    assert.ok(m, `${f}: CSP meta missing`);
    assert.match(m[1], /default-src 'none'/);
    assert.doesNotMatch(m[1], /script-src/, 'scripts fall back to none');
    assert.ok(html.indexOf(m[0]) < html.indexOf('<link'), `${f}: CSP must precede the resources it governs`);
    assert.ok(!/<script\b/i.test(html), `${f}: page must stay script-free`);
  }
});

test('no credentials or private keys in tracked files', () => {
  const files = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n')
    .filter((f) => f && !/\.(png|jpe?g|gif|ico)$/i.test(f));
  const patterns = [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /AKIA[0-9A-Z]{16}/, /gh[pousr]_[A-Za-z0-9]{36}/, /github_pat_[A-Za-z0-9_]{40,}/,
    /xox[abprs]-[A-Za-z0-9-]{10,}/, /sk-[A-Za-z0-9]{32,}/, /sk_live_[A-Za-z0-9]{16,}/,
    /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\./, // JWT
  ];
  for (const f of files) {
    if (f === 'tests/security.test.js') continue; // the patterns themselves
    const txt = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const p of patterns) assert.ok(!p.test(txt), `${f} matches ${p}`);
  }
  assert.ok(!files.some((f) => /(^|\/)\.env(\.|$)|\.(pem|p12|p8|mobileprovision)$/i.test(f)), 'secret-bearing file tracked');
});

// --- real browser: the CSP must not break the pages it protects ----------------
let chromium = null;
try { ({ chromium } = require('playwright')); } catch { /* not installed: skip */ }

test('CSP pages render with no policy violations (browser)', { skip: !chromium && 'playwright not available' }, async () => {
  const types = { '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.js': 'text/javascript' };
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, path.normalize(p));
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
    res.end(fs.readFileSync(f));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  try {
    for (const p of ['/privacy/', '/support/']) {
      const page = await browser.newPage();
      const violations = [];
      page.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) violations.push(m.text()); });
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (e) => console.log('Content Security Policy violation: ' + e.violatedDirective + ' ' + e.blockedURI));
      });
      await page.goto(base + p, { waitUntil: 'load' });
      // The stylesheet applied (dark theme background) and the inline style attribute still works.
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      assert.notEqual(bg, 'rgba(0, 0, 0, 0)', `${p}: styles.css did not apply`);
      const linkColor = await page.evaluate(() => getComputedStyle(document.querySelector('.tankname a')).color);
      assert.notEqual(linkColor, 'rgb(0, 0, 238)', `${p}: inline style attribute was blocked`);
      assert.deepEqual(violations, [], `${p}: CSP violations`);
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
});
