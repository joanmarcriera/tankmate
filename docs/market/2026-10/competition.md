# Tankmate — competition, round 2: content/SEO, first-run audit, pricing and distribution (2026-10-24)

Round 1 (task 4077 comments, 2026-10-23) covered the competitor set, pricing table, App Store GB quotes, angles and the /check and /holiday pages. This round does not repeat it; it corrects one round-1 claim, adds new competitors and quotes, audits the real first-run, and covers SEO, pricing and channels.

Evidence limits first: Reddit, Fishlore, Reef2Reef and aquariumcoop.com forum pages return 403 to WebFetch; SearXNG on 192.168.0.5:30053 returned nothing for any query; WebSearch returned no Reddit or Hacker News thread for any query. No keyword-volume tool was used, so no search volume is claimed. User voice below is App Store GB review RSS (iTunes, most recent first, fetched 2026-10-24). Forum sentiment remains a gap.

## Product in one paragraph

Tankmate is a local-first, offline aquarium PWA (live at tankmate.joanmarcriera.es, HTTP 200 on 2026-10-24) with a SwiftUI/WKWebView iOS shell in progress. Each water test (NH3, NO2, NO3, KH, pH, GH, temp) returns a colour level, a plain-English meaning and an action; there are trends, a feeding rotation, an incident playbook and a printable holiday sheet. Free tier: one tank, unlimited tests. Pro (£14/yr, task 1962): multi-tank, all-parameter charts and export, per-tank reminders. No account, no server. Source: repo README, CLAUDE.md, app.js.

## Correction to round 1

Round 1 (angle 1) said "no competitor listing read offers per-parameter actions". That is too strong. Found this round:

- Tetra Digital Water Test app (Tetra Aquatics, App Store id 976948241): free; per Practical Fishkeeping it provides "a course of action and an appropriate product" after a test; a reviewer calls it a "traffic light system" (below). https://www.practicalfishkeeping.co.uk/fishkeeping-news/tetra-launches-free-water-test-app/ (article undated).
- Aquarium Manager (id 6790680603, released 2026-07-21, 0 ratings): listing says "a built-in cycling coach tell you exactly when it's safe to add new fish".
- TankSync (id 6746080095, 0 ratings): "AI-powered care recommendations"; a search-result summary of its listing quotes $4.99/mo, $39.99/yr, 3-day trial (not re-checked on the store page).
- App-aquatic (round 1) scans strips and diagnoses.

The accurate claim: guidance exists, but it is brand-tied (Tetra: its strips and products), AI-generated (TankSync, App-aquatic) or has no users yet. A deterministic, explainable rule set with a stated reason and no product push is still unoccupied in what I read. The in-app line "No app does this — that's the point" (index.html, Holiday tab) is about the holiday sheet, and round 1 found no app doing it, but it is an absolute claim; soften it.

## Competitors (new this round; round-1 table still stands)

| Name | Type | Pricing | URL |
|---|---|---|---|
| Tetra Digital Water Test (app "Tetra Aquatics", GB 1.69 stars, 144 ratings) | Brand app, strip scan + advice | Free (sells Tetra strips/products) | https://apps.apple.com/gb/app/id976948241 |
| JBL PROSCAN 2 (GB 5.0 listing rating, reviews below mostly 1 star) | Brand app, card/strip scan | Free app, £20+ kit | https://apps.apple.com/gb/app/id931476590 |
| Aquarium Manager (new, Jul 2026) | Direct, cycling coach | Free, IAP not checked | https://apps.apple.com/gb/app/id6790680603 |
| TankSync | Direct, AI advice | $4.99/mo, $39.99/yr (search summary) | https://apps.apple.com/gb/app/id6746080095 |
| AquaCalc / Aquarium Planner & Tank Math | Indirect, calculators | $0.99 / free with record cap | https://apps.apple.com/us/app/-/id6747986281 |
| Generic care sites (aqueon, aqua-fish.net, enviroliteracy etc.) | Content substitute | Free | search results 2026-10-24 |

