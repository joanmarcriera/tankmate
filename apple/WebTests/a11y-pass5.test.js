// Accessibility pass 5 guards (static + vm; no browser needed).
//  - WCAG AA contrast for the text/background pairs the dark theme actually uses
//    (computed from the CSS custom properties, so a token tweak that breaks contrast fails here);
//  - renderHandover: escapes the friend's name, falls back to 7 days, sizes the pill-organiser
//    list from the days away, and moves focus to the generated sheet;
//  - drawChart: the KH series is dashed (not colour-only) and the legend says so;
//  - decorative glyphs are hidden from assistive tech, touch targets and number keypads are set.
// Run:  node --test apple/WebTests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '../..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const css = read('styles.css');
const app = read('app.js');
const html = read('index.html');
const block = (head) => { const i = app.indexOf(head); assert.ok(i >= 0, head); return app.slice(i, app.indexOf('\n}\n', i) + 3); };

/* ---- contrast ---- */
const token = n => { const m = new RegExp('--' + n + ':\\s*(#[0-9a-fA-F]{6})').exec(css); assert.ok(m, '--' + n); return m[1]; };
const lum = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('contrast: body, muted and accent text meet WCAG AA (4.5:1) on every surface they sit on', () => {
  const surfaces = ['bg', 'panel', 'panel2'];
  for (const fg of ['ink', 'mut', 'acc', 'good', 'warn', 'bad']) {
    for (const bg of surfaces) {
      const r = ratio(token(fg), token(bg));
      assert.ok(r >= 4.5, `--${fg} on --${bg} is ${r.toFixed(2)}:1`);
    }
  }
});

