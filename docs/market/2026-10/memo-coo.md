# Tankmate - COO memo, round 2 (2026-10-24)

Inputs: round-2 competition.md (SEO, first-run audit, pricing, channels), round-1 COO memo (task 4077; not repeated),
repo at 610265d plus read-only `git show`/`git diff` on the `feat/drive-*` and `ci/*` branches. Live checks 2026-10-24 by `curl`.
Nothing built, deployed, sent or signed up. Not checked: CEO/CFO round-2 memos (absent from out/tankmate/), VPS state, Search Console.
Rule in force: no releases before 2026-10-31, so every launch step is Marc's.

## 1. Release readiness (what changed since round 1)
Pipeline today: `main` -> `.github/workflows/deploy.yml` -> rsync `--delete` to Hetzner (excludes .git .github apple *.md). No test, no smoke.
iOS: `release-appstore-ios.yml`, tag `ios-v*`, stops before review. All round-1 ops fixes now exist as branches; none is merged.
Branch state (all 0 behind `main`, 8-10 ahead): deploy-gate (`scripts/check.sh`, `scripts/smoke.sh`, checks+smoke jobs), check-page (`/check`,
`rules.js`), holiday-page (`/holiday-sitter-sheet`, `holiday.js`), codex-fixes (validation, privacy text), ops-docs (`RUNBOOK.md`,
`drafts/support-page-sla.md`), measure (`MEASUREMENT.md`, `apple/scripts/page-stats.sh`), rules-review, listing-verdict.
Ordered gaps, most launch-relevant first:
1. **First run shows the author's data on every install** (app.js:8-12,26,249 `SEED`; tanks.js:21 and index.html:14 "Fluval Flex 57 L";
   app.js:136-144 feed rota; app.js:176-192 holiday text). grep on `feat/drive-codex-fixes` shows the seed still there: no branch fixes it.
   The iOS app bundles the same files, so an App Review tester and a first buyer see someone else's tank. Release-blocking for the listing's
   honesty (screenshots must match); cheap; independent of Pro.
2. **Merge collisions.** `check-page` and `holiday-page` each rewrite `sw.js` `ASSETS` and `index.html`; `check-page` is at `tankmate-v4`,
   `holiday-page` at `v3`, `main` at `v2`. Expect conflicts in `sw.js` and `index.html` (merge not trialled, to stay read-only). Whoever merges
   second must re-bump `VERSION` (CLAUDE.md gotcha 1) or returning users keep stale pages.
3. **Gate does not scale to a content programme.** `check.sh` verifies only refs in `index.html`; new pages (`/check/`, `/holiday-sitter-sheet/`, six
   symptom pages) are unchecked, and `smoke.sh` tests three fixed paths. Fix in section 4, item 2.
4. **Live site is not indexable.** `/` has a title only; `/sitemap.xml` and `/robots.txt` = HTTP 404; no canonical, no meta description.
5. **Deploy publishes dotfiles.** `curl` 2026-10-24: `/.vikunja` = 200 (holds the Vikunja project URL), `/.gitignore` = 200. Low severity, but the exclude
   list (`.git .github apple *.md`, plus `scripts` on deploy-gate) lacks `.vikunja`, `.gitignore`, `drafts`, `docs`. A new non-md file under `docs/`
   or `drafts/` would go live.
6. **Repo is PUBLIC** (`gh repo view` returned PUBLIC). Branches carrying `docs/market/` (competitor quotes, pricing plans, rule review) become
   public when pushed. Pushing is a gate; decide whether market notes belong in a private Forgejo repo first.
7. Round-1 blockers still open (human): provisioning profile `Tankmate_AppStore`, ASC privacy / Paid Apps Agreement / subscription, 7 GitHub secrets.

## 2. Operations after launch (content-programme additions; round-1 table stands)
| Area | State | Evidence / gap |
|---|---|---|
| Content ownership and refresh | **missing** | No owner or date per page. Rule text will change (NT Labs vs forum advice disagree, research s.3); nothing lists which page quotes which rule. |
| Rule/page drift | **missing** | Prose pages would hand-copy rule wording from `RULES`. A rule fix (RUNBOOK s.2) then leaves a wrong page live. `rules.js` (check-page) is the only single source. |
| Safety disclaimer | **weak** | Proposal in `docs/market/RULES-SAFETY-REVIEW.md` (branch `feat/drive-rules-review`); on no page yet. Every advice page needs it. |
| Search Console, sitemap | **missing** | Human sign-up (DNS TXT at OVH), steps in `MEASUREMENT.md` s.3; no sitemap exists. |
| Traffic counting | **exists (branch)** | `apple/scripts/page-stats.sh` + fixture test on `feat/drive-measure`; VPS log location unverified. |
| Support | **weak** | `support/index.html` live, personal gmail, no promise. SLA diff drafted in `drafts/support-page-sla.md`; alias not created (human). |
| Incident path | **exists (branch)** | `RUNBOOK.md` on `feat/drive-ops-docs`: revert, pull-a-rule, weekly ASC routine. Not on `main`. |
| Monetisation ops | **missing** | Lifetime product, offer codes, affiliate links: no owner, no ledger of what is live in ASC, no disclosure text. |
| Web uptime | **weak** | `smoke.sh` runs after a deploy only; nothing watches the site between deploys. Unverified whether the home-lab monitor covers it. |

