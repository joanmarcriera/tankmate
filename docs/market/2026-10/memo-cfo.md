# Tankmate CFO memo, round 2 (2026-10-24). Recommendations only: no price changed, nothing bought, nothing signed up.
Tags: [S] sourced (URL/file) · [E] my estimate, assumption stated. Decision on record: Pro = £14/yr (task 1962).
Not repeated: round-1 pricing table, packaging and unit economics (task 4077, comment 4962). This memo updates them with round-2 evidence.
Gaps: no round-2 CEO memo, prospects.md or accounts.csv existed. The "three bets" are my reading of competition.md "Angles to win" #1, #2+3, #4. Re-cost if the CEO names others.

## 1. Competitor pricing table (new or changed since round 1)
| Product | Plan | Price | Billing | Source |
|---|---|---|---|---|
| Tetra Aquatics (Tetra Digital Water Test) | Free, advice after a test, sells strips | £0 | - | https://apps.apple.com/gb/app/id976948241 [S, 144 GB ratings, 1.69*] |
| JBL PROSCAN | Free app, kit needed | £0 app, kit £20+ | - | https://apps.apple.com/gb/app/id931476590 [S app price; kit price from round 1] |
| Aquarimate | Paid app | £9.99 | one-off (+ sub, amount unverified) | https://apps.apple.com/gb/app/aquarimate/id587215055 [S, 96 ratings, 4.28*] |
| Aquarium Log (Ko) | Free | £0 | - | https://apps.apple.com/gb/app/aquarium-log-tank-manager/id1621042664 [S, 40 ratings, 4.85*] |
| Aquarium Manager (new Jul 2026) | Free, IAP not checked | £0 | - | https://apps.apple.com/gb/app/id6790680603 [S, 0 ratings] |
| TankSync | Sub | $4.99/mo, $39.99/yr, 3-day trial | monthly/yearly | https://apps.apple.com/gb/app/id6746080095 [S via search summary only; store page lists Free, 0 ratings] |
| AquaCalc / Planner | Calculator | $0.99 / free with cap | one-off | https://apps.apple.com/us/app/-/id6747986281 [S] |
Rating counts: iTunes lookup API, country=gb, fetched 2026-10-24 [S]: https://itunes.apple.com/lookup?id=976948241,931476590,587215055,614505498,1621042664,6746080095,6790680603&country=gb
Read: the best-known GB aquarium app has only 144 ratings. The UK paid-app pool is small (see §3).

## 2. Our price and packaging
- Keep Pro £14/yr and "no trial, no monthly" [round-1 reasoning stands]. Round 2 adds no reason to change them.
- Free: one tank, unlimited tests, verdict, Feed, Playbook, Holiday sheet. Why: round 2 found the only advice app (Tetra) is free, so a capped or paid verdict would lose the one differentiator [S: competition.md].
- Do NOT put any price or paywall in front of the first-run fixes. Seeded author data (app.js:8-12, :26) and the hardcoded "Fluval Flex 57 L" tank (index.html:14) hurt conversion more than any price point [S: audit]. Fix first.
- Lifetime "Pro for life" ~£24.99 [E: about 1.8× the annual price; Reef Trak $9.99 and AquaticLog $149.99 lifetime exist, S round 1]. A later build, as a second StoreKit product. Rule: add it only after 20 sales of the yearly plan; keep it if lifetime is <50% of sales.
- Web/PWA stays free; no Lemon Squeezy Pro on web this year (no accounts, so no entitlement system; >15 h [E]).
- Affiliate links in Playbook cards: no. Terms unverified and sign-up is a gate. They conflict with the "no tracking" claim and income is trivial below ~1,000 monthly users [E].

## 3. Unit economics (correction and update)
| Line | £/yr | Basis |
|---|---|---|
| Price, UK, VAT-inclusive | 14.00 | [S] task 1962 |
| VAT 20% | -2.33 | [E] 14/1.2; Apple remits as MoR in-app |
| Apple commission 15% | -1.75 | [S] 15% Small Business rate: https://developer.apple.com/app-store/small-business-program/ (≤ $1M prior-year proceeds); [E] that Marc enrols |
| Hosting, LLM, sync | 0.00 | [S] none: static files on the existing VPS, no server per user |
| Support | -0.50 | [E] 2 min/user/yr |
| **Proceeds** | **≈ 9.42** | [E]; gross margin 81% of net-of-VAT, 67% of £14 |
- Correction to round 1: I wrote "Apple drops to 15% after year one regardless of programme" from memory. The Apple page I read says only 15% for the programme and mentions "a further reduced commission of 10%" for subscriptions after year one, ambiguous (EU terms or all). Unverified; confirm in the Paid Apps agreement. The effect is ≤ £0.58/yr per renewing sub [E], so the break-even does not move.
- Without enrolment (30%): proceeds ≈ £7.67 [E]. Enrolment is a Marc gate, a form in ASC.
- Lemon Squeezy fee [S] https://www.lemonsqueezy.com/pricing : 5% + 50¢ per transaction; "transactions made outside of the US may encounter small additional fees"; no subscription surcharge or payout fee listed. On £14 that is about £1.08 (£0.70 + 50¢ at ~$1.31/£ [E] ≈ £0.38) = 7.7%, i.e. proceeds ≈ £10.6 if the £14 is VAT-inclusive [E]. LS looks cheaper than Apple 15% on paper but only the iOS price can sell inside the app (Guideline 3.1.1, TANKMATE-PRO.md). LS is for web or tip jar only.
- **Break-even active subscribers** (proceeds £9.42/yr = £0.785/mo) [E]:
  - £100/month = £1,200/yr → 128 (30% Apple: 157).
  - £500/month = £6,000/yr → 637 (30% Apple: 782).
  - Before income tax and Class 4 NI, which I do not model.
