# PROJECT_STATE — Tankmate

Updated 2026-11-09. `main` = c77f454 + this commit, deployed (run 42719572649 success; live sw.js = tankmate-v21; 103 node tests pass).

## State
- Web PWA live with multi-tank, install nudge, a11y pass, storage hardening, cycling module (not wired to UI).
- Deploy is gated on `node --test apple/WebTests/*.test.js`; drafts/docs/.claude are excluded from the rsync.
- Unmerged: `feat/drive-tankmate-2026-10-27` (2 commits: delete already-published excluded paths on deploy; nudge-hook test), `/check` and `/holiday` page branches, ios/* branches.
- `/.vikunja` is still published on the live site (task 5480, needs the 10-27 deploy change).

## Next action (Marc)
1. iOS: TestFlight upload + App Privacy "Data Not Collected" in ASC (tasks 1904, 2009).
2. Decide whether to merge `feat/drive-tankmate-2026-10-27` (rsync --delete-excluded) and the /check, /holiday page branches.