## 3. Measurement (complaint or praise -> metric -> where captured)
Constraint unchanged: no tracker in the app or PWA; privacy page says none; ASC "Data Not Collected".
| Signal (round-2 source) | Metric | Capture |
|---|---|---|
| Praise: Tetra "tell if ... all Ok or what you need to do", "traffic light system works" | `/check` unique IPs; install-link IPs / page IPs (target >=5%) | nginx log via `page-stats.sh`; links `/?src=check` |
| Complaint: Tetra camera access 1* (2024-01, 2024-04, 2024-12); JBL "no way to manually read" | Search Console queries containing scan/camera/strip on the no-camera page; reviews or emails asking for a scanner | GSC Performance; ASC reviews; mailbox tally |
| Complaint: AquaticLog caps; Aquarimate "another GBP10/year within 5 seconds" | Paywall views to purchase (<1% at 200 views = revisit); share of first 10 reviews citing price | ASC Subscriptions/Sales; ASC reviews, hand count |
| Gap: cycling coach (Aquarium Manager leads with it) | GSC impressions on "nitrite" / "new tank" queries; support mails mentioning a new tank | GSC; mailbox |
| First run (audit findings 1-4) | Day-1 / Day-7 retention of opted-in iOS users; reviews saying "not my tank" / "example data" | ASC App Analytics (Apple-side, no SDK); ASC reviews |
| Lifetime-vs-yearly test | Lifetime share of Pro units after 20 sales (>50% raise, <10% drop) | ASC Sales by product |
Not measurable: PWA first-run drop-off (data lives in localStorage; the server sees one page load). Stated, not proxied.

## 4. Processes and tools to add (ranked; smallest version that works)
1. **Neutral first run** (release gate, 1.1). Smallest: no `SEED` unless the URL has `?demo`; tank name "My tank" until renamed; Feed and Holiday text
   from fields with empty defaults. Test: a node test that a fresh store has 0 tests and the name is not "Fluval".
2. **One page list drives sitemap, check and smoke.** Smallest: `pages.txt` (one path per line). `scripts/check.sh` asserts each path has
   `<path>/index.html` with `<title>`, meta description and canonical; `smoke.sh` loops the list; a 10-line script writes `sitemap.xml`. Extends deploy-gate.
3. **Merge order with re-bump** as commands (section 5), so conflicts are resolved once. Smallest: the checklist, no tooling.
4. **Deploy excludes:** add `--exclude '.vikunja' --exclude '.gitignore' --exclude drafts --exclude docs`; smoke asserts `/.vikunja` is 404.
5. **Rule-to-page drift check.** Smallest: `check.sh` greps each symptom page for its threshold (e.g. "0.25") and fails if `rules.js` has no matching rule;
   same step requires the disclaimer string on every advice page.
6. **Content ledger** `docs/content-ledger.md`: one row per page (path, rule quoted, source, last reviewed). Review monthly with the ASC routine.
7. **Support alias + SLA** (drafted) and a weekly Vikunja repeating task "ASC reviews + mailbox + GSC" (10 min, `MEASUREMENT.md` s.4).
8. **Uptime monitor:** one keyword check on `/` (verify the existing stack first).
9. **Monetisation ledger:** one table of live ASC products, prices, offer codes.
Not now: affiliate links (sign-up, disclosure, clashes with "no tracking"; research: not worth it under ~1,000 monthly users [E]); a lifetime product
before a build carries a second StoreKit product; a CMS, crash SDK or status page; brand-kit partnership outreach (a gate, and premature).

## 5. Launch-day checklist (H = human click; after 2026-10-31; nothing run; paths from `~/Development/Project/tankmate`)
1. Back up your own localStorage (export in the app), confirm the first-run fix (4.1) is on the branch, then: `node --test apple/WebTests/*.test.js` exit 0.
2. Settle the public-repo question (1.6) before any push: `gh repo view joanmarcriera/tankmate --json visibility -q .visibility`
3. Merge web branches onto `main` one at a time, re-bumping `sw.js` `VERSION` after each conflict; run `scripts/check.sh` after each (deploy-gate first):
   ```sh
   git switch main && git pull --ff-only
   for b in feat/drive-deploy-gate feat/drive-codex-fixes feat/drive-check-page feat/drive-holiday-page; do git merge --no-ff "$b" || break; scripts/check.sh || break; done
   ```
   Stop at the first conflict and resolve by hand; publish nothing until the loop completes. Docs branches (`ops-docs`, `measure`, `rules-review`) last.
4. [H] Publish `main` (this deploys the live PWA): `git push origin main` then `gh run watch --repo joanmarcriera/tankmate`
5. Verify live: `TRIES=5 DELAY=6 scripts/smoke.sh` and
   `for p in / /check/ /holiday-sitter-sheet/ /sitemap.xml /robots.txt /.vikunja; do echo "$p $(curl -s -o /dev/null -w '%{http_code}' https://tankmate.joanmarcriera.es$p)"; done`
   (expect 200 for the first five; 404 for `/.vikunja` once 4.4 is in).
6. [H] Search Console: add property by DNS TXT (`MEASUREMENT.md` s.3), submit `sitemap.xml`, request indexing for `/check/` and the holiday page.
7. [H] Create the support alias, replace `{{SUPPORT_ALIAS}}` (`drafts/support-page-sla.md`), set the same address in ASC; deploy; repeat step 5.
8. [H] iOS path unchanged from round 1 (profile, ASC privacy + Paid Apps Agreement + subscription, 7 secrets, tag `ios-v1.0.0`, TestFlight sandbox purchase).
9. After 7 days: `apple/scripts/page-stats.sh <log>` (fetch per `MEASUREMENT.md` s.1); put the numbers in one Vikunja comment on task 4077; apply section 3 thresholds.
