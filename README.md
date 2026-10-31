# Tankmate — aquarium co-pilot (working MVP)

A local-first PWA that logs water tests and **tells you what to do** — verdicts, trends, feeding schedule, an incident playbook, and a holiday-handover sheet. The differentiator vs every existing app (AquaticLog, Aquarium Note, etc.): they store numbers and draw graphs; Tankmate gives **judgement**.

Built and smoke-tested 2026-06-24. Seeded with Marc's real Fluval Flex 57 L data. **No server, no account, works offline.**

## Run it locally (live check, ~10 seconds)
```bash
python3 -m http.server 8765
# open http://localhost:8765
```
Add to Home Screen on an iPhone/Android to install it as an app.

## Deployment
Pushing to `main` runs `.github/workflows/deploy.yml`, which rsyncs the repo root to a Hetzner host (nginx behind Traefik) at [tankmate.joanmarcriera.es](https://tankmate.joanmarcriera.es/). No build step: the files go up as they are. `apple/`, `.github/`, `tests/` and every `*.md` are excluded. `.github/workflows/test.yml` runs `node --test 'tests/*.test.mjs'` on pull requests.

## What's implemented (the moat = encoded domain logic)
- **Verdict engine** — every parameter (NH₃, NO₂, NO₃, KH, pH, GH, temp) returns a colour verdict + plain-English meaning + an action (e.g. "KH ≤ 4 → water change today", "NO₂>0 while NH₃=0 → colony B behind").
- **Trends** — nitrate rate in ppm/week (the rate matters more than the reading) + KH watch + a tiny chart.
- **Feeding** — tonight's sinking-rotation item by weekday + the full schedule.
- **Incident playbook** — emergency cards ("almost every emergency = a partial water change").
- **Holiday handover** — generates a printable, friend-proof sheet (pill-organiser map, "drop in after lights-out, nothing else", photo request). **No competitor does this.**
- Local storage, offline service worker, installable manifest.

## What this MVP is NOT (yet) — the paid fast-follow
Per the brainstorm, these are the Pro tier once there are real users: multi-tank, photo timeline, cloud sync, the AI advisor (point it at Marc's local LLM or a metered API), and the Home Assistant sensor bridge (Marc's unfair advantage). The free tier deliberately keeps the basics free — the #1 complaint about AquaticLog's paywall.

## Also in this repo
- **`apple/`** — the iOS app: a SwiftUI + WKWebView shell that bundles this same web app and adds weekly local reminders, a switched-off APNs push path and the App Store listing and run-sheet. See `apple/README.md`.
- **`privacy/`, `support/`** — the privacy and support pages the App Store listing links to.
- **`HANDOFF-*.md`** — session handoff notes; `CLAUDE.md` — working notes for coding agents.

<!-- vikunja-tracking -->
## Tracking

Vikunja project **65 · Tankmate native (iOS)** — https://familia.riera.co.uk/projects/65
