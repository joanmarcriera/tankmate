/* Tankmate — install nudge (task 4659). Pure decision logic, no DOM, no network.
   Loaded by index.html and by node for apple/WebTests/install-nudge.test.js.

   state = {
     savedTests: number of tests the USER has saved (the seed history does not count),
     standalone: app already runs installed (display-mode: standalone / navigator.standalone),
     dismissed:  user closed the bar before (persisted in localStorage by app.js),
     native:     running inside the iOS shell (never nudge there),
     canPrompt:  a beforeinstallprompt event was captured (Chromium),
     ios:        iOS Safari, where install is manual (Share > Add to Home Screen)
   }
   shouldShowNudge(state) -> boolean   hidden when standalone, dismissed, native or zero tests.
   nudgeMode(state) -> 'prompt' | 'ios' | null   which bar to show (null = nothing to offer). */
(function (root) {
  'use strict';

  function shouldShowNudge(s) {
    s = s || {};
    if (s.native || s.standalone || s.dismissed) return false;
    return Number(s.savedTests) > 0;
  }

  function nudgeMode(s) {
    if (!shouldShowNudge(s)) return null;
    if (s.canPrompt) return 'prompt';
    if (s.ios) return 'ios';
    return null;
  }

  /** True for iPhone/iPad Safari (iPadOS reports as Mac with touch points). */
  function isIosSafari(ua, maxTouchPoints) {
    ua = ua || '';
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
    return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  }

  const api = { shouldShowNudge, nudgeMode, isIosSafari, FLAG_DISMISSED: 'tankmate.nudge.dismissed.v1', FLAG_SAVED: 'tankmate.nudge.saved.v1' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.InstallNudge = api;
})(typeof window !== 'undefined' ? window : globalThis);
