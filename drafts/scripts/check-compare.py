#!/usr/bin/env python3
"""check-compare.py - gate for drafts/pages/compare-*.html (task 4606).

Usage: python3 -I drafts/scripts/check-compare.py [pages_dir]

Exit 0 only if (a) at least one compare page exists, (b) every line holding
class="rival-claim" carries an https:// URL and an ISO date, (c) any other line
quoting a star rating or "N ratings" carries an ISO date too.
Prints each failure; exits 1 otherwise.
"""
import glob
import os
import re
import sys

here = os.path.dirname(os.path.abspath(__file__))
root = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, "..", "pages")
files = sorted(glob.glob(os.path.join(root, "compare-*.html")))
bad = []
claims = 0
if not files:
    bad.append("no compare-*.html pages found")
for f in files:
    name = os.path.basename(f)
    with open(f, encoding="utf-8") as fh:
        for n, line in enumerate(fh, 1):
            has_url = re.search(r"https://", line)
            has_date = re.search(r"\b20\d\d-\d\d-\d\d\b", line)
            if 'class="rival-claim"' in line:
                claims += 1
                if not (has_url and has_date):
                    bad.append(f"{name}:{n} rival claim lacks https URL or date")
            elif re.search(r"\d(\.\d+)? (stars?|ratings)\b", line) and not has_date:
                bad.append(f"{name}:{n} rating quoted without a date")
print(f"pages={len(files)} rival_claims={claims} failures={len(bad)}")
for b in bad:
    print("FAIL", b)
sys.exit(1 if bad else 0)
