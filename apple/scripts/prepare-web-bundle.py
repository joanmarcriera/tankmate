#!/usr/bin/env python3
"""Copy the Tankmate web app into the built iOS app bundle.

Usage:  prepare-web-bundle.py <repo-root> <dest-dir>

Run as an Xcode build phase (after Copy Bundle Resources, before code signing)
from apple/project.yml. Also runnable by hand for inspection:

    apple/scripts/prepare-web-bundle.py . /tmp/tankmate-web

Two jobs:

1. Copy the PWA. The files in the repo root are the single source of truth for
   the verdict engine, so nothing is duplicated into apple/ and web and native
   can never drift.

2. Remove the Lemon Squeezy "Buy me a coffee" checkout. App Review Guideline
   3.1.1 forbids an app from steering users to an outside payment flow, so the
   link is REMOVED from the bundled HTML rather than hidden with CSS, exactly as
   Distavo compiles its donate link out of the App Store edition. The script
   asserts afterwards that no trace survives and fails the build if it does —
   "the build went green" must mean the payload is actually clean.

Removing the remote lemon.js also means the bundled app loads nothing from the
network at all, which is what makes the offline story structural.
"""

import re
import shutil
import sys
from pathlib import Path

# sw.js is deliberately NOT bundled: WKWebView does not run service workers for
# custom URL schemes, and the app does not need one — every asset is already
# inside the bundle. app.js already wraps its registration in .catch().
ASSETS = ["index.html", "app.js", "styles.css", "icon.svg", "manifest.webmanifest"]

# Anything matching these must not survive into the bundled HTML.
FORBIDDEN = ["lemonsqueezy", "coffee-btn", "checkout/buy"]

STRIP_PATTERNS = [
    # The footer's checkout anchor.
    re.compile(r"<a\b[^>]*coffee-btn[^>]*>.*?</a>", re.IGNORECASE | re.DOTALL),
    # The Lemon Squeezy overlay script and its HTML comment.
    re.compile(r"<!--[^>]*Lemon Squeezy[^>]*-->\s*", re.IGNORECASE),
    re.compile(r"<script\b[^>]*lemonsqueezy[^>]*>\s*</script>", re.IGNORECASE),
    # The inline script that reveals the button once a real checkout URL exists.
    re.compile(r"<script>(?:(?!</script>).)*coffee-btn(?:(?!</script>).)*</script>",
               re.IGNORECASE | re.DOTALL),
]

# Tidy the separator the removed link used to sit behind ("Made by Marc · ").
DANGLING_SEPARATOR = re.compile(r"\s*[·|]\s*(?=\s*</footer>)", re.IGNORECASE)


def strip_external_checkout(html: str) -> str:
    for pattern in STRIP_PATTERNS:
        html = pattern.sub("", html)
    return DANGLING_SEPARATOR.sub("", html)


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2

    src = Path(argv[1]).resolve()
    dest = Path(argv[2])

    missing = [name for name in ASSETS if not (src / name).is_file()]
    if missing:
        print(f"error: web asset(s) not found in {src}: {', '.join(missing)}", file=sys.stderr)
        return 1

    # Rebuild from scratch so a renamed or deleted asset cannot linger in an
    # incremental build.
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)

    for name in ASSETS:
        if name == "index.html":
            html = strip_external_checkout((src / name).read_text(encoding="utf-8"))
            (dest / name).write_text(html, encoding="utf-8")
        else:
            shutil.copy2(src / name, dest / name)

    # Verify, over the whole bundled payload and not just index.html.
    failures = []
    for path in sorted(dest.rglob("*")):
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for needle in FORBIDDEN:
            if needle.lower() in text.lower():
                failures.append(f"{path.name}: contains '{needle}'")
    if failures:
        print("error: external-payment content survived the strip "
              "(App Review Guideline 3.1.1):", file=sys.stderr)
        for failure in failures:
            print(f"  - {failure}", file=sys.stderr)
        return 1

    print(f"Tankmate web bundle: {len(ASSETS)} files -> {dest} (external checkout removed)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