test('contrast: primary button text (#022) on the accent fill meets AA', () => {
  assert.match(css, /button\{[^}]*background:var\(--acc\);color:#022/);
  assert.ok(ratio('#002222', token('acc')) >= 4.5);
});

test('contrast: chart axis labels (canvas, panel background) meet AA', () => {
  const axis = /ctx\.fillStyle='(#[0-9a-fA-F]{6})'; ctx\.font/.exec(app);
  assert.ok(axis, 'axis label colour found');
  assert.ok(ratio(axis[1], token('panel')) >= 4.5, ratio(axis[1], token('panel')).toFixed(2));
});

/* ---- renderHandover ---- */
function handoverCtx({ days = '7', friend = '', tests = [] } = {}) {
  const el = { innerHTML: '', h3: null, querySelector(sel) { return sel === 'h3' && /<h3[\s>]/.test(this.innerHTML) ? this.h3 : null; } };
  el.h3 = { tabIndex: undefined, focused: 0, focus() { this.focused++; } };
  const inputs = { 'h-days': { value: days }, 'h-friend': { value: friend }, handover: el };
  const c = vm.createContext({ tests, document: { getElementById: id => inputs[id] }, worst: () => 'good', tankName: () => 'Fluval Flex 57 L' });
  vm.runInContext([app.split('\n').find(l => l.startsWith('const esc')), block('function renderHandover')].join('\n'), c);
  return { c, el };
}

test('renderHandover: friend name is escaped, not injected', () => {
  const { c, el } = handoverCtx({ friend: '<img src=x onerror=alert(1)>' });
  vm.runInContext('renderHandover()', c);
  assert.ok(!el.innerHTML.includes('<img'), el.innerHTML);
  assert.ok(el.innerHTML.includes('&lt;img'));
});

test('renderHandover: empty or zero days falls back to 7; visits are one per 3 days, minimum 1', () => {
  for (const [days, visits, shown] of [['', 3, 7], ['0', 3, 7], ['1', 1, 1], ['3', 1, 3], ['4', 2, 4], ['14', 5, 14]]) {
    const { c, el } = handoverCtx({ days });
    vm.runInContext('renderHandover()', c);
    assert.ok(el.innerHTML.includes(`— ${shown} days`), `${days}: ${el.innerHTML.slice(0, 120)}`);
    assert.ok(el.innerHTML.includes(`<b>${visits} pill-organiser compartment${visits > 1 ? 's' : ''}`), `${days}: want ${visits}`);
  }
});

test('renderHandover: focus moves to the new sheet heading', () => {
  const { c, el } = handoverCtx();
  vm.runInContext('renderHandover()', c);
  assert.equal(el.h3.focused, 1);
  assert.equal(el.h3.tabIndex, -1);
});

test('renderHandover: with no tests it says "—" for the last test date', () => {
  const { c, el } = handoverCtx({ tests: [] });
  vm.runInContext('renderHandover()', c);
  assert.match(el.innerHTML, /Last water test —:/);
});

/* ---- chart: not colour-only ---- */
test('drawChart: KH is dashed, nitrate solid, legend names both line styles', () => {
  const ev = [];   // ordered: dash pattern in force at each stroke()
  let dash = 0;
  const ctx2d = new Proxy({ setLineDash: d => { dash = d.length; ev.push('dash' + d.length); }, stroke: () => ev.push('stroke@' + dash), measureText: () => ({ width: 0 }) },
    { get: (t, k) => k in t ? t[k] : () => {}, set: () => true });
  const canvas = { clientWidth: 300, width: 0, height: 0, attrs: {}, getContext: () => ctx2d, setAttribute(k, v) { this.attrs[k] = v; } };
  const legend = { innerHTML: '' };
  const c = vm.createContext({
    devicePixelRatio: 1, tests: [{ date: '2026-01-01', no3: 10, kh: 7 }, { date: '2026-01-08', no3: 20, kh: 6 }],
    document: { getElementById: id => id === 'chart' ? canvas : legend },
  });
  vm.runInContext([app.split('\n').find(l => l.startsWith('const MONTHS')), app.split('\n').find(l => l.startsWith('function shortDate')),
    app.split('\n').find(l => l.startsWith('function chartLabelIdx')), block('function drawChart')].join('\n'), c);
  vm.runInContext('drawChart()', c);
  // series order is no3 then kh: nitrate strokes solid, KH strokes dashed, and the dash is reset after.
  const strokes = ev.filter(e => e.startsWith('stroke'));
  assert.deepEqual(strokes, ['stroke@0', 'stroke@2'], ev.join(','));
  assert.equal(ev[ev.length - 1], 'dash0', 'dash reset after the last series');
  assert.match(legend.innerHTML, /NO₃ nitrate \(solid\)/);
  assert.match(legend.innerHTML, /KH buffer \(dashed\)/);
  assert.match(canvas.attrs['aria-label'], /2 tests from 1 Jan to 8 Jan/);
  assert.match(css, /\.legend i\.dash\{[^}]*dashed/);
});

/* ---- static a11y details ---- */
test('decorative glyphs are hidden from assistive tech', () => {
  assert.match(app, /<summary>\$\{p\.sym\}<span aria-hidden="true">＋<\/span>/);
  assert.ok((html.match(/<span aria-hidden="true">[^<]+<\/span><span>\w+<\/span>/g) || []).length === 5, 'five tab icons hidden');
});

test('tab-bar buttons are at least 44px tall; the new-tab footer link says so', () => {
  const m = /\.tabbar button\{[^}]*min-height:(\d+)px/.exec(css);
  assert.ok(m && +m[1] >= 48);
  assert.match(html, /Buy me a coffee<span class="sr-only"> \(opens in a new tab\)<\/span>/);
});

test('numeric test fields bring up the right number keypad and skip autofill', () => {
  const want = { nh3: 'decimal', no2: 'decimal', no3: 'numeric', kh: 'numeric', ph: 'decimal', gh: 'numeric', temp: 'decimal' };
  for (const id of Object.keys(want)) {
    const tag = new RegExp(`<input[^>]*id="f-${id}"[^>]*>`).exec(html);
    assert.ok(tag, id);
    assert.match(tag[0], new RegExp(`inputmode="${want[id]}"`), id);
    assert.match(tag[0], /autocomplete="off"/, id);
  }
});

test('iOS bundle strip removes the new-tab sr-only text together with the coffee link', () => {
  const os = require('node:os');
  const { spawnSync } = require('node:child_process');
  const dest = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tm-a11y-')), 'web');
  const r = spawnSync('python3', [path.join(root, 'apple/scripts/prepare-web-bundle.py'), root, dest], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const out = fs.readFileSync(path.join(dest, 'index.html'), 'utf8');
  assert.ok(!/opens in a new tab/.test(out) && !/coffee/i.test(out), 'no orphaned footer text in the bundle');
});

test('every form control has an accessible name', () => {
  const ids = [...html.matchAll(/<(?:input|textarea|select)\b[^>]*\bid="([^"]+)"[^>]*>/g)];
  assert.ok(ids.length >= 10);
  for (const [tag, id] of ids) {
    assert.ok(html.includes(`for="${id}"`) || /aria-label="[^"]+"/.test(tag), `no label for #${id}`);
  }
});

test('motion is opt-out: tab animation and smooth scroll both respect prefers-reduced-motion', () => {
  assert.match(css, /prefers-reduced-motion:reduce\)\{\.tab\.active\{animation:none\}/);
  assert.match(app, /prefers-reduced-motion: reduce\)'\)\.matches\?'auto':'smooth'/);
});