## Praise per competitor (new quotes; App Store GB)

| Competitor | Quote | Date |
|---|---|---|
| Tetra Aquatics | "Put your test readings in to the app and tell if you if all Ok or if not what you need to do well done tetra" (haw7128976, 5*) | 2023-01-26 |
| Tetra Aquatics | "the traffic light system works well" ... "the data on the page for each test is good" (Ronjon20304050, 4*) | 2023-01-30 |
| JBL PROSCAN 2 | Fix after bug: "All sorted with the updates. Thank you." (Uncle_Fester, 5*) | 2022-01-28 |

## Complaints per competitor (new quotes; App Store GB)

| Competitor | Quote | Date |
|---|---|---|
| Tetra Aquatics | "Since you updated the app it no longer allows access to the camera. The product is useless without it." (User121314159, 1*) | 2024-04-21 |
| Tetra Aquatics | "The camera still doesn't show up in settings to allow you to grant access. Why hasn't this been fixed yet??" (beckster74, 1*) | 2024-01-22 |
| Tetra Aquatics | "No camera access" (Mr H 71, 1*): "Needs accessible to camera to perform digital tests but option not available" | 2024-12-01 |
| Tetra Aquatics | graph "only displ[ays]..." limited (Ronjon20304050, 4*, truncated by me) | 2023-01-30 |
| JBL PROSCAN 2 | "Nitrate readings are way off every time ... Annoying there is no way to manually read the results." (L 9797, 2*) | 2021-08-17 |
| JBL PROSCAN 2 | "Spent 2 hours trying to get this app to take a single reading ... Do not buy." (Alex.G2001, 1*) | 2023-10-17 |
| JBL PROSCAN 2 | "Why do we need to authenticate once in a while ... my scans are lost" (sergio never, 1*) | 2023-02-14 |
| JBL PROSCAN 2 | "the app tells me my levels are dangerous" while a liquid test disagreed (next app does not work, 1*) | 2021-12-04 |

Reading: the only mass-market app that gives advice is rated 1.69 on 144 ratings, and the reviews are about camera scanning, not about the advice. Camera-scan dependence is the failure; the advice is praised. Manual entry of readings from a liquid kit (what Tankmate does) avoids that failure and JBL's "no way to manually read" complaint. Round 1 quotes (AquaticLog caps, Aquarimate upsell/crash, Fishkeeper login) stand.

## First-run and conversion audit of the real product

Method: read index.html, app.js, tanks.js at commit 610265d (branch feat/ios-pro-price-14); live site fetched 2026-10-24. No browser run, no analytics (none exist), so these are code findings, not measured drop-off.

| # | Finding | Evidence | Effect |
|---|---|---|---|
| 1 | A new user is seeded with Marc's three tests (2025-12-20 NO2 0.5, 2026-05-30, 2026-06-11) | app.js:8-12, :26 `if (!tests) { tests = ... SEED.slice() }` | History and Trends show someone else's tank; a new user cannot tell what is theirs; Trends charts fake data |
| 2 | Tank is named "Fluval Flex 57 L" for everyone | index.html:14, tanks.js:21, app.js:181 | Immediate "not my tank" signal; holiday sheet prints the wrong tank |
| 3 | Feed tab is Marc's pleco/Repashy/Tetra rotation | app.js:136-144, index.html Feed tab | A tetra or betta keeper gets irrelevant instructions; tab is the first thing that looks wrong |
| 4 | Holiday sheet text is hardcoded ("1 pleco tablet + 1 crab loop", "granules in the labelled pot") | app.js:176-192 | The headline feature only fits one setup; needs fields for food and tank |
| 5 | No empty state or intro: the Log form opens with placeholders 0/0/10/7/7.4/25 and no explanation of kit units | index.html:20-30 | pH 7.4 placeholder reads as a default; beginners do not know which kit gives ppm vs dKH |
| 6 | Verdict appears only after "Save & read verdict" | index.html:31 | Good (value in one action) but no sample result before typing |
| 7 | PWA install is not prompted; iOS needs Add to Home Screen by hand | README; no beforeinstallprompt in app.js (grep) | Web visitors rarely return without an install nudge |
| 8 | Live site has no meta description, no canonical, /sitemap.xml and /robots.txt return 404 | `curl` 2026-10-24: title only; 404, 404 | The SEO work (task 4322) is on an unpushed branch, so nothing is indexable beyond the title |
| 9 | Stale `/check/` and `/holiday-sitter-sheet/` return 404 live | curl 2026-10-24 | Expected: both are drafts on branches |

