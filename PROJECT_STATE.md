# PROJECT_STATE — Tankmate

Updated 2026-11-10. `main` = 15404ad (merge of `feat/drive-tankmate-2026-10-27`) + this commit, deployed
(run https://github.com/joanmarcriera/tankmate/actions/runs/42722695563 test+deploy success; live sw.js = tankmate-v21;
105 node tests pass; `/.vikunja` and `/CLAUDE.md` now 404).

## PARKED 10 Nov 2026
Parked by Marc's instruction of 10 Nov 2026: not before January 2027. Web is released and live; everything else waits.
Vikunja project 65: open tasks have no dates except https://familia.riera.co.uk/tasks/4106 (4-8 Jan 2027). To un-park Marc supplies:
1. iOS: upload the first TestFlight build and submit it (https://familia.riera.co.uk/tasks/1904).
2. iOS: publish App Privacy "Data Not Collected" in App Store Connect (https://familia.riera.co.uk/tasks/2009).
3. Pro tier: keep the £14/yr price, yes/no (https://familia.riera.co.uk/tasks/1962).
4. Support alias address and the server access-log retention period (https://familia.riera.co.uk/tasks/4973).
5. Yes/no per page branch: `feat/drive-check-page` (/check), `feat/drive-holiday-page` (/holiday-sitter-sheet); both need a rebase on main.
6. Yes/no: CI hardening (`ci/gitleaks-gate`: gitleaks + CSP) and post-deploy smoke test (`feat/drive-deploy-gate`).

## State
- Web PWA live with multi-tank, install nudge, a11y pass, storage hardening, cycling module (not wired to UI).
- Deploy is gated on `node --test apple/WebTests/*.test.js`; rsync uses `--delete --delete-excluded`, so the
  excluded paths (.git, .github, apple, *.md, drafts/, docs/, .vikunja, .claude/) are removed from the web root.
- Unmerged: `/check` and `/holiday` page branches, ios/* and wp/* branches, ci/gitleaks-gate, feat/drive-deploy-gate.
