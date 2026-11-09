// Copy claims must match the code (review lane, drive 2026-11-09-1346).
// The privacy and support pages said the iOS app "makes no network requests at all", but
// Tankmate Pro (apple/Sources/ProStore.swift) asks the App Store for the product, purchases
// and entitlements through StoreKit. A privacy policy that App Review and users read must
// say so, and say what Tankmate does (not) receive.
// Run:  node --test apple/WebTests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '../..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const text = f => read(f).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
const usesStoreKit = /Product\.products\(|Transaction\./.test(read('apple/Sources/ProStore.swift'));

test('sanity: the iOS app uses StoreKit', () => assert.ok(usesStoreKit));

for (const page of ['privacy/index.html', 'support/index.html']) {
  test(`${page} does not claim the iOS app makes no network requests`, () => {
    assert.doesNotMatch(text(page), /makes no network requests/i);
  });
}

test('privacy page explains in-app purchases go through Apple and what Tankmate receives', () => {
  const t = text('privacy/index.html');
  assert.match(t, /Tankmate Pro/);
  assert.match(t, /App Store/);
  assert.match(t, /Apple/);
});

test('web pages never load third-party scripts (the "nothing is sent" claim)', () => {
  for (const page of ['index.html', 'privacy/index.html', 'support/index.html']) {
    const srcs = [...read(page).matchAll(/<script\b[^>]*\bsrc="([^"]+)"/gi)].map(m => m[1]);
    for (const s of srcs) assert.doesNotMatch(s, /^(https?:)?\/\//i, `${page} loads ${s}`);
  }
});

// 69c7227 on GitHub main (Vikunja 6324) moved the coffee link to the LIVE Lemon Squeezy
// product; the drive branches still carried the test-mode one. Never ship the test product.
test('coffee link is the live-mode checkout, opened as a plain link', () => {
  const html = read('index.html');
  assert.ok(html.includes('/checkout/buy/5fbc35a0-bd77-470f-8e9b-e184199a3f4f"'), 'live product link');
  assert.ok(!html.includes('b6678503-277f-4679-81ec-1018a8c4cc12'), 'test-mode product link');
});

// Second review (sonnet): ProStore loads the product and entitlements on every launch, so
// "only contacts the App Store if you buy or restore" was not true either.
test('support page does not say the App Store is contacted only on buy/restore', () => {
  assert.doesNotMatch(text('support/index.html'), /only contacts Apple's App Store if you buy/i);
  assert.match(text('support/index.html'), /check whether your subscription is active/);
});
