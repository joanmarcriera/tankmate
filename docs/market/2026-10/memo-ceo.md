# Tankmate CEO memo, round 2 (2026-10-24)
Inputs: out/tankmate/competition.md and sources.md (round 2), repo at 610265d. Nothing here is an outward action.
Evidence limits (inherited): forums 403, SearXNG empty, no keyword volumes, no analytics exist. User voice = App Store GB reviews only.

## Position
For UK freshwater hobbyists who test with a liquid kit, Tankmate is the water-test app that tells you what to do from numbers you type, instead of scanner apps (Tetra, JBL: 1.69 stars on 144 ratings, camera failures) and log-only apps with caps, because the advice is what reviewers praise in those apps and the camera is what fails.

## Three bets this week (ranked)

### 1. Make the first run look like the buyer's tank (before any traffic or review)
- Angle: a new user sees the product, not Marc's tank.
- Evidence: competition.md audit findings 1-4: seeded tests (app.js:8-12, :26), tank "Fluval Flex 57 L" for everyone (index.html:14), Marc's pleco rotation (app.js:136-144), hardcoded holiday text (app.js:176-192). Round-1 AquaticLog cap reviews show first-session trust decides.
- Deliverable: tasks 4602 (neutral state, name-your-tank, empty-state card) and 4603 (generic Feed/Holiday) on one draft branch built on the Pro-web commit 612b39b, with tests. Soften the "No app does this" line (4604).
- Worked if: tests show a fresh profile has zero tests and the typed tank name on screen and on the printed sheet; a grep for "pleco" and "Fluval" in app.js and index.html finds nothing outside a labelled sample.

### 2. One indexable page that answers the panic query: /check, then the nitrite page
- Angle: no free web tool that interprets NH3/NO2/NO3 was found; ranking pages are explainers and kit leaflets.
- Evidence: competition.md SEO section; queries "nitrite 0.25 what to do", "water test results what to do" (volume unmeasured, so a bet, not a forecast). Live site has no meta description; /sitemap.xml and /robots.txt return 404.
- Deliverable: land draft branches 4322 (SEO basics), 4100 (/check) and the 4099 safety wording, then only the nitrite page from 4605. Each page states its rule basis (NT Labs and forum advice disagree) and the disclaimer.
- Worked if: after Marc deploys, Search Console shows 100+ impressions for /check pages within 4 weeks (measurement guide on branch feat/drive-measure). Below that, stop adding pages.

### 3. Position against scanners: typed entry, no camera, no account
- Angle: "Type what your kit says. Unlimited tests, no account."
- Evidence: Tetra camera-access 1* reviews 2024-01-22, 2024-04-21, 2024-12-01; JBL "no way to manually read the results" (2021-08-17); the advice itself is praised (Tetra, 2023-01-26).
- Deliverable: one sourced comparison page draft (4606), rivals named on the website only, never in the store listing; verdict-first listing draft (4102 branch). No new code.
- Worked if: every claim maps to a dated quote in sources.md and the listing draft carries the free-tier promise line.

## Stop / do not build
- Cycling coach build (4607 stays spec and tests only): Aquarium Manager already leads with it, it needs safety review, and bets 1-2 are unfinished.
- Lifetime SKU and any pricing change: one product (£14/yr, task 1962) until paying users exist to measure; 4608 stays a document.
- Affiliate links, brand partnerships, retailer outreach: terms unverified, conflicts with the no-tracking promise, income negligible below roughly 1,000 monthly users [estimate]; outreach is forbidden this week. Drafts only (4609).
- Five more symptom pages: write them only after the nitrite page shows impressions.
- AI advisor, Home Assistant bridge, photo timeline, cloud sync: no user evidence; the deterministic rules are the moat.
- Naming rivals in App Store text: policy risk for no gain.
- Forum or Facebook posting: a human action and a gate; no channel size is verified.

## Release-in-minutes test
Web (main auto-deploys on push, so everything is a draft branch until Marc pushes):
1. Gate/CI first: ci/checks-2026-10-17 and feat/drive-deploy-gate (tests before rsync, post-deploy smoke), then feat/drive-codex-fixes.
2. First-run branch (bet 1) on top of the multi-tank web commit 612b39b, which sits on feat/ios-* branches and not on main.
3. 4322 SEO basics, then feat/drive-check-page, then 4099 wording; the holiday page waits for the generic holiday sheet (4603).
4. Bump VERSION in sw.js, run the static checks, quote the exit code.
5. Marc pushes main (gate). Smoke: HTTP 200 for /, /check/, /sitemap.xml, /robots.txt.
6. Marc submits the sitemap in Search Console (gate).
iOS: after step 2, rebuild the web bundle and run the tests; App Store Connect metadata and submission are Marc's gate (apple/docs/APP-STORE-CONNECT.md). No release this drive.
State today: origin/main = d81fc7d holds none of the above; live /check/ and /holiday-sitter-sheet/ return 404.

## Open questions for Marc
1. Merge the drive branches into main in the order above and push once the first-run fix passes step 4? Recommend yes: it is the first moment the live site is worth sending anyone to.
2. Keep Pro at £14/yr as the only product until about 20 paid users? Recommend yes.
3. Submit the iOS build only after the neutral first-run lands? Recommend yes: a reviewer would otherwise see seeded personal data.
4. Accept NT Labs thresholds with a stated source as the basis of the nitrite page, after the 4099 review? Recommend yes.
5. Post one hand-written answer in a UK fishkeeping group once the page is live? Recommend no for now; wait for Search Console data.
6. Sign up to a UK retailer affiliate programme? Recommend no: below about 1,000 monthly users, and it conflicts with the no-tracking promise.