Findings 1-4 are the conversion blockers: they are the first screens, they are Marc's data, and a store reviewer or first user will see them. They are cheap to fix and independent of the Pro decision.

## Where the value is

1. Interpretation is where users ask for help. Round-1 competitors store; the one app with traffic-light advice earns praise for exactly that ("tell if you if all Ok or if not what you need to do"), and its low rating comes from camera scanning. A reachable gap: advice from typed values, no scanner.
2. New-tank cycling is where beginners lose fish and where a new app (Aquarium Manager) now leads its listing. Sources agree adding fish to an uncycled tank is the most lethal beginner mistake (charterhouse-aquatics and gensou.sg guides, 2026-10-24 search). Tankmate has NO2/NH3 rules but no "cycling" mode or "safe to add fish" state; the nitrite rule "colony B behind" is the nearest.
3. Content is a commodity but tool-less: search results for "water test results what to do" are generic care articles and kit-maker leaflets (NT Labs guidance: bacteria product at 0.25-0.5 ppm; water change only at higher values). No free web checker that interprets NH3/NO2/NO3 was found. Also note the sources disagree (water change vs bacteria additive), so the rule wording needs a stated basis.
4. Money: the free field is large (Aquarium Log, Fishkeeper, Aquarium Manager, Tetra, JBL), so payment is for convenience and breadth: AquaticLog $40/yr, TankSync $40/yr, Aquarimate £9.99 + sub. £14/yr stays below both; a one-off option (Reef Trak $9.99, Aquarium Guide ~£20, Aquarimate £9.99) is a credible alternative for a freshwater segment that dislikes subscriptions (round 1 quotes).
5. Channels reachable by one person with no ad budget: search (interpretation pages), the App Store listing itself, forum/Facebook answers by hand (a human action, gate), UK retailers' affiliate programmes (inbound income, not distribution). UK community evidence is weak: one Practical Fishkeeping feature cites a 3,000-member Facebook group (undated); a British Cichlid Association forum shows 13,412 members (undated thread); Practical Fishkeeping runs a closed Facebook "Chat Room". No reliable size ranking found.

## Pricing and packaging experiments (recommendations; nothing changed)

| Experiment | Basis | Smallest test | Stop rule |
|---|---|---|---|
| Keep £14/yr, add a one-off "Pro for life" at about £24.99 after launch | Reef Trak $9.99 and AquaticLog $149.99 lifetime exist; freshwater reviewers resist subscriptions (round 1) | Add a second StoreKit product only in a later build | If lifetime >50% of Pro sales after 20 sales, raise it; if <10%, drop it |
| Paywall only on the second tank or first export, never at launch | Aquarimate "asked for another £10 / year within 5 seconds" (1*, 2021-11-22) | Already in task 4102 audit | Paywall-view to purchase <1% after 200 views: revisit |
| Free tier promise written on the listing: "unlimited tests, no account" | AquaticLog 5/10-per-month cap reviews (1*, 2*, 2026) | Copy in listing draft (task 4102) | None needed |
| Retail affiliate links for test kits and dechlorinator inside Playbook cards | Maidenhead Aquatics (Adtraction), Aquatics Shop UK (Awin, 30-day cookie), Lincs Aquatics (FlexOffers); terms unverified, sign-up is a gate | A draft of placement copy only | Not worth doing below ~1,000 monthly users [E]; conflicts with "no tracking" promise: links must be plain |
| Brand partnership (Tetra/JBL-style kit makers) | Their apps are 1-star camera apps; a manual-entry advice app could pair with a kit | None; outreach is forbidden this week | Revisit after 1,000 installs |

