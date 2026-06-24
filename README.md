# Tankmate — aquarium co-pilot (working MVP)

A local-first PWA that logs water tests and **tells you what to do** — verdicts, trends, feeding schedule, an incident playbook, and a holiday-handover sheet. The differentiator vs every existing app (AquaticLog, Aquarium Note, etc.): they store numbers and draw graphs; Tankmate gives **judgement**.

Built and smoke-tested 2026-06-24. Seeded with Marc's real Fluval Flex 57 L data. **No server, no account, works offline.**

## Run it locally (live check, ~10 seconds)
```bash
cd dist/tankmate
python3 -m http.server 8765
# open http://localhost:8765
```
Add to Home Screen on an iPhone/Android to install it as an app.

## Ship it live for free (recommended first step)
Any static host works — no build step, no backend:
- **Vercel:** drag the `tankmate/` folder onto vercel.com, or `vercel deploy`.
- **Cloudflare Pages / Netlify:** point at this folder.
- **GitHub Pages:** push `tankmate/` to a repo, enable Pages.

That gives you a public URL to drop into Fishlore / r/Aquariums / UK fishkeeping groups for the first real-user feedback — the cheapest possible validation.

## What's implemented (the moat = encoded domain logic)
- **Verdict engine** — every parameter (NH₃, NO₂, NO₃, KH, pH, GH, temp) returns a colour verdict + plain-English meaning + an action, encoded from `Fish tank maintenance/water-chemistry-notes.md` (e.g. "KH ≤ 4 → water change today", "NO₂>0 while NH₃=0 → colony B behind").
- **Trends** — nitrate rate in ppm/week (the rate matters more than the reading) + KH watch + a tiny chart.
- **Feeding** — tonight's sinking-rotation item by weekday + the full schedule, from `feeding-plan.md`.
- **Incident playbook** — the §5 emergency table as guided cards ("almost every emergency = a partial water change").
- **Holiday handover** — generates a printable, friend-proof sheet (pill-organiser map, "drop in after lights-out, nothing else", photo request). **No competitor does this.**
- Local storage, offline service worker, installable manifest.

## What this MVP is NOT (yet) — the paid fast-follow
Per the brainstorm, these are the Pro tier once there are real users: multi-tank, photo timeline, cloud sync, the AI advisor (point it at Marc's local LLM or a metered API), and the Home Assistant sensor bridge (Marc's unfair advantage). The free tier deliberately keeps the basics free — the #1 complaint about AquaticLog's paywall.

## Honest status
This PWA validates the **product thesis** (judgement, not storage) at £0 cost-to-release. The brainstorm's longer-term recommendation is a Flutter/native build for proper iOS notifications + camera; treat this PWA as the live proof-of-concept and the review-gap pilot (candidate C7). If forum feedback is warm, graduate to native; if it's flat, you've spent £0 finding out.
