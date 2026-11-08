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

test('index.html carries the SEO/share meta and a noscript notice', () => {
  const html = read('index.html');
  const desc = (html.match(/<meta name="description" content="([^"]+)"/) || [])[1] || '';
  assert.ok(desc.length >= 80 && desc.length <= 300, `description length ${desc.length}`);
  assert.match(html, /<meta property="og:title"/);
  assert.match(html, /<link rel="icon" href="icon\.svg"/);
  assert.match(html, /<noscript>/);
  assert.equal((html.match(/<title>/g) || []).length, 1);
});

test('show(): announces the section, marks aria-current, redraws chart only for trends, scrolls to top', () => {
  const vm = require('node:vm');
  const src = read('app.js');
  const i = src.indexOf('function show(tab)');
  assert.ok(i >= 0);
  const code = src.slice(i, src.indexOf('\n}\n', i) + 3);
  const cls = () => { const s = new Set(); return { toggle: (n, on) => on ? s.add(n) : s.delete(n), has: n => s.has(n) }; };
  const tabs = ['log', 'trends'].map(n => ({ id: 'tab-' + n, classList: cls() }));
  const attrs = {};
  const btns = ['log', 'trends'].map(n => ({ dataset: { tab: n }, classList: cls(),
    setAttribute: (k, v) => { attrs[n] = v; }, removeAttribute: () => { delete attrs[n]; } }));
  const announce = { textContent: '' };
  const calls = { draw: 0, scroll: [] };
  const ctx = vm.createContext({
    document: {
      querySelectorAll: q => q === '.tab' ? tabs : btns,
      querySelector: q => ({ textContent: q === '#tab-trends h1' ? 'Trends' : 'Log a water test' }),
      getElementById: id => id === 'tabannounce' ? announce : null,
    },
    window: { scrollTo: (...a) => calls.scroll.push(a) },
    drawChart: () => { calls.draw++; },
  });
  vm.runInContext(code + '; this.show = show;', ctx);
  ctx.show('trends');
  assert.equal(announce.textContent, 'Trends');
  assert.deepEqual(attrs, { trends: 'page' });
  assert.equal(calls.draw, 1);
  assert.deepEqual(calls.scroll[0], [0, 0]);
  assert.ok(tabs[1].classList.has('active') && !tabs[0].classList.has('active'));
  ctx.show('log');
  assert.equal(announce.textContent, 'Log a water test');
  assert.deepEqual(attrs, { log: 'page' });
  assert.equal(calls.draw, 1);
});

test('tab bar never hides a focused control: scroll-padding is set', () => {
  assert.match(read('styles.css'), /html\{scroll-padding-bottom:\d+px\}/);
});
