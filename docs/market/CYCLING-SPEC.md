# Cycling state ("is it safe to add fish?") — spec (task 4607)

Status: DRAFT 2026-10-24. Pure module `cycling.js` + `apple/WebTests/cycling.test.js` (17 tests). **Not wired into the UI**, not in the iOS bundle's ASSETS list. Wiring it, any user-facing wording and publishing are Marc gates. Safety review of the wording is task 4099's job and has not happened: this spec is an engineering proposal, not advice text.

Why: Aquarium Manager (App Store id 6790680603, released 2026-07-21) leads its listing with "a built-in cycling coach tell you exactly when it's safe to add new fish" (https://apps.apple.com/gb/app/id6790680603, read 2026-10-24). Adding fish to an uncycled tank is named the most lethal beginner mistake in guides read the same day (https://charterhouse-aquatics.com/blogs/help-guides/25-common-beginner-aquarium-mistakes-and-how-to-avoid-them). Tankmate today has NH3/NO2 rules but no "cycling" state.

## Scope

Fishless-cycle completion only (a new tank, no fish yet). A tank with fish already in it keeps using the existing `RULES` in `app.js`; the module never tells such a tank anything is "safe". Fail closed: `safeToAddFish` is true in exactly one state (`ready`).

## Input

Test records as in `app.js` plus two optional fields: `dose` (ppm ammonia the user added before the test) and `hoursSinceDose` (hours between dose and test). Without them the best the module can say is `unconfirmed`.

## States

| State | Condition (latest test) | safeToAddFish |
|---|---|---|
| `no-data` | no tests, or latest lacks ammonia or nitrite | false |
| `nitrite` | nitrite > 0 (checked first; wins over ammonia) | false |
| `ammonia` | ammonia > 0, nitrite 0 | false |
| `clearing` | ammonia 0, nitrite 0, nitrate not > 0 | false |
| `unconfirmed` | ammonia 0, nitrite 0, nitrate > 0, fewer than 2 passing dose tests | false |
| `ready` | as `unconfirmed` but 2 passing dose tests on different dates, and latest test not stale | **true** |

A **passing dose test** = `dose >= 2` ppm, `hoursSinceDose <= 24`, ammonia 0, nitrite 0, nitrate > 0.

## Thresholds and sources

Each threshold has its source and the date I read it. Fetch limits: aquariumcoop.com, Reddit and thinkfish forum pages returned 403 on 2026-10-24, so forum claims below rest on search-result summaries only, and are marked so.

| ID | Threshold | Source URL | Read | How solid |
|---|---|---|---|---|
| T1 | A 2 ppm ammonia dose must read 0 ammonia and 0 nitrite within 24 h, nitrate present | https://gensou.sg/?p=36222 ("Your cycle is complete only when a full 2 mg/L ammonia dose converts to zero ammonia and zero nitrite ... within 24 hours, with nitrate present") | 2026-10-24, page fetched | One commercial guide. Search summary of other guides (https://forum.aquariumcoop.com/topic/36491-how-to-know-when-cycle-is-done-completely , https://forums.thinkfish.co.uk/fishtank-filtration-and-cycling/fishless-cycling-discussion-thread/) described the same test, 403 on fetch |
| T2 | Repeat the 24 h test twice to confirm (some sources say three days) | https://gensou.sg/?p=36222 ("Do the 24-hour test twice to confirm stability") | 2026-10-24, page fetched | One guide; the stricter "three consecutive days" comes from a search summary only, so the module uses 2 and the number is a constant (`PASSES_NEEDED`) |
| T3 | Ammonia and nitrite target is 0, any reading above is not cycled | https://thefishbarn.co.uk/product/nt-labs-nitrite-test/ ("A level of zero mg/L (ppm) should be maintained at all times") | 2026-10-24, page fetched | Kit-maker text on a retailer page. Matches the existing Tankmate rules for NH3 and NO2 (`app.js`) |
| T4 | Nitrite > 0 means the second bacteria group is behind | https://thefishbarn.co.uk/product/nt-labs-nitrite-test/ (nitrite "can build up in aquariums where there are not sufficient beneficial filter bacteria ... common in new aquariums", search summary of the same text) | 2026-10-24 | Kit-maker text |
| T5 | A latest test older than 3 days withdraws "safe" | **No external source.** Tankmate design choice to fail closed; constant `STALE_DAYS` | 2026-10-24 | Unsourced by design. Marc or the 4099 review should keep, change or drop it |

## Where the advice disagrees (do not hide this in the UI wording)

- **Kit-maker vs fishless guide.** NT Labs (https://thefishbarn.co.uk/product/nt-labs-nitrite-test/, read 2026-10-24): at 0.25–0.5 ppm nitrite "add Filter Starter" (a bacteria product); water change of 25% at 1 ppm and 50% above. The fishless guide (https://gensou.sg/?p=36222) keeps dosing ammonia until the 24 h test passes and uses a large water change (75–80%) only after the cycle is confirmed and before the fish go in. The two treat a nitrite reading differently: one reacts to it, the other treats it as part of the process. The module does not give an action for `nitrite`; it only says "not safe". Which action text to show is a 4099 decision.
- **Fish-in cycling** (adding fish first and managing ammonia with water changes) is a common alternative that this module does not model; I did not find a source I could fetch for it. Out of scope here.
- **Gensou.sg figures** other than T1/T2 (bacteria doubling times, temperature targets) were flagged by the search tool as unverifiable and are not used.

## Open questions for Marc / task 4099 (no decision taken here)

1. Is "2 passes" the right bar, or three?
2. Is a 24 h dose test too demanding for a beginner? The fallback is `unconfirmed`, which never says safe.
3. Wording for each state, and whether to show the bacteria-product vs water-change disagreement to the user.
4. UI: where `dose`/`hoursSinceDose` are entered. Not designed.
5. If wired: add `cycling.js` to `ASSETS` in `apple/scripts/prepare-web-bundle.py` and to `index.html`, and bump `VERSION` in `sw.js`.
