// Unit tests for nudge.js (install nudge decision logic).
// Run:  node --test apple/WebTests/
const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('../../nudge.js');

const base = { savedTests: 1, standalone: false, dismissed: false, native: false, canPrompt: true, ios: false };

test('shown after a saved test when not installed and not dismissed', () => {
  assert.equal(N.shouldShowNudge(base), true);
});
test('hidden with zero saved tests', () => {
  assert.equal(N.shouldShowNudge({ ...base, savedTests: 0 }), false);
  assert.equal(N.shouldShowNudge({}), false);
  assert.equal(N.shouldShowNudge(undefined), false);
});
test('hidden when standalone, dismissed or inside the native shell', () => {
  assert.equal(N.shouldShowNudge({ ...base, standalone: true }), false);
  assert.equal(N.shouldShowNudge({ ...base, dismissed: true }), false);
  assert.equal(N.shouldShowNudge({ ...base, native: true }), false);
});
test('mode: prompt for Chromium, ios hint for iOS Safari, null otherwise', () => {
  assert.equal(N.nudgeMode(base), 'prompt');
  assert.equal(N.nudgeMode({ ...base, canPrompt: false, ios: true }), 'ios');
  assert.equal(N.nudgeMode({ ...base, canPrompt: false }), null);
  assert.equal(N.nudgeMode({ ...base, dismissed: true }), null);
});
test('isIosSafari: Safari yes, Chrome/Firefox on iOS and desktop no, iPadOS yes', () => {
  const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  assert.equal(N.isIosSafari(safari, 5), true);
  assert.equal(N.isIosSafari(safari.replace('Version/17.0', 'CriOS/120'), 5), false);
  assert.equal(N.isIosSafari('Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537.36', 0), false);
  assert.equal(N.isIosSafari('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17 Safari/605.1.15', 5), true);
  assert.equal(N.isIosSafari('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17 Safari/605.1.15', 0), false);
});