- New demand check [S+E]: GB rating counts above are 144 / 96 / 40 / 24. At a 1-3% rating-to-download rate [E, rule of thumb, no source] the biggest GB aquarium app has ~5,000-15,000 lifetime downloads. A product that wants 128 subscribers at 3% conversion [E] needs ~4,300 installs. That means matching the category leader's lifetime volume within a year, with no ad budget. £100/mo is a stretch target, £500/mo is not reachable on the UK iOS market alone. Needs ≥ 2 levers: non-UK storefronts (priced by tier), lifetime, reef/advanced tier.
- Fixed costs: Apple Developer Programme ~£79/yr [E, $99; already held, sunk]; domain, VPS, TrueNAS sunk. Search Console free [E].

## 4. Cost of the three round-2 bets (hours = Marc plus Claude combined [E]; cash = incremental)
| Bet | Hours | Cash | What it buys | Kill rule |
|---|---|---|---|---|
| A. First-run fix: neutral start, "name your tank", generic Feed and Holiday text (audit findings 1-4) | 5-8 (S-M; remove seed, 2 hardcoded strings, first-run card, tests) | £0 | Removes the "not my tank" first impression and the wrong-tank holiday sheet | None; do it regardless |
| B. SEO: /check plus six symptom pages and one comparison page, all from RULES | 14-18 [E]: pages 1.5 h each plus shared template and rule-basis review | £0 (static files on the VPS); Search Console free | Only organic channel that costs no cash. Zero indexable pages today (/sitemap.xml and /robots.txt = 404, S audit #8) | After 8 weeks live, <200 impressions or <20 installs/mo: stop at 3 pages |
| C. New-tank cycling coach ("safe to add fish?") | 14-20 [E], including the safety review (task 4099 first) | £0 | Matches Aquarium Manager's lead feature; beginners are the highest-pain segment | Skip unless B shows nitrite/cycling pages draw the most impressions |
Total A+B = 19-26 h, £0. Opportunity cost is the real price: at Marc's scarce hours, 26 h ≈ £390 at the £15/h I used in round 1 [E].
Expected return [E, no data, wide]: B at maturity 6 pages × 40 visits/mo × 10% install × 3% Pro = <1 sub/mo. Direct revenue from SEO is small in year one. Its value is installs and reviews. Do not justify B on revenue.

## 5. Revenue hypotheses to test this week
Nothing ships before 2026-10-31 (RULES, Scope 3) and the product has no analytics, so every test is a desk or repo test or a proxy.
| # | Hypothesis | Falsified if | Measurement (unattended) |
|---|---|---|---|
| H1 | The UK paid niche is thin: no paid aquarium app on GB has >500 ratings | Any competitor's GB `userRatingCount` ≥ 500 | `curl itunes.apple.com/lookup?id=…&country=gb`; 2026-10-24 max was 144 (Tetra), so H1 holds today. Re-run Friday |
| H2 | TankSync's $39.99/yr price is real and visible on its store page | The store page shows another price or no IAP | WebFetch https://apps.apple.com/gb/app/id6746080095 and grep for "39.99"; the in-app-purchase list on the page is the evidence |
| H3 | The first screen shows the author's data to a new user | A fresh profile shows no 3 seeded rows | Node/vm test: empty localStorage, load app.js, count `tests` entries (expect 3 now, 0 after fix A). Repo test, exit code |
| H4 | The hardcoded tank name appears in every new user's Holiday sheet | Sheet text contains no "Fluval" for a renamed tank | grep the generated sheet; `grep -n 'Fluval' index.html tanks.js app.js` returns 0 hits after fix A |
| H5 | Apple proceeds ≥ £9 per £14 sub with enrolment | Apple's published rate or VAT treatment gives < £9 | Read the Paid Apps agreement or ASC tax page after sign-in (Marc gate). Until then, [E] |
| H6 | The nitrite page targets a query with a non-generic result set | Top results include a free interactive checker | WebSearch "nitrite 0.25 what to do" and "aquarium water test result checker"; count tool pages vs articles. Round 2 found none |

## 6. Risks
- **Fees:** Lemon Squeezy: "small additional fees" outside the US are undefined [S]; the fixed 50¢ is 2.7% of £14 alone. Apple 15% needs enrolment; if missed, 30%.
- **Refunds/chargebacks:** Apple handles refunds and takes the revenue back. Rate unknown [E 2-5%]; the web (LS) side would also give refund and dispute cost. No data yet.
- **Tax:** Apple remits VAT in-app; payouts still count as UK income (income tax, Class 4 NI, trading allowance £1,000 [E]). Not modelled. Check with an accountant before the first payout. Non-UK storefronts: Apple handles, tier price conversion unverified.
- **Platform rules:** Guideline 4.2 (web-wrapper rejection) is the largest launch risk (COO memo). 3.1.1 forbids the LS checkout in the iOS app. Apple can change the Small Business or subscription rate at any time.
- **Liability:** SEO pages and verdicts about livestock carry safety risk. Sources disagree (NT Labs: bacteria additive at 0.25-0.5 ppm, others: water change), so each page needs a stated basis and the "not veterinary advice" line (task 4099).
- **Concentration:** all revenue depends on one iOS subscription at a 3% conversion guess [E]; if 1% instead, 128 subs needs ~12,800 installs.
- **Forum sentiment unread:** Reddit, Fishlore and aquariumcoop returned 403, so willingness to pay is inferred only from App Store reviews.