## Angles to win, ranked (new ranking for round 2; round-1 angles 1-5 stand)

| # | Angle | Evidence | Cost to get there |
|---|---|---|---|
| 1 | Fix first-run so the product looks like the buyer's tank (neutral start, name your tank, generic feed/holiday) | Audit findings 1-4; AquaticLog-type reviews show first-session trust matters | S-M: remove seed and hardcoded names, add a first-run card. No new rules |
| 2 | "Water test result checker" plus per-symptom pages, built from the same RULES | Generic care sites, no tool; no free interpreter found; round-1 gap | M, already in task 4100; add 6 static pages (below) |
| 3 | Typed-entry advice, no camera: position against 1.69-star Tetra and JBL scan failures | Camera-permission 1* reviews 2023-2024 | S: one comparison page and listing line; do not name rivals in the store listing (policy), do on the website with sources |
| 4 | New-tank cycling coach ("is it safe to add fish?") | Aquarium Manager leads with it; beginner-mistake guides; Tankmate lacks the state | M-L: needs rule design and safety review (task 4099 outputs first) |
| 5 | Holiday sheet made generic and sold as a seasonal page | Round 1 plus finding 4: today it fits only Marc's tank | M: fields for food/tank, then page 4101 |
| 6 | Lifetime option test | Pricing table | S after launch, needs a build (gate) |
| 7 | Affiliate/partner revenue | Retail programmes exist; terms unverified | Low money, off-strategy now |

## SEO: queries, gaps, the missing page

Queries seen in this round (not volume-tested): "aquarium water test results what to do ammonia nitrite nitrate", "nitrite 0.25 what to do", "first water test 0.25 ammonia now what" (a real aquariumcoop forum thread title, 403 so not fetched), "fish tank sitter instructions printable", "how to cycle a fish tank beginner nitrite spike what to do", "aquarium water change calculator", "aquarium app free no subscription", "aquarium app that tells you what to do".

Who ranks: enviroliteracy.org, aquariumscience.org, pet-abuse.com, fishpondinfo.com, kit-maker pages (NT Labs) and forum threads (aquariumcoop, monsterfishkeepers). These are explanatory, not tools. Calculators are served by app listings (AquaCalc $0.99, Aquarium Planner) and one blog page (diysmarthomehub). App competitors publish comparison and calculator pages (round 1: App-aquatic, Aquarium Tracker).

Content gaps Tankmate can fill with its own rules (each page = reading, meaning, action, "when to retest", disclaimer):
1. /nitrite-0-25-what-to-do, /ammonia-above-zero-what-to-do, /nitrate-rising-how-often-water-change, /low-kh-what-to-do, /cloudy-water-new-tank, /fish-dead-what-to-test: six symptom pages, each embedding the checker pre-filled.
2. /fish-tank-sitter-instructions: the holiday page already planned (4101).
3. /aquarium-app-no-subscription and /tankmate-vs-scanner-apps: comparison pages, claims sourced.
4. /new-tank-cycling-checker (depends on angle 4).

The one missing page remains /check (round 1). The first addition after it is the nitrite page, because "nitrite" queries carry panic intent and the rule already has an action.

Risk: advice pages carry safety liability and rule sources differ (NT Labs vs forum advice). Every page needs a stated basis and the "not veterinary advice" line from task 4099. Publishing is a Marc gate.

## Sources

See sources.md in the same directory.
