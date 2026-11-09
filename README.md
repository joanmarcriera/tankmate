# Tankmate — aquarium co-pilot (working MVP)

A local-first PWA that logs water tests and **tells you what to do** — verdicts, trends, feeding schedule, an incident playbook, and a holiday-handover sheet. The differentiator vs every existing app (AquaticLog, Aquarium Note, etc.): they store numbers and draw graphs; Tankmate gives **judgement**.

Built and smoke-tested 2026-06-24, live at **https://tankmate.joanmarcriera.es/**. Seeded with Marc's real Fluval Flex 57 L data. **No backend, no account, works offline.**

## Run it locally (live check, ~10 seconds)
```bash
python3 -m http.server 8765
# open http://localhost:8765
```
Add to Home Screen on an iPhone/Android to install it as an app.

## Where it runs
Pushing to `main` deploys: `.github/workflows/deploy.yml` rsyncs the repo root to the Hetzner VPS (nginx behind Traefik), excluding `.git`, `.github`, `apple/` and every `*.md` file. No build step, no backend.

The iOS app in `apple/` is a SwiftUI shell around the same web files — see `apple/README.md`. The App Store asks for the [privacy](https://tankmate.joanmarcriera.es/privacy/) and [support](https://tankmate.joanmarcriera.es/support/) pages, which live in `privacy/` and `support/`.

## Layout
```
index.html  app.js  styles.css      the app (5 tabs; verdict engine in app.js)
sw.js  manifest.webmanifest  icon.svg   offline cache + installable PWA
privacy/  support/                  static pages linked from the app footer and the App Store
apple/                              iOS shell (not deployed to the site)
.github/workflows/deploy.yml        push to main → rsync to Hetzner
```

## What's implemented (the moat = encoded domain logic)
- **Verdict engine** — every parameter (NH₃, NO₂, NO₃, KH, pH, GH, temp) returns a colour verdict + plain-English meaning + an action, encoded from Marc's water-chemistry notes (kept outside this repo) (e.g. "KH ≤ 4 → water change today", "NO₂>0 while NH₃=0 → colony B behind").
- **Trends** — nitrate rate in ppm/week (the rate matters more than the reading) + KH watch + a tiny chart.
- **Feeding** — tonight's sinking-rotation item by weekday + the full schedule — Marc's real feeding plan.
- **Incident playbook** — the §5 emergency table as guided cards ("almost every emergency = a partial water change").
- **Holiday handover** — generates a printable, friend-proof sheet (pill-organiser map, "drop in after lights-out, nothing else", photo request). **No competitor does this.**
- Local storage (`tankmate.tests.v1`), offline service worker, installable manifest.
- Privacy and support pages (`privacy/`, `support/`).

## What this MVP is NOT (yet) — the paid fast-follow
Per the brainstorm, these are the Pro tier once there are real users: multi-tank, photo timeline, cloud sync, the AI advisor (point it at Marc's local LLM or a metered API), and the Home Assistant sensor bridge (Marc's unfair advantage). The free tier deliberately keeps the basics free — the #1 complaint about AquaticLog's paywall.

## Honest status
This PWA validates the **product thesis** (judgement, not storage) at £0 cost-to-release. The brainstorm's longer-term recommendation is a Flutter/native build for proper iOS notifications + camera; treat this PWA as the live proof-of-concept and the review-gap pilot (candidate C7). If forum feedback is warm, graduate to native; if it's flat, you've spent £0 finding out.

<!-- vikunja-tracking -->
## Tracking

Vikunja project **65 · Tankmate native (iOS)** — https://familia.riera.co.uk/projects/65
