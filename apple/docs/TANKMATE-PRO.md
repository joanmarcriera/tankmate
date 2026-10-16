# Tankmate Pro - design (Vikunja #1962)

Status: design + StoreKit scaffolding. No App Store Connect product exists; creating the
subscription group, product and price is a gate for Marc (see end).

## Offer
One auto-renewing subscription, **Tankmate Pro (yearly)**, target GBP 12-18 per year
(local test config uses 14.99; the real price is Marc's decision). Product id
`uk.co.riera.tankmate.pro.yearly`, subscription group `Tankmate Pro`. No monthly tier at
launch (fewer SKUs, less review surface). Optional 1-month free trial introductory offer.

## Free vs Pro
| Free (forever) | Pro |
|---|---|
| One tank, unlimited tests, verdict engine, Feed, Playbook, Holiday sheet | **Multi-tank** (separate store per tank, tank switcher) |
| One weekly reminder (already built) | **Extra reminders**: per-tank water change, feeding, filter clean, custom interval |
| Basic Trends (nitrate rate, KH) | **Parameter charts**: every parameter, 30/90/365 day range, target bands, CSV/JSON export |

Principle: nothing that exists today is taken away. The verdict engine stays free; it is
the moat and the acquisition hook. Pro sells convenience for people with more than one tank.

## Architecture
- Entitlement lives in native Swift (`Sources/ProStore.swift`, StoreKit 2,
  `Transaction.currentEntitlements`). It is derived, never stored, so editing UserDefaults
  cannot unlock Pro.
- The web app is the single source of truth for logic, so Pro features are built in the web
  app and gated by a flag the native shell injects, next to the existing native bridge in
  `WebAppView.swift`: `window.tankmateNative.isPro` (bool) plus a message
  `tankmateNative.showPaywall()` that opens a SwiftUI `PaywallView` sheet (same pattern as
  the reminders bell). On the PWA the flag is absent, so the PWA stays free-tier and the
  Lemon Squeezy tip jar continues to be stripped only from the iOS bundle.
- Data: multi-tank changes the localStorage key from `tankmate.tests.v1` to
  `tankmate.tank.<id>.tests.v1` with a one-time migration of v1 into tank `default`.
  The key/origin (`tankmate://app/`) must not change (see README).
- Guideline 3.1.1: purchase only through StoreKit inside the app; the external checkout
  stays removed from the bundle. Paywall must show price, period, auto-renew wording, a
  Restore Purchases button, and links to Privacy and Terms (EULA) pages.
- Privacy: StoreKit needs no network code of ours. Update the App Privacy answers only if
  purchase data counts (Apple-collected, not ours): re-check the nutrition label.

## Work breakdown (all Claude-doable up to the gate)
1. [done] `ProStore.swift` + `Tankmate.storekit` local test config + scheme wiring.
2. `PaywallView.swift` + native bridge flag (`isPro`, `showPaywall`).
3. Web: tank model + switcher + migration (app.js), gated by `isPro`.
4. Web: parameter charts for all parameters with range selector.
5. Native: extra reminder types in `ReminderScheduler`, gated by `isPro`.
6. UI tests with the StoreKit test session (`SKTestSession`) for buy / restore / expire.
7. Terms of Use page under `terms/`; update listing.json description and screenshots.

## Gates (need Marc)
- Create the subscription group, the product `uk.co.riera.tankmate.pro.yearly` and its
  price in App Store Connect; it must be submitted alongside a build.
- Paid Apps Agreement + tax/banking in App Store Connect (required before any IAP works).
- Final price and whether to offer a free trial.
