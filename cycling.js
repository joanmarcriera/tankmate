/* Tankmate — new-tank cycling state ("is it safe to add fish?"). Pure logic, no DOM, not wired
   into the UI (task 4607). Spec and sources: docs/market/CYCLING-SPEC.md.
   Loaded by node for apple/WebTests/cycling.test.js. NOT in apple/scripts/prepare-web-bundle.py's
   ASSETS list on purpose: add it there in the same commit that wires it into index.html.

   Input: an array of test records {date:'YYYY-MM-DD', nh3, no2, no3, dose?, hoursSinceDose?}
   (same shape as app.js records; `dose` = ppm ammonia the user added before this test, and
   `hoursSinceDose` = hours between that dose and the test). Missing values are null/undefined.

   cyclingState(tests, {today}) -> {state, safeToAddFish, passes, stale, reason, basis[]}
   States: no-data | ammonia | nitrite | clearing | unconfirmed | ready
   safeToAddFish is true ONLY in `ready`; every uncertain case returns false (fail closed). */
(function (root) {
  'use strict';
  const DOSE_PPM = 2;          // fishless dose that counts as a full test (spec T1)
  const WINDOW_H = 24;         // ammonia and nitrite must read 0 within this many hours (spec T1)
  const PASSES_NEEDED = 2;     // repeat the 24 h test twice on different dates (spec T2)
  const STALE_DAYS = 3;        // latest test older than this: advice may be out of date (spec T5)

  const num = (v) => (v == null || v === '' || Number.isNaN(Number(v))) ? null : Number(v);
  const dayMs = 86400000;
  const sorted = (tests) => [...(tests || [])].filter(t => t && t.date).sort((a, b) => a.date.localeCompare(b.date));

  /** True when this record is a fishless "full dose cleared" test (spec T1). */
  function isPass(t) {
    const dose = num(t.dose), h = num(t.hoursSinceDose);
    return dose != null && dose >= DOSE_PPM && h != null && h <= WINDOW_H &&
      num(t.nh3) === 0 && num(t.no2) === 0 && (num(t.no3) || 0) > 0;
  }

  function cyclingState(tests, opts) {
    const list = sorted(tests);
    const out = (state, reason, extra) => Object.assign(
      { state, safeToAddFish: false, passes: 0, stale: false, reason, basis: [] }, extra || {});
    if (!list.length) return out('no-data', 'No test yet. Test ammonia, nitrite and nitrate first.');
    const last = list[list.length - 1];
    const nh3 = num(last.nh3), no2 = num(last.no2), no3 = num(last.no3);
    const passDates = new Set(list.filter(isPass).map(t => t.date));
    const passes = passDates.size;
    let stale = false;
    const today = opts && opts.today;
    if (today) stale = (Date.parse(today) - Date.parse(last.date)) / dayMs > STALE_DAYS;

    let r;
    if (nh3 == null || no2 == null) {
      r = out('no-data', 'The latest test is missing ammonia or nitrite, so no cycling verdict is possible.');
    } else if (no2 > 0) {
      r = out('nitrite', 'Nitrite is above 0: the second bacteria group is still catching up. Not safe for fish.',
        { basis: ['T3', 'T4'] });
    } else if (nh3 > 0) {
      r = out('ammonia', 'Ammonia is above 0 and nitrite is 0: the first bacteria group is still building. Not safe for fish.',
        { basis: ['T3'] });
    } else if (!(no3 > 0)) {
      r = out('clearing', 'Ammonia and nitrite read 0 but there is no nitrate yet, so nothing has been converted. Keep going.',
        { basis: ['T1'] });
    } else if (passes >= PASSES_NEEDED) {
      r = out('ready', 'A 2 ppm ammonia dose reached 0 ammonia and 0 nitrite within 24 h, twice, with nitrate present.',
        { safeToAddFish: true, basis: ['T1', 'T2'] });
    } else {
      r = out('unconfirmed', 'Zeros with nitrate look promising, but the 24 h dose test is not confirmed twice. Not yet safe to say.',
        { basis: ['T1', 'T2'] });
    }
    r.passes = passes;
    r.stale = stale;
    if (stale && r.safeToAddFish) { r.safeToAddFish = false; r.reason += ' The last test is old: retest before adding fish.'; }
    return r;
  }

  const api = { cyclingState, isPass, DOSE_PPM, WINDOW_H, PASSES_NEEDED, STALE_DAYS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Cycling = api;
})(typeof self !== 'undefined' ? self : this);
