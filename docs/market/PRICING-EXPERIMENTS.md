# Tankmate Pro — pricing experiments (task 4608)

Status: PLAN, 2026-10-24. Nothing is changed in App Store Connect, no build is released, no price moves. The decision on record stays **Tankmate Pro = £14/yr** (https://familia.riera.co.uk/tasks/1962). Creating any product in App Store Connect, or shipping a build that offers one, is a Marc gate.

Evidence base: round-2 competition notes (https://familia.riera.co.uk/tasks/4077; local copy `claude-config/drives/week-2026-10/market-r2/out/tankmate/competition.md`, read 2026-10-24). Rival prices below come from that file, are search-summary or store-listing figures read on 2026-10-24, and were not all re-checked on the store page; re-check before acting on any of them.

## Measurement rule: no tracking in the app

Tankmate promises no account and no server, so no experiment adds analytics, events or SDKs. All numbers come from **App Store Connect analytics** (Sales and Trends: units, proceeds, subscriptions; App Analytics: product page views, downloads, conversion) which Apple collects itself. The consequence is limits on what can be measured, stated per experiment. Paywall views cannot be counted without in-app events, so "paywall view to purchase" is replaced by "download to paid conversion", which App Store Connect does show. Reading these numbers is a human action in the App Store Connect web UI.

## Baseline

£14/yr subscription `uk.co.riera.tankmate.pro.yearly`, optional 1-month trial still undecided (`apple/docs/TANKMATE-PRO.md`). Free tier: one tank, unlimited tests. Rivals (round 2, 2026-10-24): AquaticLog about $40/yr; TankSync $4.99/mo or $39.99/yr (search summary); Aquarimate £9.99 plus subscription. Lifetime references: Reef Trak $9.99 one-off, AquaticLog $149.99 lifetime. £14/yr sits under the yearly rivals.

## Experiments

### E1. Lifetime SKU ("Pro for life", about £24.99) next to the yearly price

- **Hypothesis:** freshwater hobbyists who dislike subscriptions (round-1 review quotes) will buy a one-off, and it lifts total proceeds without cannibalising the yearly plan.
- **Smallest test:** a second, non-consumable product `uk.co.riera.tankmate.pro.lifetime` shown on the paywall in a later build. **Not in this release.** In this task only the local StoreKit test config gets the product, flagged as disabled (see below); `ProStore.swift` and the paywall are untouched and never request it.
- **Metric:** share of Pro purchases that are lifetime, from Sales and Trends units by product.
- **Minimum sample:** judge only after 20 Pro purchases in total.
- **Stop rules:** if lifetime is more than 50% of Pro sales after 20 sales, raise its price and re-run; if it is under 10%, remove it. If proceeds per download are lower than in the 4 weeks before the SKU appeared (same source), remove it. Do not run it in the same weeks as E2.
- **Limits:** a before/after comparison, not an A/B; seasonality and the listing change confound it. Say so in any conclusion.

### E2. Paywall placement: second tank or first export only, never at launch

- **Hypothesis:** asking for money only at the moment of a Pro need converts better than any earlier prompt. Basis: an Aquarimate 1-star review that "asked for another £10 / year within 5 seconds" (2021-11-22, round-1 quote).
- **Current state:** already the design (`apple/docs/TANKMATE-PRO.md`: free tier is one tank, unlimited tests). No change to test.
- **Metric:** download to paid conversion, and Pro proceeds per 100 first-time downloads, from App Store Connect.
- **Stop rule:** if fewer than 1 in 100 downloads becomes a paid Pro after 500 downloads, revisit the free/Pro split. Do not change the placement, the price and the SKU set at the same time.
- **Limits:** no in-app paywall-view count exists, so view-to-purchase cannot be computed. Do not add it.

### E3. Free-tier promise on the listing ("unlimited tests, no account")

- **Hypothesis:** stating the promise lifts page-view to download conversion, against rivals reported to cap free entries (AquaticLog review dated 2026-01-05: "limited to 5 measurements per month").
- **Smallest test:** copy only, in the listing draft (task 4102). A human submits it.
- **Metric:** product page conversion (App Analytics), compared for the 4 weeks before and after.
- **Stop rule:** none needed, it costs nothing and is true. Revert only if a reviewer rejects the wording.

### E4. Retail affiliate links in Playbook cards

- **Basis:** Maidenhead Aquatics (Adtraction), Aquatics Shop UK (Awin), Lincs Aquatics (FlexOffers); terms unverified. Sign-up is a Marc gate.
- **Stop rule:** do not start below roughly 1,000 monthly users (estimate, no source). Links must be plain links with no tracking parameters, or they break the no-tracking promise; if a programme requires tracking, drop it.

### E5. Brand partnership with a kit maker

- No test. Outreach is out of scope this week. Revisit after 1,000 installs.

## Order

E3 with the first listing (free), then E2 as designed, then E1 only after 20 yearly sales so a baseline exists. E4 and E5 wait on user numbers.

## StoreKit config change in this task: NOT made

The task allowed a disabled `uk.co.riera.tankmate.pro.lifetime` product in `apple/Tankmate.storekit` only if the StoreKit tests still pass. They do not pass on this Mac on 2026-10-24 even with the config untouched: `xcodebuild test -scheme TankmateUnitTests -only-testing:TankmateTests/ProStoreTests` on the iPhone 17 Pro simulator (iOS 26.5) fails its tests with `[SKTestSession] Error ... SKInternalErrorDomain Code=3` and `expected pending, got unavailable`. With the product added, the same run hung until the 560 s limit. With no passing baseline to compare against, the change cannot be shown safe, so `apple/Tankmate.storekit` and all Swift code are unchanged. The product to add later is a non-consumable with the id above at GBP 24.99 (E1); add it only once `ProStoreTests` pass again. The cause of the failure was not investigated (simulator runtime or environment suspected, unverified).
