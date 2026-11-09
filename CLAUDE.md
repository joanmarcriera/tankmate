# Tankmate — local-first aquarium co-pilot PWA

**Purpose:** Local-first Progressive Web App (PWA) for freshwater aquarium maintenance. Logs water tests and returns verdicts + actionable judgements, not just stored numbers. The moat is domain-encoded rules; the business model is free tier + paid features (multi-tank, photo timeline, cloud sync, local LLM advisor, Home Assistant bridge).

**Status:** Live MVP (shipped 2026-06-24, deployed to https://tankmate.joanmarcriera.es/ via Hetzner rsync CI/CD; iOS shell in `apple/`, not yet submitted). Seeded with Marc's real Fluval Flex 57 L data.

---

## How to run locally

```bash
cd tankmate   # the repo root
python3 -m http.server 8765
open http://localhost:8765
```

Add to Home Screen (iOS/Android) to test the installable PWA experience.

No build step needed — all files are served directly.

Tests (no dependencies, Node ≥ 18): `node --test` from the repo root. `tests/harness.js` loads `app.js` and `sw.js` into a Node `vm` with small DOM / cache stubs.

---

## Project layout

```
tankmate/
├── app.js                    # Verdict engine + all UI logic (~220 lines, no deps)
├── index.html               # HTML structure: 5 tabs (Log, Trends, Feed, Playbook, Holiday)
├── styles.css               # Dark theme, color-coded verdicts (good/warn/bad)
├── sw.js                    # Service worker: offline cache, falls back to index.html
├── manifest.webmanifest     # PWA metadata (name, icon, display:standalone)
├── privacy/index.html       # Privacy policy (App Store privacy URL)
├── support/index.html       # Support + FAQ (App Store support URL)
├── icon.svg                 # Single SVG icon (any-sized + maskable)
├── README.md                # Product narrative + deployment paths
├── HANDOFF-*.md             # Session handoffs (not deployed)
├── apple/                   # iOS SwiftUI + WKWebView shell (see apple/README.md; not deployed)
└── .github/workflows/deploy.yml  # GitHub Actions → rsync to Hetzner
```

---

## Core logic

### Verdict Engine (`RULES` in app.js, from line 23)

Each parameter (NH₃, NO₂, NO₃, KH, pH, GH, temp) is evaluated by a rule function returning `{level, tag, meaning, action}`. Levels are ordered `bad → warn → good` on render.

**Example:** `KH ≤ 4 dKH` → level:bad, action: "Water change SAME DAY".

Rules are encoded from real freshwater chemistry + Marc's experience. Edit `RULES` object to adjust verdicts.

### Data Model

```js
const STORE = 'tankmate.tests.v1';  // localStorage key — the only key the app writes
const TANK = 'tankmate.tank.v1';    // declared but not used yet (tank name is hardcoded in index.html)
const SEED = [...];  // initial data (Marc's Fluval Flex history)

// A test record:
{
  date: '2026-06-11',
  nh3: 0, no2: 0, no3: 10, kh: 7, ph: 7.4, gh: null, temp: 25,
  note: 'healthy after 5–6 water changes'
}
```

Tests are appended to array, persisted to localStorage on every save. SEED populates on first visit if localStorage is empty.

### Tabs & Rendering

- **Log:** Form to enter test, shows verdict for latest test, history list.
- **Trends:** Nitrate rate (ppm/week), KH watch, Canvas chart of NO₃ + KH over time.
- **Feed:** Tonight's sinking-rotation item by weekday (hardcoded `ROTATION` array), full schedule.
- **Playbook:** Collapsible emergency cards (e.g. "Ammonia above 0 → water change 25–30%").
- **Holiday:** Generate printable friend-proof handover sheet (pill-organiser map, photo schedule).

---

## Conventions

- **No build, no dependencies, no node_modules.** Static HTML/CSS/JS, service worker registration is inline.
- **XSS safe:** HTML escaping via the `esc()` helper near the top of app.js.
- **Responsive:** `max-width: 680px`, mobile-first, `env(safe-area-inset-bottom)` for notch/home bar.
- **Fixed bottom nav:** 5 icon tabs, `position: fixed; bottom: 0`. Scroll room added via `padding-bottom: 74px` on body.
- **Color coded:** `--good` (green), `--warn` (amber), `--bad` (red) CSS tokens. Dark theme root, no light-mode variant.
- **Canvas chart:** Manually drawn on `#chart` canvas; scales to `clientWidth`, redrawn on window resize.
- **Dates are ISO strings** (`YYYY-MM-DD`); form input type="date" handles parsing.

---

## Deployment

**Local → live:** Push to `main` branch → GitHub Actions `deploy.yml` → rsync to `deploy@joanmarcriera.es:/opt/stacks/core/tankmate/`. SSH key secret: `DEPLOY_SSH_KEY`.

Files deployed as-is (no build); rsync `--delete` excludes `.git`, `.github`, `apple/` and `*.md`. Served by nginx on Hetzner VPS, behind Traefik + Let's Encrypt.

---

## Gotchas & notes

1. **Service worker cache key:** the `VERSION` constant on line 2 of `sw.js`. Bump it to invalidate caches (e.g. on CSS/JS updates).

2. **localStorage scope:** Data is per-origin. If deployed to a new URL, users won't see their old tests. Consider export/import for multi-tank feature later.

3. **Chart memory:** Canvas redraws on every tab switch to Trends. No memoization — acceptable for <100 tests; revisit if it grows.

4. **Playbook is hardcoded:** `PLAYBOOK` array has no UI to add new cards; edit the array to add emergency scenarios.

5. **Feeding rotation is hardcoded:** `ROTATION` array is Marc's real schedule. Multi-tank feature will need customizable schedules.

6. **No validation on test form:** Accepts null or NaN for any parameter; verdict engine skips null/NaN safely. User can submit an empty form.

7. **Holiday handover is a white `.sheet` card** (styles.css). There are no `@media print` rules yet, so `window.print()` prints the whole page including the tab bar; recommend PDF save via the browser print dialog.

8. **Icon is SVG:** Single vector icon used at all sizes via manifest `"sizes": "any"` + `"purpose": "maskable"`. OS may apply background on maskable icon, so test on iOS.

---

## Quick edits

- **Change verdicts:** Edit the `RULES` object in app.js.
- **Change feeding schedule:** Edit the `ROTATION` array in app.js.
- **Add emergency cards:** Add to the `PLAYBOOK` array in app.js.
- **Tweak colors:** Edit CSS tokens in `:root` (top of styles.css).
- **Privacy / support copy:** `privacy/index.html`, `support/index.html`. Every statement in the privacy page must stay true; if the app starts storing or sending anything new, update it, its "Last updated" date, and `apple/Resources/PrivacyInfo.xcprivacy`.
- **Update app name/description:** Edit manifest (manifest.webmanifest:2–4).

---

## Future (paid tier, not built yet)

- Multi-tank support (separate localStorage per tank).
- Photo timeline (store images, link to test dates).
- Cloud sync (optional, user-initiated).
- Local LLM advisor (point at user's Ollama or a metered API).
- Home Assistant sensor bridge (Marc's unfair advantage).

Current MVP is intentionally minimal; these are research-gate features pending real user feedback.
